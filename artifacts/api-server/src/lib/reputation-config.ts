/**
 * Reputation settings: the ONE place every weight, threshold, window and penalty lives.
 * Nothing else in the app hard-codes these. Change a number here (or the version) and every
 * score is recalculated from the same recorded events.
 *
 * Launch defaults come from the Bonisa Artist Reputation and Tier System brief (15 October 2026).
 */
export interface TierRule {
  key: "new_talent" | "rising" | "signature" | "elite" | "icon";
  label: string;
  minScore: number;
  minBookings: number;
  /** Whole months since she was verified. */
  minMonths: number;
}

export const REPUTATION_CONFIG = {
  /** Bump when a rule changes, so history shows which rules produced a score. */
  version: 1,

  weights: { reliability: 0.30, satisfaction: 0.30, professionalism: 0.20, consistency: 0.15, community: 0.05 },

  tiers: [
    { key: "new_talent", label: "New Talent", minScore: 0, minBookings: 0, minMonths: 0 },
    { key: "rising", label: "Rising Artist", minScore: 60, minBookings: 5, minMonths: 0 },
    { key: "signature", label: "Signature Artist", minScore: 75, minBookings: 15, minMonths: 3 },
    { key: "elite", label: "Elite Artist", minScore: 85, minBookings: 30, minMonths: 6 },
    { key: "icon", label: "Bonisa Icon", minScore: 93, minBookings: 60, minMonths: 12 },
  ] as TierRule[],

  /** Fewer completed bookings than this and she shows "Building reputation", never a low score. */
  minCompletedForRating: 5,
  /** A star-rating average is only shown publicly from this many reviews. */
  minReviewsToShow: 3,

  reliability: {
    windowDays: 365,
    /** Phantom good history every artist starts with, so one bad event cannot destroy a short record. */
    priorCompleted: 3,
    /** Phantom failure weight. With the above, a brand-new artist starts at 80. */
    priorFailureWeight: 0.75,
    /** How heavily each kind of failure counts against completed bookings. */
    failureWeights: { late_cancel: 1.5, last_minute_cancel: 3, no_show: 5 },
  },

  satisfaction: {
    /** A new artist's average leans toward this until real reviews outweigh it. */
    priorRating: 4.0,
    priorWeight: 5,
  },

  professionalism: {
    /** She starts here. Only owner-confirmed cases lower it. */
    baseline: 85,
    deductions: { conduct_minor: 5, conduct_serious: 15 },
    /** A confirmed case stops counting after this long. */
    recoveryDays: 180,
  },

  consistency: {
    windowMonths: 6,
    /** Active months (at least one completed booking) in the window that count as fully active. */
    fullActivityMonths: 4,
    successShare: 0.7,
    activityShare: 0.3,
    /** Used until she has been verified for a full month. */
    neutralActivity: 0.8,
  },

  community: {
    /** Without referrals everyone sits here, so the 5% is neither a bonus nor a punishment. */
    baseline: 60,
    pointsPerReferral: 10,
    /** At most this many referral credits are counted in any 12 months. */
    maxCreditsPerYear: 4,
    /** The referred artist must be verified and finish this many bookings first. */
    bookingsRequired: 3,
  },

  /** How much notice an artist must give to cancel a booking without a mark. */
  cancellation: {
    freeNoticeHours: 48,
    /** Between this and freeNoticeHours is a late cancellation. Under it is last minute. */
    lateNoticeHours: 12,
  },

  tierReview: {
    /** Months in a row she must qualify for a lower tier before she is moved down. */
    demotionMonths: 2,
  },

  /** Cash incentive for referrals. Deliberately 0 until the owner approves a percentage. */
  referralIncentivePercent: 0,

  safety: {
    /** Hours after a job ends before an artist who has not checked in is reminded. */
    reminderAfterHours: 3,
  },
} as const;

/** Refuse nonsense settings at startup rather than quietly scoring wrongly. */
export function validateReputationConfig(c: typeof REPUTATION_CONFIG = REPUTATION_CONFIG): string[] {
  const problems: string[] = [];
  const sum = Object.values(c.weights).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > 1e-9) problems.push(`Weights add up to ${sum}, they must add up to 1`);
  const tiers = c.tiers;
  for (let i = 1; i < tiers.length; i++) {
    const a = tiers[i - 1]!, b = tiers[i]!;
    if (b.minScore <= a.minScore) problems.push(`${b.key} needs a higher score than ${a.key}`);
    if (b.minBookings < a.minBookings) problems.push(`${b.key} needs at least as many bookings as ${a.key}`);
    if (b.minMonths < a.minMonths) problems.push(`${b.key} needs at least as many months as ${a.key}`);
  }
  if (c.cancellation.lateNoticeHours >= c.cancellation.freeNoticeHours) problems.push("Late notice hours must be less than free notice hours");
  return problems;
}
