import { Router } from "express";
import type Stripe from "stripe";
import { db, usersTable, appointmentsTable, paymentsTable, stylistProfilesTable, servicesTable, conversationsTable } from "@workspace/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth } from "../lib/auth";
import { getUncachableStripeClient } from "../stripeClient";
import { logger } from "../lib/logger";
import { isValidSlot, isUniqueViolation } from "../lib/bookingValidation";
import { fulfillCheckoutSession } from "../lib/paymentHelpers";
import { sendNotification } from "../lib/notifications";

const router = Router();

// ─── Checkout ───────────────────────────────────────────────────────────────

/**
 * POST /stripe/checkout
 *
 * Creates a Stripe Checkout session.
 *
 * Body:
 *   stylistId, serviceId, date, time        — required
 *   notes                                   — optional
 *   isTeamBooking                           — optional boolean
 *   paymentMode: 'full'|'deposit'           — default 'full'
 *   depositPct: number                      — % to charge now (default 50), only for 'deposit'
 *   tipAmount: number                       — ZAR tip added to checkout
 */
router.post("/stripe/checkout", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const {
    stylistId,
    serviceId,
    date,
    time,
    notes,
    isTeamBooking,
    paymentMode = "full",
    depositPct = 50,
    tipAmount = 0,
  } = req.body;

  if (!stylistId || !serviceId || !date || !time) {
    res.status(400).json({ error: "Missing required fields: stylistId, serviceId, date, time" });
    return;
  }

  if (!["full", "deposit"].includes(paymentMode)) {
    res.status(400).json({ error: "Invalid paymentMode. Use 'full' or 'deposit'." });
    return;
  }

  const slotCheck = isValidSlot(date, time);
  if (!slotCheck.ok) {
    res.status(400).json({ error: slotCheck.error });
    return;
  }

  const [profile] = await db.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.id, stylistId));
  const [service] = await db.select().from(servicesTable).where(eq(servicesTable.id, serviceId));
  if (!profile || !service) {
    res.status(404).json({ error: "Stylist or service not found" });
    return;
  }

  // Early conflict check — only CONFIRMED appointments block a slot.
  // Pending appointments are "in-flight" checkout sessions; they are released
  // automatically if payment fails/expires, so they must not block new bookings.
  const activeConflict = await db.select().from(appointmentsTable).where(
    and(
      eq(appointmentsTable.stylistId, stylistId),
      eq(appointmentsTable.date, date),
      eq(appointmentsTable.time, time),
    )
  );
  if (activeConflict.some((a) => a.status === "confirmed")) {
    res.status(409).json({ error: "This time slot is no longer available. Please choose another time." });
    return;
  }

  // ── Stripe Checkout ─────────────────────────────────────────────────────
  const stripe = await getUncachableStripeClient();

  // Find or create Stripe customer
  let [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
  let customerId = dbUser?.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: { userId: user.id },
    });
    customerId = customer.id;
    await db.update(usersTable).set({ stripeCustomerId: customerId }).where(eq(usersTable.id, user.id));
  }

  const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;

  // Compute charge amount
  const servicePrice = Number(service.price);
  let chargeAmount = servicePrice;
  let actualDepositPct = 0;
  if (paymentMode === "deposit") {
    actualDepositPct = Math.min(Math.max(Number(depositPct), 1), 99);
    chargeAmount = Math.round((servicePrice * actualDepositPct / 100) * 100) / 100;
  }
  const tipAmountNum = Math.max(0, Number(tipAmount) || 0);

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      price_data: {
        currency: "zar",
        unit_amount: Math.round(chargeAmount * 100),
        product_data: {
          name: paymentMode === "deposit"
            ? `${service.name} with ${profile.name} — ${actualDepositPct}% Deposit`
            : `${service.name} with ${profile.name}`,
          description: `${service.duration} min appointment on ${date} at ${time}`,
        },
      },
      quantity: 1,
    },
  ];

  if (tipAmountNum > 0) {
    lineItems.push({
      price_data: {
        currency: "zar",
        unit_amount: Math.round(tipAmountNum * 100),
        product_data: {
          name: "Tip",
          description: `Tip for ${profile.name}`,
        },
      },
      quantity: 1,
    });
  }

  const successParams = new URLSearchParams({
    stylistId,
    serviceId,
    date,
    time,
    ...(notes ? { notes } : {}),
  });

  // Pending appointment created BEFORE user enters payment details.
  // This ensures there is always a visible, retryable record in the user's
  // history even if payment fails. Slot conflict only blocks "confirmed"
  // appointments so this soft reservation doesn't prevent other checkouts.
  let pendingAppt: typeof appointmentsTable.$inferSelect | null = null;
  try {
    const depositAmountNum = actualDepositPct > 0
      ? Math.round((servicePrice * actualDepositPct / 100) * 100) / 100
      : 0;
    const balanceDueNum = actualDepositPct > 0
      ? Math.round((servicePrice - depositAmountNum) * 100) / 100
      : 0;
    [pendingAppt] = await db.insert(appointmentsTable).values({
      id: randomUUID(),
      clientId: user.id,
      clientName: user.name,
      stylistId,
      stylistName: profile.name,
      serviceId,
      serviceName: service.name,
      date,
      time,
      status: "pending",
      price: service.price,
      duration: service.duration,
      notes: notes || null,
      stripeSessionId: null, // updated after session creation
      paymentMode,
      depositAmount: depositAmountNum,
      tipAmount: tipAmountNum,
      balanceDue: balanceDueNum,
      isTeamBooking: !!isTeamBooking,
    }).returning();
  } catch (err) {
    // Non-fatal — checkout can still proceed; fulfillCheckoutSession will insert if needed
    logger.warn({ err }, "Could not pre-create pending appointment — proceeding to checkout");
  }

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    customer: customerId ?? undefined,
    customer_email: !customerId ? user.email : undefined, // for email receipt when no Stripe customer obj
    line_items: lineItems,
    mode: "payment",
    allow_promotion_codes: true,
    // receipt_email goes inside payment_intent_data for Checkout Sessions
    payment_intent_data: {
      receipt_email: user.email, // Stripe sends email receipt on payment success
    },
    success_url: `${baseUrl}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/book/${stylistId}`,
    metadata: {
      userId: user.id,
      stylistId,
      serviceId,
      date,
      time,
      notes: notes ?? "",
      paymentMode,
      depositPct: String(actualDepositPct),
      tipAmount: String(tipAmountNum),
      isTeamBooking: isTeamBooking ? "true" : "false",
      ...(pendingAppt ? { pendingAppointmentId: pendingAppt.id } : {}),
    },
  };
  const session = await stripe.checkout.sessions.create(sessionParams);

  // Link the pending appointment to this session so it can be found on failure
  if (pendingAppt) {
    await db.update(appointmentsTable)
      .set({ stripeSessionId: session.id })
      .where(eq(appointmentsTable.id, pendingAppt.id));
  }

  res.json({ url: session.url });
});

