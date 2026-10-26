import { Router } from "express";
import { Readable } from "stream";
import { randomUUID } from "crypto";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import {
  db, usersTable, modelProfilesTable, modelPhotosTable, modelSocialLinksTable, modelEnquiriesTable,
  opportunitiesTable, opportunityApplicationsTable,
} from "@workspace/db";
import {
  UpdateMyModelProfileBody, SetMyModelPublishedBody, ReplaceMySocialLinksBody,
  RegisterMyModelPhotoBody, UpdateMyModelPhotoBody, SendTalentEnquiryBody, ListTalentQueryParams,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { requireModel } from "../lib/modelAuth";
import { recordAudit } from "../lib/audit";
import { param } from "../lib/params";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { wasUploadedBy } from "../lib/upload-registry";
import { isListed, loadModelParts, missingForPublish, ownerProfileDto, talentCardDto, talentProfileDto } from "../lib/modelDto";
import { myApplicationDto } from "./opportunities";

const router = Router();
const objectStorageService = new ObjectStorageService();

const MAX_EDITORIAL = 12;
const MAX_ENQUIRIES_PER_DAY = 3;
const ownerPhotoUrl = (id: string) => `/models/me/photos/${id}/file`;

async function sendPrivateFile(res: any, objectPath: string) {
  const response = await objectStorageService.downloadObject(await objectStorageService.getObjectEntityFile(objectPath));
  res.status(response.status);
  response.headers.forEach((value, key) => res.setHeader(key, value));
  // Set last so object storage cache hints can never make a private photo cacheable.
  res.setHeader("Cache-Control", "private, no-store");
  if (response.body) Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res); else res.end();
}

async function ownerView(profileId: string) {
  const [profile] = await db.select().from(modelProfilesTable).where(eq(modelProfilesTable.id, profileId));
  const { photos, links } = await loadModelParts(profileId);
  return ownerProfileDto(profile, photos, links, ownerPhotoUrl);
}

/** Listed = published, verified, and the account is not suspended. */
async function listedProfiles() {
  const rows = await db.select({ profile: modelProfilesTable }).from(modelProfilesTable)
    .innerJoin(usersTable, eq(usersTable.id, modelProfilesTable.userId))
    .where(and(
      eq(modelProfilesTable.isPublished, true),
      eq(modelProfilesTable.verificationStatus, "verified"),
      eq(usersTable.accountStatus, "active"),
    ));
  return rows.map((r) => r.profile);
}

// ── Public directory ────────────────────────────────────────────────────────

router.get("/talent", async (req, res) => {
  const q = ListTalentQueryParams.safeParse(req.query);
  if (!q.success) { res.status(400).json({ error: "Validation error" }); return; }
  const { q: text, category, area, availability } = q.data;

  const profiles = await listedProfiles();
  const photoRows = profiles.length
    ? await db.select().from(modelPhotosTable).where(inArray(modelPhotosTable.modelProfileId, profiles.map((p) => p.id)))
    : [];

  // Filters run on the card (what the public may see), never on hidden fields.
  let cards = profiles.map((p) => talentCardDto(p, photoRows.filter((ph) => ph.modelProfileId === p.id)));
  if (category) cards = cards.filter((c) => c.category.toLowerCase() === category.toLowerCase());
  if (area) cards = cards.filter((c) => c.area?.toLowerCase().includes(area.toLowerCase()));
  if (availability) cards = cards.filter((c) => c.availability === availability);
  if (text) {
    const needle = text.toLowerCase();
    cards = cards.filter((c) =>
      [c.professionalName, c.category, c.area ?? "", ...c.skills].some((v) => v.toLowerCase().includes(needle)));
  }
  // Spotlight picks are an editorial choice by Bonisa and come first. Everyone else is alphabetical, never ranked.
  cards.sort((a, b) => Number(b.isSpotlight) - Number(a.isSpotlight) || a.professionalName.localeCompare(b.professionalName));
  res.json(cards);
});

// Must precede /talent/:modelId so "photos" is not read as a model id.
router.get("/talent/photos/:photoId", async (req, res) => {
  const [photo] = await db.select().from(modelPhotosTable).where(eq(modelPhotosTable.id, param(req.params.photoId)));
  if (!photo || !photo.isPublic) { res.status(404).json({ error: "Not found" }); return; }
  const [profile] = await db.select().from(modelProfilesTable).where(eq(modelProfilesTable.id, photo.modelProfileId));
  const [user] = profile ? await db.select().from(usersTable).where(eq(usersTable.id, profile.userId)) : [];
  if (!profile || !isListed(profile) || user?.accountStatus !== "active") { res.status(404).json({ error: "Not found" }); return; }
  try {
    const response = await objectStorageService.downloadObject(await objectStorageService.getObjectEntityFile(photo.objectPath), 300);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.setHeader("Cache-Control", "public, max-age=300");
    if (response.body) Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res); else res.end();
  } catch (err) {
    if (err instanceof ObjectNotFoundError) { res.status(404).json({ error: "Not found" }); return; }
    res.status(500).json({ error: "Could not load photo" });
  }
});

