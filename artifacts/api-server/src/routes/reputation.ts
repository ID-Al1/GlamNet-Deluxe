/**
 * Reputation, artist cancellation and the safety check-in.
 *
 * Artist:
 *   GET  /reputation/me                              her standing, in plain terms
 *   POST /reputation/events/:eventId/dispute         ask for a record to be looked at again
 *   POST /appointments/:id/artist-cancel             cancel a confirmed booking, with fair notice
 *   GET  /safety/pending                             jobs she has not checked in for yet
 *   POST /appointments/:id/safety-checkin            photo + "I am safe" (+ "last booking"), returns a code
 * Owner:
 *   GET  /owner/reputation, /owner/reputation/:stylistId, /owner/reputation/disputes
 *   POST /owner/reputation/disputes/:id/resolve, /events/:id/reverse, /:stylistId/conduct-case, /:stylistId/recalculate
 *   POST /owner/appointments/:id/no-show
 *   GET  /owner/safety, /owner/safety/:id/photo
 *
 * Every rule is decided here on the server. A screen can never send a score, a tier or an outcome.
 */
import { Router } from "express";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { randomInt, randomUUID } from "crypto";
import { Readable } from "stream";
import {
  appointmentsTable,
  db,
  reputationAuditLogTable,
  reputationDisputesTable,
  reputationEventsTable,
  reputationSummaryTable,
  safetyCheckinsTable,
  stylistProfilesTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, requireOwner } from "../lib/auth";
import { param } from "../lib/params";
import { wasUploadedBy } from "../lib/upload-registry";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage";
import { sendNotification } from "../lib/notifications";
import { hoursUntilEvent, notifyStylistProfile, notifyUserId } from "../lib/campaigns";
import { REPUTATION_CONFIG as CFG } from "../lib/reputation-config";
import { cancellationKind } from "../lib/reputation-score";
import {
  artistReputationView,
  collectedFor,
  openDispute,
  recomputeReputation,

  recordConductCase,
  recordNoShow,
  resolveDispute,
  reverseEvent,
  syncEvents,
  audit,
  EVENT_LABELS,
} from "../lib/reputation";
import { logger } from "../lib/logger";
import { postSystemMessage } from "./messages";

const router = Router();
const objectStorage = new ObjectStorageService();

const myProfile = async (userId: string) => (await db.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.userId, userId)))[0];
const text = (v: unknown, max = 1000) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// ---------------------------------------------------------------------------
// Artist: her standing
// ---------------------------------------------------------------------------

router.get("/reputation/me", requireAuth, async (req, res) => {
  const profile = await myProfile((req as any).user.id);
  if (!profile) { res.status(403).json({ error: "Only artists have a reputation." }); return; }
  const view = await artistReputationView(profile.id);
  if (!view) { res.status(404).json({ error: "Not found" }); return; }
  res.json(view);
});

router.post("/reputation/events/:eventId/dispute", requireAuth, async (req, res) => {
  const profile = await myProfile((req as any).user.id);
  if (!profile) { res.status(403).json({ error: "Only artists can do this." }); return; }
  const reason = text(req.body?.reason);
  if (reason.length < 10) { res.status(400).json({ error: "Tell us what is wrong, in at least a sentence, so we can look into it properly." }); return; }
  const result = await openDispute(profile.id, param(req.params.eventId), reason);
  if ("error" in result) { res.status(result.status).json({ error: result.error }); return; }
  res.status(201).json({ message: "Thank you. We will review this and tell you what we decide. Until then it does not count against you." });
});

// ---------------------------------------------------------------------------
// Artist: cancelling a confirmed booking
// ---------------------------------------------------------------------------

/**
 * An artist can cancel a confirmed booking. How much notice she gives decides what it means:
 *   48 hours or more   no mark
 *   12 to 48 hours     a late cancellation, lightly counted
 *   under 12 hours     a last-minute cancellation, counted more
 * A real emergency can be flagged: the record then waits for the owner and does not count meanwhile.
 * The client's payment is marked to be refunded in full.
 */
