/**
 * Brand campaigns: shared rules.
 *
 * A campaign is a casting call with real numbers: how many artists, what each
 * is paid, when and where. The brand pays the artist's full rate plus Bonisa's
 * 18% on top (see money.ts), half up front to lock in the team and the rest
 * three days before the event. Money is held in escrow and released through the
 * same two-sided confirmation as any other booking.
 *
 * Everything here is server-side. Screens only display it.
 */
import { randomUUID } from "crypto";
import { and, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import {
  appointmentsTable,
  brandProfilesTable,
  campaignPaymentsTable,
  castingApplicationsTable,
  castingCallsTable,
  db,
  paymentsTable,
  stylistProfilesTable,
  usersTable,
  type BrandProfile,
} from "@workspace/db";
import { campaignArtistCost, campaignBalanceDueDate, campaignCost, campaignDepositAllowed, daysUntil, formatRandWhole } from "./money";
import { notify, type NotificationData, type NotificationEvent } from "./notifications";
import { logger } from "./logger";

export type CallRow = typeof castingCallsTable.$inferSelect;
export type ApplicationRow = typeof castingApplicationsTable.$inferSelect;
type UserRow = typeof usersTable.$inferSelect;

export type CampaignStage = "open" | "deposit_paid" | "fully_paid" | "completed" | "cancelled";

export function isOwnerUser(user: { email: string }): boolean {
  const ownerEmail = process.env["OWNER_EMAIL"];
  return !!ownerEmail && user.email.trim().toLowerCase() === ownerEmail.trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Brand profile
// ---------------------------------------------------------------------------

export async function getOrCreateBrandProfile(user: { id: string; businessName?: string | null }): Promise<BrandProfile> {
  const [existing] = await db.select().from(brandProfilesTable).where(eq(brandProfilesTable.userId, user.id));
  if (existing) return existing;
  const [created] = await db.insert(brandProfilesTable).values({
    id: randomUUID(),
    userId: user.id,
    companyName: user.businessName?.trim() ?? "",
  }).onConflictDoNothing().returning();
  if (created) return created;
  const [raced] = await db.select().from(brandProfilesTable).where(eq(brandProfilesTable.userId, user.id));
  return raced!;
}

/** What is still needed before a brand profile can be sent for verification. */
export function brandMissing(profile: BrandProfile, user: { phone?: string | null }): string[] {
  const missing: string[] = [];
  if (profile.companyName.trim().length < 2) missing.push("Company name");
  if (!profile.registrationNumber?.trim() && !profile.website?.trim()) missing.push("Company registration number or website");
  if (!user.phone?.trim()) missing.push("Phone number on your account");
  return missing;
}

export function presentBrandProfile(profile: BrandProfile, user: { phone?: string | null }) {
  const missing = brandMissing(profile, user);
  return {
    id: profile.id,
    userId: profile.userId,
    companyName: profile.companyName,
    registrationNumber: profile.registrationNumber ?? null,
    vatNumber: profile.vatNumber ?? null,
    website: profile.website ?? null,
    billingAddress: profile.billingAddress ?? null,
    verificationStatus: profile.verificationStatus as "none" | "pending" | "verified",
    rejectionReason: profile.rejectionReason ?? null,
    submittedAt: profile.submittedAt?.toISOString() ?? null,
    verifiedAt: profile.verifiedAt?.toISOString() ?? null,
    missing,
    canSubmit: profile.verificationStatus === "none" && missing.length === 0,
  };
}

export async function isBrandVerified(userId: string): Promise<boolean> {
  const [profile] = await db.select({ status: brandProfilesTable.verificationStatus })
    .from(brandProfilesTable).where(eq(brandProfilesTable.userId, userId));
  return profile?.status === "verified";
}

// ---------------------------------------------------------------------------
// Dates and wording
// ---------------------------------------------------------------------------

/** Applications close at the end of the deadline day. */
export function deadlinePassed(deadline: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return false;
  return daysUntil(deadline) < 0;
}

export function budgetText(rate: number, artists: number): string {
  const money = formatRandWhole(rate);
  return artists > 1 ? `${money} per artist, ${artists} artists` : `${money} per artist`;
}

export function formatLongDate(date: string | null | undefined): string {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return date ?? "";
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

// ---------------------------------------------------------------------------
// Notifying people without ever failing the request
// ---------------------------------------------------------------------------

export async function notifyUserId(userId: string, event: NotificationEvent, data: NotificationData) {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) return;
    await notify({ phone: user.phone, email: user.email, name: user.name }, event, data);
  } catch (err) {
    logger.warn({ err, event }, "Campaign notification failed");
  }
}

export async function notifyStylistProfile(profileId: string, event: NotificationEvent, data: NotificationData) {
  try {
    const [profile] = await db.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.id, profileId));
    if (!profile) return;
    await notifyUserId(profile.userId, event, { artistName: profile.name, ...data });
  } catch (err) {
    logger.warn({ err, event }, "Campaign notification failed");
  }
}

