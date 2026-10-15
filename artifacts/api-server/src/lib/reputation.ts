/**
 * Reputation engine (server side only; nothing a screen sends can set a score or a tier).
 *
 * How it works, in order:
 *   1. syncEvents   reads what really happened (completed jobs, artist cancellations, no-shows,
 *                   reviews, seat withdrawals, referrals) and writes each fact to the ledger once.
 *   2. recompute    adds up the ledger into five category scores, an overall score and a tier.
 *   3. monthly review  is the only thing that moves a tier DOWN, and only after she has qualified for a
 *                   lower tier two months in a row. Promotion happens as soon as she qualifies.
 *
 * Every rule and number is in reputation-config.ts. The maths is in reputation-score.ts.
 */
import { randomUUID } from "crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  appointmentsTable,
  campaignSeatEventsTable,
  db,
  referralsTable,
  reviewsTable,
  reputationAuditLogTable,
  reputationDisputesTable,
  reputationEventsTable,
  reputationSummaryTable,
  reputationTierHistoryTable,
  stylistProfilesTable,
  usersTable,
  type ReputationEvent,
} from "@workspace/db";
import { REPUTATION_CONFIG as CFG, validateReputationConfig } from "./reputation-config";
import {
  cancellationKind,
  communityScore,
  consistencyScore,
  monthsBetween,
  nextTierProgress,
  overallScore,
  professionalismScore,
  qualifyingTier,
  reliabilityScore,
  satisfactionScore,
  tierIndex,
} from "./reputation-score";
import { notifyStylistProfile } from "./campaigns";
import { logger } from "./logger";

const DAY_MS = 86_400_000;

export const EVENT_LABELS: Record<string, string> = {
  completed: "Completed booking",
  late_cancel: "Late cancellation by you",
  last_minute_cancel: "Last-minute cancellation by you",
  no_show: "Missed booking (no-show)",
  review: "Client review",
  conduct_minor: "Confirmed conduct case (minor)",
  conduct_serious: "Confirmed conduct case (serious)",
  referral_credit: "Referral milestone",
};

// ---------------------------------------------------------------------------
// 1. The ledger
// ---------------------------------------------------------------------------

type NewEvent = { stylistId: string; type: string; sourceType: string; sourceId: string; eventAt: Date; data?: Record<string, unknown> };

/** Record a fact once. The same fact arriving twice (a retry, a re-run) changes nothing. */
async function addEvent(e: NewEvent): Promise<boolean> {
  const key = `${e.sourceType}:${e.sourceId}:${e.type}`;
  const rows = await db.insert(reputationEventsTable).values({
    id: randomUUID(), stylistId: e.stylistId, type: e.type, sourceType: e.sourceType, sourceId: e.sourceId,
    data: e.data ?? {}, eventAt: e.eventAt, idempotencyKey: key,
  }).onConflictDoNothing().returning({ id: reputationEventsTable.id });
  return rows.length > 0;
}

const apptMoment = (a: { date: string; time: string }) => {
  const t = Date.parse(`${a.date}T${/^\d{2}:\d{2}$/.test(a.time) ? a.time : "09:00"}:00+02:00`);
  return new Date(Number.isNaN(t) ? Date.now() : t);
};