router.post("/appointments/:appointmentId/artist-cancel", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const profile = await myProfile(user.id);
  if (!profile) { res.status(403).json({ error: "Only the artist on this booking can cancel it this way." }); return; }
  const reason = text(req.body?.reason);
  const emergency = req.body?.emergency === true;
  if (emergency && reason.length < 10) { res.status(400).json({ error: "Please tell us briefly what the emergency is, so we can review it fairly." }); return; }

  const id = param(req.params.appointmentId);
  type Cancelled = { status: number; error: string } | { a: typeof appointmentsTable.$inferSelect; hours: number; kind: ReturnType<typeof cancellationKind> };
  const outcome = await db.transaction(async (tx): Promise<Cancelled> => {
    const [a] = await tx.select().from(appointmentsTable).where(eq(appointmentsTable.id, id)).for("update");
    if (!a || a.stylistId !== profile.id) return { status: 404, error: "Booking not found" } as const;
    if (a.campaignId) return { status: 409, error: "This job is part of a brand campaign. Use 'I can't make it' on the Casting Calls page instead." } as const;
    if (a.status !== "confirmed") return { status: 409, error: a.status === "pending" ? "This booking has not been confirmed yet. You can decline it instead." : "This booking can no longer be cancelled." } as const;
    const hours = hoursUntilEvent({ eventDate: a.date, eventTime: a.time });
    if (hours === null) return { status: 409, error: "This booking has no date, so please contact Bonisa." } as const;
    if (hours <= 0) return { status: 409, error: "This booking has already started. Please contact Bonisa." } as const;
    const kind = cancellationKind(hours);
    await tx.update(appointmentsTable).set({ status: "cancelled", cancelledBy: "artist", cancelledAt: new Date(), cancelNoticeHours: hours }).where(eq(appointmentsTable.id, id));
    return { a, hours, kind };
  });
  if ("error" in outcome) { res.status(outcome.status).json({ error: outcome.error }); return; }
  const { a, hours, kind } = outcome;

  // The client gets their money back: record what is owed so Bonisa refunds it.
  const collected = await collectedFor(id);
  if (collected > 0) await db.update(appointmentsTable).set({ refundDueAmount: collected }).where(eq(appointmentsTable.id, id));

  await syncEvents(profile.id);
  let held = false;
  if (emergency && kind !== "free") {
    const [ev] = await db.select().from(reputationEventsTable).where(and(eq(reputationEventsTable.sourceId, id), eq(reputationEventsTable.stylistId, profile.id), inArray(reputationEventsTable.type, ["late_cancel", "last_minute_cancel"])));
    if (ev) { const d = await openDispute(profile.id, ev.id, `Emergency: ${reason}`); held = !("error" in d); }
  }
  await recomputeReputation(profile.id, { skipSync: true });

  res.json({
    message: kind === "free"
      ? "Booking cancelled. You gave good notice, so there is no mark against you. The client will be refunded."
      : held
        ? "Booking cancelled. Because you flagged an emergency, Bonisa will review it and it does not count against you for now. The client will be refunded."
        : kind === "late_cancel"
          ? "Booking cancelled. This was a late cancellation and has been noted on your record. The client will be refunded."
          : "Booking cancelled. This was a last-minute cancellation and has been noted on your record. The client will be refunded.",
    kind,
    noticeHours: Math.round(hours * 10) / 10,
    heldForReview: held,
    refundDue: collected,
  });

  setImmediate(async () => {
    try {
      const [client] = await db.select().from(usersTable).where(eq(usersTable.id, a.clientId));
      await sendNotification(client?.phone, "booking.declined", { stylistName: a.stylistName, clientName: a.clientName, serviceName: a.serviceName, date: a.date, time: a.time });
      await postSystemMessage(a.clientId, a.stylistId, `Booking cancelled by the artist: ${a.serviceName} on ${a.date} at ${a.time}.${collected > 0 ? " Your payment will be refunded in full." : ""}`);
    } catch (err) { logger.warn({ err }, "Could not tell the client about an artist cancellation"); }
  });
});

// ---------------------------------------------------------------------------
// Safety check-in
// ---------------------------------------------------------------------------

const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const makeCode = () => `BNS-${Array.from({ length: 6 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join("")}`;

