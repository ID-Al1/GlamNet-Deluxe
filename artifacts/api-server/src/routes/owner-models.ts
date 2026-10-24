import { Router } from "express";
import { Readable } from "stream";
import { randomUUID } from "crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  db, usersTable, modelProfilesTable, modelPhotosTable, opportunitiesTable, opportunityReportsTable, auditEventsTable,
} from "@workspace/db";
import { RejectModelBody } from "@workspace/api-zod";
import { requireOwner } from "../lib/auth";
import { recordAudit } from "../lib/audit";
import { param } from "../lib/params";
import { loadModelParts } from "../lib/modelDto";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";

const router = Router();
const objectStorageService = new ObjectStorageService();
const DAY_MS = 24 * 60 * 60 * 1000;

type Profile = typeof modelProfilesTable.$inferSelect;

function rowDto(p: Profile, photoCount: number) {
  const waiting = p.verificationStatus === "pending" && p.verificationRequestedAt
    ? Math.floor((Date.now() - p.verificationRequestedAt.getTime()) / DAY_MS)
    : null;
  return {
    id: p.id,
    userId: p.userId,
    professionalName: p.professionalName,
    category: p.category,
    area: p.area,
    isPublished: p.isPublished,
    verificationStatus: p.verificationStatus as "none" | "pending" | "verified" | "rejected",
    verificationRequestedAt: p.verificationRequestedAt?.toISOString() ?? null,
    daysWaiting: waiting,
    photoCount,
    createdAt: p.createdAt.toISOString(),
  };
}

async function photoCounts(ids: string[]) {
  if (!ids.length) return new Map<string, number>();
  const rows = await db.select({ id: modelPhotosTable.modelProfileId, n: sql<number>`count(*)::int` }).from(modelPhotosTable)
    .where(inArray(modelPhotosTable.modelProfileId, ids)).groupBy(modelPhotosTable.modelProfileId);
  return new Map(rows.map((r) => [r.id, r.n]));
}

router.get("/owner/models", requireOwner, async (_req, res) => {
  const profiles = await db.select().from(modelProfilesTable);
  const counts = await photoCounts(profiles.map((p) => p.id));
  const rows = profiles.map((p) => rowDto(p, counts.get(p.id) ?? 0));
  // Longest-waiting verification requests first, then everyone else newest first.
  rows.sort((a, b) => {
    const aw = a.verificationStatus === "pending", bw = b.verificationStatus === "pending";
    if (aw !== bw) return aw ? -1 : 1;
    if (aw && bw) return (a.verificationRequestedAt ?? "").localeCompare(b.verificationRequestedAt ?? "");
    return b.createdAt.localeCompare(a.createdAt);
  });
  res.json(rows);
});

router.get("/owner/models/photos/:photoId/file", requireOwner, async (req, res) => {
  const owner = (req as any).user;
  const [photo] = await db.select().from(modelPhotosTable).where(eq(modelPhotosTable.id, param(req.params.photoId)));
  if (!photo) { res.status(404).json({ error: "Not found" }); return; }
  // Audit first: if the log cannot be written, the photo is not served.
  await recordAudit({ id: owner.id, role: "owner" }, "model.photo_viewed", "model_photo", photo.id, { modelProfileId: photo.modelProfileId, kind: photo.kind });
  try {
    const response = await objectStorageService.downloadObject(await objectStorageService.getObjectEntityFile(photo.objectPath));
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.setHeader("Cache-Control", "private, no-store");
    if (response.body) Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res); else res.end();
  } catch (err) {
    if (err instanceof ObjectNotFoundError) { res.status(404).json({ error: "Not found" }); return; }
    res.status(500).json({ error: "Could not load photo" });
  }
});

