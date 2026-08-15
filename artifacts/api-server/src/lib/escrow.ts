import { randomUUID } from "crypto";
import { db, appointmentsTable, payoutEventsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

import { ARTIST_SHARE, PLATFORM_SHARE, splitAmount } from "./money";
export { ARTIST_SHARE, PLATFORM_SHARE, splitAmount };

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
