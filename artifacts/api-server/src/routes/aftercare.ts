import { Router } from "express";
import { randomBytes, randomUUID } from "crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, aftercarePagesTable, stylistProfilesTable, usersTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { param } from "../lib/params";
import { rateLimit } from "../lib/rateLimit";
import { AFTERCARE_TEMPLATES } from "../lib/aftercareTemplates";
import { MAX_PAGES_PER_ARTIST, parseAftercareInput } from "../lib/aftercareContent";

const router = Router();

// An unguessable public address: 128 random bits, 22 characters.
const newPublicToken = () => randomBytes(16).toString("base64url");

type PageRow = typeof aftercarePagesTable.$inferSelect;

/** What the artist sees about her own page. The public token is hers to share. */
function serializePage(p: PageRow) {
  return {
    id: p.id, title: p.title, category: p.category, blocks: p.blocks, rebookingUrl: p.rebookingUrl ?? null,
    publicToken: p.publicToken, published: p.published,
    reviewedAt: p.reviewedAt?.toISOString() ?? null, publishedAt: p.publishedAt?.toISOString() ?? null,
    viewCount: p.viewCount, lastViewedAt: p.lastViewedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(),
  };
}

async function loadMyProfile(req: any, res: any) {
  const [profile] = await db.select({ id: stylistProfilesTable.id, name: stylistProfilesTable.name, verified: stylistProfilesTable.verified })
    .from(stylistProfilesTable).where(eq(stylistProfilesTable.userId, req.user.id));
  if (!profile) { res.status(404).json({ error: "Artist profile not found" }); return null; }
  return profile;
}

/** Same as loadMyProfile, but only for verified artists. Aftercare is a verified-artist feature. */
async function loadVerifiedProfile(req: any, res: any) {
  const profile = await loadMyProfile(req, res);
  if (!profile) return null;
  if (!profile.verified) { res.status(403).json({ error: "Aftercare pages are for verified artists. Finish your verification to use them." }); return null; }
  return profile;
}

/** One of my own pages, or a 404. Another artist's page is indistinguishable from a missing one. */
async function loadMyPage(req: any, res: any, profileId: string) {
  const [page] = await db.select().from(aftercarePagesTable)
    .where(and(eq(aftercarePagesTable.id, param(req.params.pageId)), eq(aftercarePagesTable.artistProfileId, profileId)));
  if (!page) { res.status(404).json({ error: "Page not found" }); return null; }
  return page;
}

router.get("/aftercare/templates", requireAuth, async (req, res) => {
  if (!(await loadMyProfile(req, res))) return;
  res.json(AFTERCARE_TEMPLATES);
});

router.get("/aftercare", requireAuth, async (req, res) => {
  const profile = await loadMyProfile(req, res);
  if (!profile) return;
  const pages = await db.select().from(aftercarePagesTable)
    .where(eq(aftercarePagesTable.artistProfileId, profile.id)).orderBy(desc(aftercarePagesTable.updatedAt));
  res.setHeader("Cache-Control", "no-store, private");
  res.json({ verified: profile.verified, pages: pages.map(serializePage) });
});

router.post("/aftercare", requireAuth, async (req, res) => {
  const profile = await loadVerifiedProfile(req, res);
  if (!profile) return;
  const parsed = parseAftercareInput(req.body);
  if (!parsed.ok) { res.status(400).json({ error: parsed.error }); return; }
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(aftercarePagesTable).where(eq(aftercarePagesTable.artistProfileId, profile.id));
  if (count >= MAX_PAGES_PER_ARTIST) { res.status(409).json({ error: `You can have up to ${MAX_PAGES_PER_ARTIST} aftercare pages. Delete one you no longer need.` }); return; }
  const [page] = await db.insert(aftercarePagesTable).values({
    id: randomUUID(), artistProfileId: profile.id, publicToken: newPublicToken(), ...parsed.value,
  }).returning();
  res.status(201).json(serializePage(page));
});

router.get("/aftercare/:pageId", requireAuth, async (req, res) => {
  const profile = await loadMyProfile(req, res);
  if (!profile) return;
  const page = await loadMyPage(req, res, profile.id);
  if (!page) return;
  res.setHeader("Cache-Control", "no-store, private");
  res.json(serializePage(page));
});

router.put("/aftercare/:pageId", requireAuth, async (req, res) => {
  const profile = await loadVerifiedProfile(req, res);
  if (!profile) return;
  const page = await loadMyPage(req, res, profile.id);
  if (!page) return;
  const parsed = parseAftercareInput(req.body);
  if (!parsed.ok) { res.status(400).json({ error: parsed.error }); return; }
  // A live page cannot be changed without the artist confirming she has reviewed the new text.
  if (page.published && req.body?.reviewed !== true) {
    res.status(400).json({ error: "This page is live. Confirm that you have reviewed your changes before saving." }); return;
  }
  const [updated] = await db.update(aftercarePagesTable).set({
    ...parsed.value, updatedAt: new Date(), ...(page.published ? { reviewedAt: new Date() } : {}),
  }).where(eq(aftercarePagesTable.id, page.id)).returning();
  res.json(serializePage(updated));
});

