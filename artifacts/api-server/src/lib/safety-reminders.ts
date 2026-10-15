/**
 * After a job finishes, an artist who has not checked in is gently reminded once. The check-in itself is
 * a photo, a "yes I am safe", and a generated code (routes/reputation.ts).
 */
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { appointmentsTable, db, safetyCheckinsTable } from "@workspace/db";
import { REPUTATION_CONFIG as CFG } from "./reputation-config";
import { hoursUntilEvent, notifyStylistProfile } from "./campaigns";
import { logger } from "./logger";

export async function sendSafetyReminders(now: Date = new Date()): Promise<number> {
  const day = (offset: number) => new Date(now.getTime() + 2 * 3600e3 + offset * 86_400_000).toISOString().slice(0, 10);
  const jobs = await db.select().from(appointmentsTable).where(and(
    inArray(appointmentsTable.status, ["confirmed", "completed"]),
    isNull(appointmentsTable.safetyReminderSentAt),
    sql`${appointmentsTable.date} between ${day(-1)} and ${day(0)}`,
  ));
  let sent = 0;
  for (const job of jobs) {
    const hoursSinceStart = -(hoursUntilEvent({ eventDate: job.date, eventTime: job.time }, now) ?? 0);
    const endedHoursAgo = hoursSinceStart - job.duration / 60;
    if (endedHoursAgo < CFG.safety.reminderAfterHours) continue;
    const [done] = await db.select({ id: safetyCheckinsTable.id }).from(safetyCheckinsTable).where(eq(safetyCheckinsTable.appointmentId, job.id));
    if (done) continue;
    // Claim it first so two runs never send it twice.
    const claimed = await db.update(appointmentsTable).set({ safetyReminderSentAt: now })
      .where(and(eq(appointmentsTable.id, job.id), isNull(appointmentsTable.safetyReminderSentAt))).returning({ id: appointmentsTable.id });
    if (claimed.length === 0) continue;
    await notifyStylistProfile(job.stylistId, "safety.reminder", { clientName: job.clientName, serviceName: job.serviceName });
    sent++;
  }
  return sent;
}

export function startSafetyReminderJob() {
  const run = () => sendSafetyReminders().catch((err) => logger.error({ err }, "Safety reminder job failed"));
  setTimeout(run, 150 * 1000);
  setInterval(run, 30 * 60_000);
  logger.info("Safety reminder job scheduled");
}