// ---------------------------------------------------------------------------
// Casting calls as the app shows them
// ---------------------------------------------------------------------------

export type ArtistCallStatus = "none" | "pending" | "shortlisted" | "invited" | "accepted" | "declined" | "passed";

/** Turn call rows into what the app shows, working out spots and the viewing artist's standing in bulk. */
export async function formatCalls(calls: CallRow[], viewer?: { id: string; role: string }) {
  if (calls.length === 0) return [];
  const callIds = calls.map((c) => c.id);
  const apps = await db.select().from(castingApplicationsTable).where(inArray(castingApplicationsTable.castingId, callIds));
  const brands = await db.select({ userId: brandProfilesTable.userId, status: brandProfilesTable.verificationStatus })
    .from(brandProfilesTable).where(inArray(brandProfilesTable.userId, [...new Set(calls.map((c) => c.brandId))]));
  const verified = new Set(brands.filter((b) => b.status === "verified").map((b) => b.userId));

  let myProfileId: string | null = null;
  if (viewer?.role === "stylist") {
    const [profile] = await db.select({ id: stylistProfilesTable.id }).from(stylistProfilesTable).where(eq(stylistProfilesTable.userId, viewer.id));
    myProfileId = profile?.id ?? null;
  }

  return calls.map((c) => {
    const mine = myProfileId ? apps.find((a) => a.castingId === c.id && a.stylistId === myProfileId) : undefined;
    return {
      id: c.id,
      brandId: c.brandId,
      brandName: c.brandName,
      title: c.title,
      brief: c.brief,
      budget: c.ratePerArtist > 0 ? budgetText(c.ratePerArtist, c.artistsNeeded) : c.budget,
      deadline: c.deadline,
      specialty: c.specialty,
      applicantCount: c.applicantCount,
      hasApplied: !!mine && mine.source === "applied",
      createdAt: c.createdAt.toISOString(),
      artistsNeeded: c.artistsNeeded,
      ratePerArtist: c.ratePerArtist,
      eventDate: c.eventDate ?? null,
      eventTime: c.eventTime,
      location: c.location,
      status: c.status as "open" | "deposit_paid" | "fully_paid" | "cancelled",
      spotsFilled: apps.filter((a) => a.castingId === c.id && a.status === "accepted").length,
      brandVerified: verified.has(c.brandId),
      myStatus: (mine?.status ?? "none") as ArtistCallStatus,
    };
  });
}

/** Has this artist got another job at that exact date and time? */
export async function artistHasConflict(stylistId: string, date: string, time: string, exceptCampaignId?: string): Promise<boolean> {
  const rows = await db.select({ id: appointmentsTable.id }).from(appointmentsTable).where(and(
    eq(appointmentsTable.stylistId, stylistId),
    eq(appointmentsTable.date, date),
    eq(appointmentsTable.time, time),
    inArray(appointmentsTable.status, ["pending", "confirmed"]),
    exceptCampaignId
      ? or(sql`${appointmentsTable.campaignId} is null`, ne(appointmentsTable.campaignId, exceptCampaignId))
      : sql`true`,
  )).limit(1);
  return rows.length > 0;
}

export async function artistJobsCompleted(profileIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (profileIds.length === 0) return counts;
  const rows = await db.select({
    stylistId: appointmentsTable.stylistId,
    n: sql<number>`count(*)::int`,
  }).from(appointmentsTable)
    .where(and(inArray(appointmentsTable.stylistId, profileIds), eq(appointmentsTable.status, "completed")))
    .groupBy(appointmentsTable.stylistId);
  for (const r of rows) counts.set(r.stylistId, r.n);
  return counts;
}