/** Jobs that have started (and are not cancelled), for the artist to check in on. */
async function jobsNeedingCheckin(stylistId: string) {
  const rows = await db.select().from(appointmentsTable)
    .where(and(eq(appointmentsTable.stylistId, stylistId), inArray(appointmentsTable.status, ["confirmed", "completed"]),
      gte(appointmentsTable.date, new Date(Date.now() + 2 * 3600e3 - 3 * 86_400_000).toISOString().slice(0, 10))));
  const done = rows.length
    ? await db.select({ id: safetyCheckinsTable.appointmentId }).from(safetyCheckinsTable).where(inArray(safetyCheckinsTable.appointmentId, rows.map((r) => r.id)))
    : [];
  const doneIds = new Set(done.map((d) => d.id));
  return rows.filter((r) => !doneIds.has(r.id) && (hoursUntilEvent({ eventDate: r.date, eventTime: r.time }) ?? 1) <= 0);
}

router.get("/safety/pending", requireAuth, async (req, res) => {
  const profile = await myProfile((req as any).user.id);
  if (!profile) { res.status(403).json({ error: "Only artists can do this." }); return; }
  const jobs = await jobsNeedingCheckin(profile.id);
  res.json(jobs.map((j) => ({ appointmentId: j.id, clientName: j.clientName, serviceName: j.serviceName, date: j.date, time: j.time })));
});

router.post("/appointments/:appointmentId/safety-checkin", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const profile = await myProfile(user.id);
  if (!profile) { res.status(403).json({ error: "Only artists can check in." }); return; }
  const { objectPath, mimeType } = req.body ?? {};
  const safe = req.body?.safe;
  if (typeof safe !== "boolean") { res.status(400).json({ error: "Tell us whether you are safe." }); return; }
  if (typeof objectPath !== "string" || !/^\/objects\/uploads\/[A-Za-z0-9-]+$/.test(objectPath) || !wasUploadedBy(objectPath, user.id) || !["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
    res.status(400).json({ error: "Please add a photo to check in." });
    return;
  }
  const [a] = await db.select().from(appointmentsTable).where(and(eq(appointmentsTable.id, param(req.params.appointmentId)), eq(appointmentsTable.stylistId, profile.id)));
  if (!a) { res.status(404).json({ error: "Booking not found" }); return; }
  if (a.status !== "confirmed" && a.status !== "completed") { res.status(409).json({ error: "You can only check in on a booking that went ahead." }); return; }
  if ((hoursUntilEvent({ eventDate: a.date, eventTime: a.time }) ?? -1) > 0) { res.status(409).json({ error: "This booking has not started yet." }); return; }

  let created: typeof safetyCheckinsTable.$inferSelect | undefined;
  for (let attempt = 0; attempt < 5 && !created; attempt++) {
    const rows = await db.insert(safetyCheckinsTable).values({
      id: randomUUID(), appointmentId: a.id, stylistId: profile.id, code: makeCode(), photoPath: objectPath,
      status: safe ? "safe" : "needs_help", isLastBooking: req.body?.lastBooking === true, note: text(req.body?.note, 500) || null,
    }).onConflictDoNothing().returning();
    created = rows[0];
    if (!created) {
      const [existing] = await db.select().from(safetyCheckinsTable).where(eq(safetyCheckinsTable.appointmentId, a.id));
      if (existing) { res.status(409).json({ error: `You already checked in for this booking (code ${existing.code}).` }); return; }
    }
  }
  if (!created) { res.status(500).json({ error: "Could not save your check-in. Please try again." }); return; }

  if (!safe) {
    setImmediate(async () => {
      const ownerEmail = process.env["OWNER_EMAIL"]?.trim().toLowerCase();
      const [owner] = ownerEmail ? await db.select().from(usersTable).where(sql`lower(${usersTable.email}) = ${ownerEmail}`) : [];
      const data = { artistName: profile.name, serviceName: a.serviceName, clientName: a.clientName, note: created!.code };
      if (owner) await notifyUserId(owner.id, "safety.alert", data);
      const adminPhone = process.env["ADMIN_WHATSAPP_PHONE"];
      if (adminPhone) await sendNotification(adminPhone, "safety.alert", data).catch(() => undefined);
    });
  }
  res.status(201).json({
    code: created.code,
    status: created.status,
    message: safe
      ? (created.isLastBooking ? "Thank you. You are checked in as safe, and that was your last booking. Get home safely." : "Thank you. You are checked in as safe.")
      : "We have told Bonisa you need help and someone will contact you straight away. If you are in danger, please also call the police on 10111.",
  });
});

// ---------------------------------------------------------------------------
// Owner
// ---------------------------------------------------------------------------