/** Turn what the app already knows into ledger entries. Safe to run any number of times. */
export async function syncEvents(stylistId: string): Promise<void> {
  const [profile] = await db.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.id, stylistId));
  if (!profile) return;

  const appts = await db.select().from(appointmentsTable).where(eq(appointmentsTable.stylistId, stylistId));
  for (const a of appts) {
    if (a.noShow) {
      await addEvent({ stylistId, type: "no_show", sourceType: "appt", sourceId: a.id, eventAt: apptMoment(a) });
      continue;
    }
    if (a.status === "completed" && a.payoutStatus !== "disputed") {
      await addEvent({ stylistId, type: "completed", sourceType: "appt", sourceId: a.id, eventAt: apptMoment(a) });
    }
    // Only a cancellation the ARTIST made counts, and only if she gave too little notice.
    // Client cancellations, platform cancellations and old bookings with no record are never held against her.
    if (a.status === "cancelled" && a.cancelledBy === "artist" && a.cancelNoticeHours !== null) {
      const kind = cancellationKind(a.cancelNoticeHours);
      if (kind !== "free") {
        await addEvent({ stylistId, type: kind, sourceType: "appt", sourceId: a.id, eventAt: a.cancelledAt ?? apptMoment(a), data: { noticeHours: a.cancelNoticeHours } });
      }
    }
  }

  // Reviews from the client of a completed booking, one per booking (the reviews table already enforces that).
  const reviews = await db.select({ id: reviewsTable.id, rating: reviewsTable.rating, createdAt: reviewsTable.createdAt, apptStatus: appointmentsTable.status, clientId: appointmentsTable.clientId, reviewerId: reviewsTable.reviewerId })
    .from(reviewsTable)
    .innerJoin(appointmentsTable, eq(appointmentsTable.id, reviewsTable.appointmentId))
    .where(eq(reviewsTable.revieweeId, stylistId));
  for (const r of reviews) {
    if (r.apptStatus !== "completed" || r.reviewerId !== r.clientId || r.reviewerId === profile.userId) continue;
    await addEvent({ stylistId, type: "review", sourceType: "review", sourceId: r.id, eventAt: r.createdAt, data: { rating: r.rating } });
  }

  // A brand campaign seat she left late is a late cancellation too. Leaving 7+ days ahead is not.
  const seatEvents = await db.select().from(campaignSeatEventsTable)
    .where(and(eq(campaignSeatEventsTable.stylistProfileId, stylistId), eq(campaignSeatEventsTable.kind, "withdrew")));
  for (const s of seatEvents) {
    const type = s.severity === "last_minute" ? "last_minute_cancel" : s.severity === "late" ? "late_cancel" : null;
    if (type) await addEvent({ stylistId, type, sourceType: "seat", sourceId: s.id, eventAt: s.createdAt, data: { noticeHours: s.hoursBefore } });
  }

  await syncReferralCredits(stylistId, profile.userId);
}

/**
 * A referral earns credit only once the referred ARTIST is verified and has finished the required number of
 * bookings. Self-referrals and accounts sharing a phone number never count.
 */
async function syncReferralCredits(stylistId: string, userId: string) {
  const referrals = await db.select().from(referralsTable)
    .where(and(eq(referralsTable.referrerId, userId), eq(referralsTable.referredType, "artist")));
  if (referrals.length === 0) return;
  const [me] = await db.select({ phone: usersTable.phone }).from(usersTable).where(eq(usersTable.id, userId));
  for (const r of referrals) {
    if (r.referredId === userId) continue;
    const [other] = await db.select({ phone: usersTable.phone }).from(usersTable).where(eq(usersTable.id, r.referredId));
    if (!other || (me?.phone && other.phone && me.phone === other.phone)) continue;
    const [referredProfile] = await db.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.userId, r.referredId));
    if (!referredProfile?.verified) continue;
    const [done] = await db.select({ n: sql<number>`count(*)::int` }).from(appointmentsTable)
      .where(and(eq(appointmentsTable.stylistId, referredProfile.id), eq(appointmentsTable.status, "completed"), eq(appointmentsTable.noShow, false)));
    if ((done?.n ?? 0) < CFG.community.bookingsRequired) continue;
    await addEvent({ stylistId, type: "referral_credit", sourceType: "referral", sourceId: r.id, eventAt: new Date() });
  }
}

// ---------------------------------------------------------------------------
// 2. Working out the standing
// ---------------------------------------------------------------------------

export type SummaryRow = typeof reputationSummaryTable.$inferSelect;

export interface Standing {
  categories: { reliability: number; satisfaction: number; professionalism: number; consistency: number; community: number };
  overall: number;
  tier: string;
  evidenceSufficient: boolean;
  completedBookings: number;
  reviewCount: number;
  ratingSum: number;
  activeMonths: number;
  monthsSinceVerified: number;
}

