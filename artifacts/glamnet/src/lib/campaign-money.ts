/**
 * Campaign prices, for showing a brand what it will pay while it fills in a form.
 *
 * DISPLAY ONLY. The server works out the real amounts (artifacts/api-server/src/lib/money.ts)
 * and refuses anything that does not match, so nothing here decides what anyone is charged.
 *
 * The rule: the artist keeps her full rate, and the brand pays Bonisa's 18% on top.
 * Half is paid to lock in the team, the rest 3 days before the event.
 */
export const BRAND_FEE_PERCENT = 18;
export const BALANCE_DAYS_BEFORE_EVENT = 3;

const cents = (n: number) => Math.round(n * 100);

export function campaignQuote(rate: number, artists: number) {
  const rateC = cents(rate);
  const feeC = Math.round(rateC * BRAND_FEE_PERCENT / 100);
  const totalC = rateC + feeC;
  const depositC = Math.floor(totalC / 2);
  return {
    perArtistFee: feeC / 100,
    perArtistTotal: totalC / 100,
    artistFees: (rateC * artists) / 100,
    fee: (feeC * artists) / 100,
    total: (totalC * artists) / 100,
    deposit: (depositC * artists) / 100,
    balance: ((totalC - depositC) * artists) / 100,
  };
}

/** "R3,540.00" */
export const rand = (n: number) =>
  `R${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "R3,000" */
export const randWhole = (n: number) => `R${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

/** Today's date in South Africa as YYYY-MM-DD. */
export function todaySA(): string {
  return new Date(Date.now() + 2 * 3_600_000).toISOString().slice(0, 10);
}

/** Whole days from today (South Africa) to a YYYY-MM-DD date. */
export function daysFromToday(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const [ty, tm, td] = todaySA().split("-").map(Number);
  return Math.round((Date.UTC(y!, m! - 1, d!) - Date.UTC(ty!, tm! - 1, td!)) / 86_400_000);
}

export function addDaysSA(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

export function longDate(date: string | null | undefined): string {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return date ?? "";
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export function shortDate(date: string | null | undefined): string {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return date ?? "";
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString("en-ZA", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** Pull the server's plain-words message out of a failed request. */
export function apiMessage(error: unknown, fallback: string): string {
  const e = error as { data?: { error?: string }; message?: string } | undefined;
  return e?.data?.error ?? fallback;
}
