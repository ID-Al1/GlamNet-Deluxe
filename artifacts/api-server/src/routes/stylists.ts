import { Router } from "express";
import { param } from "../lib/params";
import { db, stylistProfilesTable, servicesTable, portfolioItemsTable, usersTable, appointmentsTable } from "@workspace/db";
import { eq, and, ilike, or } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth, verifyToken } from "../lib/auth";
import { notify } from "../lib/notifications";
import {
  UpdateMyStylistProfileBody,
  AddStylistServiceBody,
  UpdateStylistServiceBody,
  AddPortfolioItemBody,
} from "@workspace/api-zod";

const router = Router();

async function computeReputationScore(profileId: string, currentRating: number, reviewCount: number) {
  const appointments = await db.select({
    clientId: appointmentsTable.clientId,
    status: appointmentsTable.status,
  }).from(appointmentsTable).where(eq(appointmentsTable.stylistId, profileId));

  const total = appointments.length;
  if (total === 0) return null;

  const cancelled = appointments.filter(a => a.status === "cancelled").length;
  const completed = appointments.filter(a => a.status === "completed").length;

  const clientCounts: Record<string, number> = {};
  for (const a of appointments) {
    clientCounts[a.clientId] = (clientCounts[a.clientId] ?? 0) + 1;
  }
  const uniqueClients = Object.keys(clientCounts).length;
  const repeatClients = Object.values(clientCounts).filter(c => c >= 2).length;

  const cancellationRate = total > 0 ? cancelled / total : 0;
  const repeatClientRate = uniqueClients > 0 ? repeatClients / uniqueClients : 0;

  const reviewPoints = reviewCount > 0 ? (currentRating / 5) * 35 : 0;
  const cancellationPoints = (1 - cancellationRate) * 30;
  const repeatPoints = repeatClientRate * 20;
  const volumePoints = Math.min(completed / 10, 1) * 15;

  const score = Math.round(reviewPoints + cancellationPoints + repeatPoints + volumePoints);

  return {
    score,
    cancellationRate: Math.round(cancellationRate * 100),
    repeatClientRate: Math.round(repeatClientRate * 100),
    completedBookings: completed,
    totalBookings: total,
  };
}

function computeProfileReadiness(
  profile: typeof stylistProfilesTable.$inferSelect,
  services: typeof servicesTable.$inferSelect[],
  portfolio: typeof portfolioItemsTable.$inferSelect[],
  phone: string | null,
) {
  const criteria = [
    {
      id: 1,
      label: "Services listed",
      met: services.length > 0,
      hint: "Add at least one service with a name, price and duration so clients can pick what they need.",
    },
    {
      id: 2,
      label: "Working days set",
      met: profile.availability != null && profile.availability.length > 0,
      hint: "Choose which days of the week you're available so the calendar only shows valid booking dates.",
    },
    {
      id: 3,
      label: "Bio written",
      met: typeof profile.bio === "string" && profile.bio.trim().length >= 30,
      hint: "Write a short bio (at least 30 characters) so clients know who they're booking.",
    },
    {
      id: 4,
      label: "Specialty confirmed",
      met: typeof profile.specialty === "string" && profile.specialty.trim().length > 0,
      hint: "Set your specialty (e.g. Hair, Makeup, Nails) so clients can find you by category.",
    },
    {
      id: 5,
      label: "Location set",
      met: typeof profile.location === "string" && profile.location.trim().length > 0,
      hint: "Add your city or area so clients nearby can discover and book you.",
    },
    {
      id: 6,
      label: "Portfolio added",
      met: portfolio.length > 0,
      hint: "Upload at least one portfolio item (photo or video of your work) to build client confidence.",
    },
    {
      id: 7,
      label: "Contact available",
      met: !!(phone || profile.instagram || profile.website),
      hint: "Add a phone number, Instagram handle, or website so clients can reach you if needed.",
    },
  ];

  const completedCount = criteria.filter(c => c.met).length;
  return {
    criteria,
    completedCount,
    totalCount: criteria.length,
    canBeBooked: criteria[0].met, // services is the hard requirement
    isFullyReady: completedCount === criteria.length,
  };
}

async function buildStylistResponse(profileId: string) {
  const [profile] = await db.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.id, profileId));
  if (!profile) return null;
  const services = await db.select().from(servicesTable).where(eq(servicesTable.stylistId, profileId));
  const portfolio = await db.select().from(portfolioItemsTable).where(eq(portfolioItemsTable.stylistId, profileId));
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, profile.userId));
  const reputation = await computeReputationScore(profile.id, profile.rating ?? 0, profile.reviewCount ?? 0);
  const phone = user?.phone ?? null;
  const readiness = computeProfileReadiness(profile, services, portfolio, phone);
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
    phone,
    reputationScore: reputation?.score ?? null,
    reputationBreakdown: reputation ?? null,
    profileReadiness: readiness,
  };
}

