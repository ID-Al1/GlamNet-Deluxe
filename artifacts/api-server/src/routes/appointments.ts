import { Router } from "express";
import { db, appointmentsTable, stylistProfilesTable, servicesTable, usersTable, paymentsTable, payoutLedgerTable } from "@workspace/db";
import { eq, and, or, desc, isNull, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth } from "../lib/auth";
import { CreateAppointmentBody, UpdateAppointmentBody } from "@workspace/api-zod";
import { sendNotification } from "../lib/notifications";
import { isValidSlot, isUniqueViolation } from "../lib/bookingValidation";
import { postSystemMessage } from "./messages";
import { recordPayoutEvent, transitionToDisputed } from "../lib/escrow";
import { param } from "../lib/params";
import { COMPLAINT_WINDOW_HOURS, COMPLETION_CODE_MAX_ATTEMPTS, COMPLETION_CODE_MAX_REQUESTS } from "../lib/bookingPolicy";
import { appointmentStartTime, completionCodeExpiresAt, completionCodesMatch, deriveCompletionCode, newCodeNonce } from "../lib/completionCode";

const router = Router();


function formatAppt(a: typeof appointmentsTable.$inferSelect) {
  return {
    id: a.id,
    clientId: a.clientId,
    clientName: a.clientName,
    stylistId: a.stylistId,
    stylistName: a.stylistName,
    serviceId: a.serviceId,
    serviceName: a.serviceName,
    date: a.date,
    time: a.time,
    status: a.status,
    price: a.price,
    duration: a.duration,
    notes: a.notes ?? null,
    createdAt: a.createdAt.toISOString(),
    paymentMode: a.paymentMode,
    depositAmount: a.depositAmount,
    tipAmount: a.tipAmount,
    balanceDue: a.balanceDue,
    workConfirmedByClient: a.workConfirmedByClient,
    workConfirmedByClientAt: a.workConfirmedByClientAt?.toISOString() ?? null,
    workConfirmedByArtist: a.workConfirmedByArtist,
    workConfirmedByArtistAt: a.workConfirmedByArtistAt?.toISOString() ?? null,
    payoutStatus: a.payoutStatus,
    artistPayoutAmount: a.artistPayoutAmount,
    platformFeeAmount: a.platformFeeAmount,
    completionCodeRequested: !!a.completionCodeRequestedAt && !a.completedAt,
    completedAt: a.completedAt?.toISOString() ?? null,
    complaintWindowEndsAt: a.complaintWindowEndsAt?.toISOString() ?? null,
  };
}

router.get("/appointments", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { status, role } = req.query as Record<string, string>;

  let appts;
  if (role === "stylist" || user.role === "stylist") {
    // appointments.stylistId holds a stylist_profiles.id, NOT a users.id.
    // Comparing it against user.id matches nothing, which is why artists were
    // getting an empty list. dashboard.ts already does this correctly.
    const [profile] = await db.select().from(stylistProfilesTable)
      .where(eq(stylistProfilesTable.userId, user.id))
      .limit(1);

    appts = profile
      ? await db.select().from(appointmentsTable).where(eq(appointmentsTable.stylistId, profile.id))
      : [];
  } else {
    appts = await db.select().from(appointmentsTable).where(eq(appointmentsTable.clientId, user.id));
  }

  if (status) {
    appts = appts.filter(a => a.status === status);
  }

  res.json(appts.map(formatAppt));
});

