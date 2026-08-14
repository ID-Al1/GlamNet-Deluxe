import { db, appointmentsTable } from "@workspace/db";
import { and, eq, or } from "drizzle-orm";
import { recordPayoutEvent } from "./escrow";
import { postSystemMessage } from "../routes/messages";
import { logger } from "./logger";

// Configurable timeout for one-sided completion confirmations (default 48h)
const TIMEOUT_HOURS = Number(process.env.CONFIRMATION_TIMEOUT_HOURS ?? 48);
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly

/**
 * Escalates bookings where only one side confirmed and the other has been
 * silent past the timeout. Funds stay in escrow; the booking is flagged for
 * manual review instead of paying out on a single confirmation.
 */
async function escalateStale() {
  const cutoff = new Date(Date.now() - TIMEOUT_HOURS * 60 * 60 * 1000);

  const candidates = await db.select().from(appointmentsTable)
    .where(and(
      eq(appointmentsTable.payoutStatus, "held"),
      or(
        and(eq(appointmentsTable.workConfirmedByClient, true), eq(appointmentsTable.workConfirmedByArtist, false)),
        and(eq(appointmentsTable.workConfirmedByClient, false), eq(appointmentsTable.workConfirmedByArtist, true)),
      ),
    ));

  for (const appt of candidates) {
    const confirmedAt = appt.workConfirmedByClientAt ?? appt.workConfirmedByArtistAt;
    if (!confirmedAt || confirmedAt > cutoff) continue;

    await db.update(appointmentsTable)
      .set({ payoutStatus: "disputed" })
      .where(and(eq(appointmentsTable.id, appt.id), eq(appointmentsTable.payoutStatus, "held")));

    await recordPayoutEvent({
      appointmentId: appt.id,
      type: "escalated",
      note: `Only one party confirmed within ${TIMEOUT_HOURS}h — escalated for manual review`,
    });

    try {
      await postSystemMessage(
        appt.clientId, appt.stylistId,
        `The ${appt.serviceName} appointment (${appt.date}) was confirmed by only one party within ${TIMEOUT_HOURS} hours. It has been escalated to Bonisa for review. The payment stays safely in escrow until it's resolved.`
      );
    } catch { /* non-fatal */ }

    logger.info({ appointmentId: appt.id }, "Escrow escalated after confirmation timeout");
  }
}

export function startEscrowTimeoutJob() {
  const run = () => escalateStale().catch((err) => logger.error({ err }, "Escrow timeout job failed"));
  setTimeout(run, 30 * 1000); // first pass shortly after boot
  setInterval(run, CHECK_INTERVAL_MS);
  logger.info({ timeoutHours: TIMEOUT_HOURS }, "Escrow confirmation-timeout job scheduled");
}