router.get("/talent/:modelId", async (req, res) => {
  const profiles = (await listedProfiles()).filter((p) => p.id === param(req.params.modelId));
  const profile = profiles[0];
  if (!profile) { res.status(404).json({ error: "Not found" }); return; }
  const { photos, links } = await loadModelParts(profile.id);
  res.json(talentProfileDto(profile, photos, links));
});

router.post("/talent/:modelId/enquiries", requireAuth, async (req, res) => {
  const user = (req as any).user;
  if (user.role === "model") { res.status(403).json({ error: "Models cannot send enquiries to other models." }); return; }
  const parsed = SendTalentEnquiryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation error" }); return; }
  const profile = (await listedProfiles()).find((p) => p.id === param(req.params.modelId));
  if (!profile) { res.status(404).json({ error: "Not found" }); return; }
  if (!profile.acceptsEnquiries) { res.status(403).json({ error: "This model is not accepting enquiries right now." }); return; }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(modelEnquiriesTable).where(and(
    eq(modelEnquiriesTable.modelProfileId, profile.id), eq(modelEnquiriesTable.fromUserId, user.id), gte(modelEnquiriesTable.createdAt, since)));
  if (n >= MAX_ENQUIRIES_PER_DAY) { res.status(429).json({ error: "You have already sent several enquiries to this model today." }); return; }

  await db.insert(modelEnquiriesTable).values({ id: randomUUID(), modelProfileId: profile.id, fromUserId: user.id, message: parsed.data.message.trim() });
  res.status(201).json({ message: "Enquiry sent" });
});

// ── The model's own workspace ───────────────────────────────────────────────

router.get("/models/me/profile", requireModel, async (req, res) => {
  res.json(await ownerView((req as any).modelProfile.id));
});

router.patch("/models/me/profile", requireModel, async (req, res) => {
  const profile = (req as any).modelProfile as typeof modelProfilesTable.$inferSelect;
  const user = (req as any).user;
  const parsed = UpdateMyModelProfileBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation error" }); return; }
  const d = parsed.data;

  const update: Partial<typeof modelProfilesTable.$inferInsert> = { updatedAt: new Date() };
  if (d.professionalName !== undefined) update.professionalName = d.professionalName.trim();
  if (d.category !== undefined) update.category = d.category.trim();
  if (d.area !== undefined) update.area = d.area.trim();
  if (d.bio !== undefined) update.bio = d.bio?.trim() || null;
  if (d.skills !== undefined) update.skills = d.skills.map((s) => s.trim()).filter(Boolean);
  if (d.serviceCategories !== undefined) update.serviceCategories = d.serviceCategories.map((s) => s.trim()).filter(Boolean);
  if (d.availability !== undefined) update.availability = d.availability;
  if (d.acceptsEnquiries !== undefined) update.acceptsEnquiries = d.acceptsEnquiries;
  if (d.startingRateCents !== undefined) update.startingRateCents = d.startingRateCents;
  if (d.rateNote !== undefined) update.rateNote = d.rateNote?.trim() || null;
  if (d.creativeIdentity !== undefined) update.creativeIdentity = d.creativeIdentity?.trim() || null;
  if (d.collaborationPreferences !== undefined) update.collaborationPreferences = d.collaborationPreferences?.trim() || null;
  if (d.careerGoals !== undefined) update.careerGoals = d.careerGoals?.trim() || null;
  if (d.visibility !== undefined) {
    // Merge so one switch cannot wipe the others; only known keys are kept.
    const KEYS = ["area", "availability", "bio", "skills", "serviceCategories", "rates"];
    const next = { ...(profile.visibility ?? {}) };
    for (const k of KEYS) if (typeof d.visibility[k] === "boolean") next[k] = d.visibility[k];
    update.visibility = next;
    await recordAudit({ id: user.id, role: "model" }, "model.visibility_changed", "model_profile", profile.id, { fields: Object.keys(d.visibility).filter((k) => KEYS.includes(k)) });
  }
  await db.update(modelProfilesTable).set(update).where(eq(modelProfilesTable.id, profile.id));
  res.json(await ownerView(profile.id));
});