export async function computeStanding(stylistId: string, now: Date = new Date()): Promise<Standing | null> {
  const [profile] = await db.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.id, stylistId));
  if (!profile) return null;
  const events = await db.select().from(reputationEventsTable)
    .where(and(eq(reputationEventsTable.stylistId, stylistId), eq(reputationEventsTable.status, "active")));

  const since = (days: number) => now.getTime() - days * DAY_MS;
  const inWindow = (e: ReputationEvent, days: number) => e.eventAt.getTime() >= since(days);
  const count = (type: string, days?: number) => events.filter((e) => e.type === type && (days === undefined || inWindow(e, days))).length;

  const completedAll = count("completed");
  const reviews = events.filter((e) => e.type === "review");
  const ratingSum = reviews.reduce((s, e) => s + Number((e.data as any).rating ?? 0), 0);

  const relDays = CFG.reliability.windowDays;
  const reliability = reliabilityScore({
    completed: count("completed", relDays), lateCancels: count("late_cancel", relDays),
    lastMinuteCancels: count("last_minute_cancel", relDays), noShows: count("no_show", relDays),
  });
  const satisfaction = satisfactionScore(ratingSum, reviews.length);
  const professionalism = professionalismScore(events
    .filter((e) => e.type === "conduct_minor" || e.type === "conduct_serious")
    .map((e) => ({ type: e.type as "conduct_minor" | "conduct_serious", ageDays: (now.getTime() - e.eventAt.getTime()) / DAY_MS })));

  const winDays = Math.round(CFG.consistency.windowMonths * 30.4375);
  const winCompleted = events.filter((e) => e.type === "completed" && inWindow(e, winDays));
  const months = new Set(winCompleted.map((e) => `${e.eventAt.getUTCFullYear()}-${e.eventAt.getUTCMonth()}`));
  const verifiedFrom = profile.verifiedAt ?? profile.createdAt;
  const monthsSinceVerified = monthsBetween(verifiedFrom, now);
  const consistency = consistencyScore({
    completedInWindow: winCompleted.length,
    failuresInWindow: ["late_cancel", "last_minute_cancel", "no_show"].reduce((s, t) => s + count(t, winDays), 0),
    activeMonths: months.size,
    monthsSinceVerified,
  });
  const community = communityScore(count("referral_credit", 365));

  const categories = { reliability, satisfaction, professionalism, consistency, community };
  const overall = overallScore(categories);
  const evidenceSufficient = completedAll >= CFG.minCompletedForRating;
  const tier = qualifyingTier({ score: overall, completedBookings: completedAll, monthsSinceVerified, evidenceSufficient }).key;
  return { categories, overall, tier, evidenceSufficient, completedBookings: completedAll, reviewCount: reviews.length, ratingSum, activeMonths: months.size, monthsSinceVerified, };
}

async function recordTierChange(stylistId: string, from: string | null, to: string, reason: string, score: number) {
  await db.insert(reputationTierHistoryTable).values({ id: randomUUID(), stylistId, fromTier: from, toTier: to, reason, score, calcVersion: CFG.version });
}

const tierLabel = (key: string) => CFG.tiers.find((t) => t.key === key)?.label ?? key;

function notifyTierChange(stylistId: string, from: string, to: string, up: boolean, standing: Standing) {
  const progress = nextTierProgress(to, { score: standing.overall, completedBookings: standing.completedBookings, monthsSinceVerified: standing.monthsSinceVerified, evidenceSufficient: standing.evidenceSufficient });
  const goal = progress ? `Next step: ${progress.label}.` : "You are at the highest tier.";
  void notifyStylistProfile(stylistId, up ? "tier.changed" : "tier.lowered", { previousTier: tierLabel(from), newTier: tierLabel(to), nextGoal: goal });
}

