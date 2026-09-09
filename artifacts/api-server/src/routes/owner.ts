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
import { appointmentsTable, db, payoutBatchesTable, payoutLedgerTable, portfolioItemsTable, servicesTable, stylistProfilesTable, usersTable, bankAccountsTable, bankAccountAccessLogTable } from "@workspace/db";
import { and, asc, desc, eq, gte, ilike, inArray, lt, or, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireOwner } from "../lib/auth";
import { notify } from "../lib/notifications";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage";
import { computeProfileReadiness } from "./stylists";

const router = Router();
const objectStorageService = new ObjectStorageService();

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
