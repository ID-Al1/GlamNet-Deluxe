import { Router } from "express";
import { db, stylistProfilesTable, servicesTable, portfolioItemsTable, usersTable } from "@workspace/db";
import { eq, and, ilike, or } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth } from "../lib/auth";
import {
  UpdateMyStylistProfileBody,
  AddStylistServiceBody,
  UpdateStylistServiceBody,
  AddPortfolioItemBody,
} from "@workspace/api-zod";

const router = Router();

async function buildStylistResponse(profileId: string) {
  const [profile] = await db.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.id, profileId));
  if (!profile) return null;
  const services = await db.select().from(servicesTable).where(eq(servicesTable.stylistId, profileId));
  const portfolio = await db.select().from(portfolioItemsTable).where(eq(portfolioItemsTable.stylistId, profileId));
  return {
    id: profile.id,
    userId: profile.userId,
    name: profile.name,
    specialty: profile.specialty,
    location: profile.location,
    area: profile.area,
    bio: profile.bio ?? null,
    rating: profile.rating,
    reviewCount: profile.reviewCount,
    verified: profile.verified,
    verificationStatus: profile.verificationStatus,
    services: services.map(s => ({ id: s.id, name: s.name, price: s.price, duration: s.duration })),
    portfolio: portfolio.map(p => ({ id: p.id, title: p.title, description: p.description ?? null, type: p.type, imageUrl: p.imageUrl ?? null })),
    availability: profile.availability,
    tags: profile.tags,
    instagram: profile.instagram ?? null,
    website: profile.website ?? null,
    accentColor: profile.accentColor ?? null,
    houseCalls: profile.houseCalls,
  };
}

router.get("/stylists", async (req, res) => {
  const { specialty, location, verified, search } = req.query as Record<string, string>;
  let profiles = await db.select().from(stylistProfilesTable);

  if (specialty && specialty !== "All") {
    profiles = profiles.filter(p => p.specialty.toLowerCase() === specialty.toLowerCase());
  }
  if (location) {
    profiles = profiles.filter(p => p.location.toLowerCase().includes(location.toLowerCase()));
  }
  if (verified === "true") {
    profiles = profiles.filter(p => p.verified);
  }
  if (search) {
    const s = search.toLowerCase();
    profiles = profiles.filter(p =>
      p.name.toLowerCase().includes(s) ||
      p.specialty.toLowerCase().includes(s) ||
      p.location.toLowerCase().includes(s) ||
      (p.bio ?? "").toLowerCase().includes(s)
    );
  }

  const results = await Promise.all(profiles.map(p => buildStylistResponse(p.id)));
  res.json(results.filter(Boolean));
});

router.get("/stylists/me/profile", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const [profile] = await db.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.userId, user.id));
  if (!profile) {
    res.status(404).json({ error: "Stylist profile not found" });
    return;
  }
  const result = await buildStylistResponse(profile.id);
  res.json(result);
});

router.patch("/stylists/me/profile", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const parsed = UpdateMyStylistProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation error" });
    return;
  }
  const [profile] = await db.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.userId, user.id));
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  const data = parsed.data;
  await db.update(stylistProfilesTable).set({
    ...(data.bio !== undefined && { bio: data.bio }),
    ...(data.location !== undefined && { location: data.location }),
    ...(data.area !== undefined && { area: data.area }),
    ...(data.specialty !== undefined && { specialty: data.specialty }),
    ...(data.instagram !== undefined && { instagram: data.instagram }),
    ...(data.website !== undefined && { website: data.website }),
    ...(data.availability !== undefined && { availability: data.availability }),
    ...(data.tags !== undefined && { tags: data.tags }),
    ...((data as any).houseCalls !== undefined && { houseCalls: (data as any).houseCalls }),
  }).where(eq(stylistProfilesTable.id, profile.id));
  const result = await buildStylistResponse(profile.id);
  res.json(result);
});

router.post("/stylists/me/services", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const parsed = AddStylistServiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation error" });
    return;
  }
  const [profile] = await db.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.userId, user.id));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }
  const [service] = await db.insert(servicesTable).values({
    id: randomUUID(),
    stylistId: profile.id,
    name: parsed.data.name,
    price: parsed.data.price,
    duration: parsed.data.duration,
  }).returning();
  res.status(201).json({ id: service.id, name: service.name, price: service.price, duration: service.duration });
});

router.patch("/stylists/me/services/:serviceId", requireAuth, async (req, res) => {
  const parsed = UpdateStylistServiceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation error" }); return; }
  const [service] = await db.update(servicesTable).set(parsed.data).where(eq(servicesTable.id, req.params.serviceId)).returning();
  if (!service) { res.status(404).json({ error: "Service not found" }); return; }
  res.json({ id: service.id, name: service.name, price: service.price, duration: service.duration });
});

router.delete("/stylists/me/services/:serviceId", requireAuth, async (req, res) => {
  await db.delete(servicesTable).where(eq(servicesTable.id, req.params.serviceId));
  res.json({ message: "Deleted" });
});

router.post("/stylists/me/portfolio", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const parsed = AddPortfolioItemBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation error" }); return; }
  const [profile] = await db.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.userId, user.id));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }
  const [item] = await db.insert(portfolioItemsTable).values({
    id: randomUUID(),
    stylistId: profile.id,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    type: parsed.data.type,
    imageUrl: parsed.data.imageUrl ?? null,
  }).returning();
  res.status(201).json({ id: item.id, title: item.title, description: item.description ?? null, type: item.type, imageUrl: item.imageUrl ?? null });
});

router.delete("/stylists/me/portfolio/:itemId", requireAuth, async (req, res) => {
  await db.delete(portfolioItemsTable).where(eq(portfolioItemsTable.id, req.params.itemId));
  res.json({ message: "Deleted" });
});

router.get("/stylists/:stylistId", async (req, res) => {
  const result = await buildStylistResponse(req.params.stylistId);
  if (!result) { res.status(404).json({ error: "Stylist not found" }); return; }
  res.json(result);
});

export default router;