/** Sync the ledger, work out the standing, save it. A tier goes UP straight away; down only at the monthly review. */
export async function recomputeReputation(stylistId: string, opts: { now?: Date; reason?: string; skipSync?: boolean } = {}): Promise<SummaryRow | null> {
  const now = opts.now ?? new Date();
  if (!opts.skipSync) await syncEvents(stylistId);
  const standing = await computeStanding(stylistId, now);
  if (!standing) return null;

  const [existing] = await db.select().from(reputationSummaryTable).where(eq(reputationSummaryTable.stylistId, stylistId));
  const currentTier = existing?.tier ?? "new_talent";
  let tier = currentTier;
  let promoted = false;
  if (tierIndex(standing.tier) > tierIndex(currentTier)) { tier = standing.tier; promoted = true; }

  const values = {
    stylistId,
    reliability: standing.categories.reliability, satisfaction: standing.categories.satisfaction,
    professionalism: standing.categories.professionalism, consistency: standing.categories.consistency,
    community: standing.categories.community, overall: standing.overall,
    displayedScore: Math.round(standing.overall), tier,
    evidenceSufficient: standing.evidenceSufficient, completedBookings: standing.completedBookings,
    reviewCount: standing.reviewCount, activeMonths: standing.activeMonths,
    belowTierMonths: promoted ? 0 : existing?.belowTierMonths ?? 0,
    calcVersion: CFG.version, calculatedAt: now,
  };
  const [saved] = await db.insert(reputationSummaryTable).values(values)
    .onConflictDoUpdate({ target: reputationSummaryTable.stylistId, set: values }).returning();

  if (!existing) {
    await recordTierChange(stylistId, null, tier, "First calculation", standing.overall);
  } else if (promoted) {
    await recordTierChange(stylistId, currentTier, tier, opts.reason ?? "Met the score, booking and time requirements", standing.overall);
    notifyTierChange(stylistId, currentTier, tier, true, standing);
  }
  return saved ?? null;
}

/** Recompute without ever failing the request that triggered it. */
export function recomputeLater(stylistId: string, reason?: string) {
  setImmediate(() => { recomputeReputation(stylistId, { reason }).catch((err) => logger.warn({ err, stylistId }, "Reputation recompute failed")); });
}

// ---------------------------------------------------------------------------
// 3. Monthly tier review (the only way down)
// ---------------------------------------------------------------------------

const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

export async function runMonthlyTierReview(now: Date = new Date()): Promise<{ reviewed: number; demoted: number; promoted: number }> {
  const key = monthKey(now);
  const rows = await db.select().from(reputationSummaryTable);
  let reviewed = 0, demoted = 0, promoted = 0;
  for (const row of rows) {
    if (row.lastReviewMonth === key) continue;
    await syncEvents(row.stylistId);
    const standing = await computeStanding(row.stylistId, now);
    if (!standing) continue;
    reviewed++;
    const cur = tierIndex(row.tier), target = tierIndex(standing.tier);
    let tier = row.tier, below = 0;
    if (target > cur) { tier = standing.tier; promoted++; await recordTierChange(row.stylistId, row.tier, tier, "Monthly review: met the next tier's requirements", standing.overall); notifyTierChange(row.stylistId, row.tier, tier, true, standing); }
    else if (target < cur) {
      below = row.belowTierMonths + 1;
      if (below >= CFG.tierReview.demotionMonths) {
        tier = standing.tier; below = 0; demoted++;
        await recordTierChange(row.stylistId, row.tier, tier, `Monthly review: below the requirements for ${CFG.tierReview.demotionMonths} reviews in a row`, standing.overall);
        notifyTierChange(row.stylistId, row.tier, tier, false, standing);
      }
    }
    await db.update(reputationSummaryTable).set({
      tier, belowTierMonths: below, lastReviewMonth: key, overall: standing.overall, displayedScore: Math.round(standing.overall),
      reliability: standing.categories.reliability, satisfaction: standing.categories.satisfaction, professionalism: standing.categories.professionalism,
      consistency: standing.categories.consistency, community: standing.categories.community, evidenceSufficient: standing.evidenceSufficient,
      completedBookings: standing.completedBookings, reviewCount: standing.reviewCount, activeMonths: standing.activeMonths, calculatedAt: now,
    }).where(eq(reputationSummaryTable.stylistId, row.stylistId));
  }
  return { reviewed, demoted, promoted };
}

export function startReputationJob() {
  const problems = validateReputationConfig();
  if (problems.length) logger.error({ problems }, "Reputation settings are invalid");
  const run = () => runMonthlyTierReview().catch((err) => logger.error({ err }, "Monthly tier review failed"));
  setTimeout(run, 5 * 60 * 1000);
  setInterval(run, 6 * 3_600_000);
  logger.info("Reputation monthly review scheduled");
}

