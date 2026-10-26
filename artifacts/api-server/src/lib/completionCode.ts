import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { COMPLETION_CODE_VALID_HOURS } from "./bookingPolicy";

// South Africa has one timezone and no daylight saving.
const SA_OFFSET = "+02:00";

function secret(): string {
  const value = process.env["SESSION_SECRET"];
  if (!value) throw new Error("SESSION_SECRET is required to derive completion codes");
  return value;
}

/** A fresh random value. Stored on the booking in place of the code itself. */
export function newCodeNonce(): string {
  return randomBytes(16).toString("hex");
}

/**
 * The six digit code for a booking and nonce. Derived, not stored, so a copy of
 * the database does not contain usable codes. Asking for a new code makes a new
 * nonce, which makes the old code stop working.
 */
export function deriveCompletionCode(appointmentId: string, nonce: string): string {
  const digest = createHmac("sha256", secret()).update(`completion:${appointmentId}:${nonce}`).digest();
  return String(digest.readUInt32BE(0) % 1_000_000).padStart(6, "0");
}

export function completionCodesMatch(entered: string, expected: string): boolean {
  const a = Buffer.from(entered);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function completionCodeExpiresAt(requestedAt: Date): Date {
  return new Date(requestedAt.getTime() + COMPLETION_CODE_VALID_HOURS * 60 * 60 * 1000);
}

/** The moment a booking starts, from its date (YYYY-MM-DD) and time (HH:MM) in South African time. */
export function appointmentStartTime(date: string, time: string): Date {
  return new Date(`${date}T${(time || "00:00").slice(0, 5)}:00${SA_OFFSET}`);
}