router.put("/models/me/social-links", requireModel, async (req, res) => {
  const profile = (req as any).modelProfile as typeof modelProfilesTable.$inferSelect;
  const parsed = ReplaceMySocialLinksBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation error" }); return; }
  for (const l of parsed.data.links) {
    try {
      const u = new URL(l.url);
      if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("scheme");
    } catch { res.status(400).json({ error: `"${l.url}" is not a valid link. Include https://` }); return; }
  }
  const existing = await db.select().from(modelSocialLinksTable).where(eq(modelSocialLinksTable.modelProfileId, profile.id));
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.delete(modelSocialLinksTable).where(eq(modelSocialLinksTable.modelProfileId, profile.id));
    if (parsed.data.links.length) {
      await tx.insert(modelSocialLinksTable).values(parsed.data.links.map((l) => {
        const before = existing.find((e) => e.platform === l.platform && e.url === l.url);
        const count = l.followerCount ?? null;
        // The "last updated" date only moves when the number actually changes.
        const unchanged = before && before.followerCount === count;
        return {
          id: randomUUID(), modelProfileId: profile.id, platform: l.platform, url: l.url.trim(),
          handle: l.handle?.trim() || null, followerCount: count, statSource: "self_reported",
          statUpdatedAt: count === null ? null : unchanged ? before!.statUpdatedAt : now,
          isPublic: l.isPublic === true,
        };
      }));
    }
  });
  res.json(await ownerView(profile.id));
});

// ── Photos ──────────────────────────────────────────────────────────────────

router.post("/models/me/photos", requireModel, async (req, res) => {
  const profile = (req as any).modelProfile as typeof modelProfilesTable.$inferSelect;
  const user = (req as any).user;
  const parsed = RegisterMyModelPhotoBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation error" }); return; }
  const { kind, objectPath, mimeType } = parsed.data;
  // The upload URL must have been minted for this very user a moment ago.
  if (!wasUploadedBy(objectPath, user.id)) { res.status(400).json({ error: "That upload could not be verified. Please upload the photo again." }); return; }

  if (kind === "editorial") {
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(modelPhotosTable)
      .where(and(eq(modelPhotosTable.modelProfileId, profile.id), eq(modelPhotosTable.kind, "editorial")));
    if (n >= MAX_EDITORIAL) { res.status(400).json({ error: `You can keep up to ${MAX_EDITORIAL} editorial portraits.` }); return; }
  }
  await db.transaction(async (tx) => {
    // Digitals are one-per-kind: a retake replaces the earlier shot.
    if (kind !== "editorial") await tx.delete(modelPhotosTable).where(and(eq(modelPhotosTable.modelProfileId, profile.id), eq(modelPhotosTable.kind, kind)));
    await tx.insert(modelPhotosTable).values({ id: randomUUID(), modelProfileId: profile.id, kind, objectPath, mimeType, isPublic: false });
  });
  await recordAudit({ id: user.id, role: "model" }, "model.photo_added", "model_profile", profile.id, { kind });
  res.status(201).json(await ownerView(profile.id));
});

router.get("/models/me/photos/:photoId/file", requireModel, async (req, res) => {
  const profile = (req as any).modelProfile as typeof modelProfilesTable.$inferSelect;
  const [photo] = await db.select().from(modelPhotosTable).where(and(eq(modelPhotosTable.id, param(req.params.photoId)), eq(modelPhotosTable.modelProfileId, profile.id)));
  if (!photo) { res.status(404).json({ error: "Not found" }); return; }
  try { await sendPrivateFile(res, photo.objectPath); } catch (err) {
    if (err instanceof ObjectNotFoundError) { res.status(404).json({ error: "Not found" }); return; }
    res.status(500).json({ error: "Could not load photo" });
  }
});

router.patch("/models/me/photos/:photoId", requireModel, async (req, res) => {
  const profile = (req as any).modelProfile as typeof modelProfilesTable.$inferSelect;
  const user = (req as any).user;
  const parsed = UpdateMyModelPhotoBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation error" }); return; }
  const [photo] = await db.update(modelPhotosTable).set({ isPublic: parsed.data.isPublic })
    .where(and(eq(modelPhotosTable.id, param(req.params.photoId)), eq(modelPhotosTable.modelProfileId, profile.id))).returning();
  if (!photo) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit({ id: user.id, role: "model" }, parsed.data.isPublic ? "model.photo_made_public" : "model.photo_made_private", "model_photo", photo.id, { kind: photo.kind });
  res.json(await ownerView(profile.id));
});

router.delete("/models/me/photos/:photoId", requireModel, async (req, res) => {
  const profile = (req as any).modelProfile as typeof modelProfilesTable.$inferSelect;
  const user = (req as any).user;
  const [photo] = await db.delete(modelPhotosTable)
    .where(and(eq(modelPhotosTable.id, param(req.params.photoId)), eq(modelPhotosTable.modelProfileId, profile.id))).returning();
  if (!photo) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit({ id: user.id, role: "model" }, "model.photo_removed", "model_profile", profile.id, { kind: photo.kind });
  res.json(await ownerView(profile.id));
});

