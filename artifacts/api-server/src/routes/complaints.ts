import { Router } from "express";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import {
  db, complaintsTable, complaintEvidenceTable, complaintOwnerNotesTable,
  complaintActivityTable, appointmentsTable, stylistProfilesTable, usersTable, conversationsTable, paymentsTable,
  complaintCategories, complaintStatuses,
} from "@workspace/db";
import { requireAuth, requireOwner } from "../lib/auth";
import { wasUploadedBy } from "../lib/upload-registry";
import { getUncachableStripeClient } from "../stripeClient";
import { transitionToDisputed, transitionFromDisputed } from "../lib/escrow";
import { param } from "../lib/params";
import { logger } from "../lib/logger";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { Readable } from "stream";

const router = Router();
const objectStorageService = new ObjectStorageService();
const id = () => randomUUID();
async function activity(complaintId: string, actorUserId: string, action: string, details?: string, tx: any = db) {
  await tx.insert(complaintActivityTable).values({ id: id(), complaintId, actorUserId, action, details: details ?? null });
}
async function participant(appt: typeof appointmentsTable.$inferSelect, userId: string) {
  if (appt.clientId === userId) return "client";
  const [p] = await db.select().from(stylistProfilesTable).where(and(eq(stylistProfilesTable.id, appt.stylistId), eq(stylistProfilesTable.userId, userId)));
  return p ? "stylist" : null;
}
function publicComplaint(c: any, evidence: any[] = []) {
  return { id: c.id, caseNumber: c.caseNumber, appointmentId: c.appointmentId, complainantRole: c.complainantRole,
    category: c.category, description: c.description, status: c.status, createdAt: c.createdAt, updatedAt: c.updatedAt,
    evidence: evidence.map(e => ({ id: e.id, mimeType: e.mimeType, url: `/complaints/evidence/${e.id}`, createdAt: e.createdAt })) };
}

router.post("/complaints", requireAuth, async (req, res) => {
  const user = (req as any).user;
  if (!["client", "stylist"].includes(user.role)) { res.status(403).json({ error: "Only clients and artists may submit complaints" }); return; }
  const { appointmentId, category, description, subjectUserId } = req.body ?? {};
  if (!complaintCategories.includes(category) || typeof description !== "string" || !description.trim()) { res.status(400).json({ error: "Invalid complaint category or description" }); return; }
  let role = user.role === "stylist" ? "stylist" : "client";
  let validatedSubject: string | null = null;
  if (subjectUserId === user.id) { res.status(400).json({ error: "A complaint cannot target the complainant" }); return; }
  if (appointmentId) {
    const [appt] = await db.select().from(appointmentsTable).where(eq(appointmentsTable.id, String(appointmentId)));
    if (!appt) { res.status(404).json({ error: "Appointment not found" }); return; }
    const actual = await participant(appt, user.id);
    if (!actual) { res.status(403).json({ error: "You are not a participant in this appointment" }); return; }
    role = actual;
    const [profileUser] = await db.select({ userId: stylistProfilesTable.userId }).from(stylistProfilesTable).where(eq(stylistProfilesTable.id, appt.stylistId));
    const other = role === "client" ? profileUser?.userId : appt.clientId;
    if (subjectUserId && subjectUserId !== other) { res.status(403).json({ error: "Subject is not an appointment participant" }); return; }
    validatedSubject = subjectUserId ? other ?? null : null;
  } else if (subjectUserId) {
    const [conversation] = await db.select().from(conversationsTable).where(or(
      and(eq(conversationsTable.clientId, user.id), eq(conversationsTable.stylistId, subjectUserId)),
      and(eq(conversationsTable.stylistId, user.id), eq(conversationsTable.clientId, subjectUserId)),
    )).limit(1);
    if (!conversation) { res.status(403).json({ error: "Subject has no existing relationship with you" }); return; }
    validatedSubject = subjectUserId;
  }
  const seqRows = await db.execute(sql`select nextval('complaint_case_number_seq') as n`);
  const sequenceNumber = Number((seqRows.rows[0] as any)?.n);
  if (!Number.isFinite(sequenceNumber)) { res.status(500).json({ error: "Could not allocate case number" }); return; }
  const caseNumber = `BN-${new Date().getFullYear()}-${String(sequenceNumber).padStart(6, "0")}`;
  const complaint = { id: id(), caseNumber, appointmentId: appointmentId ?? null, complainantUserId: user.id, subjectUserId: validatedSubject, complainantRole: role, category, description: description.trim(), status: "new" };
  const [created] = await db.insert(complaintsTable).values(complaint).returning();
  await activity(created.id, user.id, "created");
  res.status(201).json(publicComplaint(created));
});

