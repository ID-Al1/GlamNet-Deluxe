/**
 * Owner-only routes for Bonisa admin operations.
 *
 * Protected by requireOwner — caller's JWT email must match OWNER_EMAIL.
 *
 * Verification flow:
 *   GET  /owner/artists/pending          — list artists awaiting review
 *   GET  /owner/artists/not-submitted    — list artists who have not submitted
 *   POST /owner/artists/:profileId/verify — approve and notify
 *   POST /owner/artists/:profileId/reject — reject with reason and notify
 */
import { Router } from "express";
import { Readable } from "stream";
import { param } from "../lib/params";
import { appointmentsTable, bookingTeamMembersTable, db, payoutBatchesTable, payoutLedgerTable, portfolioItemsTable, servicesTable, stylistProfilesTable, usersTable, bankAccountsTable, bankAccountAccessLogTable, complaintsTable } from "@workspace/db";
import { and, asc, desc, eq, gte, ilike, inArray, lt, or, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireOwner } from "../lib/auth";
import { notify } from "../lib/notifications";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage";
import { computeProfileReadiness } from "./stylists";
import { revokeUserStreams } from "../lib/chatBroadcaster";

const router = Router();
const objectStorageService = new ObjectStorageService();

const ownerArtistSummary = {
  profileId: stylistProfilesTable.id,
  userId: usersTable.id,
  name: stylistProfilesTable.name,
  specialty: stylistProfilesTable.specialty,
  location: stylistProfilesTable.location,
  rating: stylistProfilesTable.rating,
  reviewCount: stylistProfilesTable.reviewCount,
  verified: stylistProfilesTable.verified,
  verificationStatus: stylistProfilesTable.verificationStatus,
  accountStatus: usersTable.accountStatus,
  joinedAt: usersTable.createdAt,
  completedBookings: sql<number>`(select count(distinct a.id)::int from appointments a left join booking_team_members tm on tm.appointment_id = a.id and tm.stylist_id = ${stylistProfilesTable.id} and tm.status = 'confirmed' where (a.stylist_id = ${stylistProfilesTable.id} or tm.stylist_id is not null) and a.status = 'completed')`,
  totalBookings: sql<number>`(select count(distinct a.id)::int from appointments a left join booking_team_members tm on tm.appointment_id = a.id and tm.stylist_id = ${stylistProfilesTable.id} and tm.status = 'confirmed' where a.stylist_id = ${stylistProfilesTable.id} or tm.stylist_id is not null)`,
  cancelledBookings: sql<number>`(select count(distinct a.id)::int from appointments a left join booking_team_members tm on tm.appointment_id = a.id and tm.stylist_id = ${stylistProfilesTable.id} and tm.status = 'confirmed' where (a.stylist_id = ${stylistProfilesTable.id} or tm.stylist_id is not null) and a.status = 'cancelled')`,
  totalEarnings: sql<number>`coalesce((select sum(pl.net_amount)::float8 from payout_ledger pl where pl.artist_profile_id = ${stylistProfilesTable.id} and pl.status <> 'reversed'), 0)`,
  complaintCount: sql<number>`(select count(*)::int from complaints c left join appointments ca on ca.id = c.appointment_id where c.subject_user_id = ${usersTable.id} or (c.subject_user_id is null and c.complainant_role = 'client' and (ca.stylist_id = ${stylistProfilesTable.id} or exists (select 1 from booking_team_members ctm where ctm.appointment_id = ca.id and ctm.stylist_id = ${stylistProfilesTable.id} and ctm.status = 'confirmed'))))`,
  disputeCount: sql<number>`(select count(distinct a.id)::int from appointments a left join booking_team_members tm on tm.appointment_id = a.id and tm.stylist_id = ${stylistProfilesTable.id} and tm.status = 'confirmed' where (a.stylist_id = ${stylistProfilesTable.id} or tm.stylist_id is not null) and a.payout_status = 'disputed')`,
};