router.post("/appointments", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const parsed = CreateAppointmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation error" }); return; }

  const { stylistId, serviceId, date, time, notes } = parsed.data;

  const slotCheck = isValidSlot(date, time);
  if (!slotCheck.ok) { res.status(400).json({ error: slotCheck.error }); return; }

  const [profile] = await db.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.id, stylistId));
  const [service] = await db.select().from(servicesTable).where(and(
    eq(servicesTable.id, serviceId),
    eq(servicesTable.stylistId, stylistId),
  ));

  if (!profile || !service) { res.status(404).json({ error: "Stylist or service not found" }); return; }
  const [artistUser] = await db.select({ accountStatus: usersTable.accountStatus }).from(usersTable).where(eq(usersTable.id, profile.userId));
  if (artistUser?.accountStatus === "suspended") { res.status(403).json({ error: "This artist account is suspended and cannot accept bookings." }); return; }
  // Part c: block bookings with unverified artists server-side.
  if (!profile.verified) { res.status(403).json({ error: "This artist is not yet verified on Bonisa and cannot accept bookings." }); return; }

  let appt;
  try {
    [appt] = await db.insert(appointmentsTable).values({
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
      notes: notes ?? null,
    }).returning();
  } catch (err) {
    // Atomic DB constraint (appointments_stylist_slot_active_unique) rejects
    // overlapping active bookings for the same stylist/date/time — this is
    // the source of truth for conflict prevention, not a pre-check, so it's
    // race-condition safe under concurrent requests.
    if (isUniqueViolation(err)) {
      res.status(409).json({ error: "This time slot was just booked by someone else. Please choose another time." });
      return;
    }
    throw err;
  }

  // Notify stylist of new booking (non-fatal)
  try {
            const [stylistUser] = await db.select().from(usersTable).where(eq(usersTable.id, profile.userId));
    await sendNotification(stylistUser?.phone, "booking.created", {
      clientName: user.name,
      serviceName: service.name,
      date,
      time,
    });
  } catch { /* non-fatal */ }

  res.status(201).json(formatAppt(appt));
});

router.get("/appointments/:appointmentId", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const appointmentId = param(req.params.appointmentId);
  const [appt] = await db.select().from(appointmentsTable)
    .where(eq(appointmentsTable.id, appointmentId));
  if (!appt) { res.status(404).json({ error: "Not found" }); return; }
  const [callerProfile] = await db.select().from(stylistProfilesTable)
    .where(and(
      eq(stylistProfilesTable.id, appt.stylistId),
      eq(stylistProfilesTable.userId, user.id),
    ));
  if (appt.clientId !== user.id && !callerProfile) {
    res.status(403).json({ error: "You are not a participant in this booking" });
    return;
  }
  res.json(formatAppt(appt));
});

router.patch("/appointments/:appointmentId", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const appointmentId = param(req.params.appointmentId);
  const parsed = UpdateAppointmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation error" }); return; }
  const data = parsed.data;

  // Fetch the appointment before updating so we have context for notifications
  const [before] = await db.select().from(appointmentsTable).where(eq(appointmentsTable.id, appointmentId));
  if (!before) { res.status(404).json({ error: "Not found" }); return; }

  const isClient = before.clientId === user.id;
  const [callerProfile] = await db.select().from(stylistProfilesTable)
    .where(and(
      eq(stylistProfilesTable.id, before.stylistId),
      eq(stylistProfilesTable.userId, user.id),
    ));
  const isArtist = !!callerProfile;
  if (!isClient && !isArtist) {
    res.status(403).json({ error: "You are not a participant in this booking" });
    return;
  }

  if (isArtist) {
    if (data.date !== undefined || data.time !== undefined || data.notes !== undefined) {
      res.status(403).json({ error: "Only the client can edit booking details" });
      return;
    }
    if (data.status !== "confirmed" && data.status !== "declined") {
      res.status(403).json({ error: "Artists can only confirm or decline booking requests" });
      return;
    }
    if (before.status !== "pending") {
      res.status(409).json({ error: "Only pending bookings can be confirmed or declined" });
      return;
    }
  } else {
    if (data.status && data.status !== "cancelled") {
      res.status(403).json({ error: "Clients can only cancel bookings" });
      return;
    }
    if ((data.date !== undefined || data.time !== undefined || data.notes !== undefined) && before.status !== "pending") {
      res.status(409).json({ error: "Only pending booking details can be edited" });
      return;
    }
    if (data.status === "cancelled" && !["pending", "confirmed"].includes(before.status)) {
      res.status(409).json({ error: "This booking can no longer be cancelled" });
      return;
    }
  }

  const [appt] = await db.update(appointmentsTable).set({
    ...(data.status && { status: data.status }),
    ...(data.date && { date: data.date }),
    ...(data.time && { time: data.time }),
    ...(data.notes !== undefined && { notes: data.notes }),
  }).where(eq(appointmentsTable.id, appointmentId)).returning();
  if (!appt) { res.status(404).json({ error: "Not found" }); return; }

  res.json(formatAppt(appt));

  // Fire notifications asynchronously after responding — non-fatal
  if (data.status && data.status !== before.status) {
    setImmediate(async () => {
      try {
        const [clientUser] = await db.select().from(usersTable).where(eq(usersTable.id, appt.clientId));
        const sharedData = {
          stylistName: appt.stylistName,
          clientName: appt.clientName,
          serviceName: appt.serviceName,
          date: appt.date,
          time: appt.time,
        };

        if (data.status === "confirmed") {
          // Notify client
          await sendNotification(clientUser?.phone, "booking.confirmed", sharedData);
          // Notify stylist too — both sides should know a booking is locked in
          const [confirmedProfile] = await db.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.id, appt.stylistId));
          if (confirmedProfile) {
            const [confirmedStylistUser] = await db.select().from(usersTable).where(eq(usersTable.id, confirmedProfile.userId));
            await sendNotification(confirmedStylistUser?.phone, "booking.confirmed.stylist", sharedData);
          }
          await postSystemMessage(
            appt.clientId, appt.stylistId,
            `✅ Booking confirmed — ${appt.serviceName} on ${appt.date} at ${appt.time}.`
          );
        } else if (data.status === "declined" || data.status === "cancelled") {
          await sendNotification(clientUser?.phone, "booking.declined", sharedData);
          await postSystemMessage(
            appt.clientId, appt.stylistId,
            `❌ Booking ${data.status} — ${appt.serviceName} on ${appt.date} at ${appt.time}.`
          );
        } else if (data.status === "completed") {
          // Notify client
          await sendNotification(clientUser?.phone, "booking.completed", sharedData);
          // Notify stylist too
          const [profile] = await db.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.id, appt.stylistId));
          if (profile) {
            const [stylistUser] = await db.select().from(usersTable).where(eq(usersTable.id, profile.userId));
            await sendNotification(stylistUser?.phone, "booking.completed", sharedData);
          }
          await postSystemMessage(
            appt.clientId, appt.stylistId,
            `🌟 Appointment complete — ${appt.serviceName}. Please leave a review!`
          );
        }
      } catch { /* non-fatal */ }
    });
  }
});