// ---------------------------------------------------------------------------
// 4. What people are allowed to see
// ---------------------------------------------------------------------------

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Safe for anyone: tier, a score only once there is enough evidence, a rating only after enough reviews. */
export function publicReputation(row: SummaryRow | undefined | null) {
  const tier = row?.tier ?? "new_talent";
  const building = !row || !row.evidenceSufficient;
  return {
    tier,
    tierLabel: building ? "New Talent" : tierLabel(tier),
    building,
    score: building ? null : row!.displayedScore,
    completedBookings: row?.completedBookings ?? 0,
    reviewCount: row?.reviewCount ?? 0,
  };
}

export async function publicReputationFor(stylistId: string) {
  const [row] = await db.select().from(reputationSummaryTable).where(eq(reputationSummaryTable.stylistId, stylistId));
  return publicReputation(row);
}

export async function publicReputationMap(stylistIds: string[]) {
  const map = new Map<string, ReturnType<typeof publicReputation>>();
  if (stylistIds.length === 0) return map;
  const rows = await db.select().from(reputationSummaryTable).where(inArray(reputationSummaryTable.stylistId, stylistIds));
  const byId = new Map(rows.map((r) => [r.stylistId, r]));
  for (const id of stylistIds) map.set(id, publicReputation(byId.get(id)));
  return map;
}

/** Everything an artist sees about herself. */
export async function artistReputationView(stylistId: string) {
  const [found] = await db.select().from(reputationSummaryTable).where(eq(reputationSummaryTable.stylistId, stylistId));
  const row: SummaryRow | undefined = found ?? (await recomputeReputation(stylistId)) ?? undefined;
  const [profile] = await db.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.id, stylistId));
  if (!row || !profile) return null;
  const monthsSinceVerified = monthsBetween(profile.verifiedAt ?? profile.createdAt, new Date());
  const progress = nextTierProgress(row.tier, { score: row.overall, completedBookings: row.completedBookings, monthsSinceVerified, evidenceSufficient: row.evidenceSufficient });
  const events = await db.select().from(reputationEventsTable).where(eq(reputationEventsTable.stylistId, stylistId)).orderBy(desc(reputationEventsTable.eventAt)).limit(40);
  const disputes = await db.select().from(reputationDisputesTable).where(eq(reputationDisputesTable.stylistId, stylistId));
  const disputeByEvent = new Map(disputes.map((d) => [d.eventId, d]));
  const history = await db.select().from(reputationTierHistoryTable).where(eq(reputationTierHistoryTable.stylistId, stylistId)).orderBy(desc(reputationTierHistoryTable.createdAt)).limit(20);
  const referralRows = await db.select().from(referralsTable)
    .where(and(eq(referralsTable.referrerId, profile.userId), eq(referralsTable.referredType, "artist")));
  const [me] = await db.select({ code: usersTable.referralCode }).from(usersTable).where(eq(usersTable.id, profile.userId));
  const credited = events.filter((e) => e.type === "referral_credit" && e.status === "active").length;

  const cat = (key: string, label: string, weight: number, value: number, help: string) => ({ key, label, weightPercent: Math.round(weight * 100), score: round1(value), help });
  const w = CFG.weights;
  return {
    building: !row.evidenceSufficient,
    tier: row.tier,
    tierLabel: row.evidenceSufficient ? tierLabel(row.tier) : "New Talent",
    score: row.evidenceSufficient ? round1(row.overall) : null,
    provisionalScore: round1(row.overall),
    completedBookings: row.completedBookings,
    bookingsToRate: Math.max(0, CFG.minCompletedForRating - row.completedBookings),
    reviewCount: row.reviewCount,
    monthsSinceVerified,
    verified: profile.verified,
    categories: [
      cat("reliability", "Booking reliability", w.reliability, row.reliability, "Jobs you complete, against cancellations or no-shows you caused."),
      cat("satisfaction", "Client satisfaction", w.satisfaction, row.satisfaction, "Your client ratings, smoothed so one review cannot swing it."),
      cat("professionalism", "Professionalism", w.professionalism, row.professionalism, "Starts strong. Only cases Bonisa has reviewed and confirmed lower it."),
      cat("consistency", "Consistency", w.consistency, row.consistency, "Dependable service over the last six months. Quiet months are not held against you."),
      cat("community", "Community", w.community, row.community, "Referrals that verified and completed their first bookings."),
    ],
    nextTier: progress,
    history: history.map((h) => ({ id: h.id, from: h.fromTier ? tierLabel(h.fromTier) : null, to: tierLabel(h.toTier), reason: h.reason, createdAt: h.createdAt.toISOString() })),
    events: events.map((e) => ({
      id: e.id, type: e.type, label: EVENT_LABELS[e.type] ?? e.type, status: e.status,
      createdAt: e.eventAt.toISOString(),
      detail: e.type === "review" ? `${(e.data as any).rating} star review` : e.type.endsWith("cancel") && (e.data as any).noticeHours != null ? `${Math.round(Number((e.data as any).noticeHours))} hours notice` : null,
      canDispute: e.status === "active" && !["completed", "review", "referral_credit"].includes(e.type) && !disputeByEvent.has(e.id),
      dispute: disputeByEvent.get(e.id) ? { status: disputeByEvent.get(e.id)!.status, note: disputeByEvent.get(e.id)!.status === "open" ? null : disputeByEvent.get(e.id)!.decisionNote } : null,
    })),
    referral: {
      code: me?.code ?? null,
      referred: referralRows.length,
      credited,
      creditCap: CFG.community.maxCreditsPerYear,
      bookingsRequired: CFG.community.bookingsRequired,
    },
    cancellationPolicy: { freeNoticeHours: CFG.cancellation.freeNoticeHours, lateNoticeHours: CFG.cancellation.lateNoticeHours },
  };
}

