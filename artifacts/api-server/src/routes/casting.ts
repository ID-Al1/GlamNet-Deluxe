import { Router } from "express";
import { db, castingCallsTable, castingApplicationsTable, stylistProfilesTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { sendNotification } from "../lib/notifications";
import { randomUUID } from "crypto";
import { requireAuth } from "../lib/auth";
import { CreateCastingCallBody, UpdateCastingCallBody } from "@workspace/api-zod";

const router = Router();

function formatCall(c: typeof castingCallsTable.$inferSelect, hasApplied = false) {
  return {
    id: c.id,
    brandId: c.brandId,
    brandName: c.brandName,
    title: c.title,
    brief: c.brief,
    budget: c.budget,
    deadline: c.deadline,
    specialty: c.specialty,
    applicantCount: c.applicantCount,
    hasApplied,
    createdAt: c.createdAt.toISOString(),
  };
}

router.get("/casting", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { specialty, brandId } = req.query as Record<string, string>;
  let calls = await db.select().from(castingCallsTable);

  if (specialty) calls = calls.filter(c => c.specialty.toLowerCase() === specialty.toLowerCase());
  if (brandId) calls = calls.filter(c => c.brandId === brandId);

  let stylistProfileId: string | null = null;
  if (user.role === "stylist") {
    const [profile] = await db.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.userId, user.id));
    stylistProfileId = profile?.id ?? null;
  }

  const result = await Promise.all(calls.map(async (c) => {
    let hasApplied = false;
    if (stylistProfileId) {
      const apps = await db.select().from(castingApplicationsTable)
        .where(and(eq(castingApplicationsTable.castingId, c.id), eq(castingApplicationsTable.stylistId, stylistProfileId)));
      hasApplied = apps.length > 0;
    }
    return formatCall(c, hasApplied);
  }));

  res.json(result);
});

router.post("/casting", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const parsed = CreateCastingCallBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation error" }); return; }

  const [call] = await db.insert(castingCallsTable).values({
    id: randomUUID(),
    brandId: user.id,
    brandName: user.businessName ?? user.name,
    ...parsed.data,
  }).returning();

  res.status(201).json(formatCall(call));
});

router.get("/casting/:castingId", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const [call] = await db.select().from(castingCallsTable).where(eq(castingCallsTable.id, req.params.castingId));
  if (!call) { res.status(404).json({ error: "Not found" }); return; }

  let hasApplied = false;
  if (user.role === "stylist") {
    const [profile] = await db.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.userId, user.id));
    if (profile) {
      const apps = await db.select().from(castingApplicationsTable)
        .where(and(eq(castingApplicationsTable.castingId, call.id), eq(castingApplicationsTable.stylistId, profile.id)));
      hasApplied = apps.length > 0;
    }
  }
  res.json(formatCall(call, hasApplied));
});

router.patch("/casting/:castingId", requireAuth, async (req, res) => {
  const parsed = UpdateCastingCallBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation error" }); return; }
  const [call] = await db.update(castingCallsTable).set(parsed.data).where(eq(castingCallsTable.id, req.params.castingId)).returning();
  if (!call) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatCall(call));
});

router.delete("/casting/:castingId", requireAuth, async (req, res) => {
  await db.delete(castingCallsTable).where(eq(castingCallsTable.id, req.params.castingId));
  res.json({ message: "Deleted" });
});

router.post("/casting/:castingId/apply", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const [profile] = await db.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.userId, user.id));
  if (!profile) { res.status(403).json({ error: "Only stylists can apply" }); return; }

  const [call] = await db.select().from(castingCallsTable).where(eq(castingCallsTable.id, req.params.castingId));
  if (!call) { res.status(404).json({ error: "Not found" }); return; }

  const existing = await db.select().from(castingApplicationsTable)
    .where(and(eq(castingApplicationsTable.castingId, call.id), eq(castingApplicationsTable.stylistId, profile.id)));
  if (existing.length > 0) { res.json({ message: "Already applied" }); return; }

  await db.insert(castingApplicationsTable).values({
    id: randomUUID(),
    castingId: call.id,
    castingTitle: call.title,
    stylistId: profile.id,
    stylistName: profile.name,
    status: "pending",
  });

  await db.update(castingCallsTable).set({ applicantCount: call.applicantCount + 1 }).where(eq(castingCallsTable.id, call.id));

  res.json({ message: "Applied successfully" });

  // Notify brand of new application — non-fatal
  setImmediate(async () => {
    try {
      const [brandUser] = await db.select().from(usersTable).where(eq(usersTable.id, call.brandId));
      await sendNotification(brandUser?.phone, "casting.applied", {
        applicantName: profile.name,
        castingTitle: call.title,
        brandName: call.brandName,
      });
    } catch { /* non-fatal */ }
  });
});

export default router;
