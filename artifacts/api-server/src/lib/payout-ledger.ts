import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import {
  bookingTeamMembersTable, payoutLedgerTable, stylistProfilesTable,
} from "@workspace/db";
const cents = (amount: number) => Math.round(amount * 100);

/**
 * Creates the release ledger inside the same transaction as the held -> released
 * appointment update. The unique appointment/artist key makes retries harmless.
 */
export async function createPayoutLedgerLines(tx: any, appointment: any, dueAt = new Date()) {
  const poolCents = cents(appointment.artistPayoutAmount);
  const feePoolCents = cents(appointment.platformFeeAmount);
  let members = appointment.isTeamBooking
    ? await tx.select().from(bookingTeamMembersTable).where(and(
      eq(bookingTeamMembersTable.appointmentId, appointment.id),
      eq(bookingTeamMembersTable.status, "confirmed"),
    ))
    : [];
  if (!appointment.isTeamBooking || !members.some((m: any) => m.stylistId === appointment.stylistId)) {
    members = [{ stylistId: appointment.stylistId, payoutPercentage: 100, isLead: true }, ...members];
  }
  const leadId = appointment.stylistId;
  const leadMember = members.find((m: any) => m.stylistId === leadId);
  const nonLead = members.filter((m: any) => m.stylistId !== leadId);
  const nonLeadPercentages = nonLead.map((member: any) => Number(member.payoutPercentage));
  if (
    nonLeadPercentages.some((percentage: number) => !Number.isFinite(percentage) || percentage < 0)
    || nonLeadPercentages.reduce((sum: number, percentage: number) => sum + percentage, 0) > 100
  ) {
    throw new Error(`Invalid team payout allocation for appointment ${appointment.id}`);
  }
  const allocations = nonLead.map((m: any) => ({
    member: m,
    amount: Math.floor(poolCents * Number(m.payoutPercentage) / 100),
    fee: Math.floor(feePoolCents * Number(m.payoutPercentage) / 100),
  }));
  const allocated = allocations.reduce((sum: number, x: any) => sum + x.amount, 0);
  const allocatedFees = allocations.reduce((sum: number, x: any) => sum + x.fee, 0);
  allocations.push({
    member: leadMember ?? { stylistId: leadId, payoutPercentage: 100 },
    amount: poolCents - allocated,
    fee: feePoolCents - allocatedFees,
  });
  for (const allocation of allocations) {
    const netAmount = allocation.amount / 100;
    const platformFee = allocation.fee / 100;
    const effectiveShare = poolCents > 0
      ? Math.round((allocation.amount / poolCents) * 10000) / 100
      : 0;
    await tx.insert(payoutLedgerTable).values({
      id: randomUUID(), appointmentId: appointment.id,
      artistProfileId: allocation.member.stylistId,
      sharePercent: effectiveShare,
      grossAmount: netAmount, platformFeeAmount: platformFee, netAmount,
      status: "due", dueAt,
    }).onConflictDoNothing();
  }
}