router.get("/complaints", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const rows = await db.select().from(complaintsTable).where(eq(complaintsTable.complainantUserId, user.id)).orderBy(desc(complaintsTable.createdAt));
  const result = await Promise.all(rows.map(async c => publicComplaint(c, await db.select().from(complaintEvidenceTable).where(eq(complaintEvidenceTable.complaintId, c.id)))));
  res.json(result);
});
// This path must precede /complaints/:complaintId so "evidence" is not treated
// as a complaint identifier.
router.get("/complaints/evidence/:evidenceId", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const [e] = await db.select().from(complaintEvidenceTable).where(eq(complaintEvidenceTable.id, param(req.params.evidenceId)));
  if (!e) { res.status(404).json({ error: "Evidence not found" }); return; }
  const [c] = await db.select().from(complaintsTable).where(eq(complaintsTable.id, e.complaintId));
  const allowed = user.email?.toLowerCase() === process.env.OWNER_EMAIL?.toLowerCase() || c?.complainantUserId === user.id;
  if (!allowed) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const response = await objectStorageService.downloadObject(await objectStorageService.getObjectEntityFile(e.objectPath));
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    // Object storage may provide a cache policy; complaint evidence is always
    // private and must not be cached, so this is deliberately the final value.
    res.setHeader("Cache-Control", "private, no-store");
    if (response.body) Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res); else res.end();
  } catch (err) { if (err instanceof ObjectNotFoundError) { res.status(404).json({ error: "Evidence object not found" }); return; } res.status(500).json({ error: "Could not load evidence" }); }
});
router.get("/complaints/:complaintId", requireAuth, async (req, res) => {
  const user = (req as any).user; const [c] = await db.select().from(complaintsTable).where(eq(complaintsTable.id, param(req.params.complaintId)));
  if (!c) { res.status(404).json({ error: "Complaint not found" }); return; }
  if (c.complainantUserId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }
  const evidence = await db.select().from(complaintEvidenceTable).where(eq(complaintEvidenceTable.complaintId, c.id));
  res.json(publicComplaint(c, evidence));
});

router.post("/complaints/:complaintId/evidence", requireAuth, async (req, res) => {
  const user = (req as any).user; const complaintId = param(req.params.complaintId);
  const [c] = await db.select().from(complaintsTable).where(eq(complaintsTable.id, complaintId));
  if (!c || c.complainantUserId !== user.id) { res.status(404).json({ error: "Complaint not found" }); return; }
  const { objectPath, mimeType } = req.body ?? {};
  if (typeof objectPath !== "string" || !/^\/objects\/uploads\/[A-Za-z0-9-]+$/.test(objectPath) || !wasUploadedBy(objectPath, user.id) ||
      !["image/jpeg", "image/png", "application/pdf", "video/mp4"].includes(mimeType)) { res.status(400).json({ error: "Invalid evidence upload" }); return; }
  const existing = await db.select().from(complaintEvidenceTable).where(eq(complaintEvidenceTable.complaintId, complaintId));
  if (existing.length >= 10) { res.status(400).json({ error: "Evidence limit reached" }); return; }
  const evidenceId = id();
  const [e] = await db.insert(complaintEvidenceTable).values({ id: evidenceId, complaintId, uploadedByUserId: user.id, objectPath, url: `/complaints/evidence/${evidenceId}`, mimeType }).returning();
  res.status(201).json({ id: e.id, mimeType: e.mimeType, url: `/complaints/evidence/${e.id}` });
});

