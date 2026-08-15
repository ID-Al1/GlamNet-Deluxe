/**
 * Bonisa money rules. One file, one source of truth.
 *
 * Bonisa takes 18% of every booking. The artist receives 82%.
 *
 * Before this file existed the same two numbers lived in three places under
 * three different names: ARTIST_SHARE in escrow.ts, ARTIST_PAYOUT_PCT in
 * routes/appointments.ts, and a bare 0.82 buried inside a calculation in
 * routes/dashboard.ts. Change the commission and you had to remember all three.
 * The one you forget produces wrong numbers quietly, for months.
 *
 * Nothing else in the codebase should hardcode a percentage. Import from here.
 */

/** The artist's share of a booking. */
export const ARTIST_SHARE = 0.82;

/** Bonisa's commission. */
export const PLATFORM_SHARE = 0.18;

/** The commission as a percentage, for storing on a booking record. */
export const PLATFORM_FEE_PERCENT = 18;

/** Hours after payout release within which the artist must actually be paid. */
export const PAYOUT_WINDOW_HOURS = 24;

/**
 * Minimum hourly-equivalent rate for onboarding, in Rand.
 *
 * From the go-to-market green lights: "Minimum rate threshold: R600/hr for
 * onboarding. No exceptions in Phase 1."
 *
 * Set to 0 to switch the floor off once Phase 1 is over.
 */
export const MIN_SERVICE_RATE_PER_HOUR = 600;

/** Round to whole cents, so floating point drift never creeps into money. */
function toCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Split a collected amount into the artist's share and the platform's.
 *
 * Same signature and return shape as the old escrow.ts version, so existing
 * callers keep working unchanged.
 *
 * Example: splitAmount(750) returns { artistShare: 615, platformShare: 135 }
 */
export function splitAmount(total: number) {
  return {
    artistShare: toCents(total * ARTIST_SHARE),
    platformShare: toCents(total * PLATFORM_SHARE),
  };
}

/** When the artist must actually have the money, given the release moment. */
export function payoutDueAt(releasedAt: Date = new Date()): Date {
  return new Date(releasedAt.getTime() + PAYOUT_WINDOW_HOURS * 60 * 60 * 1000);
}

/**
 * Is a service priced at or above the Phase 1 floor?
 *
 * duration is in minutes, price is the total for that service.
 * A R450 service lasting 60 minutes works out to R450/hr and fails.
 * A R450 service lasting 30 minutes works out to R900/hr and passes.
 */
export function meetsRateFloor(price: number, durationMinutes: number): boolean {
  if (MIN_SERVICE_RATE_PER_HOUR <= 0) return true;
  if (!durationMinutes || durationMinutes <= 0) return true;
  const hourlyRate = price / (durationMinutes / 60);
  return hourlyRate >= MIN_SERVICE_RATE_PER_HOUR;
}

/** Shown to the artist when a service is priced below the floor. */
export function rateFloorMessage(): string {
  return `Bonisa is a premium verified network. Services need to work out to at least R${MIN_SERVICE_RATE_PER_HOUR} per hour. Pricing below this undercuts every other artist on the platform, including you.`;
}
