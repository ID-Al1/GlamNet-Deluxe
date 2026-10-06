/**
 * Brand profile and verification.
 *
 * Brand:
 *   GET  /brand/profile          — the signed-in brand's business profile
 *   PUT  /brand/profile          — update it
 *   POST /brand/profile/submit   — send it to Bonisa for verification
 *
 * Owner:
 *   GET  /owner/brands/pending
 *   POST /owner/brands/:brandProfileId/verify
 *   POST /owner/brands/:brandProfileId/reject   — reason required, sent word for word
 *
 * A brand has to be verified before it can post or fund a campaign, so artists
 * are only ever shown real companies.
 */
import { Router } from "express";
import { and, asc, eq } from "drizzle-orm";
import { brandProfilesTable, db, usersTable } from "@workspace/db";
import { RejectBrandBody, UpdateMyBrandProfileBody } from "@workspace/api-zod";
import { requireAuth, requireOwner } from "../lib/auth";
import { param } from "../lib/params";
import { getOrCreateBrandProfile, notifyUserId, presentBrandProfile } from "../lib/campaigns";

const router = Router();

const clean = (value: string | null | undefined) => {
  const text = value?.trim();
  return text ? text : null;
};

router.get("/brand/profile", requireAuth, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "brand") { res.status(403).json({ error: "Only brand accounts have a brand profile." }); return; }
  const profile = await getOrCreateBrandProfile(user);
  res.json(presentBrandProfile(profile, user));
});

router.put("/brand/profile", requireAuth, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "brand") { res.status(403).json({ error: "Only brand accounts have a brand profile." }); return; }
  const parsed = UpdateMyBrandProfileBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Check the details and try again." }); return; }
  const profile = await getOrCreateBrandProfile(user);
  const data = parsed.data;

  // Once submitted or verified, the identity of the company is locked. Changing it means a new review.
  const locked = profile.verificationStatus !== "none";
  if (locked) {
    const nameChanged = data.companyName !== undefined && data.companyName.trim() !== profile.companyName;
    const regChanged = data.registrationNumber !== undefined && clean(data.registrationNumber) !== (profile.registrationNumber ?? null);
    if (nameChanged || regChanged) {
      res.status(409).json({ error: "Your company name and registration number are locked once submitted. Contact Bonisa to change them." });
      return;
    }
  }

  const set: Partial<typeof brandProfilesTable.$inferInsert> = { updatedAt: new Date() };
  if (!locked && data.companyName !== undefined) set.companyName = data.companyName.trim();
  if (!locked && data.registrationNumber !== undefined) set.registrationNumber = clean(data.registrationNumber);
  if (data.vatNumber !== undefined) set.vatNumber = clean(data.vatNumber);
  if (data.website !== undefined) set.website = clean(data.website);
  if (data.billingAddress !== undefined) set.billingAddress = clean(data.billingAddress);

  const [updated] = await db.update(brandProfilesTable).set(set).where(eq(brandProfilesTable.id, profile.id)).returning();
  res.json(presentBrandProfile(updated!, user));
});

router.post("/brand/profile/submit", requireAuth, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "brand") { res.status(403).json({ error: "Only brand accounts have a brand profile." }); return; }
  const profile = await getOrCreateBrandProfile(user);
  if (profile.verificationStatus === "pending") { res.status(409).json({ error: "Your brand is already waiting for review." }); return; }
  if (profile.verificationStatus === "verified") { res.status(409).json({ error: "Your brand is already verified." }); return; }
  const view = presentBrandProfile(profile, user);
  if (view.missing.length > 0) {
    res.status(400).json({ error: `Still needed before you can submit: ${view.missing.join(", ")}.` });
    return;
  }
  const [updated] = await db.update(brandProfilesTable)
    .set({ verificationStatus: "pending", submittedAt: new Date(), rejectionReason: null, updatedAt: new Date() })
    .where(and(eq(brandProfilesTable.id, profile.id), eq(brandProfilesTable.verificationStatus, "none")))
    .returning();
  if (!updated) { res.status(409).json({ error: "Your brand profile just changed. Reload and try again." }); return; }
  res.json(presentBrandProfile(updated, user));
});

// ---------------------------------------------------------------------------
// Owner
// ---------------------------------------------------------------------------

router.get("/owner/brands/pending", requireOwner, async (_req, res) => {
  const rows = await db.select({
    profile: brandProfilesTable,
    contactName: usersTable.name,
    email: usersTable.email,
    phone: usersTable.phone,
  }).from(brandProfilesTable)
    .innerJoin(usersTable, eq(usersTable.id, brandProfilesTable.userId))
    .where(eq(brandProfilesTable.verificationStatus, "pending"))
    .orderBy(asc(brandProfilesTable.submittedAt), asc(brandProfilesTable.id));
  res.json(rows.map(({ profile, contactName, email, phone }) => ({
    profileId: profile.id,
    userId: profile.userId,
    companyName: profile.companyName,
    registrationNumber: profile.registrationNumber ?? null,
    vatNumber: profile.vatNumber ?? null,
    website: profile.website ?? null,
    billingAddress: profile.billingAddress ?? null,
    contactName,
    email,
    phone: phone ?? null,
    submittedAt: profile.submittedAt?.toISOString() ?? null,
  })));
});

router.post("/owner/brands/:brandProfileId/verify", requireOwner, async (req, res) => {
  const id = param(req.params.brandProfileId);
  const [profile] = await db.select().from(brandProfilesTable).where(eq(brandProfilesTable.id, id));
  if (!profile) { res.status(404).json({ error: "Brand not found" }); return; }
  const [updated] = await db.update(brandProfilesTable)
    .set({ verificationStatus: "verified", verifiedAt: new Date(), rejectionReason: null, updatedAt: new Date() })
    .where(and(eq(brandProfilesTable.id, id), eq(brandProfilesTable.verificationStatus, "pending")))
    .returning();
  if (!updated) { res.status(409).json({ error: "Only brands waiting for review can be verified." }); return; }
  setImmediate(() => void notifyUserId(profile.userId, "brand.verified", { brandName: profile.companyName }));
  res.json({ message: `${profile.companyName} is verified and can now post campaigns.` });
});

router.post("/owner/brands/:brandProfileId/reject", requireOwner, async (req, res) => {
  const id = param(req.params.brandProfileId);
  const parsed = RejectBrandBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Tell them what needs fixing. A rejection with no reason just loses the brand." }); return; }
  const [profile] = await db.select().from(brandProfilesTable).where(eq(brandProfilesTable.id, id));
  if (!profile) { res.status(404).json({ error: "Brand not found" }); return; }
  const reason = parsed.data.reason.trim();
  const [updated] = await db.update(brandProfilesTable)
    .set({ verificationStatus: "none", rejectionReason: reason, updatedAt: new Date() })
    .where(and(eq(brandProfilesTable.id, id), eq(brandProfilesTable.verificationStatus, "pending")))
    .returning();
  if (!updated) { res.status(409).json({ error: "Only brands waiting for review can be sent back." }); return; }
  setImmediate(() => void notifyUserId(profile.userId, "brand.rejected", { brandName: profile.companyName, rejectionReason: reason }));
  res.json({ message: `${profile.companyName} has been told what to fix and can resubmit.` });
});

export default router;