router.get("/owner/artists", requireOwner, async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 80) : "";
  const status = typeof req.query.status === "string" ? req.query.status : "";
  if (status && !["active", "suspended"].includes(status)) { res.status(400).json({ error: "Invalid account status" }); return; }
  const query = db.select(ownerArtistSummary).from(stylistProfilesTable)
    .innerJoin(usersTable, eq(usersTable.id, stylistProfilesTable.userId)).$dynamic();
  const conditions = [];
  if (q) conditions.push(or(ilike(stylistProfilesTable.name, `%${q}%`), ilike(usersTable.email, `%${q}%`), ilike(stylistProfilesTable.specialty, `%${q}%`)));
  if (status) conditions.push(eq(usersTable.accountStatus, status));
  const rows = await (conditions.length ? query.where(and(...conditions)) : query)
    .orderBy(desc(usersTable.createdAt)).limit(100);
  res.json(rows.map(row => ({ ...row, joinedAt: row.joinedAt.toISOString(), cancellationRate: row.totalBookings ? row.cancelledBookings / row.totalBookings : 0 })));
});

router.get("/owner/artists/not-submitted", requireOwner, async (_req, res) => {
  const rows = await db.select({
    profileId: stylistProfilesTable.id,
    name: stylistProfilesTable.name,
    joinedAt: usersTable.createdAt,
    hasIdNumber: sql<boolean>`${stylistProfilesTable.idNumber} is not null and btrim(${stylistProfilesTable.idNumber}) <> ''`,
    hasIdDocument: sql<boolean>`${stylistProfilesTable.idDocumentUrl} is not null and btrim(${stylistProfilesTable.idDocumentUrl}) <> ''`,
    hasBankDetails: sql<boolean>`exists (select 1 from bank_accounts ba where ba.stylist_profile_id = ${stylistProfilesTable.id})`,
    hasBio: sql<boolean>`${stylistProfilesTable.bio} is not null and length(btrim(${stylistProfilesTable.bio})) >= 40`,
    hasServices: sql<boolean>`exists (select 1 from services s where s.stylist_id = ${stylistProfilesTable.id})`,
    hasPortfolio: sql<boolean>`exists (select 1 from portfolio_items pi where pi.stylist_id = ${stylistProfilesTable.id})`,
  }).from(stylistProfilesTable)
    .innerJoin(usersTable, eq(usersTable.id, stylistProfilesTable.userId))
    .where(eq(stylistProfilesTable.verificationStatus, "none"))
    .orderBy(asc(usersTable.createdAt));

  res.json(rows.map((row) => {
    const outstanding: string[] = [];
    if (!row.hasIdNumber) outstanding.push("ID number");
    if (!row.hasIdDocument) outstanding.push("ID document");
    if (!row.hasBankDetails) outstanding.push("Bank details");
    if (!row.hasBio) outstanding.push("Bio");
    if (!row.hasServices) outstanding.push("Services");
    if (!row.hasPortfolio) outstanding.push("Portfolio");
    return {
      profileId: row.profileId,
      name: row.name,
      joinedAt: row.joinedAt.toISOString(),
      outstanding,
    };
  }));
});

router.get("/owner/artists/:profileId/management", requireOwner, async (req, res) => {
  const profileId = param(req.params.profileId);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? "25"), 10) || 25));
  const offset = Math.min(10_000, Math.max(0, Number.parseInt(String(req.query.offset ?? "0"), 10) || 0));
  const [artist] = await db.select(ownerArtistSummary).from(stylistProfilesTable)
    .innerJoin(usersTable, eq(usersTable.id, stylistProfilesTable.userId)).where(eq(stylistProfilesTable.id, profileId));
  if (!artist) { res.status(404).json({ error: "Artist profile not found" }); return; }
  const [bookings, payouts, batches] = await Promise.all([
    db.select({ id: appointmentsTable.id, clientName: appointmentsTable.clientName, serviceName: appointmentsTable.serviceName, date: appointmentsTable.date, status: appointmentsTable.status, price: appointmentsTable.price, payoutStatus: appointmentsTable.payoutStatus })
      .from(appointmentsTable).where(or(eq(appointmentsTable.stylistId, profileId), sql`exists (select 1 from booking_team_members tm where tm.appointment_id = ${appointmentsTable.id} and tm.stylist_id = ${profileId} and tm.status = 'confirmed')`)).orderBy(desc(appointmentsTable.createdAt)).limit(limit + 1).offset(offset),
    db.select({ id: payoutLedgerTable.id, appointmentId: payoutLedgerTable.appointmentId, amount: payoutLedgerTable.netAmount, status: payoutLedgerTable.status, dueAt: payoutLedgerTable.dueAt, paidAt: payoutLedgerTable.paidAt })
      .from(payoutLedgerTable).where(eq(payoutLedgerTable.artistProfileId, profileId)).orderBy(desc(payoutLedgerTable.createdAt)).limit(limit + 1).offset(offset),
    db.select({ id: payoutBatchesTable.id, totalAmount: payoutBatchesTable.totalAmount, lineCount: payoutBatchesTable.lineCount, reference: payoutBatchesTable.reference, createdAt: payoutBatchesTable.createdAt })
      .from(payoutBatchesTable).where(eq(payoutBatchesTable.artistProfileId, profileId)).orderBy(desc(payoutBatchesTable.createdAt)).limit(limit + 1).offset(offset),
  ]);
  res.json({
    ...artist, joinedAt: artist.joinedAt.toISOString(),
    cancellationRate: artist.totalBookings ? artist.cancelledBookings / artist.totalBookings : 0,
    bookings: bookings.slice(0, limit), payouts: payouts.slice(0, limit).map(p => ({ ...p, dueAt: p.dueAt.toISOString(), paidAt: p.paidAt?.toISOString() ?? null })),
    payoutBatches: batches.slice(0, limit).map(b => ({ ...b, createdAt: b.createdAt.toISOString() })),
    historyLimit: limit, historyOffset: offset, nextOffset: (bookings.length > limit || payouts.length > limit || batches.length > limit) && offset + limit <= 10_000 ? offset + limit : null,
    historyTruncated: bookings.length > limit || payouts.length > limit || batches.length > limit,
  });
});