router.post("/aftercare/:pageId/publish", requireAuth, async (req, res) => {
  const profile = await loadVerifiedProfile(req, res);
  if (!profile) return;
  const page = await loadMyPage(req, res, profile.id);
  if (!page) return;
  if (req.body?.reviewed !== true) { res.status(400).json({ error: "Please confirm that you have reviewed these instructions before publishing." }); return; }
  if (!page.blocks.length) { res.status(400).json({ error: "Add some instructions before publishing." }); return; }
  const now = new Date();
  const [updated] = await db.update(aftercarePagesTable).set({
    published: true, reviewedAt: now, publishedAt: page.publishedAt ?? now, updatedAt: now,
  }).where(eq(aftercarePagesTable.id, page.id)).returning();
  res.json(serializePage(updated));
});

router.post("/aftercare/:pageId/unpublish", requireAuth, async (req, res) => {
  const profile = await loadMyProfile(req, res);
  if (!profile) return;
  const page = await loadMyPage(req, res, profile.id);
  if (!page) return;
  const [updated] = await db.update(aftercarePagesTable).set({ published: false, updatedAt: new Date() })
    .where(eq(aftercarePagesTable.id, page.id)).returning();
  res.json(serializePage(updated));
});

// A copy for the next client: a new draft with its own link, to be reviewed before it goes live.
router.post("/aftercare/:pageId/duplicate", requireAuth, async (req, res) => {
  const profile = await loadVerifiedProfile(req, res);
  if (!profile) return;
  const page = await loadMyPage(req, res, profile.id);
  if (!page) return;
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(aftercarePagesTable).where(eq(aftercarePagesTable.artistProfileId, profile.id));
  if (count >= MAX_PAGES_PER_ARTIST) { res.status(409).json({ error: `You can have up to ${MAX_PAGES_PER_ARTIST} aftercare pages. Delete one you no longer need.` }); return; }
  const [copy] = await db.insert(aftercarePagesTable).values({
    id: randomUUID(), artistProfileId: profile.id, publicToken: newPublicToken(),
    title: `${page.title} (copy)`.slice(0, 120), category: page.category, blocks: page.blocks, rebookingUrl: page.rebookingUrl,
  }).returning();
  res.status(201).json(serializePage(copy));
});

router.delete("/aftercare/:pageId", requireAuth, async (req, res) => {
  const profile = await loadMyProfile(req, res);
  if (!profile) return;
  const page = await loadMyPage(req, res, profile.id);
  if (!page) return;
  await db.delete(aftercarePagesTable).where(eq(aftercarePagesTable.id, page.id));
  res.json({ ok: true });
});

// The open page a client sees. No login. Returns only what the artist wrote and
// her public name: never user ids, contact details or anything about bookings.
router.get("/public/aftercare/:token", rateLimit({ windowMs: 60_000, max: 60 }), async (req, res) => {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Cache-Control", "no-store");
  const token = param(req.params.token);
  // Tokens are 22 URL-safe characters. Anything else cannot match, so skip the database.
  if (!/^[A-Za-z0-9_-]{22}$/.test(token)) { res.status(404).json({ error: "This page is not available." }); return; }
  const [row] = await db.select({
    page: aftercarePagesTable, artistName: stylistProfilesTable.name, artistProfileId: stylistProfilesTable.id,
    verified: stylistProfilesTable.verified, accountStatus: usersTable.accountStatus,
  }).from(aftercarePagesTable)
    .innerJoin(stylistProfilesTable, eq(stylistProfilesTable.id, aftercarePagesTable.artistProfileId))
    .innerJoin(usersTable, eq(usersTable.id, stylistProfilesTable.userId))
    .where(eq(aftercarePagesTable.publicToken, token));
  // Unpublished, unverified and suspended all look the same from outside.
  if (!row || !row.page.published || !row.verified || row.accountStatus !== "active") {
    res.status(404).json({ error: "This page is not available." }); return;
  }
  await db.update(aftercarePagesTable).set({ viewCount: sql`${aftercarePagesTable.viewCount} + 1`, lastViewedAt: new Date() })
    .where(eq(aftercarePagesTable.id, row.page.id));
  res.json({
    title: row.page.title, category: row.page.category, blocks: row.page.blocks,
    rebookingUrl: row.page.rebookingUrl ?? null,
    artist: { name: row.artistName, profileId: row.artistProfileId },
    updatedAt: row.page.updatedAt.toISOString(),
  });
});

export default router;