// ---------------------------------------------------------------------------
// 5. Owner actions, never silent
// ---------------------------------------------------------------------------

export async function audit(entry: { stylistId: string | null; actor: string; action: string; reason: string; eventId?: string | null; before?: Record<string, unknown> | null; after?: Record<string, unknown> | null }) {
  await db.insert(reputationAuditLogTable).values({
    id: randomUUID(), stylistId: entry.stylistId, actor: entry.actor, action: entry.action, reason: entry.reason,
    eventId: entry.eventId ?? null, before: entry.before ?? null, after: entry.after ?? null,
  });
}

/** Take an event out of the score (it was wrong), keeping the record of why. */
export async function reverseEvent(eventId: string, actor: string, reason: string): Promise<{ ok: true } | { error: string; status: number }> {
  const [ev] = await db.select().from(reputationEventsTable).where(eq(reputationEventsTable.id, eventId));
  if (!ev) return { status: 404, error: "Event not found" };
  if (ev.status === "reversed") return { status: 409, error: "This event has already been reversed." };
  await db.update(reputationEventsTable).set({ status: "reversed", reversedAt: new Date(), reversalReason: reason }).where(eq(reputationEventsTable.id, eventId));
  await audit({ stylistId: ev.stylistId, actor, action: "event_reversed", reason, eventId, before: { status: ev.status }, after: { status: "reversed" } });
  await recomputeReputation(ev.stylistId, { skipSync: true });
  return { ok: true };
}

/** An artist asks for a record to be looked at. The event stops counting until the owner decides. */
export async function openDispute(stylistId: string, eventId: string, reason: string): Promise<{ id: string } | { error: string; status: number }> {
  const [ev] = await db.select().from(reputationEventsTable).where(and(eq(reputationEventsTable.id, eventId), eq(reputationEventsTable.stylistId, stylistId)));
  if (!ev) return { status: 404, error: "Event not found" };
  if (ev.status !== "active") return { status: 409, error: "This record cannot be disputed." };
  if (["completed", "review", "referral_credit"].includes(ev.type)) return { status: 409, error: "Only cancellations, no-shows and conduct records can be disputed. To report a review, use the review's report option." };
  const [existing] = await db.select().from(reputationDisputesTable).where(eq(reputationDisputesTable.eventId, eventId));
  if (existing) return { status: 409, error: "You have already asked for this to be reviewed." };
  const id = randomUUID();
  await db.insert(reputationDisputesTable).values({ id, eventId, stylistId, reason });
  // Pending allegations never create a final negative score change.
  await db.update(reputationEventsTable).set({ status: "under_review" }).where(eq(reputationEventsTable.id, eventId));
  await audit({ stylistId, actor: `artist:${stylistId}`, action: "dispute_opened", reason, eventId, before: { status: "active" }, after: { status: "under_review" } });
  await recomputeReputation(stylistId, { skipSync: true });
  return { id };
}

