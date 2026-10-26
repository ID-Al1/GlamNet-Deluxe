import { db, appointmentsTable } from "@workspace/db";
import { and, eq, isNull, type SQL } from "drizzle-orm";
import { COMPLAINT_WINDOW_HOURS } from "./bookingPolicy";

/**
 * Marks a held booking complete and opens the complaint window. Used when the
 * artist enters the right completion code, and when the owner completes a
 * booking for an artist whose client never gave the code. Returns null if the
 * booking is no longer held or is already complete, so it is safe to retry.
 *
 * Both confirmation flags are set so complaint handling that checks them keeps working.
 */
export async function markBookingComplete(appointmentId: string, extraWhere?: SQL) {
  const now = new Date();
  const [row] = await db.update(appointmentsTable).set({
    status: "completed",
    completedAt: now,
    complaintWindowEndsAt: new Date(now.getTime() + COMPLAINT_WINDOW_HOURS * 60 * 60 * 1000),
    workConfirmedByClient: true, workConfirmedByClientAt: now,
    workConfirmedByArtist: true, workConfirmedByArtistAt: now,
    completionCodeNonce: null,
  }).where(and(
    eq(appointmentsTable.id, appointmentId),
    eq(appointmentsTable.payoutStatus, "held"),
    isNull(appointmentsTable.completedAt),
    extraWhere,
  )).returning();
  return row ?? null;
}
