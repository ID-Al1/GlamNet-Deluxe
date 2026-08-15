import { Router } from "express";
import { db, appointmentsTable, stylistProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

/**
 * Owner view: the numbers Alwande actually needs, read straight from stored
 * values rather than recalculated, so what this returns is what an auditor
 * would find.
 *
 * This replaces the monthly spreadsheet reconciliation in the operations doc.
 * The exit document is direct about why that matters: "Data lives in
 * spreadsheets. Halves acquisition interest immediately."
 *
 * Written against the existing escrow model, where payoutStatus is one of
 * 'held' | 'released' | 'disputed'. Assumes patch 3 has added paidOutAt,
 * payoutDueAt and payoutReference.
 */

function requireOwner(req: any, res: any): boolean {
  const user = req.user;
  const ownerEmail = process.env["OWNER_EMAIL"];
  if (!ownerEmail || user?.email?.toLowerCase() !== ownerEmail.toLowerCase()) {
    res.status(403).json({ error: "Not authorised" });
    return false;
  }
  return true;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

router.get("/owner/finance", requireAuth, async (req, res) => {
  if (!requireOwner(req as any, res)) return;

  const { from, to } = req.query as Record<string, string>;
  const all = await db.select().from(appointmentsTable);

  const inRange = all.filter((a) => {
    if (!from && !to) return true;
    if (from && a.date < from) return false;
    if (to && a.date > to) return false;
    return true;
  });

  const completed = inRange.filter((a) => a.status === "completed");
  const released = inRange.filter((a) => a.payoutStatus === "released");
  const held = inRange.filter((a) => a.payoutStatus === "held");
  const disputed = inRange.filter((a) => a.payoutStatus === "disputed");
  const now = new Date();

  const gmv = completed.reduce((s, a) => s + a.price + (a.tipAmount ?? 0), 0);
  const commission = released.reduce((s, a) => s + a.platformFeeAmount, 0);
  const artistShare = released.reduce((s, a) => s + a.artistPayoutAmount, 0);

  const paidOut = released
    .filter((a) => (a as any).paidOutAt != null)
    .reduce((s, a) => s + a.artistPayoutAmount, 0);

  const owedNow = released
    .filter((a) => (a as any).paidOutAt == null)
    .reduce((s, a) => s + a.artistPayoutAmount, 0);

  const inEscrow = held.reduce((s, a) => s + a.artistPayoutAmount, 0);

  // The 24-hour promise, measured. This is the number the press story and the
  // impact narrative both rest on, and until now it could not be produced.
  const releasedUnpaid = released.filter((a) => (a as any).paidOutAt == null);
  const overdue = releasedUnpaid.filter(
    (a) => (a as any).payoutDueAt != null && (a as any).payoutDueAt < now,
  );

  const paidRows = released.filter((a) => (a as any).paidOutAt != null);
  const paidOnTime = paidRows.filter(
    (a) => (a as any).payoutDueAt != null && (a as any).paidOutAt <= (a as any).payoutDueAt,
  ).length;

  res.json({
    range: { from: from ?? null, to: to ?? null },

    bookings: {
      total: inRange.length,
      completed: completed.length,
      cancelled: inRange.filter((a) => a.status === "cancelled").length,
      disputed: disputed.length,
      completionRate: inRange.length > 0 ? Math.round((completed.length / inRange.length) * 100) : 0,
    },

    money: {
      gmv: round2(gmv),
      commissionEarned: round2(commission),
      artistShare: round2(artistShare),
      paidOut: round2(paidOut),
      owedToArtistsNow: round2(owedNow),
      stillInEscrow: round2(inEscrow),
      averageBookingValue: completed.length > 0 ? round2(gmv / completed.length) : 0,
    },

    payoutPerformance: {
      overdueCount: overdue.length,
      overdueAmount: round2(overdue.reduce((s, a) => s + a.artistPayoutAmount, 0)),
      paidOnTime,
      totalPaid: paidRows.length,
      onTimeRate: paidRows.length > 0 ? Math.round((paidOnTime / paidRows.length) * 100) : 100,
    },
  });
});

/**
 * Your payout run: everything owed to artists right now, oldest first.
 * Released means cleared for payment. Until paidOutAt is set, she has not
 * actually been paid.
 */
router.get("/owner/payouts/due", requireAuth, async (req, res) => {
  if (!requireOwner(req as any, res)) return;

  const all = await db.select().from(appointmentsTable);
  const due = all
    .filter((a) => a.payoutStatus === "released" && (a as any).paidOutAt == null)
    .sort((a, b) => {
      const at = (a as any).payoutDueAt?.getTime() ?? 0;
      const bt = (b as any).payoutDueAt?.getTime() ?? 0;
      return at - bt;
    });

  const now = new Date();
  const rows = await Promise.all(
    due.map(async (a) => {
      const [profile] = await db
        .select()
        .from(stylistProfilesTable)
        .where(eq(stylistProfilesTable.id, a.stylistId));
      return {
        appointmentId: a.id,
        artistName: a.stylistName,
        artistProfileId: a.stylistId,
        artistUserId: profile?.userId ?? null,
        serviceName: a.serviceName,
        date: a.date,
        clientPaid: a.price + (a.tipAmount ?? 0),
        platformFee: a.platformFeeAmount,
        amountOwed: a.artistPayoutAmount,
        dueAt: (a as any).payoutDueAt ? (a as any).payoutDueAt.toISOString() : null,
        overdue: (a as any).payoutDueAt != null && (a as any).payoutDueAt < now,
      };
    }),
  );

  res.json({
    count: rows.length,
    totalOwed: round2(rows.reduce((s, r) => s + r.amountOwed, 0)),
    overdueCount: rows.filter((r) => r.overdue).length,
    payouts: rows,
  });
});

/** Mark a payout as actually paid, with a reference so it reconciles later. */
router.post("/owner/payouts/:appointmentId/mark-paid", requireAuth, async (req, res) => {
  if (!requireOwner(req as any, res)) return;

  const { reference } = req.body ?? {};
  if (!reference) {
    res.status(400).json({ error: "A payment reference is required so this can be reconciled against your bank statement." });
    return;
  }

  const [appt] = await db
    .select()
    .from(appointmentsTable)
    .where(eq(appointmentsTable.id, req.params.appointmentId));

  if (!appt) { res.status(404).json({ error: "Not found" }); return; }

  if (appt.payoutStatus !== "released") {
    res.status(400).json({
      error: `This payout is '${appt.payoutStatus}', not 'released'. Only released payouts can be marked paid.`,
    });
    return;
  }

  const [updated] = await db
    .update(appointmentsTable)
    .set({ paidOutAt: new Date(), payoutReference: String(reference) } as any)
    .where(eq(appointmentsTable.id, appt.id))
    .returning();

  res.json({
    appointmentId: updated.id,
    artistName: updated.stylistName,
    amountPaid: updated.artistPayoutAmount,
    paidOutAt: (updated as any).paidOutAt?.toISOString() ?? null,
    reference: (updated as any).payoutReference,
  });
});

export default router;
