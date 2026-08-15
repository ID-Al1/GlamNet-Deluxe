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
import { splitAmount } from "../lib/money";
import buildStylistResponse from "./stylistHelper";

const router = Router();

router.get("/dashboard/stylist", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Must fetch profile first — appointments are keyed by profile.id, not user.id
  const profileRows = await db
    .select()
    .from(stylistProfilesTable)
    .where(eq(stylistProfilesTable.userId, user.id))
    .limit(1);
  const profile = profileRows;

  const appts = profileRows[0]
    ? await db
        .select()
        .from(appointmentsTable)
        .where(eq(appointmentsTable.stylistId, profileRows[0].id))
        .orderBy(desc(appointmentsTable.date))
    : [];

  const pending = appts.filter((a) => a.status === "pending");
  const confirmed = appts.filter((a) => a.status === "confirmed");
  const completed = appts.filter((a) => a.status === "completed");

  // Net earnings: artists always see their 82% share, never gross booking values.
  const released = appts.filter((a) => a.payoutStatus === "released");
  const availableEarnings = released.reduce((sum, a) => sum + (a.artistPayoutAmount || 0), 0);
  const pendingEarnings = appts
    .filter((a) => a.payoutStatus === "held" && (a.status === "confirmed" || a.status === "completed"))
    .reduce((sum, a) => sum + (a.artistPayoutAmount || splitAmount(a.price + a.tipAmount).artistShare), 0);
  const thisMonthEarnings = released
    .filter((a) => new Date(a.date) >= monthStart)
    .reduce((sum, a) => sum + (a.artistPayoutAmount || 0), 0);

  function fmtStylistAppt(a: typeof appts[0]) {
    return {
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
      paymentMode: a.paymentMode,
      tipAmount: a.tipAmount,
      workConfirmedByClient: a.workConfirmedByClient,
      workConfirmedByClientAt: a.workConfirmedByClientAt?.toISOString() ?? null,
      workConfirmedByArtist: a.workConfirmedByArtist,
      workConfirmedByArtistAt: a.workConfirmedByArtistAt?.toISOString() ?? null,
      payoutStatus: a.payoutStatus,
      artistPayoutAmount: a.artistPayoutAmount,
      platformFeeAmount: a.platformFeeAmount,
    };
  }

  // Return all appointments (not just upcoming) so work-confirmation buttons can appear on past ones
  const upcoming = appts.slice(0, 30).map(fmtStylistAppt);

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
    totalEarnings: availableEarnings,
    thisMonthEarnings,
    pendingEarnings: Math.round(pendingEarnings * 100) / 100,
    availableEarnings: Math.round(availableEarnings * 100) / 100,
    lifetimeEarnings: Math.round(availableEarnings * 100) / 100,
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

  function fmtClientAppt(a: typeof appts[0]) {
    return {
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
      paymentMode: a.paymentMode,
      tipAmount: a.tipAmount,
      workConfirmedByClient: a.workConfirmedByClient,
      workConfirmedByClientAt: a.workConfirmedByClientAt?.toISOString() ?? null,
      workConfirmedByArtist: a.workConfirmedByArtist,
      workConfirmedByArtistAt: a.workConfirmedByArtistAt?.toISOString() ?? null,
      payoutStatus: a.payoutStatus,
      artistPayoutAmount: a.artistPayoutAmount,
      platformFeeAmount: a.platformFeeAmount,
    };
  }

  // Show all appointments so clients can confirm work on past ones
  const upcoming = appts.slice(0, 30).map(fmtClientAppt);

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