router.get("/owner/reputation", requireOwner, async (req, res) => {
  const q = text(req.query["q"], 80).toLowerCase();
  const rows = await db.select({ p: stylistProfilesTable, s: reputationSummaryTable })
    .from(stylistProfilesTable)
    .leftJoin(reputationSummaryTable, eq(reputationSummaryTable.stylistId, stylistProfilesTable.id))
    .where(eq(stylistProfilesTable.verified, true))
    .orderBy(stylistProfilesTable.name).limit(300);
  const openDisputes = await db.select({ stylistId: reputationDisputesTable.stylistId }).from(reputationDisputesTable).where(eq(reputationDisputesTable.status, "open"));
  const disputeCount = new Map<string, number>();
  for (const d of openDisputes) disputeCount.set(d.stylistId, (disputeCount.get(d.stylistId) ?? 0) + 1);
  res.json(rows
    .filter(({ p }) => !q || p.name.toLowerCase().includes(q) || p.specialty.toLowerCase().includes(q))
    .map(({ p, s }) => ({
      stylistId: p.id, name: p.name, specialty: p.specialty,
      tier: s ? (s.evidenceSufficient ? s.tier : "new_talent") : "new_talent",
      tierLabel: s && s.evidenceSufficient ? (CFG.tiers.find((t) => t.key === s.tier)?.label ?? s.tier) : "New Talent",
      building: !s || !s.evidenceSufficient,
      score: s ? Math.round(s.overall * 10) / 10 : null,
      completedBookings: s?.completedBookings ?? 0,
      openDisputes: disputeCount.get(p.id) ?? 0,
    })));
});

router.get("/owner/reputation/disputes", requireOwner, async (_req, res) => {
  const rows = await db.select({ d: reputationDisputesTable, e: reputationEventsTable, name: stylistProfilesTable.name })
    .from(reputationDisputesTable)
    .innerJoin(reputationEventsTable, eq(reputationEventsTable.id, reputationDisputesTable.eventId))
    .innerJoin(stylistProfilesTable, eq(stylistProfilesTable.id, reputationDisputesTable.stylistId))
    .where(eq(reputationDisputesTable.status, "open")).orderBy(reputationDisputesTable.createdAt);
  res.json(rows.map(({ d, e, name }) => ({
    id: d.id, stylistId: d.stylistId, artistName: name, eventId: e.id, eventLabel: EVENT_LABELS[e.type] ?? e.type,
    eventAt: e.eventAt.toISOString(), reason: d.reason, createdAt: d.createdAt.toISOString(),
  })));
});

router.get("/owner/reputation/:stylistId", requireOwner, async (req, res) => {
  const id = param(req.params.stylistId);
  const view = await artistReputationView(id);
  if (!view) { res.status(404).json({ error: "Artist not found" }); return; }
  const [p] = await db.select({ name: stylistProfilesTable.name }).from(stylistProfilesTable).where(eq(stylistProfilesTable.id, id));
  const log = await db.select().from(reputationAuditLogTable).where(eq(reputationAuditLogTable.stylistId, id)).orderBy(desc(reputationAuditLogTable.createdAt)).limit(50);
  const bookings = await db.select().from(appointmentsTable).where(eq(appointmentsTable.stylistId, id)).orderBy(desc(appointmentsTable.date)).limit(25);
  res.json({ name: p?.name ?? "", ...view,
    recentBookings: bookings.map((b) => ({ id: b.id, clientName: b.clientName, serviceName: b.serviceName, date: b.date, time: b.time, status: b.status, noShow: b.noShow, campaign: !!b.campaignId })),
    auditLog: log.map((l) => ({ id: l.id, actor: l.actor, action: l.action, reason: l.reason, createdAt: l.createdAt.toISOString() })) });
});

router.post("/owner/reputation/disputes/:disputeId/resolve", requireOwner, async (req, res) => {
  const decision = req.body?.decision;
  const note = text(req.body?.note);
  if (decision !== "uphold" && decision !== "reject") { res.status(400).json({ error: "Choose uphold or reject." }); return; }
  if (note.length < 5) { res.status(400).json({ error: "A decision needs a reason the artist can read." }); return; }
  const r = await resolveDispute(param(req.params.disputeId), (req as any).user.email, decision, note);
  if ("error" in r) { res.status(r.status).json({ error: r.error }); return; }
  res.json({ message: decision === "uphold" ? "Upheld. The record is removed from her score." : "Rejected. The record stands." });
});