router.post("/owner/artists/:profileId/account-status", requireOwner, async (req, res) => {
  const profileId = param(req.params.profileId);
  const status = req.body?.status;
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  if (status !== "active" && status !== "suspended") { res.status(400).json({ error: "Status must be active or suspended" }); return; }
  if (!reason || reason.length > 500) { res.status(400).json({ error: "A non-empty reason of no more than 500 characters is required" }); return; }
  const [profile] = await db.select({ userId: stylistProfilesTable.userId }).from(stylistProfilesTable).where(eq(stylistProfilesTable.id, profileId));
  if (!profile) { res.status(404).json({ error: "Artist profile not found" }); return; }
  const owner = (req as any).user;
  if (profile.userId === owner.id) { res.status(403).json({ error: "The owner account cannot be changed" }); return; }
  const [updated] = await db.update(usersTable).set({ accountStatus: status }).where(eq(usersTable.id, profile.userId)).returning({ accountStatus: usersTable.accountStatus });
  if (status === "suspended") revokeUserStreams(profile.userId);
  res.json({ accountStatus: updated.accountStatus, reason });
});

router.get("/owner/command-centre", requireOwner, async (_req, res) => {
  const [[artistMetrics], [appointmentMetrics], [ledgerMetrics]] = await Promise.all([
    db.select({
      totalArtists: sql<number>`count(*)::int`,
      verifiedArtists: sql<number>`count(*) filter (where ${stylistProfilesTable.verified} = true)::int`,
      pendingVerifications: sql<number>`count(*) filter (where ${stylistProfilesTable.verificationStatus} = 'pending')::int`,
    }).from(stylistProfilesTable),
    db.select({
      bonisaCommission: sql<number>`coalesce(sum(${appointmentsTable.platformFeeAmount}) filter (where ${appointmentsTable.payoutStatus} = 'released'), 0)::float8`,
      openDisputes: sql<number>`count(*) filter (where ${appointmentsTable.payoutStatus} = 'disputed')::int`,
    }).from(appointmentsTable),
    db.select({
      paymentsToRelease: sql<number>`coalesce(sum(${payoutLedgerTable.netAmount}) filter (where ${payoutLedgerTable.status} = 'due'), 0)::float8`,
    }).from(payoutLedgerTable),
  ]);

  res.json({
    totalArtists: artistMetrics.totalArtists,
    verifiedArtists: artistMetrics.verifiedArtists,
    pendingVerifications: artistMetrics.pendingVerifications,
    paymentsToRelease: ledgerMetrics.paymentsToRelease,
    bonisaCommission: appointmentMetrics.bonisaCommission,
    openDisputes: appointmentMetrics.openDisputes,
  });
});

