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
 * How Bonisa is paid on a job.
 *
 *   commission:   a normal booking. The client pays the price and Bonisa keeps
 *                 18% of it, so the artist gets 82%.
 *   brand_on_top: a brand campaign. The artist keeps her full rate and the
 *                 brand pays Bonisa's 18% on top, so the brand pays 118%.
 */
export type FeeMode = "commission" | "brand_on_top";

/**
 * Split a collected amount into the artist's share and the platform's.
 *
 * Same signature and return shape as the old escrow.ts version, so existing
 * callers keep working unchanged.
 *
 * Example: splitAmount(750) returns { artistShare: 615, platformShare: 135 }
 * Example: splitAmount(3540, "brand_on_top") returns { artistShare: 3000, platformShare: 540 }
 */
export function splitAmount(total: number, feeMode: FeeMode | string = "commission") {
  if (feeMode === "brand_on_top") {
    const artistShare = toCents(total / (1 + PLATFORM_SHARE));
    return { artistShare, platformShare: toCents(total - artistShare) };
  }
  return {
    artistShare: toCents(total * ARTIST_SHARE),
    platformShare: toCents(total * PLATFORM_SHARE),
  };
}

// ---------------------------------------------------------------------------
// Brand campaigns
// ---------------------------------------------------------------------------

/** The share of a campaign the brand pays up front to lock in the team. */
export const CAMPAIGN_DEPOSIT_PERCENT = 50;

/** The rest is due this many days before the event. Closer than this, the brand pays in full. */
export const CAMPAIGN_BALANCE_DAYS_BEFORE_EVENT = 3;

const toWholeCents = (amount: number) => Math.round(amount * 100);

/** "R3,540.00", the way the rest of the app writes money. */
export const formatRand = (amount: number) =>
  `R${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "R3,000", for whole-rand amounts such as an artist's rate. */
export const formatRandWhole = (amount: number) =>
  `R${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

/**
 * What one artist's job costs the brand, and how it is paid.
 *
 * rate:    what the artist is paid, in whole rand. She keeps all of it.
 * fee:     Bonisa's 18% of the rate, added on top.
 * total:   rate + fee, what the brand pays for this artist.
 * deposit: half of the total (rounded down to the cent), paid to lock in the team.
 * balance: the rest, paid before the event.
 */
export function campaignArtistCost(rate: number) {
  const rateCents = toWholeCents(rate);
  const feeCents = Math.round(rateCents * PLATFORM_SHARE);
  const totalCents = rateCents + feeCents;
  const depositCents = Math.floor(totalCents * CAMPAIGN_DEPOSIT_PERCENT / 100);
  return {
    rate: rateCents / 100,
    fee: feeCents / 100,
    total: totalCents / 100,
    deposit: depositCents / 100,
    balance: (totalCents - depositCents) / 100,
  };
}

/** The same numbers for a whole team of the given size. */
export function campaignCost(rate: number, artists: number) {
  const one = campaignArtistCost(rate);
  return {
    artists,
    rate: one.rate,
    artistFees: toWholeCents(one.rate) * artists / 100,
    fee: toWholeCents(one.fee) * artists / 100,
    total: toWholeCents(one.total) * artists / 100,
    deposit: toWholeCents(one.deposit) * artists / 100,
    balance: toWholeCents(one.balance) * artists / 100,
  };
}

/** The date by which the balance is due, as YYYY-MM-DD, given the event date (YYYY-MM-DD). */
export function campaignBalanceDueDate(eventDate: string): string {
  const [y, m, d] = eventDate.split("-").map(Number);
  const due = new Date(Date.UTC(y!, m! - 1, d! - CAMPAIGN_BALANCE_DAYS_BEFORE_EVENT));
  return due.toISOString().slice(0, 10);
}

/** "Now" in South Africa (UTC+2, no daylight saving), so a day rolls over at midnight local time. */
export const saNow = () => new Date(Date.now() + 2 * 3_600_000);

/** Whole days from today (South African date) to a YYYY-MM-DD date. Negative when it is in the past. */
export function daysUntil(date: string, from: Date = saNow()): number {
  const [y, m, d] = date.split("-").map(Number);
  const target = Date.UTC(y!, m! - 1, d!);
  const today = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  return Math.round((target - today) / 86_400_000);
}

/** Can the brand pay a deposit now and the rest later, or must it pay in full? */
export function campaignDepositAllowed(eventDate: string, from: Date = saNow()): boolean {
  return daysUntil(eventDate, from) > CAMPAIGN_BALANCE_DAYS_BEFORE_EVENT;
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