// ── Dual Work Confirmation + Payout Split ────────────────────────────────────
/**
 * POST /appointments/:appointmentId/confirm-work
 * Body: { dispute?: boolean }
 *
 * Either the client or the artist calls this to confirm work was done.
 * - If dispute=true  → payoutStatus = 'disputed', frozen for manual review
 * - If both confirm  → payoutStatus = 'released', 82/18 split computed,
 *                      appointment status set to 'completed'
 */
router.post("/appointments/:appointmentId/confirm-work", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const appointmentId = String(req.params.appointmentId);
  const dispute = req.body?.dispute === true;

  const [appt] = await db.select().from(appointmentsTable)
    .where(eq(appointmentsTable.id, appointmentId));
  if (!appt) { res.status(404).json({ error: "Appointment not found" }); return; }

  // Determine caller role
  const isClient = appt.clientId === user.id;
  const stylistRows = await db.select().from(stylistProfilesTable)
    .where(and(eq(stylistProfilesTable.id, appt.stylistId), eq(stylistProfilesTable.userId, user.id)));
  const isArtist = stylistRows.length > 0;

  if (!isClient && !isArtist) {
    res.status(403).json({ error: "Not authorised to confirm this appointment" }); return;
  }

  // State machine: only paid, confirmed bookings enter the completion flow.
  if (appt.status !== "confirmed" && appt.status !== "completed") {
    res.status(409).json({ error: "This booking is not in a confirmable state." }); return;
  }
  const [paymentRow] = await db.select().from(paymentsTable)
    .where(eq(paymentsTable.appointmentId, appointmentId))
    .orderBy(desc(paymentsTable.createdAt))
    .limit(1);
  const isPaid = (paymentRow && paymentRow.status === "succeeded") || !!appt.stripePaymentIntentId;
  if (!isPaid) {
    res.status(409).json({ error: "No verified payment for this booking — nothing is held in escrow yet." }); return;
  }

  if (dispute) {
    // Disputes can only freeze funds still in escrow. A released payout is
    // final here; post-release complaints go through support, not the ledger.
    const result = await db.transaction(tx => transitionToDisputed(tx, appt, user.id,
      `Issue reported by ${isClient ? "client" : "artist"} — funds frozen in escrow pending review`));
    const updated = result.appointment;
    if (!updated) {
      const state = appt.payoutStatus === "released"
        ? "Payout was already released. Please contact support to raise a complaint."
        : "This booking is already under dispute.";
      res.status(409).json({ error: state });
      return;
    }
    try {
      await postSystemMessage(
        appt.clientId, appt.stylistId,
        `⚠️ A dispute has been raised on the ${appt.serviceName} appointment (${appt.date}). The payout is frozen — Bonisa will reach out to both parties to resolve it.`
      );
    } catch { /* non-fatal */ }
    res.json(formatAppt(updated));
    return;
  }

  // Completing a booking now happens with the completion code, followed by the
  // complaint window (see the routes below). A plain "confirm" can no longer
  // release money; only reporting a problem (dispute=true above) uses this route.
  res.status(409).json({ error: "Complete this booking with the completion code. Ask your artist or client for it in the Bonisa app." });
});