// ─── Confirm Booking (client-side redirect after Stripe) ────────────────────

/**
 * POST /stripe/confirm-booking
 *
 * Called from the success page after Stripe redirects back. Verifies payment
 * and creates the appointment + payment record. Idempotent.
 */
router.post("/stripe/confirm-booking", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { sessionId } = req.body;

  if (!sessionId) {
    res.status(400).json({ error: "Missing sessionId" });
    return;
  }

  const stripe = await getUncachableStripeClient();

  try {
    const result = await fulfillCheckoutSession(stripe, sessionId, user.id);
    res.status(result.alreadyExisted ? 200 : 201).json({
      ...result.appointment,
      conversationId: result.conversationId,
      payment: result.payment,
    });
  } catch (err: any) {
    if (err.code === "payment_not_completed") {
      res.status(402).json({ error: "Payment not completed" });
    } else if (err.code === "bad_metadata") {
      res.status(400).json({ error: "Missing booking metadata in session" });
    } else if (err.code === "forbidden") {
      res.status(403).json({ error: "This checkout session does not belong to you" });
    } else if (err.code === "not_found") {
      res.status(404).json({ error: "Stylist or service not found" });
    } else if (err.code === "invalid_slot") {
      res.status(400).json({ error: err.message });
    } else if (err.code === "conflict") {
      res.status(409).json({
        error: "This time slot was booked by someone else while your payment was processing. Please contact support for a refund.",
      });
    } else {
      logger.error({ err, sessionId }, "Error confirming booking");
      throw err;
    }
  }
});

// ─── Payment History ─────────────────────────────────────────────────────────

/**
 * GET /stripe/payments
 *
 * Returns a combined list of appointments + associated payment records for
 * the current user, ordered by most-recent-first.
 */