router.post("/owner/reputation/events/:eventId/reverse", requireOwner, async (req, res) => {
  const reason = text(req.body?.reason);
  if (reason.length < 5) { res.status(400).json({ error: "A reason is required." }); return; }
  const r = await reverseEvent(param(req.params.eventId), (req as any).user.email, reason);
  if ("error" in r) { res.status(r.status).json({ error: r.error }); return; }
  res.json({ message: "Event reversed and the score recalculated." });
});

router.post("/owner/reputation/:stylistId/conduct-case", requireOwner, async (req, res) => {
  const severity = req.body?.severity;
  const reason = text(req.body?.reason);
  if (severity !== "minor" && severity !== "serious") { res.status(400).json({ error: "Choose minor or serious." }); return; }
  if (reason.length < 10) { res.status(400).json({ error: "Describe the confirmed case. Only reviewed, confirmed cases can be recorded." }); return; }
  const [p] = await db.select({ id: stylistProfilesTable.id }).from(stylistProfilesTable).where(eq(stylistProfilesTable.id, param(req.params.stylistId)));
  if (!p) { res.status(404).json({ error: "Artist not found" }); return; }
  await recordConductCase(p.id, severity, (req as any).user.email, reason, text(req.body?.complaintId, 100) || undefined);
  res.json({ message: "Recorded. It lowers her professionalism score for 6 months." });
});

router.post("/owner/reputation/:stylistId/recalculate", requireOwner, async (req, res) => {
  const reason = text(req.body?.reason);
  if (reason.length < 5) { res.status(400).json({ error: "A reason is required." }); return; }
  const id = param(req.params.stylistId);
  const row = await recomputeReputation(id);
  if (!row) { res.status(404).json({ error: "Artist not found" }); return; }
  await audit({ stylistId: id, actor: (req as any).user.email, action: "recalculated", reason, after: { overall: row.overall, tier: row.tier } });
  res.json({ message: "Recalculated." });
});

router.post("/owner/appointments/:appointmentId/no-show", requireOwner, async (req, res) => {
  const reason = text(req.body?.reason);
  if (reason.length < 10) { res.status(400).json({ error: "Record what you confirmed (for example, what the client and artist told you)." }); return; }
  const r = await recordNoShow(param(req.params.appointmentId), (req as any).user.email, reason);
  if ("error" in r) { res.status(r.status).json({ error: r.error }); return; }
  res.json({ message: r.refundDue > 0 ? "Recorded as a no-show. The client's payment is marked to be refunded." : "Recorded as a no-show." });
});

router.get("/owner/safety", requireOwner, async (_req, res) => {
  const rows = await db.select({ c: safetyCheckinsTable, name: stylistProfilesTable.name, svc: appointmentsTable.serviceName, client: appointmentsTable.clientName, date: appointmentsTable.date })
    .from(safetyCheckinsTable)
    .innerJoin(stylistProfilesTable, eq(stylistProfilesTable.id, safetyCheckinsTable.stylistId))
    .innerJoin(appointmentsTable, eq(appointmentsTable.id, safetyCheckinsTable.appointmentId))
    .orderBy(desc(safetyCheckinsTable.createdAt)).limit(60);
  res.json(rows.map(({ c, name, svc, client, date }) => ({
    id: c.id, code: c.code, status: c.status, isLastBooking: c.isLastBooking, note: c.note, artistName: name, serviceName: svc, clientName: client, date,
    createdAt: c.createdAt.toISOString(), photoUrl: `/owner/safety/${c.id}/photo`,
  })));
});

router.get("/owner/safety/:checkinId/photo", requireOwner, async (req, res) => {
  const [c] = await db.select().from(safetyCheckinsTable).where(eq(safetyCheckinsTable.id, param(req.params.checkinId)));
  if (!c) { res.status(404).json({ error: "Not found" }); return; }
  try {
    const response = await objectStorage.downloadObject(await objectStorage.getObjectEntityFile(c.photoPath));
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.setHeader("Cache-Control", "private, no-store");
    if (response.body) Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res); else res.end();
  } catch (err) {
    if (err instanceof ObjectNotFoundError) { res.status(404).json({ error: "Photo not found" }); return; }
    res.status(500).json({ error: "Could not load the photo" });
  }
});

export default router;
export { jobsNeedingCheckin };