// ── Completion code ──────────────────────────────────────────────────────────
// After the service the artist asks for a code. The client reads it in her app
// and gives it to the artist, who types it in. That proves the client was there
// and opens the complaint window. The money is released when the window closes
// with no open complaint (lib/completionRelease.ts).

async function loadCodeBooking(req: any, res: any, who: "artist" | "client") {
  const user = req.user;
  const [appt] = await db.select().from(appointmentsTable).where(eq(appointmentsTable.id, String(req.params.appointmentId)));
  if (!appt) { res.status(404).json({ error: "Appointment not found" }); return null; }
  if (who === "client") {
    if (appt.clientId !== user.id) { res.status(403).json({ error: "Only the client on this booking can see the code" }); return null; }
  } else {
    const [mine] = await db.select({ id: stylistProfilesTable.id }).from(stylistProfilesTable)
      .where(and(eq(stylistProfilesTable.id, appt.stylistId), eq(stylistProfilesTable.userId, user.id)));
    if (!mine) { res.status(403).json({ error: "Only the artist on this booking can do this" }); return null; }
  }
  return appt;
}

async function bookingIsPaid(appt: typeof appointmentsTable.$inferSelect) {
  const [paymentRow] = await db.select().from(paymentsTable)
    .where(eq(paymentsTable.appointmentId, appt.id)).orderBy(desc(paymentsTable.createdAt)).limit(1);
  return (paymentRow && paymentRow.status === "succeeded") || !!appt.stripePaymentIntentId;
}

router.post("/appointments/:appointmentId/request-completion-code", requireAuth, async (req, res) => {
  const appt = await loadCodeBooking(req, res, "artist");
  if (!appt) return;
  if (appt.completedAt) { res.status(409).json({ error: "This booking is already complete." }); return; }
  if (appt.status !== "confirmed") { res.status(409).json({ error: "Only confirmed bookings can be completed." }); return; }
  if (appt.payoutStatus !== "held") { res.status(409).json({ error: "This booking cannot be completed right now. Please contact Bonisa." }); return; }
  if (!(await bookingIsPaid(appt))) { res.status(409).json({ error: "The client has not paid yet, so there is nothing to complete." }); return; }
  if (new Date() < appointmentStartTime(appt.date, appt.time)) {
    res.status(409).json({ error: "You can ask for the code once the appointment has started." }); return;
  }
  if (appt.completionCodeRequests >= COMPLETION_CODE_MAX_REQUESTS) {
    res.status(429).json({ error: "You have asked for the maximum number of codes. Please contact Bonisa." }); return;
  }

  const now = new Date();
  const [updated] = await db.update(appointmentsTable).set({
    completionCodeNonce: newCodeNonce(),
    completionCodeRequestedAt: now,
    completionCodeRequests: appt.completionCodeRequests + 1,
    completionCodeAttempts: 0,
  }).where(and(
    eq(appointmentsTable.id, appt.id),
    eq(appointmentsTable.payoutStatus, "held"),
    isNull(appointmentsTable.completedAt),
    eq(appointmentsTable.completionCodeRequests, appt.completionCodeRequests),
  )).returning();
  if (!updated) { res.status(409).json({ error: "This booking just changed. Please refresh and try again." }); return; }

  try {
    // The code is never put in chat: the artist can read the chat.
    await postSystemMessage(appt.clientId, appt.stylistId,
      `${appt.stylistName} has asked for your completion code for ${appt.serviceName}. Open this booking in Bonisa to see it, and give it to ${appt.stylistName} once you are happy with the service.`);
  } catch { /* non-fatal */ }

  res.json({ requestedAt: now.toISOString(), expiresAt: completionCodeExpiresAt(now).toISOString() });
});

