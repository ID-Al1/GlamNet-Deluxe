import { Router } from "express";
import { db, usersTable, appointmentsTable, stylistProfilesTable, servicesTable, conversationsTable } from "@workspace/db";
import { sendNotification } from "../lib/notifications";
import { eq, and } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT GUARDRAIL — PayFast migration pending
// Stripe is wired in temporarily. DO NOT rebuild notification flows, webhooks,
// or booking confirmation logic in a way that assumes Stripe stays forever.
// When PayFast replaces Stripe, only this file + stripeClient.ts + the success
// page need updating — everything else must remain payment-agnostic.
// ─────────────────────────────────────────────────────────────────────────────
import { randomUUID } from "crypto";
import { requireAuth } from "../lib/auth";
import { getUncachableStripeClient } from "../stripeClient";
import { logger } from "../lib/logger";

const router = Router();

// Create a Stripe Checkout session for a booking.
// The appointment is created AFTER successful payment via the success redirect.
router.post("/stripe/checkout", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { stylistId, serviceId, date, time, notes } = req.body;

  if (!stylistId || !serviceId || !date || !time) {
    res.status(400).json({ error: "Missing required fields: stylistId, serviceId, date, time" });
    return;
  }

  const [profile] = await db.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.id, stylistId));
  const [service] = await db.select().from(servicesTable).where(eq(servicesTable.id, serviceId));
  if (!profile || !service) {
    res.status(404).json({ error: "Stylist or service not found" });
    return;
  }

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

  // Build success URL with booking details as query params so we can create the appointment after payment
  const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
  const successParams = new URLSearchParams({
    stylistId,
    serviceId,
    date,
    time,
    ...(notes ? { notes } : {}),
  });

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'zar',
          unit_amount: Math.round(Number(service.price) * 100),
          product_data: {
            name: `${service.name} with ${profile.name}`,
            description: `${service.duration} min appointment on ${date} at ${time}`,
          },
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${baseUrl}/booking/success?session_id={CHECKOUT_SESSION_ID}&${successParams.toString()}`,
    cancel_url: `${baseUrl}/book/${stylistId}`,
    metadata: {
      userId: user.id,
      stylistId,
      serviceId,
      date,
      time,
      notes: notes ?? '',
    },
  });

  res.json({ url: session.url });
});

// Called after Stripe redirects back — verifies payment and creates the appointment
router.post("/stripe/confirm-booking", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { sessionId } = req.body;

  if (!sessionId) {
    res.status(400).json({ error: "Missing sessionId" });
    return;
  }

  const stripe = await getUncachableStripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status !== 'paid') {
    res.status(402).json({ error: "Payment not completed" });
    return;
  }

  const { userId, stylistId, serviceId, date, time, notes } = session.metadata ?? {};

  if (!stylistId || !serviceId || !date || !time) {
    res.status(400).json({ error: "Missing booking metadata in session" });
    return;
  }

  // Bind the session to its original purchaser — prevents another authenticated
  // user from confirming a booking against someone else's paid session.
  if (userId && userId !== user.id) {
    res.status(403).json({ error: "This checkout session does not belong to you" });
    return;
  }

  // Check if appointment already created for this session (idempotency)
  const existing = await db.select().from(appointmentsTable)
    .where(eq(appointmentsTable.stripeSessionId, sessionId));
  if (existing.length > 0) {
    const appt = existing[0];
    const existingConv = await db.select().from(conversationsTable)
      .where(and(eq(conversationsTable.clientId, user.id), eq(conversationsTable.stylistId, appt.stylistId)));
    const conversationId = existingConv[0]?.id ?? null;
    res.json({ ...appt, conversationId });
    return;
  }

  const [profile] = await db.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.id, stylistId));
  const [service] = await db.select().from(servicesTable).where(eq(servicesTable.id, serviceId));

  if (!profile || !service) {
    res.status(404).json({ error: "Stylist or service not found" });
    return;
  }

  const [appt] = await db.insert(appointmentsTable).values({
    id: randomUUID(),
    clientId: user.id,
    clientName: user.name,
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
  }).returning();

  // Auto-create a conversation thread between client and stylist so they can
  // coordinate immediately after booking — no manual "Start conversation" needed.
  let conversationId: string | null = null;
  try {
    const existingConv = await db.select().from(conversationsTable)
      .where(and(eq(conversationsTable.clientId, user.id), eq(conversationsTable.stylistId, stylistId)));
    if (existingConv.length > 0) {
      conversationId = existingConv[0].id;
    } else {
      const [conv] = await db.insert(conversationsTable).values({
        id: randomUUID(),
        clientId: user.id,
        stylistId,
      }).returning();
      conversationId = conv.id;
    }
  } catch (err) {
    logger.warn({ err }, 'Could not auto-create conversation after booking — non-fatal');
  }

  logger.info({ appointmentId: appt.id, sessionId, conversationId }, 'Appointment created after payment');
  res.status(201).json({ ...appt, conversationId });

  // Notify stylist of new paid booking — non-fatal, fires after response
  setImmediate(async () => {
    try {
      const [stylistUser] = await db.select().from(usersTable).where(eq(usersTable.id, profile.userId));
      await sendNotification(stylistUser?.phone, "booking.created", {
        clientName: user.name,
        serviceName: service.name,
        date,
        time,
      });
    } catch { /* non-fatal */ }
  });
});

export default router;
