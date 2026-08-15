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
import { param } from "../lib/params";
import { db, stylistProfilesTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireOwner } from "../lib/auth";
import { notify } from "../lib/notifications";

const router = Router();

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
        joinedAt: p.createdAt.toISOString(),
      };
    }),
  );

  res.json(result);
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

  await db
    .update(stylistProfilesTable)
    .set({ verified: true, verificationStatus: "verified" })
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
