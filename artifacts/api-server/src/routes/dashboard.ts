import { Router } from "express";
import { db, appointmentsTable, castingCallsTable, castingApplicationsTable, stylistProfilesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/dashboard/stylist", requireAuth, async (req, res) => {
  const user = (req as any).user;

  const appts = await db.select().from(appointmentsTable).where(eq(appointmentsTable.stylistId, user.id));
  const pending = appts.filter(a => a.status === "pending");
  const confirmed = appts.filter(a => a.status === "confirmed");
  const completed = appts.filter(a => a.status === "completed");
  const totalEarnings = completed.reduce((sum, a) => sum + a.price, 0);

  const now = new Date();
  const thisMonthEarnings = completed
    .filter(a => {
      const d = new Date(a.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((sum, a) => sum + a.price, 0);

  const upcoming = appts
    .filter(a => (a.status === "confirmed" || a.status === "pending") && new Date(a.date) >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5)
    .map(a => ({
      id: a.id, clientId: a.clientId, clientName: a.clientName, stylistId: a.stylistId, stylistName: a.stylistName,
      serviceId: a.serviceId, serviceName: a.serviceName, date: a.date, time: a.time, status: a.status,
      price: a.price, duration: a.duration, notes: a.notes ?? null, createdAt: a.createdAt.toISOString(),
    }));

  const [profile] = await db.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.userId, user.id));
  let profileStrength = 10;
  if (profile) {
    if (profile.bio && profile.bio.length > 40) profileStrength += 20;
    if ((profile.availability?.length ?? 0) > 0) profileStrength += 15;
    if (profile.instagram) profileStrength += 10;
    const svcs = await db.select().from(stylistProfilesTable);
    profileStrength = Math.min(100, profileStrength + 15);
  }

  res.json({
    totalBookings: appts.length,
    pendingBookings: pending.length,
    confirmedBookings: confirmed.length,
    completedBookings: completed.length,
    totalEarnings,
    thisMonthEarnings,
    profileStrength,
    upcomingAppointments: upcoming,
    recentActivity: appts.slice(-5).reverse().map(a => ({
      id: a.id,
      type: "appointment",
      description: `${a.clientName} booked ${a.serviceName}`,
      createdAt: a.createdAt.toISOString(),
    })),
  });
});

router.get("/dashboard/client", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const appts = await db.select().from(appointmentsTable).where(eq(appointmentsTable.clientId, user.id));

  const upcoming = appts
    .filter(a => (a.status === "confirmed" || a.status === "pending") && new Date(a.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5)
    .map(a => ({
      id: a.id, clientId: a.clientId, clientName: a.clientName, stylistId: a.stylistId, stylistName: a.stylistName,
      serviceId: a.serviceId, serviceName: a.serviceName, date: a.date, time: a.time, status: a.status,
      price: a.price, duration: a.duration, notes: a.notes ?? null, createdAt: a.createdAt.toISOString(),
    }));

  const allStylists = await db.select().from(stylistProfilesTable).limit(4);
  const recommended = await Promise.all(allStylists.map(async (p) => {
    const { default: buildStylist } = await import("./stylistHelper");
    return buildStylist(p.id);
  }));

  res.json({
    totalBookings: appts.length,
    upcomingBookings: appts.filter(a => a.status === "confirmed" || a.status === "pending").length,
    completedBookings: appts.filter(a => a.status === "completed").length,
    favouriteStylists: 0,
    recentAppointments: upcoming,
    recommendedStylists: recommended.filter(Boolean),
  });
});

router.get("/dashboard/brand", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const calls = await db.select().from(castingCallsTable).where(eq(castingCallsTable.brandId, user.id));
  const totalApplications = calls.reduce((sum, c) => sum + c.applicantCount, 0);

  const allApps = await db.select().from(castingApplicationsTable);
  const myCallIds = new Set(calls.map(c => c.id));
  const myApps = allApps.filter(a => myCallIds.has(a.castingId));

  res.json({
    activeCastingCalls: calls.length,
    totalApplications,
    totalSpend: 0,
    teamSize: 1,
    recentApplications: myApps.slice(-5).reverse().map(a => ({
      id: a.id,
      castingId: a.castingId,
      castingTitle: a.castingTitle,
      stylistId: a.stylistId,
      stylistName: a.stylistName,
      appliedAt: a.appliedAt.toISOString(),
      status: a.status,
    })),
    topCastingCalls: calls.slice(0, 3).map(c => ({
      id: c.id, brandId: c.brandId, brandName: c.brandName, title: c.title, brief: c.brief,
      budget: c.budget, deadline: c.deadline, specialty: c.specialty,
      applicantCount: c.applicantCount, hasApplied: false, createdAt: c.createdAt.toISOString(),
    })),
  });
});

export default router;