router.get("/stripe/payments", requireAuth, async (req, res) => {
  const user = (req as any).user;

  const appointments = await db.select().from(appointmentsTable)
    .where(eq(appointmentsTable.clientId, user.id))
    .orderBy(desc(appointmentsTable.createdAt));

  const appointmentIds = appointments.map((a) => a.id);
  if (appointmentIds.length === 0) {
    res.json([]);
    return;
  }

  const allPayments = await db.select().from(paymentsTable)
    .orderBy(desc(paymentsTable.createdAt));

  const paymentMap = new Map<string, typeof paymentsTable.$inferSelect>();
  for (const p of allPayments) {
    if (p.appointmentId && !paymentMap.has(p.appointmentId)) {
      paymentMap.set(p.appointmentId, p);
    }
  }

  const result = appointments.map((appt) => ({
    ...appt,
    payment: paymentMap.get(appt.id) ?? null,
  }));

  res.json(result);
});

// ─── Receipt ─────────────────────────────────────────────────────────────────

/**
 * GET /stripe/payments/:appointmentId/receipt
 *
 * Returns detailed receipt info for an appointment, including Stripe
 * hosted receipt URL if available.
 */
router.get("/stripe/payments/:appointmentId/receipt", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { appointmentId } = req.params;

  const appts = await db.select().from(appointmentsTable)
    .where(and(eq(appointmentsTable.id, appointmentId as string), eq(appointmentsTable.clientId, String(user.id))));
  const appt = appts[0];
  if (!appt) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  const payments = await db.select().from(paymentsTable)
    .where(eq(paymentsTable.appointmentId, appointmentId as string));
  const payment = payments[0];

  let hostedReceiptUrl: string | null = null;
  if (payment?.stripePaymentIntentId && appt.paymentMode !== "pay_at_appointment") {
    try {
      const stripe = await getUncachableStripeClient();
      const charges = await stripe.charges.list({ payment_intent: payment.stripePaymentIntentId, limit: 1 });
      hostedReceiptUrl = charges.data[0]?.receipt_url ?? null;
    } catch { /* non-fatal */ }
  }

  res.json({
    appointment: appt,
    payment: payment ?? null,
    hostedReceiptUrl,
  });
});

// ─── Refund ──────────────────────────────────────────────────────────────────

/**
 * POST /stripe/refund
 *
 * Issues a full or partial refund for a payment. Only the client who owns
 * the booking, or a stylist on the booking, can request a refund.
 *
 * Body:
 *   appointmentId  — required
 *   amount         — optional ZAR amount (omit for full refund)
 *   reason         — optional: 'duplicate', 'fraudulent', 'requested_by_customer'
 */
