import { randomUUID } from "crypto";
import { db, appointmentsTable, payoutEventsTable, paymentsTable } from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { logger } from "./logger";

import { ARTIST_SHARE, PLATFORM_SHARE, splitAmount } from "./money";
import { createPayoutLedgerLines } from "./payout-ledger";
import { payoutDueAt } from "./money";
export { ARTIST_SHARE, PLATFORM_SHARE, splitAmount };

export async function resolveCollectedAmount(tx: any, appointment: any): Promise<number> {
  const [payment] = await tx.select().from(paymentsTable)
    .where(and(eq(paymentsTable.appointmentId, appointment.id),
      // A refunded payment remains the authoritative payment record. Never
      // substitute the appointment price once Stripe has recorded a payment.
      sql`${paymentsTable.status} in ('succeeded', 'partial_refunded', 'refunded')`))
    .orderBy(desc(paymentsTable.createdAt)).limit(1);
  if (payment) {
    const remainingCents = Math.max(0,
      Math.round(payment.amount * 100) - Math.round((payment.refundedAmount ?? 0) * 100));
    return remainingCents / 100;
  }
  return appointment.paymentMode === "deposit"
    ? appointment.depositAmount + appointment.tipAmount : appointment.price + appointment.tipAmount;
}

/** Atomic held -> disputed transition. Caller owns the surrounding transaction. */
export async function transitionToDisputed(tx: any, appointment: any, actorUserId: string, note: string) {
  const amount = await resolveCollectedAmount(tx, appointment);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Cannot dispute without a positive remaining collected amount");
  const shares = splitAmount(amount);
  const [updated] = await tx.update(appointmentsTable).set({ payoutStatus: "disputed" })
    .where(and(eq(appointmentsTable.id, appointment.id), eq(appointmentsTable.payoutStatus, "held"))).returning();
  if (!updated) return { updated: false, alreadyDisputed: appointment.payoutStatus === "disputed", amount, ...shares, appointment: null };
  await tx.insert(payoutEventsTable).values({
    id: randomUUID(), appointmentId: appointment.id, type: "disputed", actorUserId,
    amount, artistShare: shares.artistShare, platformShare: shares.platformShare, note,
  });
  return { updated: true, alreadyDisputed: false, amount, ...shares, appointment: updated };
}

/** Atomic disputed -> released transition, including the payout ledger. */
export async function transitionFromDisputed(tx: any, appointment: any, actorUserId: string, note: string) {
  const amount = await resolveCollectedAmount(tx, appointment);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Cannot release without a positive collected amount");
  const shares = splitAmount(amount);
  const [updated] = await tx.update(appointmentsTable).set({
    payoutStatus: "released", status: "completed",
    artistPayoutAmount: shares.artistShare, platformFeeAmount: shares.platformShare,
  }).where(and(eq(appointmentsTable.id, appointment.id), eq(appointmentsTable.payoutStatus, "disputed"))).returning();
  if (!updated) return { updated: false, amount, ...shares, appointment: null };
  await createPayoutLedgerLines(tx, updated, payoutDueAt());
  await tx.insert(payoutEventsTable).values({
    id: randomUUID(), appointmentId: appointment.id, type: "released", actorUserId,
    amount, artistShare: shares.artistShare, platformShare: shares.platformShare, note,
  });
  return { updated: true, amount, ...shares, appointment: updated };
}

/** Append a row to the payout audit trail. Never throws — audit failures are logged, not fatal. */
export async function recordPayoutEvent(event: {
  appointmentId: string;
  type: "held" | "client_confirmed" | "artist_confirmed" | "released" | "disputed" | "escalated";
  actorUserId?: string | null;
  amount?: number;
  artistShare?: number;
  platformShare?: number;
  note?: string;
}) {
  try {
    await db.insert(payoutEventsTable).values({
      id: randomUUID(),
      appointmentId: event.appointmentId,
      type: event.type,
      actorUserId: event.actorUserId ?? null,
      amount: event.amount ?? 0,
      artistShare: event.artistShare ?? 0,
      platformShare: event.platformShare ?? 0,
      note: event.note ?? null,
    });
  } catch (err) {
    logger.error({ err, event }, "Failed to record payout event");
  }
}

/**
 * Called when a payment lands. Divides the collected amount into artist and
 * platform allocations, stores them on the appointment as held escrow, and
 * records the audit event. Both stay inside escrow until release.
 */
export async function holdEscrow(appointmentId: string, amountCollected: number, actorUserId?: string | null) {
  const { artistShare, platformShare } = splitAmount(amountCollected);
  await db.update(appointmentsTable)
    .set({ payoutStatus: "held", artistPayoutAmount: artistShare, platformFeeAmount: platformShare })
    .where(eq(appointmentsTable.id, appointmentId));
  await recordPayoutEvent({
    appointmentId, type: "held", actorUserId,
    amount: amountCollected, artistShare, platformShare,
    note: "Payment received — funds held in escrow pending completion confirmation",
  });
  return { artistShare, platformShare };
}
