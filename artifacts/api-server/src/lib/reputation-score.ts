/**
 * The maths of reputation, with no database in it so every rule can be tested on its own.
 * Inputs are plain counts; outputs are 0 to 100 category scores, an overall score, and a tier.
 * Scores keep full precision. Rounding happens only when a number is shown.
 */
import { REPUTATION_CONFIG as CFG, type TierRule } from "./reputation-config";

export type Config = typeof CFG;

export const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));

export interface ReliabilityInput { completed: number; lateCancels: number; lastMinuteCancels: number; noShows: number }

/** (done + credit) / (done + credit + weighted failures). One bad event is softened by the credit every artist starts with. */
export function reliabilityScore(i: ReliabilityInput, c: Config = CFG): number {
  const r = c.reliability;
  const failures = i.lateCancels * r.failureWeights.late_cancel
    + i.lastMinuteCancels * r.failureWeights.last_minute_cancel
    + i.noShows * r.failureWeights.no_show;
  const good = i.completed + r.priorCompleted;
  return clamp(100 * good / (good + failures + r.priorFailureWeight));
}

/** A smoothed average, so one rating cannot dominate a short record. 1 star is 0, 5 stars is 100. */
export function satisfactionScore(ratingSum: number, ratingCount: number, c: Config = CFG): number {
  const s = c.satisfaction;
  const avg = (ratingSum + s.priorRating * s.priorWeight) / (ratingCount + s.priorWeight);
  return clamp(((avg - 1) / 4) * 100);
}

/** Starts at a baseline. Only owner-confirmed conduct cases within the recovery window lower it. */
export function professionalismScore(cases: { type: "conduct_minor" | "conduct_serious"; ageDays: number }[], c: Config = CFG): number {
  const p = c.professionalism;
  const lost = cases
    .filter((x) => x.ageDays <= p.recoveryDays)
    .reduce((sum, x) => sum + p.deductions[x.type], 0);
  return clamp(p.baseline - lost);
}

export interface ConsistencyInput {
  /** Completed and failed bookings inside the rolling window. */
  completedInWindow: number;
  failuresInWindow: number;
  /** Months in the window with at least one completed booking. */
  activeMonths: number;
  /** Whole months since she was verified. */
  monthsSinceVerified: number;
}

/**
 * Success rate in the last six months, plus how many of those months she was active. Quiet months only
 * stop the activity part growing. They are never treated as misconduct. Inside her first month the activity
 * part is neutral.
 */
export function consistencyScore(i: ConsistencyInput, c: Config = CFG): number {
  const k = c.consistency, r = c.reliability;
  const good = i.completedInWindow + r.priorCompleted;
  const success = good / (good + i.failuresInWindow + r.priorFailureWeight);
  let activity: number;
  if (i.monthsSinceVerified < 1) activity = k.neutralActivity;
  else {
    const available = Math.min(k.windowMonths, i.monthsSinceVerified);
    const target = Math.max(1, Math.min(k.fullActivityMonths, Math.round(available * (k.fullActivityMonths / k.windowMonths))));
    activity = Math.min(1, i.activeMonths / target);
  }
  return clamp(100 * (k.successShare * success + k.activityShare * activity));
}

/** Referrals lift this above a neutral baseline, up to a cap, so it can never carry more than its 5%. */
export function communityScore(creditedReferrals: number, c: Config = CFG): number {
  const k = c.community;
  return clamp(k.baseline + Math.min(creditedReferrals, k.maxCreditsPerYear) * k.pointsPerReferral);
}

export interface Categories { reliability: number; satisfaction: number; professionalism: number; consistency: number; community: number }

export function overallScore(cat: Categories, c: Config = CFG): number {
  const w = c.weights;
  return clamp(
    w.reliability * cat.reliability + w.satisfaction * cat.satisfaction + w.professionalism * cat.professionalism
    + w.consistency * cat.consistency + w.community * cat.community,
  );
}

export interface TierInput { score: number; completedBookings: number; monthsSinceVerified: number; evidenceSufficient: boolean }

/** The highest tier she meets on score AND bookings AND time. A score alone never unlocks anything. */
export function qualifyingTier(i: TierInput, c: Config = CFG): TierRule {
  const tiers = c.tiers;
  if (!i.evidenceSufficient) return tiers[0]!;
  let best = tiers[0]!;
  for (const t of tiers) {
    if (i.score >= t.minScore && i.completedBookings >= t.minBookings && i.monthsSinceVerified >= t.minMonths) best = t;
  }
  return best;
}

export const tierIndex = (key: string, c: Config = CFG) => Math.max(0, c.tiers.findIndex((t) => t.key === key));

/** What an artist still needs for the next tier, in plain terms. Never says "unlocked" while anything is missing. */
export function nextTierProgress(current: string, i: TierInput, c: Config = CFG) {
  const next = c.tiers[tierIndex(current, c) + 1];
  if (!next) return null;
  return {
    tier: next.key,
    label: next.label,
    pointsNeeded: Math.max(0, Math.round((next.minScore - i.score) * 10) / 10),
    bookingsNeeded: Math.max(0, next.minBookings - i.completedBookings),
    monthsNeeded: Math.max(0, next.minMonths - i.monthsSinceVerified),
  };
}

/** Whole months between two dates, never negative. */
export function monthsBetween(from: Date, to: Date): number {
  const days = (to.getTime() - from.getTime()) / 86_400_000;
  return Math.max(0, Math.floor(days / 30.4375));
}

/** How much notice she gave before a booking, turned into the kind of cancellation it counts as. */
export function cancellationKind(noticeHours: number, c: Config = CFG): "free" | "late_cancel" | "last_minute_cancel" {
  if (noticeHours >= c.cancellation.freeNoticeHours) return "free";
  if (noticeHours >= c.cancellation.lateNoticeHours) return "late_cancel";
  return "last_minute_cancel";
}