router.post("/stripe/refund", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { appointmentId, amount, reason } = req.body;

  if (!appointmentId) {
    res.status(400).json({ error: "Missing appointmentId" });
    return;
  }

  const [appt] = await db.select().from(appointmentsTable)
    .where(eq(appointmentsTable.id, appointmentId));
  if (!appt) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  // Only the client or the lead stylist can request refunds
  const isStylist = appt.stylistId === user.id;
  const isClient = appt.clientId === user.id;
  const isStylistByProfile = !isStylist && !isClient
    ? await db.select().from(stylistProfilesTable)
        .where(and(eq(stylistProfilesTable.id, appt.stylistId), eq(stylistProfilesTable.userId, user.id)))
        .then((rows) => rows.length > 0)
    : false;

  if (!isClient && !isStylist && !isStylistByProfile) {
    res.status(403).json({ error: "You are not authorized to refund this booking" });
    return;
  }

  // Select the most recent refundable payment for this appointment.
  // Include both "succeeded" (no refunds yet) and "partial_refunded" (partially
  // refunded, more still available) so stylists can issue multiple partial refunds.
  // Ordering by createdAt DESC ensures we refund the correct charge when
  // multiple payment records exist (e.g., after a retry).
  const paymentRows = await db.select().from(paymentsTable)
    .where(and(
      eq(paymentsTable.appointmentId, appointmentId),
      inArray(paymentsTable.status, ["succeeded", "partial_refunded"]),
    ))
    .orderBy(desc(paymentsTable.createdAt));

  const payment = paymentRows[0] ?? null;

  if (!payment) {
    res.status(400).json({ error: "No successful payment record found for this appointment. Pay-at-appointment or failed bookings cannot be refunded here." });
    return;
  }

  if (payment.status === "refunded") {
    res.status(409).json({ error: "This payment has already been fully refunded" });
    return;
  }

  const alreadyRefunded = payment.refundedAmount ?? 0;
  const refundable = payment.amount - alreadyRefunded;

  if (refundable <= 0) {
    res.status(409).json({ error: "Nothing left to refund" });
    return;
  }

  const refundAmountZAR = amount ? Math.min(Number(amount), refundable) : refundable;
  const refundAmountCents = Math.round(refundAmountZAR * 100);

  if (!payment.stripePaymentIntentId) {
    res.status(400).json({ error: "No Stripe payment intent on record — cannot issue refund automatically" });
    return;
  }

  const stripe = await getUncachableStripeClient();

  // Client must supply a stable idempotency key generated once per UI refund action.
  // The same key is reused on network-level retries of the same intent, preventing
  // duplicate refunds. A new key is generated for each new distinct refund action.
  const clientKey: string = typeof req.body.idempotencyKey === "string" && req.body.idempotencyKey
    ? req.body.idempotencyKey
    : randomUUID(); // fallback for callers that don't supply one
  const refundIdempotencyKey = `refund-${payment.id}-${clientKey}`;

  const refund = await stripe.refunds.create(
    {
      payment_intent: payment.stripePaymentIntentId,
      amount: refundAmountCents,
      ...(reason ? { reason: reason as any } : {}),
    },
    { idempotencyKey: refundIdempotencyKey }
  );

  if (refund.status === "failed") {
    res.status(502).json({ error: "Stripe refund failed. Please try again or contact support." });
    return;
  }

  // Fetch the authoritative refunded total from Stripe rather than incrementing
  // locally — this guarantees the DB reflects Stripe's ground truth even if
  // there are concurrent refund operations or network retries.
  let newRefundedTotal = alreadyRefunded + refundAmountZAR;
  try {
    const charges = await stripe.charges.list({
      payment_intent: payment.stripePaymentIntentId,
      limit: 1,
    });
    if (charges.data[0]) {
      newRefundedTotal = charges.data[0].amount_refunded / 100;
    }
  } catch {
    // If the charge fetch fails, fall back to the locally-computed value — still
    // better than aborting the whole refund response.
    logger.warn({ paymentId: payment.id }, "Could not fetch authoritative refunded total from Stripe — using computed value");
  }

  const isFullRefund = newRefundedTotal >= payment.amount - 0.01;
  const newStatus = isFullRefund ? "refunded" : "partial_refunded";

  await db.update(paymentsTable)
    .set({ refundedAmount: newRefundedTotal, status: newStatus })
    .where(eq(paymentsTable.id, payment.id));

  if (isFullRefund) {
    await db.update(appointmentsTable)
      .set({ status: "cancelled" })
      .where(eq(appointmentsTable.id, appointmentId));
  }

  logger.info(
    { appointmentId, paymentId: payment.id, refundAmountZAR, newRefundedTotal, isFullRefund },
    "Refund issued"
  );

  res.json({
    refundId: refund.id,
    refundedAmount: refundAmountZAR,
    totalRefunded: newRefundedTotal,
    status: newStatus,
    isFullRefund,
  });
});

// ─── Stylist Payment History ─────────────────────────────────────────────────

/**
 * GET /stripe/stylist-payments
 *
 * Returns a combined list of appointments + associated payment records for
 * the current stylist (appointments where they are the artist), ordered by
 * most-recent-first.
 */
router.get("/stripe/stylist-payments", requireAuth, async (req, res) => {
  const user = (req as any).user;

  // Resolve the stylist profile id for this user
  const profileRows = await db
    .select()
    .from(stylistProfilesTable)
    .where(eq(stylistProfilesTable.userId, user.id))
    .limit(1);
  const profile = profileRows[0];

  if (!profile) {
    res.json([]);
    return;
  }

  const appointments = await db
    .select()
    .from(appointmentsTable)
    .where(eq(appointmentsTable.stylistId, profile.id))
    .orderBy(desc(appointmentsTable.createdAt));

  if (appointments.length === 0) {
    res.json([]);
    return;
  }

  const appointmentIds = appointments.map((a) => a.id);
  const allPayments = await db
    .select()
    .from(paymentsTable)
    .orderBy(desc(paymentsTable.createdAt));

  const paymentMap = new Map<string, typeof paymentsTable.$inferSelect>();
  for (const p of allPayments) {
    if (p.appointmentId && appointmentIds.includes(p.appointmentId) && !paymentMap.has(p.appointmentId)) {
      paymentMap.set(p.appointmentId, p);
    }
  }

  const result = appointments.map((appt) => ({
    id: appt.id,
    clientId: appt.clientId,
    clientName: appt.clientName,
    stylistId: appt.stylistId,
    stylistName: appt.stylistName,
    serviceId: appt.serviceId,
    serviceName: appt.serviceName,
    date: appt.date,
    time: appt.time,
    status: appt.status,
    price: appt.price,
    paymentMode: appt.paymentMode,
    depositAmount: appt.depositAmount,
    tipAmount: appt.tipAmount,
    balanceDue: appt.balanceDue,
    payoutStatus: appt.payoutStatus,
    artistPayoutAmount: appt.artistPayoutAmount,
    stripeSessionId: appt.stripeSessionId,
    createdAt: appt.createdAt.toISOString(),
    payment: paymentMap.get(appt.id) ?? null,
  }));

  res.json(result);
});

