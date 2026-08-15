/**
 * Bonisa reputation and tier.
 *
 * A star rating is the Gumtree signal. Any competitor can copy it in a week.
 * REP is different: it is built from things that only happen on this platform,
 * so it does not travel when an artist leaves. That is the whole point.
 *
 * Deliberately simple. A weighted sum you can explain to an artist in one
 * sentence beats a clever formula nobody trusts. Refine it once there is real
 * data to look at.
 */

export type ArtistTier = "new" | "rising" | "established" | "elite";

export interface RepInputs {
  completedJobs: number;
  averageRating: number;   // 0 to 5
  reviewCount: number;
  onTimeJobs: number;
  campaignsCompleted: number;
  repeatClients: number;
}

/**
 * REP score out of 100.
 *
 * Weighting, and why:
 *  - Completed jobs (30): proof of work. The hardest thing to fake.
 *  - Rating quality (25): only counts once there are enough reviews to mean
 *    anything, so one five-star review from a friend does not carry it.
 *  - Reliability (20): turning up on time is what brands actually pay for.
 *  - Repeat clients (15): the strongest quality signal there is. A client who
 *    comes back has voted with money, not with a tap on a star.
 *  - Campaign work (10): brand-grade work, verified by the brand.
 */
export function calculateRepScore(i: RepInputs): number {
  // Completed jobs, saturating at 50 jobs.
  const jobsPoints = Math.min(i.completedJobs / 50, 1) * 30;

  // Rating only starts counting from the third review.
  const ratingWeight = i.reviewCount >= 3 ? Math.min(i.reviewCount / 10, 1) : 0;
  const ratingPoints = (i.averageRating / 5) * 25 * ratingWeight;

  // On-time rate.
  const onTimeRate = i.completedJobs > 0 ? i.onTimeJobs / i.completedJobs : 0;
  const reliabilityPoints = onTimeRate * 20;

  // Repeat clients as a share of completed jobs.
  const repeatRate = i.completedJobs > 0 ? Math.min(i.repeatClients / i.completedJobs, 1) : 0;
  const repeatPoints = repeatRate * 15;

  // Campaign work, saturating at 5 campaigns.
  const campaignPoints = Math.min(i.campaignsCompleted / 5, 1) * 10;

  const total = jobsPoints + ratingPoints + reliabilityPoints + repeatPoints + campaignPoints;
  return Math.round(Math.max(0, Math.min(100, total)));
}

/**
 * Tier from REP score and completed jobs.
 *
 * Both matter. A high score off three jobs is not the same as a high score off
 * forty, and brands staffing a campaign care about the difference.
 */
export function calculateTier(repScore: number, completedJobs: number): ArtistTier {
  if (repScore >= 75 && completedJobs >= 40) return "elite";
  if (repScore >= 50 && completedJobs >= 15) return "established";
  if (repScore >= 25 && completedJobs >= 5) return "rising";
  return "new";
}

/** Tier ordering, for "this campaign needs Established or above" checks. */
const TIER_ORDER: ArtistTier[] = ["new", "rising", "established", "elite"];

export function tierAtLeast(artistTier: string, requiredTier: string): boolean {
  return TIER_ORDER.indexOf(artistTier as ArtistTier) >= TIER_ORDER.indexOf(requiredTier as ArtistTier);
}

/** What an artist sees. Plain language, no jargon. */
export function tierLabel(tier: ArtistTier): string {
  switch (tier) {
    case "elite": return "Elite";
    case "established": return "Established";
    case "rising": return "Rising";
    default: return "New";
  }
}

export function nextTierGoal(tier: ArtistTier, repScore: number, completedJobs: number): string | null {
  if (tier === "elite") return null;
  if (tier === "established") {
    return `Reach Elite with a REP of 75 and 40 completed jobs. You are on ${repScore} and ${completedJobs}.`;
  }
  if (tier === "rising") {
    return `Reach Established with a REP of 50 and 15 completed jobs. You are on ${repScore} and ${completedJobs}.`;
  }
  return `Reach Rising with a REP of 25 and 5 completed jobs. You are on ${repScore} and ${completedJobs}.`;
}