export async function resolveDispute(disputeId: string, actor: string, decision: "uphold" | "reject", note: string): Promise<{ ok: true } | { error: string; status: number }> {
  const [d] = await db.select().from(reputationDisputesTable).where(eq(reputationDisputesTable.id, disputeId));
  if (!d) return { status: 404, error: "Dispute not found" };
  if (d.status !== "open") return { status: 409, error: "This dispute has already been decided." };
  const upheld = decision === "uphold";
  await db.update(reputationDisputesTable).set({ status: upheld ? "upheld" : "rejected", decisionNote: note, decidedBy: actor, decidedAt: new Date() }).where(eq(reputationDisputesTable.id, disputeId));
  await db.update(reputationEventsTable).set(upheld
    ? { status: "reversed", reversedAt: new Date(), reversalReason: note }
    : { status: "active" }).where(eq(reputationEventsTable.id, d.eventId));
  await audit({ stylistId: d.stylistId, actor, action: upheld ? "dispute_upheld" : "dispute_rejected", reason: note, eventId: d.eventId, before: { status: "under_review" }, after: { status: upheld ? "reversed" : "active" } });
  await recomputeReputation(d.stylistId, { skipSync: true });
  return { ok: true };
}

/** The owner records a conduct case after reviewing it. Never created from an unproven claim. */
export async function recordConductCase(stylistId: string, severity: "minor" | "serious", actor: string, reason: string, complaintId?: string) {
  const id = randomUUID();
  await addEvent({ stylistId, type: severity === "minor" ? "conduct_minor" : "conduct_serious", sourceType: "case", sourceId: id, eventAt: new Date(), data: { reason, complaintId: complaintId ?? null } });
  await audit({ stylistId, actor, action: "conduct_case_recorded", reason, after: { severity } });
  await recomputeReputation(stylistId, { skipSync: true });
}

/** Record a confirmed artist no-show (owner only) and recompute. */
export async function recordNoShow(appointmentId: string, actor: string, reason: string): Promise<{ ok: true; refundDue: number } | { error: string; status: number }> {
  const [a] = await db.select().from(appointmentsTable).where(eq(appointmentsTable.id, appointmentId));
  if (!a) return { status: 404, error: "Booking not found" };
  if (a.noShow) return { status: 409, error: "This booking is already recorded as a no-show." };
  if (a.status === "completed") return { status: 409, error: "This booking was completed, so it cannot be a no-show." };
  if (a.campaignId) return { status: 409, error: "Campaign jobs are handled through the campaign." };
  const collected = await collectedFor(appointmentId);
  await db.update(appointmentsTable).set({
    noShow: true, status: "cancelled", cancelledBy: "artist", cancelledAt: new Date(),
    refundDueAmount: collected > 0 ? collected : a.refundDueAmount,
  }).where(eq(appointmentsTable.id, appointmentId));
  await audit({ stylistId: a.stylistId, actor, action: "no_show_recorded", reason, before: { noShow: false }, after: { noShow: true } });
  await recomputeReputation(a.stylistId);
  return { ok: true, refundDue: collected };
}

/** What a client has paid on a normal booking and not yet had back. */
export async function collectedFor(appointmentId: string): Promise<number> {
  const { paymentsTable } = await import("@workspace/db");
  const rows = await db.select().from(paymentsTable).where(and(
    eq(paymentsTable.appointmentId, appointmentId),
    sql`${paymentsTable.status} in ('succeeded', 'partial_refunded')`,
  ));
  const cents = rows.reduce((s, p) => s + Math.round(p.amount * 100) - Math.round((p.refundedAmount ?? 0) * 100), 0);
  return Math.max(0, cents) / 100;
}