// ---------------------------------------------------------------------------
// The campaign summary: team, cost, payments, jobs
// ---------------------------------------------------------------------------

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function buildCampaignSummary(call: CallRow, viewer?: { id: string; role: string }) {
  const [apps, jobRows, paymentRows] = await Promise.all([
    db.select().from(castingApplicationsTable).where(eq(castingApplicationsTable.castingId, call.id)),
    db.select().from(appointmentsTable).where(and(
      eq(appointmentsTable.campaignId, call.id),
      inArray(appointmentsTable.status, ["pending", "confirmed", "completed"]),
    )),
    db.select().from(campaignPaymentsTable).where(eq(campaignPaymentsTable.castingId, call.id)).orderBy(desc(campaignPaymentsTable.createdAt)),
  ]);

  const jobIds = jobRows.map((j) => j.id);
  const collectedRows = jobIds.length
    ? await db.select().from(paymentsTable).where(and(
        inArray(paymentsTable.appointmentId, jobIds),
        sql`${paymentsTable.status} in ('succeeded', 'partial_refunded', 'refunded')`,
      ))
    : [];
  const collectedBy = new Map<string, number>();
  for (const p of collectedRows) {
    collectedBy.set(p.appointmentId!, round2((collectedBy.get(p.appointmentId!) ?? 0) + p.amount - (p.refundedAmount ?? 0)));
  }

  const funded = call.status !== "open" && call.status !== "cancelled";
  const accepted = apps.filter((a) => a.status === "accepted");
  const one = campaignArtistCost(call.ratePerArtist);
  const profileIds = (funded ? jobRows.map((j) => j.stylistId) : accepted.map((a) => a.stylistId));
  const profiles = profileIds.length
    ? await db.select().from(stylistProfilesTable).where(inArray(stylistProfilesTable.id, profileIds))
    : [];
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  const team = (funded ? jobRows.map((j) => ({ applicationId: apps.find((a) => a.stylistId === j.stylistId)?.id ?? j.id, stylistId: j.stylistId })) : accepted.map((a) => ({ applicationId: a.id, stylistId: a.stylistId })))
    .map((m) => ({
      applicationId: m.applicationId,
      stylistId: m.stylistId,
      name: profileById.get(m.stylistId)?.name ?? "Artist",
      specialty: profileById.get(m.stylistId)?.specialty ?? "",
      rate: one.rate,
      fee: one.fee,
      total: one.total,
      deposit: one.deposit,
      balance: one.balance,
    }));

  const cost = campaignCost(call.ratePerArtist, team.length);
  const paid = round2(paymentRows.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amount, 0));
  const outstanding = round2(Math.max(0, cost.total - paid));

  const brandVerified = await isBrandVerified(call.brandId);
  const balanceDueDate = call.status === "deposit_paid" && call.eventDate ? campaignBalanceDueDate(call.eventDate) : null;
  const balanceOverdue = !!balanceDueDate && daysUntil(balanceDueDate) < 0;
  const depositAllowed = !!call.eventDate && campaignDepositAllowed(call.eventDate);

  const jobs = jobRows.map((j) => ({
    appointmentId: j.id,
    stylistId: j.stylistId,
    name: j.stylistName,
    rate: j.price,
    total: campaignArtistCost(j.price).total,
    collected: collectedBy.get(j.id) ?? 0,
    status: j.status,
    payoutStatus: j.payoutStatus,
    confirmedByBrand: j.workConfirmedByClient,
    confirmedByArtist: j.workConfirmedByArtist,
  }));

  let stage: CampaignStage = "open";
  if (call.status === "cancelled") stage = "cancelled";
  else if (call.status === "deposit_paid") stage = "deposit_paid";
  else if (call.status === "fully_paid") {
    stage = jobs.length > 0 && jobs.every((j) => j.payoutStatus === "released") ? "completed" : "fully_paid";
  }

  const blockers: string[] = [];
  if (call.status === "cancelled") blockers.push("This campaign is cancelled.");
  if (call.status === "open") {
    if (!brandVerified) blockers.push("Your brand needs to be verified before you can pay.");
    if (call.ratePerArtist <= 0) blockers.push("Add what each artist is paid before you can pay.");
    if (!call.eventDate) blockers.push("Add the event date before you can pay.");
    else if (daysUntil(call.eventDate) < 1) blockers.push("The event date has passed or is today. Edit the date to continue.");
    if (accepted.length === 0) blockers.push("Accept at least one artist first. Artists you invite need to accept before you can pay.");
  }

  const canFund = call.status === "open" && blockers.length === 0;
  const canPayBalance = call.status === "deposit_paid" && outstanding > 0;

  const [calls] = await Promise.all([formatCalls([call], viewer)]);

  return {
    call: calls[0]!,
    stage,
    team,
    jobs,
    payments: paymentRows.map((p) => ({
      id: p.id,
      kind: p.kind as "deposit" | "balance" | "full",
      amount: p.amount,
      status: p.status as "pending" | "paid" | "failed" | "expired",
      createdAt: p.createdAt.toISOString(),
      paidAt: p.paidAt?.toISOString() ?? null,
    })),
    cost,
    paid,
    outstanding,
    balanceDueDate,
    balanceOverdue,
    depositAllowed,
    canFund,
    canPayBalance,
    blockers,
  };
}