router.get("/owner/models/:modelId", requireOwner, async (req, res) => {
  const owner = (req as any).user;
  const [p] = await db.select().from(modelProfilesTable).where(eq(modelProfilesTable.id, param(req.params.modelId)));
  if (!p) { res.status(404).json({ error: "Not found" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, p.userId));
  const { photos, links } = await loadModelParts(p.id);
  // Private contact details are returned here, so the read itself is audited first.
  await recordAudit({ id: owner.id, role: "owner" }, "model.record_viewed", "model_profile", p.id);
  res.json({
    row: rowDto(p, photos.length),
    email: user.email,
    phone: user.phone ?? null,
    bio: p.bio,
    skills: p.skills,
    serviceCategories: p.serviceCategories,
    visibility: p.visibility ?? {},
    photos: photos.map((ph) => ({ id: ph.id, kind: ph.kind as "front" | "left" | "right" | "full_length" | "editorial", url: `/owner/models/photos/${ph.id}/file`, isPublic: ph.isPublic })),
    socialLinks: links.map((l) => ({
      id: l.id, platform: l.platform, url: l.url, handle: l.handle, followerCount: l.followerCount,
      statSource: l.statSource, statUpdatedAt: l.statUpdatedAt?.toISOString() ?? null, isPublic: l.isPublic,
    })),
  });
});

router.post("/owner/models/:modelId/verify", requireOwner, async (req, res) => {
  const owner = (req as any).user;
  const id = param(req.params.modelId);
  const [exists] = await db.select().from(modelProfilesTable).where(eq(modelProfilesTable.id, id));
  if (!exists) { res.status(404).json({ error: "Not found" }); return; }
  // Only from pending, so a replayed click cannot overwrite a later decision.
  const [p] = await db.update(modelProfilesTable).set({
    verificationStatus: "verified", verifiedAt: new Date(), verificationRejectionReason: null, updatedAt: new Date(),
  }).where(and(eq(modelProfilesTable.id, id), eq(modelProfilesTable.verificationStatus, "pending"))).returning();
  if (!p) { res.status(409).json({ error: "This model is not waiting for verification." }); return; }
  await recordAudit({ id: owner.id, role: "owner" }, "model.verified", "model_profile", id);
  const counts = await photoCounts([id]);
  res.json(rowDto(p, counts.get(id) ?? 0));
});

router.post("/owner/models/:modelId/reject", requireOwner, async (req, res) => {
  const owner = (req as any).user;
  const parsed = RejectModelBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "A written reason of at least 10 characters is required." }); return; }
  const id = param(req.params.modelId);
  const [exists] = await db.select().from(modelProfilesTable).where(eq(modelProfilesTable.id, id));
  if (!exists) { res.status(404).json({ error: "Not found" }); return; }
  const [p] = await db.update(modelProfilesTable).set({
    verificationStatus: "rejected", verificationRejectionReason: parsed.data.reason.trim(), isPublished: false, updatedAt: new Date(),
  }).where(and(eq(modelProfilesTable.id, id), eq(modelProfilesTable.verificationStatus, "pending"))).returning();
  if (!p) { res.status(409).json({ error: "This model is not waiting for verification." }); return; }
  await recordAudit({ id: owner.id, role: "owner" }, "model.verification_rejected", "model_profile", id);
  const counts = await photoCounts([id]);
  res.json(rowDto(p, counts.get(id) ?? 0));
});

router.get("/owner/audit-events", requireOwner, async (_req, res) => {
  const rows = await db.select({ e: auditEventsTable, name: usersTable.name }).from(auditEventsTable)
    .leftJoin(usersTable, eq(usersTable.id, auditEventsTable.actorUserId))
    .orderBy(desc(auditEventsTable.createdAt)).limit(200);
  res.json(rows.map(({ e, name }) => ({
    id: e.id, actorUserId: e.actorUserId, actorName: name ?? null, actorRole: e.actorRole,
    action: e.action, targetType: e.targetType, targetId: e.targetId, createdAt: e.createdAt.toISOString(),
  })));
});

router.get("/owner/opportunity-reports", requireOwner, async (_req, res) => {
  const reports = await db.select().from(opportunityReportsTable);
  const byOpp = new Map<string, string[]>();
  for (const r of reports) byOpp.set(r.opportunityId, [...(byOpp.get(r.opportunityId) ?? []), r.reason]);
  if (!byOpp.size) { res.json([]); return; }
  const opps = await db.select().from(opportunitiesTable).where(inArray(opportunitiesTable.id, [...byOpp.keys()]));
  res.json(opps.map((o) => ({
    opportunityId: o.id, title: o.title, organiserName: o.organiserName, status: o.status,
    reportCount: byOpp.get(o.id)!.length, reasons: byOpp.get(o.id)!,
  })).sort((a, b) => b.reportCount - a.reportCount));
});

router.post("/owner/opportunities/:opportunityId/close", requireOwner, async (req, res) => {
  const owner = (req as any).user;
  const id = param(req.params.opportunityId);
  const [o] = await db.update(opportunitiesTable).set({ status: "closed" }).where(eq(opportunitiesTable.id, id)).returning();
  if (!o) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit({ id: owner.id, role: "owner" }, "opportunity.closed_by_owner", "opportunity", id);
  res.json({ message: "Opportunity closed" });
});

export default router;
