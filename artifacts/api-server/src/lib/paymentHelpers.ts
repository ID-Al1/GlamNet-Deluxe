import { randomUUID } from "crypto";
import { db, appointmentsTable, paymentsTable, stylistProfilesTable, servicesTable, usersTable, conversationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { isValidSlot, isUniqueViolation } from "./bookingValidation";
import { holdEscrow } from "./escrow";
import { sendNotification } from "./notifications";
import { logger } from "./logger";
import type Stripe from "stripe";

export interface FulfillResult {
  appointment: typeof appointmentsTable.$inferSelect;
  payment: typeof paymentsTable.$inferSelect | null;
  conversationId: string | null;
  alreadyExisted: boolean;
}

/**
 * Shared logic for creating an appointment and payment record from a
 * confirmed Stripe checkout session. Idempotent: if the appointment already
 * exists for this session ID it is returned immediately without re-creating.
 *
 * Called by both the HTTP confirm-booking endpoint (client-side redirect)
 * and the webhook handler (server-side, for reliability).
 */
export async function fulfillCheckoutSession(
  stripe: Stripe,
  sessionId: string,
  ownerUserId?: string,
): Promise<FulfillResult> {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["total_details.breakdown"],
  });

  if (session.payment_status !== "paid") {
    throw Object.assign(new Error("Payment not completed"), { code: "payment_not_completed" });
  }

  const {
    userId, stylistId, serviceId, date, time, notes, paymentMode, tipAmount, depositPct,
    retryForAppointmentId,
  } = session.metadata ?? {};

  if (ownerUserId && userId && userId !== ownerUserId) {
    throw Object.assign(new Error("Session does not belong to this user"), { code: "forbidden" });
  }

  // Compute amounts from the session (authoritative)
  const amountPaid = (session.amount_total ?? 0) / 100;
  const totalDetails = session.total_details as any;
  const discountAmount = totalDetails?.amount_discount ? totalDetails.amount_discount / 100 : 0;
  const couponCode = totalDetails?.breakdown?.discounts?.[0]?.discount?.coupon?.id ?? null;
  const paymentIntentId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id ?? null;
  const tipAmountNum = tipAmount ? parseFloat(tipAmount) : 0;

  // ── RETRY PATH ────────────────────────────────────────────────────────────
  // When retryForAppointmentId is set, this session is a retry for an existing
  // appointment whose previous payment failed. Update that appointment in-place
  // instead of inserting a new one.
  if (retryForAppointmentId) {
    // Idempotency: if this session already linked to the appointment, return it
    const alreadyLinked = await db.select().from(appointmentsTable)
      .where(eq(appointmentsTable.stripeSessionId, sessionId));
    if (alreadyLinked.length > 0) {
      const appt = alreadyLinked[0];
      const [existingPayment] = await db.select().from(paymentsTable)
        .where(eq(paymentsTable.stripeSessionId, sessionId));
      const existingConv = await db.select().from(conversationsTable)
        .where(and(eq(conversationsTable.clientId, appt.clientId), eq(conversationsTable.stylistId, appt.stylistId)));
      return { appointment: appt, payment: existingPayment ?? null, conversationId: existingConv[0]?.id ?? null, alreadyExisted: true };
    }

    const [retryAppt] = await db.select().from(appointmentsTable)
      .where(eq(appointmentsTable.id, retryForAppointmentId));
    if (!retryAppt) {
      throw Object.assign(new Error("Original appointment not found for payment retry"), { code: "not_found" });
    }

    // Re-link the appointment to the new (successful) session + payment intent
    const [updatedAppt] = await db.update(appointmentsTable)
      .set({ stripeSessionId: sessionId, stripePaymentIntentId: paymentIntentId, status: "confirmed" })
      .where(eq(appointmentsTable.id, retryForAppointmentId))
      .returning();

    const [retryPayment] = await db.insert(paymentsTable).values({
      id: randomUUID(),
      appointmentId: retryAppt.id,
      stripeSessionId: sessionId,
      stripePaymentIntentId: paymentIntentId,
      amount: amountPaid,
      tipAmount: tipAmountNum,
      depositAmount: retryAppt.depositAmount,
      discountAmount,
      couponCode,
      refundedAmount: 0,
      status: "succeeded",
    }).onConflictDoNothing().returning();

    const retryConv = await db.select().from(conversationsTable)
      .where(and(eq(conversationsTable.clientId, retryAppt.clientId), eq(conversationsTable.stylistId, retryAppt.stylistId)));

    await holdEscrow(retryAppt.id, amountPaid, retryAppt.clientId);

    logger.info({ appointmentId: retryAppt.id, sessionId, paymentIntentId }, "Payment retry fulfilled — existing appointment updated");

    return {
      appointment: updatedAppt ?? retryAppt,
      payment: retryPayment,
      conversationId: retryConv[0]?.id ?? null,
      alreadyExisted: false,
    };
  }
  // ── END RETRY PATH ────────────────────────────────────────────────────────

  if (!stylistId || !serviceId || !date || !time) {
    throw Object.assign(new Error("Missing booking metadata in session"), { code: "bad_metadata" });
  }

  // Check for an existing appointment for this session
  const existingBySession = await db.select().from(appointmentsTable)
    .where(eq(appointmentsTable.stripeSessionId, sessionId));

  const existingAppt = existingBySession[0] ?? null;

  if (existingAppt) {
    if (existingAppt.status === "confirmed") {
      // Already fulfilled (idempotent return)
      const existingConv = await db.select().from(conversationsTable)
        .where(and(eq(conversationsTable.clientId, existingAppt.clientId), eq(conversationsTable.stylistId, existingAppt.stylistId)));
      const [existingPayment] = await db.select().from(paymentsTable)
        .where(eq(paymentsTable.stripeSessionId, sessionId));
      return {
        appointment: existingAppt,
        payment: existingPayment ?? null,
        conversationId: existingConv[0]?.id ?? null,
        alreadyExisted: true,
      };
    }

    // Pending appointment exists — upgrade it to confirmed + create payment record.
    // This is the normal path when checkout flow pre-creates the appointment.
    //
    // IDEMPOTENCY: guard the update with `status = 'pending'` so that if both
    // the webhook and the client-side confirm-booking endpoint race here, only
    // one caller actually transitions the row. The other gets 0 rows back and
    // falls through to re-query, returning the already-confirmed data.
    const [confirmedAppt] = await db.update(appointmentsTable)
      .set({ status: "confirmed", stripePaymentIntentId: paymentIntentId })
      .where(and(
        eq(appointmentsTable.id, existingAppt.id),
        eq(appointmentsTable.status, "pending"),
      ))
      .returning();

    if (!confirmedAppt) {
      // Race: the other concurrent caller already confirmed this appointment.
      // Re-query and return idempotently.
      const [raceWinner] = await db.select().from(appointmentsTable)
        .where(eq(appointmentsTable.id, existingAppt.id));
      const [racePayment] = await db.select().from(paymentsTable)
        .where(eq(paymentsTable.stripeSessionId, sessionId));
      const raceConv = await db.select().from(conversationsTable)
        .where(and(eq(conversationsTable.clientId, existingAppt.clientId), eq(conversationsTable.stylistId, existingAppt.stylistId)));
      logger.info({ appointmentId: existingAppt.id, sessionId }, "Race: appointment already confirmed by concurrent caller — returning existing");
      return {
        appointment: raceWinner ?? existingAppt,
        payment: racePayment ?? null,
        conversationId: raceConv[0]?.id ?? null,
        alreadyExisted: true,
      };
    }

    // Use onConflictDoNothing so a duplicate call (same stripeSessionId) never
    // inserts a second payment row — the unique constraint on stripe_session_id
    // is the hard guard; Drizzle's onConflictDoNothing surfaces it safely.
    const [payment] = await db.insert(paymentsTable).values({
      id: randomUUID(),
      appointmentId: existingAppt.id,
      stripeSessionId: sessionId,
      stripePaymentIntentId: paymentIntentId,
      amount: amountPaid,
      tipAmount: tipAmountNum,
      depositAmount: existingAppt.depositAmount,
      discountAmount,
      couponCode,
      refundedAmount: 0,
      status: "succeeded",
    }).onConflictDoNothing().returning();

    let conversationId: string | null = null;
    try {
      const existingConvRows = await db.select().from(conversationsTable)
        .where(and(eq(conversationsTable.clientId, existingAppt.clientId), eq(conversationsTable.stylistId, existingAppt.stylistId)));
      if (existingConvRows.length > 0) {
        conversationId = existingConvRows[0].id;
      } else {
        const [conv] = await db.insert(conversationsTable).values({
          id: randomUUID(), clientId: existingAppt.clientId, stylistId: existingAppt.stylistId,
        }).returning();
        conversationId = conv.id;
      }
    } catch { /* non-fatal */ }

    await holdEscrow(existingAppt.id, amountPaid, existingAppt.clientId);

    logger.info({ appointmentId: existingAppt.id, sessionId }, "Pending appointment confirmed after payment");

    // Notify (non-fatal, async)
    setImmediate(async () => {
      try {
        const [clientUser] = await db.select().from(usersTable).where(eq(usersTable.id, existingAppt.clientId));
        const [profile] = await db.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.id, existingAppt.stylistId));
        const [stylistUser] = profile
          ? await db.select().from(usersTable).where(eq(usersTable.id, profile.userId))
          : [null];
        await sendNotification(stylistUser?.phone, "booking.created", {
          clientName: existingAppt.clientName, serviceName: existingAppt.serviceName,
          date: existingAppt.date, time: existingAppt.time,
        });
        await sendNotification(clientUser?.phone, "booking.confirmed", {
          stylistName: existingAppt.stylistName, serviceName: existingAppt.serviceName,
          date: existingAppt.date, time: existingAppt.time,
        });
      } catch { /* non-fatal */ }
    });

    return { appointment: confirmedAppt ?? existingAppt, payment, conversationId, alreadyExisted: false };
  }

  // ── Fallback: no pre-existing appointment (backward compat / webhook path) ──
  const [profile] = await db.select().from(stylistProfilesTable)
    .where(eq(stylistProfilesTable.id, stylistId));
  const [service] = await db.select().from(servicesTable)
    .where(eq(servicesTable.id, serviceId));

  if (!profile || !service) {
    throw Object.assign(new Error("Stylist or service not found"), { code: "not_found" });
  }

  const slotCheck = isValidSlot(date, time);
  if (!slotCheck.ok) {
    throw Object.assign(new Error(slotCheck.error), { code: "invalid_slot" });
  }

  // Parse tip and deposit from metadata
  const depositPctNum = depositPct ? parseFloat(depositPct) : 0;
  const depositAmountNum = depositPctNum > 0 ? Math.round((Number(service.price) * depositPctNum / 100) * 100) / 100 : 0;
  const balanceDue = depositPctNum > 0 ? Math.round((Number(service.price) - depositAmountNum) * 100) / 100 : 0;
  const mode = (paymentMode as "full" | "deposit" | "pay_at_appointment") ?? "full";

  // Determine the client ID — either from session metadata (webhook path) or ownerUserId
  const clientId = userId ?? ownerUserId;
  if (!clientId) {
    throw Object.assign(new Error("Cannot determine client identity"), { code: "no_client" });
  }

  const [clientUser] = await db.select().from(usersTable).where(eq(usersTable.id, clientId));
  if (!clientUser) {
    throw Object.assign(new Error("Client user not found"), { code: "not_found" });
  }

  let appt: typeof appointmentsTable.$inferSelect;
  try {
    [appt] = await db.insert(appointmentsTable).values({
      id: randomUUID(),
      clientId,
      clientName: clientUser.name,
      stylistId,
      stylistName: profile.name,
      serviceId,
      serviceName: service.name,
      date,
      time,
      status: "confirmed",
      price: service.price,
      duration: service.duration,
      notes: notes || null,
      stripeSessionId: sessionId,
      stripePaymentIntentId: paymentIntentId,
      paymentMode: mode,
      depositAmount: depositAmountNum,
      tipAmount: tipAmountNum,
      balanceDue,
    }).returning();
  } catch (err) {
    if (isUniqueViolation(err)) {
      const constraint: string = (err as any)?.cause?.constraint ?? "";

      // Unique violation on stripe_session_id → concurrent webhook + confirm-booking race.
      // The appointment was already created by the other path — re-query and return it.
      if (constraint === "appointments_stripe_session_id_unique") {
        logger.info({ sessionId }, "Concurrent fulfillment detected — re-querying existing appointment");
        const [raceWinner] = await db.select().from(appointmentsTable)
          .where(eq(appointmentsTable.stripeSessionId, sessionId));
        if (raceWinner) {
          const [racePayment] = await db.select().from(paymentsTable)
            .where(eq(paymentsTable.stripeSessionId, sessionId));
          const raceConv = await db.select().from(conversationsTable)
            .where(and(eq(conversationsTable.clientId, raceWinner.clientId), eq(conversationsTable.stylistId, raceWinner.stylistId)));
          return {
            appointment: raceWinner,
            payment: racePayment ?? null,
            conversationId: raceConv[0]?.id ?? null,
            alreadyExisted: true,
          };
        }
      }

      // Any other unique violation is a genuine slot conflict with another booking
      logger.error(
        { sessionId, stylistId, date, time, constraint },
        "Booking conflict after successful payment — refund needed"
      );
      throw Object.assign(
        new Error("This time slot was booked by someone else while payment was processing"),
        { code: "conflict" }
      );
    }
    throw err;
  }

  await holdEscrow(appt.id, amountPaid, clientId);

  // Create payment record
  const [payment] = await db.insert(paymentsTable).values({
    id: randomUUID(),
    appointmentId: appt.id,
    stripeSessionId: sessionId,
    stripePaymentIntentId: paymentIntentId,
    amount: amountPaid,
    tipAmount: tipAmountNum,
    depositAmount: depositAmountNum,
    discountAmount,
    couponCode,
    refundedAmount: 0,
    status: "succeeded",
  }).returning();

  // Auto-create conversation thread
  let conversationId: string | null = null;
  try {
    const existingConv = await db.select().from(conversationsTable)
      .where(and(eq(conversationsTable.clientId, clientId), eq(conversationsTable.stylistId, stylistId)));
    if (existingConv.length > 0) {
      conversationId = existingConv[0].id;
    } else {
      const [conv] = await db.insert(conversationsTable).values({
        id: randomUUID(),
        clientId,
        stylistId,
      }).returning();
      conversationId = conv.id;
    }
  } catch (err) {
    logger.warn({ err }, "Could not auto-create conversation — non-fatal");
  }

  logger.info(
    { appointmentId: appt.id, sessionId, paymentIntentId, conversationId },
    "Appointment and payment record created after successful payment"
  );

  // Notify stylist (non-fatal, fire after return)
  setImmediate(async () => {
    try {
      const [stylistUser] = await db.select().from(usersTable)
        .where(eq(usersTable.id, profile.userId));
      await sendNotification(stylistUser?.phone, "booking.created", {
        clientName: clientUser.name,
        serviceName: service.name,
        date,
        time,
      });
      // Notify client with confirmation
      await sendNotification(clientUser?.phone, "booking.confirmed", {
        stylistName: profile.name,
        serviceName: service.name,
        date,
        time,
      });
    } catch { /* non-fatal */ }
  });

  return { appointment: appt, payment, conversationId, alreadyExisted: false };
}
