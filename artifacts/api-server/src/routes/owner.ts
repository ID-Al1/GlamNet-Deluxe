/**
 * Owner-only routes for Bonisa admin operations.
 *
 * Protected by requireOwner — caller's JWT email must match OWNER_EMAIL.
 *
 * Verification flow:
 *   GET  /owner/artists/pending          — list artists awaiting review
 *   POST /owner/artists/:profileId/verify — approve and notify
 *   POST /owner/artists/:profileId/reject — reject with reason and notify
 */
import { Router } from "express";
import { Readable } from "stream";
import { param } from "../lib/params";
import { db, portfolioItemsTable, servicesTable, stylistProfilesTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireOwner } from "../lib/auth";
import { notify } from "../lib/notifications";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage";
import { computeProfileReadiness } from "./stylists";

const router = Router();
const objectStorageService = new ObjectStorageService();

// ---------------------------------------------------------------------------
// List pending artists
// ---------------------------------------------------------------------------
router.get("/owner/artists/pending", requireOwner, async (req, res) => {
  const profiles = await db
    .select()
    .from(stylistProfilesTable)
    .where(eq(stylistProfilesTable.verificationStatus, "pending"));

  const result = await Promise.all(
    profiles.map(async (p) => {
      const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, p.userId));
      return {
        profileId: p.id,
        name: p.name,
        specialty: p.specialty,
        location: p.location,
        bio: p.bio ?? null,
        email: user?.email ?? null,
        phone: user?.phone ?? null,
        identityDocumentAvailable: !!p.idDocumentUrl,
        joinedAt: p.createdAt.toISOString(),
      };
    }),
  );

  res.json(result);
});

router.get("/owner/artists/:profileId/identity", requireOwner, async (req, res) => {
  const [profile] = await db.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.id, param(req.params.profileId)));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }
  if (!profile.idNumber) { res.status(404).json({ error: "Identity details have not been submitted" }); return; }

  res.json({ idNumber: profile.idNumber, documentAvailable: !!profile.idDocumentUrl });
});

router.get("/owner/artists/:profileId/identity-document", requireOwner, async (req, res) => {
  const [profile] = await db.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.id, param(req.params.profileId)));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }
  if (!profile.idDocumentUrl) { res.status(404).json({ error: "Identity document has not been submitted" }); return; }

  try {
    const file = await objectStorageService.getObjectEntityFile(profile.idDocumentUrl);
    const response = await objectStorageService.downloadObject(file, 0);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.setHeader("Cache-Control", "no-store, private");
    if (response.body) {
      Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Identity document not found" }); return;
    }
    res.status(500).json({ error: "Could not load the identity document" });
  }
});

// ---------------------------------------------------------------------------
// Approve an artist
// ---------------------------------------------------------------------------
router.post("/owner/artists/:profileId/verify", requireOwner, async (req, res) => {
  const profileId = param(req.params.profileId);
  const [profile] = await db
    .select()
    .from(stylistProfilesTable)
    .where(eq(stylistProfilesTable.id, profileId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const [[artistUser], services, portfolio] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.id, profile.userId)),
    db.select().from(servicesTable).where(eq(servicesTable.stylistId, profileId)),
    db.select().from(portfolioItemsTable).where(eq(portfolioItemsTable.stylistId, profileId)),
  ]);
  const readiness = computeProfileReadiness(profile, services, portfolio, artistUser?.phone ?? null);
  const missingItems = readiness.criteria
    .filter((criterion) => !criterion.met)
    .map(({ id, label, hint }) => ({ id, label, hint }));
  if (missingItems.length > 0) {
    res.status(400).json({
      error: "This artist cannot be verified until all profile requirements are complete.",
      missingItems,
    });
    return;
  }

  await db
    .update(stylistProfilesTable)
    .set({ verified: true, verificationStatus: "verified" })
    .where(eq(stylistProfilesTable.id, profileId));

  if (artistUser) {
    setImmediate(async () => {
      try {
        await notify(
          { phone: artistUser.phone, email: artistUser.email, name: artistUser.name },
          "verification.approved",
          { artistName: profile.name },
        );
      } catch { /* non-fatal */ }
    });
  }

  res.json({ message: `${profile.name} is now verified and live on Bonisa` });
});

// ---------------------------------------------------------------------------
// Reject an artist — resets status to "none" so she can fix and resubmit
// ---------------------------------------------------------------------------
router.post("/owner/artists/:profileId/reject", requireOwner, async (req, res) => {
  const profileId = param(req.params.profileId);
  const { reason, outstandingItems } = req.body as {
    reason?: string;
    outstandingItems?: string[];
  };

  const [profile] = await db
    .select()
    .from(stylistProfilesTable)
    .where(eq(stylistProfilesTable.id, profileId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  // Reset to "none" so the artist can address the issues and submit again.
  await db
    .update(stylistProfilesTable)
    .set({ verificationStatus: "none" })
    .where(eq(stylistProfilesTable.id, profileId));

  const [artistUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, profile.userId));

  if (artistUser) {
    setImmediate(async () => {
      try {
        await notify(
          { phone: artistUser.phone, email: artistUser.email, name: artistUser.name },
          "verification.rejected",
          { artistName: profile.name, rejectionReason: reason, outstandingItems },
        );
      } catch { /* non-fatal */ }
    });
  }

  res.json({ message: `Verification rejected — ${profile.name} notified and reset to not-submitted` });
});

export default router;