// Unpaid ledger lines grouped by artist. Filters are deliberately server-side so
// the owner view remains accurate for large ledgers.
router.get("/owner/payouts", requireOwner, async (req, res) => {
  const filter = String(req.query.filter ?? "all-time");
  const now = new Date();
  const monday = new Date(now);
  const day = monday.getDay() || 7;
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - day + 1);
  const nextMonday = new Date(monday);
  nextMonday.setDate(nextMonday.getDate() + 7);
  const since = filter === "this-week" ? monday : null;
  const lines = await db.select({
    id: payoutLedgerTable.id, artistProfileId: payoutLedgerTable.artistProfileId,
    artistName: stylistProfilesTable.name, amount: payoutLedgerTable.netAmount,
    dueAt: payoutLedgerTable.dueAt, appointmentId: appointmentsTable.id,
    clientName: appointmentsTable.clientName, serviceName: appointmentsTable.serviceName,
    date: appointmentsTable.date,
  }).from(payoutLedgerTable)
    .innerJoin(stylistProfilesTable, eq(stylistProfilesTable.id, payoutLedgerTable.artistProfileId))
    .innerJoin(appointmentsTable, eq(appointmentsTable.id, payoutLedgerTable.appointmentId))
    .where(since
      ? and(eq(payoutLedgerTable.status, "due"), gte(payoutLedgerTable.dueAt, since), lt(payoutLedgerTable.dueAt, nextMonday))
      : eq(payoutLedgerTable.status, "due"))
    .orderBy(asc(payoutLedgerTable.dueAt), asc(payoutLedgerTable.id));
  const groups = new Map<string, any>();
  for (const line of lines) {
    const group = groups.get(line.artistProfileId) ?? {
      artistProfileId: line.artistProfileId, artistName: line.artistName,
      bankVerificationStatus: "none",
      totalAmount: 0, lineCount: 0, lines: [],
    };
    group.totalAmount = Math.round((group.totalAmount + line.amount) * 100) / 100;
    group.lineCount++;
    group.lines.push({ ...line, dueAt: line.dueAt.toISOString() });
    groups.set(line.artistProfileId, group);
  }
  const accountRows = await db.select({ stylistProfileId: bankAccountsTable.stylistProfileId, verificationStatus: bankAccountsTable.verificationStatus }).from(bankAccountsTable).where(inArray(bankAccountsTable.stylistProfileId, [...groups.keys()]));
  for (const account of accountRows) groups.get(account.stylistProfileId).bankVerificationStatus = account.verificationStatus;
  const result = [...groups.values()];
  result.sort((a, b) => {
    const byOldest = Date.parse(a.lines[0].dueAt) - Date.parse(b.lines[0].dueAt);
    const primary = filter === "highest" ? b.totalAmount - a.totalAmount : byOldest;
    return primary || byOldest || a.artistProfileId.localeCompare(b.artistProfileId);
  });
  res.json(result);
});

router.post("/owner/payouts/:artistProfileId/mark-paid", requireOwner, async (req, res) => {
  const artistProfileId = param(req.params.artistProfileId);
  const reference = typeof req.body?.reference === "string" ? req.body.reference.trim() : "";
  const lineIds = Array.isArray(req.body?.lineIds) ? req.body.lineIds.filter((id: unknown): id is string => typeof id === "string" && id.length > 0) : [];
  const expectedTotal = typeof req.body?.expectedTotal === "number" ? req.body.expectedTotal : Number(req.body?.expectedTotal);
  if (!reference) { res.status(400).json({ error: "A non-empty EFT reference is required" }); return; }
  if (!lineIds.length || !Number.isFinite(expectedTotal)) { res.status(400).json({ error: "lineIds and expectedTotal are required" }); return; }
  const paid = await db.transaction(async (tx) => {
    const [bank] = await tx.select().from(bankAccountsTable)
      .where(and(eq(bankAccountsTable.stylistProfileId, artistProfileId), eq(bankAccountsTable.verificationStatus, "verified"))).for("update");
    if (!bank) return { error: "Needs bank verification" } as const;
    const due = await tx.select().from(payoutLedgerTable)
      .where(and(eq(payoutLedgerTable.artistProfileId, artistProfileId), eq(payoutLedgerTable.status, "due"), inArray(payoutLedgerTable.id, lineIds)))
      .for("update");
    if (due.length !== lineIds.length) return null;
    const expectedCents = Math.round(expectedTotal * 100);
    const actualCents = due.reduce((sum, line) => sum + Math.round(line.netAmount * 100), 0);
    if (actualCents !== expectedCents) return null;
    const batchId = randomUUID();
    const now = new Date();
    await tx.insert(payoutBatchesTable).values({
      id: batchId, artistProfileId, totalAmount: 0, lineCount: 0,
      reference, paidBy: (req as any).user.id,
    });
    const updated = [];
    for (const line of due) {
      const rows = await tx.update(payoutLedgerTable).set({
        status: "paid", paidAt: now, paidBatchId: batchId,
      }).where(and(eq(payoutLedgerTable.id, line.id), eq(payoutLedgerTable.status, "due"))).returning();
      updated.push(...rows);
    }
    if (!updated.length) return null;
    const totalAmount = Math.round(updated.reduce((sum, line) => sum + line.netAmount, 0) * 100) / 100;
    const [batch] = await tx.update(payoutBatchesTable)
      .set({ totalAmount, lineCount: updated.length })
      .where(eq(payoutBatchesTable.id, batchId))
      .returning();
    return batch;
  });
  if (!paid) { res.status(409).json({ error: "No currently due payout lines remain" }); return; }
  if ("error" in paid) { res.status(409).json(paid); return; }
  res.json(paid);
});

