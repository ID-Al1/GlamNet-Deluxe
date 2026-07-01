import { Router } from "express";
import {
  db,
  appointmentsTable,
  castingCallsTable,
  castingApplicationsTable,
  stylistProfilesTable,
  servicesTable,
  portfolioItemsTable,
} from "@workspace/db";
import { eq, and, gte, or, sql, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import buildStylistResponse from "./stylistHelper";

const router = Router();

router.get("/dashboard/stylist", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [profile, appts] = await Promise.all([
    db
      .select()
      .from(stylistProfilesTable)
      .where(eq(stylistProfilesTable.userId, user.id))
      .limit(1),
    db
      .select()
      .from(appointmentsTable)
      .where(eq(appointmentsTable.stylistId, user.id))
      .orderBy(desc(appointmentsTable.date)),
  ]);

  const pending = appts.filter((a) => a.status === "pending");
  const confirmed = appts.filter((a) => a.status === "confirmed");
  const completed = appts.filter((a) => a.status === "completed");

  const thisMonthEarnings = completed
    .filter((a) => new Date(a.date) >= monthStart)
    .reduce((sum, a) => sum + a.price, 0);

  const upcoming = appts
    .filter(
      (a) =>
        (a.status === "confirmed" || a.status === "pending") &&
        new Date(a.date) >= now,
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5)
    .map((a) => ({
      id: a.id,
      clientId: a.clientId,
      clientName: a.clientName,
      stylistId: a.stylistId,
      stylistName: a.stylistName,
      serviceId: a.serviceId,
      serviceName: a.serviceName,
      date: a.date,
      time: a.time,
      status: a.status,
      price: a.price,
      duration: a.duration,
      notes: a.notes ?? null,
      createdAt: a.createdAt.toISOString(),
    }));

  let profileStrength = 10;
  const p = profile[0];
  if (p) {
    if (p.bio && p.bio.length > 40) profileStrength += 20;
    if ((p.availability?.length ?? 0) > 0) profileStrength += 15;
    if (p.instagram) profileStrength += 10;
    const [svcCount, portCount] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(servicesTable)
        .where(eq(servicesTable.stylistId, p.id)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(portfolioItemsTable)
        .where(eq(portfolioItemsTable.stylistId, p.id)),
    ]);
    if ((svcCount[0]?.count ?? 0) > 0) profileStrength += 20;
    if ((portCount[0]?.count ?? 0) > 0) profileStrength += 25;
  }

  res.json({
    totalBookings: appts.length,
    pendingBookings: pending.length,
    confirmedBookings: confirmed.length,
    completedBookings: completed.length,
    totalEarnings: completed.reduce((sum, a) => sum + a.price, 0),
    thisMonthEarnings,
    profileStrength: Math.min(100, profileStrength),
    upcomingAppointments: upcoming,
    recentActivity: appts.slice(0, 5).map((a) => ({
      id: a.id,
      type: "appointment",
      description: `${a.clientName} booked ${a.serviceName}`,
      createdAt: a.createdAt.toISOString(),
    })),
  });
});

router.get("/dashboard/client", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const now = new Date();

  const appts = await db
    .select()
    .from(appointmentsTable)
    .where(eq(appointmentsTable.clientId, user.id))
    .orderBy(desc(appointmentsTable.date));

  const upcoming = appts
    .filter(
      (a) =>
        (a.status === "confirmed" || a.status === "pending") &&
        new Date(a.date) >= now,
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5)
    .map((a) => ({
      id: a.id,
      clientId: a.clientId,
      clientName: a.clientName,
      stylistId: a.stylistId,
      stylistName: a.stylistName,
      serviceId: a.serviceId,
      serviceName: a.serviceName,
      date: a.date,
      time: a.time,
      status: a.status,
      price: a.price,
      duration: a.duration,
      notes: a.notes ?? null,
      createdAt: a.createdAt.toISOString(),
    }));

  const allStylists = await db
    .select()
    .from(stylistProfilesTable)
    .limit(4);

  const recommended = await Promise.all(
    allStylists.map((p) => buildStylistResponse(p.id)),
  );

  res.json({
    totalBookings: appts.length,
    upcomingBookings: appts.filter(
      (a) => a.status === "confirmed" || a.status === "pending",
    ).length,
    completedBookings: appts.filter((a) => a.status === "completed").length,
    favouriteStylists: 0,
    recentAppointments: upcoming,
    recommendedStylists: recommended.filter(Boolean),
  });
});

router.get("/dashboard/brand", requireAuth, async (req, res) => {
  const user = (req as any).user;

  const [calls, allApps] = await Promise.all([
    db
      .select()
      .from(castingCallsTable)
      .where(eq(castingCallsTable.brandId, user.id)),
    db.select().from(castingApplicationsTable),
  ]);

  const myCallIds = new Set(calls.map((c) => c.id));
  const myApps = allApps.filter((a) => myCallIds.has(a.castingId));

  res.json({
    activeCastingCalls: calls.length,
    totalApplications: calls.reduce((sum, c) => sum + c.applicantCount, 0),
    totalSpend: 0,
    teamSize: 1,
    recentApplications: myApps.slice(-5).reverse().map((a) => ({
      id: a.id,
      castingId: a.castingId,
      castingTitle: a.castingTitle,
      stylistId: a.stylistId,
      stylistName: a.stylistName,
      appliedAt: a.appliedAt.toISOString(),
      status: a.status,
    })),
    topCastingCalls: calls.slice(0, 3).map((c) => ({
      id: c.id,
      brandId: c.brandId,
      brandName: c.brandName,
      title: c.title,
      brief: c.brief,
      budget: c.budget,
      deadline: c.deadline,
      specialty: c.specialty,
      applicantCount: c.applicantCount,
      hasApplied: false,
      createdAt: c.createdAt.toISOString(),
    })),
  });
});

export default router;