router.get("/owner/complaints", requireOwner, async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : null;
  if (status && !complaintStatuses.includes(status as any)) { res.status(400).json({ error: "Invalid complaint status" }); return; }
  const rows = await db.select().from(complaintsTable).where(status ? eq(complaintsTable.status, status) : undefined).orderBy(desc(complaintsTable.createdAt));
  res.json(rows.map(c => ({ id: c.id, caseNumber: c.caseNumber, appointmentId: c.appointmentId, subjectUserId: c.subjectUserId, category: c.category, status: c.status, complainantRole: c.complainantRole, description: c.description, createdAt: c.createdAt, updatedAt: c.updatedAt })));
});
router.get("/owner/complaints/:complaintId", requireOwner, async (req, res) => {
  const [c] = await db.select().from(complaintsTable).where(eq(complaintsTable.id, param(req.params.complaintId)));
  if (!c) { res.status(404).json({ error: "Complaint not found" }); return; }
  const [evidence, notes, activities] = await Promise.all([
    db.select().from(complaintEvidenceTable).where(eq(complaintEvidenceTable.complaintId, c.id)),
    db.select().from(complaintOwnerNotesTable).where(eq(complaintOwnerNotesTable.complaintId, c.id)).orderBy(desc(complaintOwnerNotesTable.createdAt)),
    db.select().from(complaintActivityTable).where(eq(complaintActivityTable.complaintId, c.id)).orderBy(desc(complaintActivityTable.createdAt)),
  ]);
  const userSelection = {
    userId: usersTable.id, name: usersTable.name, email: usersTable.email,
    role: usersTable.role, accountStatus: usersTable.accountStatus,
  };
  const [[complainant], subjectRows] = await Promise.all([
    db.select(userSelection).from(usersTable).where(eq(usersTable.id, c.complainantUserId)).limit(1),
    c.subjectUserId
      ? db.select(userSelection).from(usersTable).where(eq(usersTable.id, c.subjectUserId)).limit(1)
      : Promise.resolve([]),
  ]);
  if (!complainant) { res.status(500).json({ error: "Complaint complainant record is missing" }); return; }
  let appointment = null;
  if (c.appointmentId) {
    const [row] = await db.select({
      id: appointmentsTable.id,
      clientUserId: appointmentsTable.clientId,
      clientName: appointmentsTable.clientName,
      artistName: appointmentsTable.stylistName,
      artistUserId: stylistProfilesTable.userId,
      serviceName: appointmentsTable.serviceName,
      date: appointmentsTable.date,
      bookingStatus: appointmentsTable.status,
      payoutStatus: appointmentsTable.payoutStatus,
    }).from(appointmentsTable)
      .innerJoin(stylistProfilesTable, eq(stylistProfilesTable.id, appointmentsTable.stylistId))
      .where(eq(appointmentsTable.id, c.appointmentId));
    if (row) {
      const [payment] = await db.select({
        amount: paymentsTable.amount,
        refundedAmount: paymentsTable.refundedAmount,
      }).from(paymentsTable)
        .where(and(eq(paymentsTable.appointmentId, row.id),
          sql`${paymentsTable.status} in ('succeeded', 'partial_refunded', 'refunded')`))
        .orderBy(desc(paymentsTable.createdAt)).limit(1);
      const grossCents = Math.round((payment?.amount ?? 0) * 100);
      const refundedCents = Math.max(0, Math.round((payment?.refundedAmount ?? 0) * 100));
      appointment = {
        id: row.id,
        clientUserId: row.clientUserId,
        clientName: row.clientName,
        artistUserId: row.artistUserId,
        artistName: row.artistName,
        serviceName: row.serviceName,
        date: row.date,
        bookingStatus: row.bookingStatus,
        payoutStatus: row.payoutStatus,
        grossCollected: grossCents / 100,
        refundedAmount: refundedCents / 100,
        refundableAmount: Math.max(0, grossCents - refundedCents) / 100,
      };
    }
  }
  res.json({
    id: c.id, caseNumber: c.caseNumber, appointmentId: c.appointmentId,
    subjectUserId: c.subjectUserId, complainantRole: c.complainantRole,
    category: c.category, description: c.description, status: c.status,
    createdAt: c.createdAt, updatedAt: c.updatedAt,
    evidence: evidence.map(e => ({ id: e.id, mimeType: e.mimeType, url: `/complaints/evidence/${e.id}`, createdAt: e.createdAt })),
    complainant, subject: subjectRows[0] ?? null,
    appointment, notes, activities,
  });
});

