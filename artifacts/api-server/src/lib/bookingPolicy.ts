/**
 * Bonisa booking policy: deposits, cancellations, lateness and no-shows.
 *
 * One file, one source of truth, like money.ts. Decided by Alwande on 2026-10-26.
 * The full wording lives in docs/BONISA_PAYMENTS_AND_CANCELLATION_POLICY.md.
 *
 * These are pure functions. They say how much money goes where; they do not move
 * any money, so they work the same whichever payment provider is behind them.
 * The artist's 82% and Bonisa's 18% are applied by the caller with splitAmount().
 */

/** The deposit a client pays at booking, as a percentage of the price. */
export const DEPOSIT_PERCENT = 50;

/** Hours after the service within which a client can raise a complaint. */
export const COMPLAINT_WINDOW_HOURS = 24;

/** Cancelling at least this many hours before: full refund. */
export const FULL_REFUND_NOTICE_HOURS = 48;

/** Cancelling less than this many hours before: the deposit is kept. */
export const NO_REFUND_NOTICE_HOURS = 24;

/**
 * Between the two notice limits the client gets part of the deposit back.
 * ASSUMPTION: Alwande did not state this tier. Confirm or change.
 */
export const MIDDLE_TIER_DEPOSIT_KEPT_PERCENT = 50;

/** Minutes late that are free of charge. */
export const LATE_GRACE_MINUTES = 15;

/** More minutes late than this counts as a no-show. */
export const LATE_NO_SHOW_MINUTES = 30;

/**
 * Late fee, as a percentage of the deposit.
 * ASSUMPTION: Alwande said "20%"; I read it as 20% of the deposit. Confirm.
 */
export const LATE_FEE_PERCENT_OF_DEPOSIT = 20;

/**
 * A single booking whose artist share is at or above this (in Rand) is paid out
 * on Monday in one batch. Smaller bookings are paid on the next payout day.
 */
export const LARGE_PAYOUT_THRESHOLD = 2000;

const cents = (rand: number) => Math.round(rand * 100);
const rand = (c: number) => c / 100;

/** The deposit for a booking price, in Rand. */
export function depositFor(price: number): number {
  assertMoney(price, "price");
  return rand(Math.round(cents(price) * DEPOSIT_PERCENT / 100));
}

/** Does this artist share go out in the Monday batch instead of the normal one? */
export function isLargePayout(artistShare: number): boolean {
  return artistShare >= LARGE_PAYOUT_THRESHOLD;
}

export type PolicyEvent =
  | { type: "client_cancel"; hoursBefore: number }
  | { type: "client_late"; minutesLate: number }
  | { type: "client_no_show" }
  | { type: "artist_cancel" }
  | { type: "artist_no_show" };

export interface PolicyOutcome {
  /** True when the booking still goes ahead (the client was only a little late). */
  proceeds: boolean;
  /** Money returned to the client, in Rand. */
  clientRefund: number;
  /** Money from what was already paid that the artist keeps, in Rand. */
  artistKeeps: number;
  /** Extra the client owes for being late, in Rand. Not part of money already paid. */
  lateFee: number;
  /** A sentence both sides can read. */
  reason: string;
}

function assertMoney(value: number, name: string) {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be a number of Rand, 0 or more`);
}

/**
 * Work out what happens to the money already paid.
 *
 * price:      the full booking price.
 * amountPaid: what the client has paid so far through Bonisa (at least the deposit).
 */
export function applyBookingPolicy(input: { price: number; amountPaid?: number; event: PolicyEvent }): PolicyOutcome {
  const { price, event } = input;
  const depositC = cents(depositFor(price));
  const paidC = cents(input.amountPaid ?? rand(depositC));
  assertMoney(rand(paidC), "amountPaid");
  if (paidC < depositC) throw new RangeError("amountPaid cannot be less than the deposit");

  const keep = (keptC: number, reason: string): PolicyOutcome => ({
    proceeds: false, clientRefund: rand(paidC - keptC), artistKeeps: rand(keptC), lateFee: 0, reason,
  });

  switch (event.type) {
    case "artist_cancel":
      return keep(0, "The artist cancelled, so the client is refunded in full.");
    case "artist_no_show":
      return keep(0, "The artist did not show up, so the client is refunded in full and the artist is not paid.");
    case "client_no_show":
      return keep(depositC, "The client did not show up, so the artist keeps the deposit.");
    case "client_late": {
      if (event.minutesLate > LATE_NO_SHOW_MINUTES) {
        return keep(depositC, `The client was more than ${LATE_NO_SHOW_MINUTES} minutes late, which counts as a no-show. The artist keeps the deposit.`);
      }
      if (event.minutesLate > LATE_GRACE_MINUTES) {
        const feeC = Math.round(depositC * LATE_FEE_PERCENT_OF_DEPOSIT / 100);
        return { proceeds: true, clientRefund: 0, artistKeeps: 0, lateFee: rand(feeC), reason: `The client was more than ${LATE_GRACE_MINUTES} minutes late, so a late fee applies.` };
      }
      return { proceeds: true, clientRefund: 0, artistKeeps: 0, lateFee: 0, reason: "Within the grace period, so no fee applies." };
    }
    case "client_cancel": {
      if (event.hoursBefore >= FULL_REFUND_NOTICE_HOURS) {
        return keep(0, `Cancelled ${FULL_REFUND_NOTICE_HOURS} hours or more before, so the client is refunded in full.`);
      }
      if (event.hoursBefore >= NO_REFUND_NOTICE_HOURS) {
        const keptC = Math.round(depositC * MIDDLE_TIER_DEPOSIT_KEPT_PERCENT / 100);
        return keep(keptC, `Cancelled less than ${FULL_REFUND_NOTICE_HOURS} hours before, so the artist keeps part of the deposit.`);
      }
      return keep(depositC, `Cancelled less than ${NO_REFUND_NOTICE_HOURS} hours before, so the deposit is not refunded.`);
    }
  }
}