// ── Publish and verification ────────────────────────────────────────────────

router.post("/models/me/publish", requireModel, async (req, res) => {
  const profile = (req as any).modelProfile as typeof modelProfilesTable.$inferSelect;
  const user = (req as any).user;
  const parsed = SetMyModelPublishedBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation error" }); return; }
  if (parsed.data.published) {
    const { photos } = await loadModelParts(profile.id);
    const missing = missingForPublish(profile, photos);
    if (missing.length) { res.status(400).json({ error: `Still needed before you can publish: ${missing.join(", ")}.` }); return; }
  }
  await db.update(modelProfilesTable).set({
    isPublished: parsed.data.published,
    publishedAt: parsed.data.published ? new Date() : profile.publishedAt,
    updatedAt: new Date(),
  }).where(eq(modelProfilesTable.id, profile.id));
  await recordAudit({ id: user.id, role: "model" }, parsed.data.published ? "model.published" : "model.unpublished", "model_profile", profile.id);
  res.json(await ownerView(profile.id));
});

router.post("/models/me/verification-request", requireModel, async (req, res) => {
  const profile = (req as any).modelProfile as typeof modelProfilesTable.$inferSelect;
  const user = (req as any).user;
  if (profile.verificationStatus === "pending") { res.status(400).json({ error: "Your verification request is already with Bonisa." }); return; }
  if (profile.verificationStatus === "verified") { res.status(400).json({ error: "Your profile is already verified." }); return; }
  const { photos } = await loadModelParts(profile.id);
  const missing = missingForPublish(profile, photos);
  if (missing.length) { res.status(400).json({ error: `Complete your profile first. Still needed: ${missing.join(", ")}.` }); return; }
  await db.update(modelProfilesTable).set({
    verificationStatus: "pending", verificationRequestedAt: new Date(), verificationRejectionReason: null, updatedAt: new Date(),
  }).where(eq(modelProfilesTable.id, profile.id));
  await recordAudit({ id: user.id, role: "model" }, "model.verification_requested", "model_profile", profile.id);
  res.json(await ownerView(profile.id));
});

// ── Enquiries, applications, saved ──────────────────────────────────────────

router.get("/models/me/enquiries", requireModel, async (req, res) => {
  const profile = (req as any).modelProfile as typeof modelProfilesTable.$inferSelect;
  const rows = await db.select({ e: modelEnquiriesTable, name: usersTable.name, role: usersTable.role, business: usersTable.businessName })
    .from(modelEnquiriesTable).innerJoin(usersTable, eq(usersTable.id, modelEnquiriesTable.fromUserId))
    .where(eq(modelEnquiriesTable.modelProfileId, profile.id)).orderBy(desc(modelEnquiriesTable.createdAt));
  res.json(rows.map((r) => ({ id: r.e.id, message: r.e.message, fromName: r.business || r.name, fromRole: r.role, createdAt: r.e.createdAt.toISOString() })));
});

router.get("/models/me/applications", requireModel, async (req, res) => {
  const profile = (req as any).modelProfile as typeof modelProfilesTable.$inferSelect;
  const rows = await db.select({ a: opportunityApplicationsTable, o: opportunitiesTable }).from(opportunityApplicationsTable)
    .innerJoin(opportunitiesTable, eq(opportunitiesTable.id, opportunityApplicationsTable.opportunityId))
    .where(eq(opportunityApplicationsTable.modelProfileId, profile.id)).orderBy(desc(opportunityApplicationsTable.updatedAt));
  res.json(rows.map((r) => myApplicationDto(r.a, r.o)));
});

router.post("/models/me/applications/:applicationId/withdraw", requireModel, async (req, res) => {
  const profile = (req as any).modelProfile as typeof modelProfilesTable.$inferSelect;
  const user = (req as any).user;
  const id = param(req.params.applicationId);
  const [mine] = await db.select().from(opportunityApplicationsTable)
    .where(and(eq(opportunityApplicationsTable.id, id), eq(opportunityApplicationsTable.modelProfileId, profile.id)));
  if (!mine) { res.status(404).json({ error: "Not found" }); return; }
  // Atomic: only an application that is still open can be withdrawn.
  const [done] = await db.update(opportunityApplicationsTable).set({ status: "withdrawn", updatedAt: new Date() })
    .where(and(eq(opportunityApplicationsTable.id, id), inArray(opportunityApplicationsTable.status, ["applied", "shortlisted"]))).returning();
  if (!done) { res.status(409).json({ error: "This application can no longer be withdrawn here." }); return; }
  await recordAudit({ id: user.id, role: "model" }, "application.withdrawn", "application", id);
  res.json({ message: "Application withdrawn" });
});

export default router;