router.post("/owner/complaints/:complaintId/actions", requireOwner, async (req, res) => {
  const owner = (req as any).user; const complaintId = param(req.params.complaintId);
  const [c] = await db.select().from(complaintsTable).where(eq(complaintsTable.id, complaintId));
  if (!c) { res.status(404).json({ error: "Complaint not found" }); return; }
  const { action, status, note, userId, amount } = req.body ?? {};
  try {
    if (action === "status") {
      if (!complaintStatuses.includes(status)) { res.status(400).json({ error: "Invalid complaint status" }); return; }
      await db.update(complaintsTable).set({ status, updatedAt: new Date(), resolvedAt: ["resolved", "closed"].includes(status) ? new Date() : null }).where(eq(complaintsTable.id, complaintId));
      await activity(complaintId, owner.id, "status_changed", status);
    } else if (action === "note") {
      if (typeof note !== "string" || !note.trim()) { res.status(400).json({ error: "Note is required" }); return; }
      await db.insert(complaintOwnerNotesTable).values({ id: id(), complaintId, ownerId: owner.id, note: note.trim() });
      await activity(complaintId, owner.id, "owner_note_added");
    } else if (action === "suspend") {
      if (!userId) { res.status(400).json({ error: "userId is required" }); return; }
      if (typeof note !== "string" || !note.trim() || note.trim().length > 1000) {
        res.status(400).json({ error: "A suspension reason is required (maximum 1000 characters)" }); return;
      }
      if (userId === owner.id) { res.status(403).json({ error: "Owner accounts cannot be suspended by complaint action" }); return; }
      let validTarget = userId === c.complainantUserId || userId === c.subjectUserId;
      if (!validTarget && c.appointmentId) {
        const [appt] = await db.select().from(appointmentsTable).where(eq(appointmentsTable.id, c.appointmentId));
        if (appt) {
          const [artist] = await db.select({ userId: stylistProfilesTable.userId }).from(stylistProfilesTable).where(eq(stylistProfilesTable.id, appt.stylistId));
          validTarget = userId === appt.clientId || userId === artist?.userId;
        }
      }
      if (!validTarget) { res.status(403).json({ error: "Account is not a validated complaint participant" }); return; }
      await db.update(usersTable).set({ accountStatus: "suspended" }).where(eq(usersTable.id, userId));
      await activity(complaintId, owner.id, "account_suspended", `targetUserId=${userId}; reason=${note.trim()}`);
    } else if (action === "hold" || action === "release") {
      if (!c.appointmentId) { res.status(409).json({ error: "Complaint has no payment appointment" }); return; }
      const [appt] = await db.select().from(appointmentsTable).where(eq(appointmentsTable.id, c.appointmentId));
      if (!appt) { res.status(404).json({ error: "Appointment not found" }); return; }
      if (action === "hold") {
        await db.transaction(async tx => {
          const result = await transitionToDisputed(tx, appt, owner.id, `Complaint ${c.caseNumber}`);
          if (!result.updated && !result.alreadyDisputed) throw new Error("Payout has already been released");
          if (result.updated) {
            await tx.update(complaintsTable).set({ updatedAt: new Date() }).where(eq(complaintsTable.id, complaintId));
            await activity(complaintId, owner.id, "payment_held", c.caseNumber, tx);
          }
        });
      } else {
        if (appt.payoutStatus !== "disputed" || !appt.workConfirmedByClient || !appt.workConfirmedByArtist) { res.status(409).json({ error: "Cannot release: confirmations or payout state are invalid" }); return; }
        await db.transaction(async tx => {
          const result = await transitionFromDisputed(tx, appt, owner.id, `Complaint ${c.caseNumber}`);
          if (!result.updated) throw new Error("already released");
          await tx.update(complaintsTable).set({ updatedAt: new Date() }).where(eq(complaintsTable.id, complaintId));
          await activity(complaintId, owner.id, "payment_released", c.caseNumber, tx);
        });
      }
    } else if (action === "refund") {
      if (!c.appointmentId) { res.status(409).json({ error: "Complaint has no payment appointment" }); return; }
      const refundAppointmentId = c.appointmentId;
      await db.transaction(async tx => {
        const [appt] = await tx.select().from(appointmentsTable).where(eq(appointmentsTable.id, refundAppointmentId)).for("update");
        if (!appt || appt.payoutStatus === "released") throw new Error("Refund blocked after payout release");
        const [payment] = await tx.select().from(paymentsTable).where(and(eq(paymentsTable.appointmentId, refundAppointmentId), or(eq(paymentsTable.status, "succeeded"), eq(paymentsTable.status, "partial_refunded")))).orderBy(desc(paymentsTable.createdAt)).limit(1).for("update");
        if (!payment?.stripePaymentIntentId) throw new Error("No authoritative Stripe payment found");
        const cents = Math.round((typeof amount === "number" ? amount : payment.amount - (payment.refundedAmount ?? 0)) * 100);
        const existingCents = Math.round((payment.refundedAmount ?? 0) * 100);
        if (cents <= 0 || cents > Math.round(payment.amount * 100) - existingCents) throw new Error("Invalid refund amount");
        const targetTotal = existingCents + cents;
        const stripe = await getUncachableStripeClient();
        const refund = await stripe.refunds.create({ payment_intent: payment.stripePaymentIntentId, amount: cents }, { idempotencyKey: `complaint-${complaintId}-payment-${payment.id}-target-${targetTotal}` });
        if (refund.status === "failed") throw new Error("Stripe refund failed");
        const charges = await stripe.charges.list({ payment_intent: payment.stripePaymentIntentId, limit: 1 });
        const refundedTotal = charges.data[0]?.amount_refunded;
        if (typeof refundedTotal !== "number") throw new Error("Stripe refund total could not be reconciled");
        const totalZar = refundedTotal / 100;
        await tx.update(paymentsTable).set({ refundedAmount: totalZar, status: totalZar >= payment.amount ? "refunded" : "partial_refunded" }).where(eq(paymentsTable.id, payment.id));
        await tx.update(complaintsTable).set({ updatedAt: new Date() }).where(eq(complaintsTable.id, complaintId));
        await activity(complaintId, owner.id, "refund_succeeded", refund.id, tx);
      });
    } else { res.status(400).json({ error: "Unknown complaint action" }); return; }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err, complaintId, action }, "Complaint action failed");
    await activity(complaintId, owner.id, `${action}_failed`, err instanceof Error ? err.message : "action failed");
    res.status(409).json({ error: "Complaint action failed" });
  }
});

export default router;