router.get("/stylists", async (req, res) => {
  const { specialty, location, search, minRating, maxPrice, houseCalls, availabilityDay, language, service, area } = req.query as Record<string, string>;
  // Part a: only verified artists appear in browse results — enforced at DB level.
  let profiles = await db.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.verified, true));

  if (specialty && specialty !== "All") {
    profiles = profiles.filter(p => p.specialty.toLowerCase() === specialty.toLowerCase());
  }
  if (location) {
    profiles = profiles.filter(p => p.location.toLowerCase().includes(location.toLowerCase()));
  }
  if (area) {
    const a = area.toLowerCase();
    profiles = profiles.filter(p =>
      p.area.toLowerCase().includes(a) || p.location.toLowerCase().includes(a)
    );
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
  if (minRating) {
    const rating = parseFloat(minRating);
    if (!isNaN(rating)) {
      profiles = profiles.filter(p => (p.rating ?? 0) >= rating);
    }
  }
  if (houseCalls === "true") {
    profiles = profiles.filter(p => p.houseCalls);
  }
  if (availabilityDay) {
    const day = availabilityDay.toLowerCase();
    profiles = profiles.filter(p =>
      p.availability.some(a => a.toLowerCase().includes(day))
    );
  }
  if (language) {
    const lang = language.toLowerCase();
    profiles = profiles.filter(p =>
      p.tags.some(t => t.toLowerCase().includes(lang))
    );
  }

  const needsServiceData = !!(maxPrice || service);
  let allServices: typeof servicesTable.$inferSelect[] = [];
  if (needsServiceData && profiles.length > 0) {
    allServices = await db.select().from(servicesTable);
  }

  if (maxPrice && profiles.length > 0) {
    const price = parseFloat(maxPrice);
    if (!isNaN(price)) {
      const profileIds = new Set(profiles.map(p => p.id));
      const minPriceById: Record<string, number> = {};
      for (const s of allServices) {
        if (profileIds.has(s.stylistId)) {
          if (minPriceById[s.stylistId] === undefined || s.price < minPriceById[s.stylistId]) {
            minPriceById[s.stylistId] = s.price;
          }
        }
      }
      profiles = profiles.filter(p => {
        const cheapest = minPriceById[p.id];
        return cheapest === undefined || cheapest <= price;
      });
    }
  }

  if (service && profiles.length > 0) {
    const svc = service.toLowerCase();
    const profileIds = new Set(profiles.map(p => p.id));
    const stylistsWithService = new Set<string>();
    for (const s of allServices) {
      if (profileIds.has(s.stylistId) && s.name.toLowerCase().includes(svc)) {
        stylistsWithService.add(s.stylistId);
      }
    }
    profiles = profiles.filter(p => stylistsWithService.has(p.id));
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
    ...(data.houseCalls !== undefined && { houseCalls: data.houseCalls }),
  }).where(eq(stylistProfilesTable.id, profile.id));
  const result = await buildStylistResponse(profile.id);
  res.json(result);
});

// Artist submits her profile for verification.
// "none" → "pending" (also allows resubmission after a rejection resets to "none").
// Returns 409 if already pending or already verified.
router.patch("/stylists/me/verification-submit", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const [profile] = await db.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.userId, user.id));
  if (!profile) { res.status(404).json({ error: "Stylist profile not found" }); return; }
  if (profile.verificationStatus === "pending") {
    res.status(409).json({ error: "Your profile is already under review." }); return;
  }
  if (profile.verificationStatus === "verified") {
    res.status(409).json({ error: "Your profile is already verified." }); return;
  }

  await db.update(stylistProfilesTable)
    .set({ verificationStatus: "pending" })
    .where(eq(stylistProfilesTable.id, profile.id));

  // Notify the artist — non-fatal, runs after response is sent
  setImmediate(async () => {
    try {
      const [userRow] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
      await notify(
        { phone: userRow?.phone, email: userRow?.email, name: userRow?.name },
        "verification.submitted",
        { artistName: profile.name },
      );
    } catch { /* non-fatal */ }
  });

  res.json({ message: "Profile submitted for verification. We'll be in touch within 72 hours." });
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
  const [service] = await db.update(servicesTable).set(parsed.data).where(eq(servicesTable.id, param(req.params.serviceId))).returning();
  if (!service) { res.status(404).json({ error: "Service not found" }); return; }
  res.json({ id: service.id, name: service.name, price: service.price, duration: service.duration });
});

router.delete("/stylists/me/services/:serviceId", requireAuth, async (req, res) => {
  await db.delete(servicesTable).where(eq(servicesTable.id, param(req.params.serviceId)));
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
  await db.delete(portfolioItemsTable).where(eq(portfolioItemsTable.id, param(req.params.itemId)));
  res.json({ message: "Deleted" });
});

// Part e: verification checklist — what the artist needs to complete before going live.
// Must be declared before /:stylistId to avoid being swallowed by that wildcard.
router.get("/stylists/me/verification-checklist", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const [profile] = await db.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.userId, user.id));
  if (!profile) { res.status(404).json({ error: "Stylist profile not found" }); return; }

  const [services, portfolio, userRow] = await Promise.all([
    db.select().from(servicesTable).where(eq(servicesTable.stylistId, profile.id)),
    db.select().from(portfolioItemsTable).where(eq(portfolioItemsTable.stylistId, profile.id)),
    db.select().from(usersTable).where(eq(usersTable.id, user.id)).then(r => r[0] ?? null),
  ]);
  const phone = userRow?.phone ?? null;
  const readiness = computeProfileReadiness(profile, services, portfolio, phone);

  res.json({
    verified: profile.verified,
    verificationStatus: profile.verificationStatus,
    ...readiness,
  });
});

router.get("/stylists/:stylistId", async (req, res) => {
  const result = await buildStylistResponse(req.params.stylistId);
  if (!result) { res.status(404).json({ error: "Stylist not found" }); return; }

  // Part b: unverified artists are invisible to everyone except the artist herself
  // (so she can preview her own profile while she completes the checklist).
  if (!result.verified) {
    const auth = req.headers.authorization;
    let requestingUserId: string | null = null;
    if (auth?.startsWith("Bearer ")) {
      requestingUserId = verifyToken(auth.slice(7));
    }
    if (requestingUserId !== result.userId) {
      res.status(404).json({ error: "Stylist not found" });
      return;
    }
  }

  res.json(result);
});

export default router;