// ─── Retry Checkout ──────────────────────────────────────────────────────────

/**
 * POST /stripe/retry-checkout
 *
 * Re-creates a Stripe Checkout session for an appointment whose payment failed.
 * The original appointment record is reused; a new session is created so the
 * customer can complete payment without re-booking.
 *
 * Body: { appointmentId }
 * Returns: { url } — Stripe Checkout redirect URL
 */
router.post("/stripe/retry-checkout", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { appointmentId } = req.body;

  if (!appointmentId) {
    res.status(400).json({ error: "Missing appointmentId" });
    return;
  }

  const [appt] = await db.select().from(appointmentsTable)
    .where(and(eq(appointmentsTable.id, appointmentId), eq(appointmentsTable.clientId, user.id)));

  if (!appt) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  if (appt.paymentMode === "pay_at_appointment") {
    res.status(400).json({ error: "Pay-at-appointment bookings do not require a Stripe payment retry" });
    return;
  }

  // Check whether ANY succeeded payment exists for this appointment.
  // Using a status filter + count rather than relying on the first arbitrary row,
  // which could be an older failed record — and miss a later success.
  const succeededPayments = await db.select().from(paymentsTable)
    .where(and(
      eq(paymentsTable.appointmentId, appointmentId),
      eq(paymentsTable.status, "succeeded"),
    ));

  if (succeededPayments.length > 0) {
    res.status(409).json({ error: "This appointment already has a successful payment and cannot be retried" });
    return;
  }

  const [service] = await db.select().from(servicesTable)
    .where(eq(servicesTable.id, appt.serviceId));
  const [profile] = await db.select().from(stylistProfilesTable)
    .where(eq(stylistProfilesTable.id, appt.stylistId));

  if (!service || !profile) {
    res.status(404).json({ error: "Appointment references a deleted service or stylist" });
    return;
  }

  const stripe = await getUncachableStripeClient();

  // Use the appointment's stored amounts (locked at booking time).
  // For a deposit retry: charge the original deposit amount (what the customer
  // initially owed), NOT balanceDue — that's the remaining balance collected
  // separately after a successful deposit. Charging balanceDue on a retry
  // would overcharge by ~70% on a 30% deposit.
  const retryServiceAmount = appt.paymentMode === "deposit"
    ? appt.depositAmount  // original deposit (e.g. 30% of price)
    : appt.price;         // full payment

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      price_data: {
        currency: "zar",
        product_data: {
          name: appt.serviceName,
          description: `with ${appt.stylistName} on ${appt.date} at ${appt.time}${
            appt.paymentMode === "deposit" && appt.balanceDue > 0 ? " (balance due)" : ""
          }`,
        },
        unit_amount: Math.round(retryServiceAmount * 100),
      },
      quantity: 1,
    },
  ];

  if (appt.tipAmount > 0) {
    lineItems.push({
      price_data: {
        currency: "zar",
        product_data: { name: "Tip" },
        unit_amount: Math.round(appt.tipAmount * 100),
      },
      quantity: 1,
    });
  }

  const [stripeUserRow] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
  if (!stripeUserRow) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Ensure Stripe customer exists
  let customerId: string | undefined;
  try {
    const customers = await stripe.customers.list({ email: stripeUserRow.email, limit: 1 });
    if (customers.data[0]) {
      customerId = customers.data[0].id;
    } else {
      const customer = await stripe.customers.create({ email: stripeUserRow.email, name: stripeUserRow.name });
      customerId = customer.id;
    }
  } catch { /* non-fatal — proceed without customer */ }

  const origin = req.headers.origin ?? `https://${req.headers.host}`;
  const basePath = process.env.VITE_BASE_URL ?? "";

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    line_items: lineItems,
    mode: "payment",
    success_url: `${origin}${basePath}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}${basePath}/payments`,
    allow_promotion_codes: true,
    metadata: {
      userId: user.id,
      stylistId: appt.stylistId,
      serviceId: appt.serviceId,
      date: appt.date,
      time: appt.time,
      paymentMode: appt.paymentMode,
      tipAmount: String(appt.tipAmount),
      depositPct: "0",
      retryForAppointmentId: appointmentId,
    },
  });

  logger.info({ appointmentId, sessionId: session.id }, "Retry checkout session created");
  res.json({ url: session.url });
});

export default router;
