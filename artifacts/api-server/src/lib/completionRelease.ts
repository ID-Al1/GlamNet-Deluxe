import { db, appointmentsTable, complaintsTable, payoutLedgerTable, stylistProfilesTable, usersTable } from "@workspace/db";
import { and, eq, inArray, isNotNull, lte, notExists, sql } from "drizzle-orm";
import { recordPayoutEvent, resolveCollectedAmount, splitAmount } from "./escrow";
import { createPayoutLedgerLines } from "./payout-ledger";
import { payoutDueAt } from "./money";
import { notify } from "./notifications";
import { postSystemMessage } from "../routes/messages";
import { logger } from "./logger";

const CHECK_INTERVAL_MS = 15 * 60 * 1000;

// A booking with any of these complaints open stays held. Once the owner closes
// or resolves the case, the next pass releases it (unless it was refunded or disputed).
const OPEN_COMPLAINT_STATUSES = ["new", "under_review", "waiting_for_client", "waiting_for_artist", "escalated"];

const noOpenComplaint = () => notExists(
  db.select({ one: sql`1` }).from(complaintsTable).where(and(
    eq(complaintsTable.appointmentId, appointmentsTable.id),
    inArray(complaintsTable.status, OPEN_COMPLAINT_STATUSES),
  )),
);

/**
 * Releases bookings whose complaint window has closed with no open complaint:
 * splits the money 82/18, creates the payout ledger lines (due within the payout
 * window), and tells the artist. The conditional update makes it safe to run at
 * the same time as anything else that changes the booking.
 */
export async function releaseCompletedBookings() {
  const now = new Date();
  const due = await db.select().from(appointmentsTable).where(and(
    eq(appointmentsTable.payoutStatus, "held"),
    isNotNull(appointmentsTable.completedAt),
    lte(appointmentsTable.complaintWindowEndsAt, now),
    noOpenComplaint(),
  ));

  for (const appt of due) {
    try {
      const released = await db.transaction(async (tx) => {
        const amount = await resolveCollectedAmount(tx, appt);
        if (!Number.isFinite(amount) || amount <= 0) return null;
        const { artistShare, platformShare } = splitAmount(amount);
        const [row] = await tx.update(appointmentsTable).set({
          payoutStatus: "released", artistPayoutAmount: artistShare, platformFeeAmount: platformShare, status: "completed",
        }).where(and(
          eq(appointmentsTable.id, appt.id),
          eq(appointmentsTable.payoutStatus, "held"),
          isNotNull(appointmentsTable.completedAt),
          lte(appointmentsTable.complaintWindowEndsAt, now),
          noOpenComplaint(),
        )).returning();
        if (!row) return null;
        await createPayoutLedgerLines(tx, row, payoutDueAt());
        return { amount, artistShare, platformShare };
      });
      if (!released) continue;

      await recordPayoutEvent({
        appointmentId: appt.id, type: "released", amount: released.amount,
        artistShare: released.artistShare, platformShare: released.platformShare,
        note: "Complaint window closed with no open complaint. Escrow released",
      });
      try {
        await postSystemMessage(appt.clientId, appt.stylistId,
          appt.isTeamBooking
            ? `The complaint window has closed. R${released.artistShare.toFixed(2)} is allocated across the confirmed team artists (Bonisa fee: R${released.platformShare.toFixed(2)}).`
            : `The complaint window has closed. R${released.artistShare.toFixed(2)} is released to ${appt.stylistName} (Bonisa fee: R${released.platformShare.toFixed(2)}).`);
      } catch { /* non-fatal */ }

      try {
        const lines = await db.select({ artistProfileId: payoutLedgerTable.artistProfileId, amount: payoutLedgerTable.netAmount, dueAt: payoutLedgerTable.dueAt })
          .from(payoutLedgerTable).where(eq(payoutLedgerTable.appointmentId, appt.id));
        for (const line of lines) {
          const [profile] = await db.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.id, line.artistProfileId));
          if (!profile) continue;
          const [artistUser] = await db.select().from(usersTable).where(eq(usersTable.id, profile.userId));
          if (!artistUser) continue;
          await notify(
            { phone: artistUser.phone, email: artistUser.email, name: artistUser.name },
            "payout.released",
            { artistName: profile.name, serviceName: appt.serviceName, amount: line.amount, payoutDueAt: line.dueAt.toLocaleDateString("en-ZA") },
          );
        }
      } catch { /* non-fatal */ }
      logger.info({ appointmentId: appt.id }, "Released after complaint window");
    } catch (err) {
      logger.error({ err, appointmentId: appt.id }, "Release after complaint window failed");
    }
  }
}

export function startCompletionReleaseJob() {
  const run = () => releaseCompletedBookings().catch((err) => logger.error({ err }, "Completion release job failed"));
  setTimeout(run, 45 * 1000);
  setInterval(run, CHECK_INTERVAL_MS);
  logger.info({ everyMinutes: CHECK_INTERVAL_MS / 60000 }, "Completion release job scheduled");
}