router.get("/owner/payments-overview", requireOwner, async (_req, res) => {
  const appointments = await db.select().from(appointmentsTable)
    .orderBy(desc(appointmentsTable.createdAt), desc(appointmentsTable.id));
  const lines = await db.select({
    appointmentId: payoutLedgerTable.appointmentId, artistProfileId: payoutLedgerTable.artistProfileId,
    artistName: stylistProfilesTable.name, sharePercent: payoutLedgerTable.sharePercent,
    grossAmount: payoutLedgerTable.grossAmount, platformFeeAmount: payoutLedgerTable.platformFeeAmount,
    netAmount: payoutLedgerTable.netAmount, status: payoutLedgerTable.status,
    paidAt: payoutLedgerTable.paidAt,
  }).from(payoutLedgerTable).innerJoin(stylistProfilesTable,
    eq(stylistProfilesTable.id, payoutLedgerTable.artistProfileId))
    .orderBy(asc(payoutLedgerTable.appointmentId), asc(payoutLedgerTable.artistProfileId));
  res.json(appointments.map((appointment) => ({
    appointmentId: appointment.id,
    clientName: appointment.clientName,
    stylistName: appointment.stylistName,
    serviceName: appointment.serviceName,
    date: appointment.date,
    payoutStatus: appointment.payoutStatus,
    grossAmount: appointment.price,
    platformFeeAmount: appointment.platformFeeAmount,
    artistPool: appointment.artistPayoutAmount,
    isTeamBooking: appointment.isTeamBooking,
    ledger: lines.filter((line) => line.appointmentId === appointment.id)
      .map((line) => ({ ...line, paidAt: line.paidAt?.toISOString() ?? null })),
  })));
});

router.get("/owner/registry", requireOwner, async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
  const search = `%${q}%`;
  const query = db.select({
    userId: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    phone: usersTable.phone,
    role: usersTable.role,
    businessName: usersTable.businessName,
    specialty: stylistProfilesTable.specialty,
    verificationStatus: stylistProfilesTable.verificationStatus,
    joinedAt: usersTable.createdAt,
  })
    .from(usersTable)
    .leftJoin(stylistProfilesTable, eq(stylistProfilesTable.userId, usersTable.id))
    .$dynamic();

  const rows = await (q
    ? query.where(or(
        ilike(usersTable.name, search),
        ilike(usersTable.email, search),
        ilike(usersTable.phone, search),
        ilike(usersTable.businessName, search),
        ilike(stylistProfilesTable.specialty, search),
      ))
    : query)
    .orderBy(desc(usersTable.createdAt))
    .limit(100);

  res.json(rows.map((row) => ({
    ...row,
    joinedAt: row.joinedAt.toISOString(),
  })));
});

