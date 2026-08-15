import { Router } from "express";
import { db, appointmentsTable, stylistProfilesTable, servicesTable, usersTable, paymentsTable } from "@workspace/db";
import { eq, and, or, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth } from "../lib/auth";
import { CreateAppointmentBody, UpdateAppointmentBody } from "@workspace/api-zod";
import { sendNotification } from "../lib/notifications";
import { isValidSlot, isUniqueViolation } from "../lib/bookingValidation";
import { postSystemMessage } from "./messages";
import { recordPayoutEvent, splitAmount } from "../lib/escrow";
import { param } from "../lib/params";

const router = Router();

import { ARTIST_SHARE as ARTIST_PAYOUT_PCT, PLATFORM_SHARE as PLATFORM_FEE_PCT } from "../lib/money";

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
    const [profile] = await db
      .select()
      .from(stylistProfilesTable)
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
  const [service] = await db.select().from(servicesTable).where(eq(servicesTable.id, serviceId));

  if (!profile || !service) { res.status(404).json({ error: "Stylist or service not found" }); return; }
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
  const [appt] = await db.select().from(appointmentsTable).where(eq(appointmentsTable.id, param(req.params.appointmentId)));
  if (!appt) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatAppt(appt));
});

router.patch("/appointments/:appointmentId", requireAuth, async (req, res) => {
  const parsed = UpdateAppointmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation error" }); return; }
  const data = parsed.data;

  // Fetch the appointment before updating so we have context for notifications
  const [before] = await db.select().from(appointmentsTable).where(eq(appointmentsTable.id, param(req.params.appointmentId)));
  if (!before) { res.status(404).json({ error: "Not found" }); return; }

  // Decline gate: only the artist on this booking can decline, and only while
  // the booking is still pending. A client cancelling a confirmed booking uses
  // "cancelled". Declined bookings never enter escrow — the confirm-work flow
  // already requires status === "confirmed" before it will touch funds.
  if (data.status === "declined") {
    const user = (req as any).user;
    const [callerProfile] = await db.select().from(stylistProfilesTable)
      .where(and(eq(stylistProfilesTable.id, before.stylistId), eq(stylistProfilesTable.userId, user.id)));
    if (!callerProfile) {
      res.status(403).json({ error: "Only the artist can decline a booking request" }); return;
    }
    if (before.status !== "pending") {
      res.status(409).json({ error: "Only pending bookings can be declined" }); return;
    }
  }

  const [appt] = await db.update(appointmentsTable).set({
    ...(data.status && { status: data.status as any }),
    ...(data.date && { date: data.date }),
    ...(data.time && { time: data.time }),
    ...(data.notes !== undefined && { notes: data.notes }),
  }).where(eq(appointmentsTable.id, param(req.params.appointmentId))).returning();
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
    const [updated] = await db.update(appointmentsTable)
      .set({ payoutStatus: "disputed" })
      .where(and(eq(appointmentsTable.id, appointmentId), eq(appointmentsTable.payoutStatus, "held")))
      .returning();
    if (!updated) {
      const state = appt.payoutStatus === "released"
        ? "Payout was already released. Please contact support to raise a complaint."
        : "This booking is already under dispute.";
      res.status(409).json({ error: state });
      return;
    }
    await recordPayoutEvent({
      appointmentId, type: "disputed", actorUserId: user.id,
      note: `Issue reported by ${isClient ? "client" : "artist"} — funds frozen in escrow pending review`,
    });
    try {
      await postSystemMessage(
        appt.clientId, appt.stylistId,
        `⚠️ A dispute has been raised on the ${appt.serviceName} appointment (${appt.date}). The payout is frozen — Bonisa will reach out to both parties to resolve it.`
      );
    } catch { /* non-fatal */ }
    res.json(formatAppt(updated));
    return;
  }

  if (appt.payoutStatus === "disputed") {
    res.status(409).json({ error: "This appointment is under dispute. Please contact support." }); return;
  }
  if (appt.payoutStatus === "released") {
    res.status(409).json({ error: "Payout already released for this appointment." }); return;
  }

  // Record this party's confirmation with a conditional update so concurrent
  // retries can't double-confirm: the WHERE clause only matches while the flag
  // is still false and funds are still held.
  const now = new Date();
  const confirmedRows = await db.update(appointmentsTable)
    .set(isClient
      ? { workConfirmedByClient: true, workConfirmedByClientAt: now }
      : { workConfirmedByArtist: true, workConfirmedByArtistAt: now })
    .where(and(
      eq(appointmentsTable.id, appointmentId),
      eq(appointmentsTable.payoutStatus, "held"),
      isClient
        ? eq(appointmentsTable.workConfirmedByClient, false)
        : eq(appointmentsTable.workConfirmedByArtist, false),
    ))
    .returning();

  if (confirmedRows.length > 0) {
    await recordPayoutEvent({
      appointmentId, type: isClient ? "client_confirmed" : "artist_confirmed",
      actorUserId: user.id,
      note: isClient ? "Client confirmed the appointment was received" : "Artist confirmed the appointment was completed",
    });
  }

  // Attempt release whenever both flags are set and funds are still held.
  // Running this even when the confirmation above was a no-op means a booking
  // that previously confirmed both sides but failed to release gets retried
  // here instead of being stuck. The conditional WHERE makes release atomic —
  // exactly one caller wins; everyone else matches zero rows.
  const actualCollected = paymentRow?.amount
    ?? (appt.paymentMode === "deposit" && appt.depositAmount > 0
      ? appt.depositAmount + appt.tipAmount
      : appt.price + appt.tipAmount);
  const { artistShare: artistPayout, platformShare: platformFee } = splitAmount(actualCollected);

  const releasedRows = await db.update(appointmentsTable)
    .set({
      payoutStatus: "released",
      artistPayoutAmount: artistPayout,
      platformFeeAmount: platformFee,
      status: "completed",
    })
    .where(and(
      eq(appointmentsTable.id, appointmentId),
      eq(appointmentsTable.payoutStatus, "held"),
      eq(appointmentsTable.workConfirmedByClient, true),
      eq(appointmentsTable.workConfirmedByArtist, true),
    ))
    .returning();

  if (releasedRows.length > 0) {
    await recordPayoutEvent({
      appointmentId, type: "released", actorUserId: user.id,
      amount: actualCollected, artistShare: artistPayout, platformShare: platformFee,
      note: "Both parties confirmed — escrow released",
    });
    try {
      await postSystemMessage(
        appt.clientId, appt.stylistId,
        `Both parties confirmed the appointment. R${artistPayout.toFixed(2)} released to ${appt.stylistName} (Bonisa fee: R${platformFee.toFixed(2)}).`
      );
    } catch { /* non-fatal */ }
    res.json(formatAppt(releasedRows[0]));
    return;
  }

  // Not released — return the freshest state
  const [current] = await db.select().from(appointmentsTable)
    .where(eq(appointmentsTable.id, appointmentId));
  res.json(formatAppt(current ?? appt));
});

export default router;