router.get("/appointments/:appointmentId/completion-code", requireAuth, async (req, res) => {
  const appt = await loadCodeBooking(req, res, "client");
  if (!appt) return;
  if (appt.completedAt || !appt.completionCodeNonce || !appt.completionCodeRequestedAt) {
    res.status(404).json({ error: "No completion code has been requested for this booking." }); return;
  }
  const expiresAt = completionCodeExpiresAt(appt.completionCodeRequestedAt);
  if (expiresAt < new Date()) { res.status(404).json({ error: "The code has expired. Your artist can ask for a new one." }); return; }
  res.setHeader("Cache-Control", "no-store, private");
  res.json({ code: deriveCompletionCode(appt.id, appt.completionCodeNonce), expiresAt: expiresAt.toISOString() });
});

router.post("/appointments/:appointmentId/verify-completion-code", requireAuth, async (req, res) => {
  const appt = await loadCodeBooking(req, res, "artist");
  if (!appt) return;
  const entered = typeof req.body?.code === "string" ? req.body.code.trim() : "";
  if (!/^\d{6}$/.test(entered)) { res.status(400).json({ error: "Enter the 6 digit code." }); return; }
  if (appt.completedAt) { res.status(409).json({ error: "This booking is already complete." }); return; }
  if (!appt.completionCodeNonce || !appt.completionCodeRequestedAt) {
    res.status(409).json({ error: "Ask for a code first." }); return;
  }
  if (completionCodeExpiresAt(appt.completionCodeRequestedAt) < new Date()) {
    res.status(409).json({ error: "That code has expired. Ask for a new one." }); return;
  }
  if (appt.completionCodeAttempts >= COMPLETION_CODE_MAX_ATTEMPTS) {
    res.status(429).json({ error: "Too many wrong tries. Ask for a new code." }); return;
  }

  if (!completionCodesMatch(entered, deriveCompletionCode(appt.id, appt.completionCodeNonce))) {
    const [after] = await db.update(appointmentsTable)
      .set({ completionCodeAttempts: sql`${appointmentsTable.completionCodeAttempts} + 1` })
      .where(eq(appointmentsTable.id, appt.id)).returning({ attempts: appointmentsTable.completionCodeAttempts });
    res.status(400).json({
      error: "That code is not right.",
      attemptsLeft: Math.max(0, COMPLETION_CODE_MAX_ATTEMPTS - (after?.attempts ?? appt.completionCodeAttempts + 1)),
    });
    return;
  }

  // The code proves both sides: the client gave it, the artist typed it. Both
  // flags are set so complaint handling that checks them keeps working. The
  // money stays held until the complaint window closes.
  const now = new Date();
  const [done] = await db.update(appointmentsTable).set({
    status: "completed",
    completedAt: now,
    complaintWindowEndsAt: new Date(now.getTime() + COMPLAINT_WINDOW_HOURS * 60 * 60 * 1000),
    workConfirmedByClient: true, workConfirmedByClientAt: now,
    workConfirmedByArtist: true, workConfirmedByArtistAt: now,
    completionCodeNonce: null,
  }).where(and(
    eq(appointmentsTable.id, appt.id),
    eq(appointmentsTable.payoutStatus, "held"),
    isNull(appointmentsTable.completedAt),
    eq(appointmentsTable.completionCodeNonce, appt.completionCodeNonce),
  )).returning();
  if (!done) { res.status(409).json({ error: "This booking just changed. Please refresh." }); return; }

  await recordPayoutEvent({
    appointmentId: appt.id, type: "completed_by_code", actorUserId: (req as any).user.id,
    note: `Completion code entered. Complaint window open until ${done.complaintWindowEndsAt?.toISOString()}`,
  });
  try {
    await postSystemMessage(appt.clientId, appt.stylistId,
      `${appt.serviceName} is complete. ${appt.clientName} has ${COMPLAINT_WINDOW_HOURS} hours to report a problem. After that, the payment is released to ${appt.stylistName}.`);
  } catch { /* non-fatal */ }
  res.json(formatAppt(done));
});

export default router;