router.get("/owner/registry/:userId", requireOwner, async (req, res) => {
  const userId = param(req.params.userId);
  const [user] = await db.select({
    userId: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    phone: usersTable.phone,
    role: usersTable.role,
    businessName: usersTable.businessName,
    joinedAt: usersTable.createdAt,
  }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "Account not found" }); return; }

  let artist = null;
  if (user.role === "stylist") {
    const [profile] = await db.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.userId, userId));
    if (profile) {
      const [services, [portfolioCount]] = await Promise.all([
        db.select({
          id: servicesTable.id,
          name: servicesTable.name,
          price: servicesTable.price,
          duration: servicesTable.duration,
        }).from(servicesTable).where(eq(servicesTable.stylistId, profile.id)),
        db.select({ count: sql<number>`count(*)::int` })
          .from(portfolioItemsTable)
          .where(eq(portfolioItemsTable.stylistId, profile.id)),
      ]);
      const [bank] = await db.select().from(bankAccountsTable).where(eq(bankAccountsTable.stylistProfileId, profile.id));
      artist = {
        profileId: profile.id,
        specialty: profile.specialty,
        area: profile.area,
        location: profile.location,
        verified: profile.verified,
        verificationStatus: profile.verificationStatus,
        services,
        portfolioItemCount: portfolioCount.count,
        identityDocumentAvailable: !!profile.idDocumentUrl,
        bank: bank ? {
          id: bank.id, bankName: bank.bankName, accountHolderName: bank.accountHolderName,
          maskedAccountNumber: `••••${bank.accountNumber.slice(-4)}`, accountType: bank.accountType,
          verificationStatus: bank.verificationStatus, verifiedAt: bank.verifiedAt?.toISOString() ?? null,
          revision: bank.revision,
        } : null,
      };
    }
  }

  res.json({
    ...user,
    joinedAt: user.joinedAt.toISOString(),
    artist,
  });
});

router.patch("/owner/artists/:profileId/bank", requireOwner, async (req, res) => {
  const profileId = param(req.params.profileId);
  const status = req.body?.status;
  const revision = req.body?.revision;
  if (status !== "verified" && status !== "failed") { res.status(400).json({ error: "Status must be verified or failed" }); return; }
  if (!Number.isInteger(revision) || revision < 1) { res.status(400).json({ error: "A valid bank account revision is required" }); return; }
  const [account] = await db.update(bankAccountsTable).set({
    verificationStatus: status, verifiedAt: new Date(),
    verifiedBy: (req as any).user.id, updatedAt: new Date(),
  }).where(and(
    eq(bankAccountsTable.stylistProfileId, profileId),
    eq(bankAccountsTable.revision, revision),
  )).returning();
  if (!account) { res.status(409).json({ error: "These bank details changed. Reload and review the latest version before deciding." }); return; }
  res.json({ verificationStatus: account.verificationStatus, verifiedAt: account.verifiedAt?.toISOString() ?? null });
});

router.post("/owner/artists/:profileId/bank/reveal", requireOwner, async (req, res) => {
  const profileId = param(req.params.profileId);
  const result = await db.transaction(async (tx) => {
    const [account] = await tx.select().from(bankAccountsTable).where(and(
      eq(bankAccountsTable.stylistProfileId, profileId),
      eq(bankAccountsTable.verificationStatus, "verified"),
    )).for("update");
    if (!account) return null;
    await tx.insert(bankAccountAccessLogTable).values({ id: randomUUID(), bankAccountId: account.id, viewedByUserId: (req as any).user.id });
    return account;
  });
  if (!result) { res.status(409).json({ error: "The bank account must be verified before it can be revealed." }); return; }
  res.setHeader("Cache-Control", "private, no-store");
  res.json({ accountNumber: result.accountNumber });
});

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
  if (profile.verificationStatus !== "pending") { res.status(409).json({ error: "Only pending artists can be approved" }); return; }

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

  const [updated] = await db.update(stylistProfilesTable).set({ verified: true, verificationStatus: "verified" })
    .where(and(eq(stylistProfilesTable.id, profileId), eq(stylistProfilesTable.verificationStatus, "pending"))).returning({ id: stylistProfilesTable.id });
  if (!updated) { res.status(409).json({ error: "Artist verification state changed; reload and try again" }); return; }

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
  const rejectionReason = typeof reason === "string" ? reason.trim().slice(0, 500) : "";
  if (!rejectionReason) { res.status(400).json({ error: "A rejection reason is required (maximum 500 characters)" }); return; }
  if (profile.verificationStatus !== "pending") { res.status(409).json({ error: "Only pending artists can be rejected" }); return; }

  // Reset to "none" so the artist can address the issues and submit again.
  const [updated] = await db.update(stylistProfilesTable).set({ verified: false, verificationStatus: "none" })
    .where(and(eq(stylistProfilesTable.id, profileId), eq(stylistProfilesTable.verificationStatus, "pending"))).returning({ id: stylistProfilesTable.id });
  if (!updated) { res.status(409).json({ error: "Artist verification state changed; reload and try again" }); return; }

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
          { artistName: profile.name, rejectionReason, outstandingItems },
        );
      } catch { /* non-fatal */ }
    });
  }

  res.json({ message: `Verification rejected — ${profile.name} notified and reset to not-submitted` });
});

export default router;
