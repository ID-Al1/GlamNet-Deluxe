import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** South African money format: R1 200 (space thousands, comma cents only when present). */
export function formatRands(n: number): string {
  // Normalize to integer cents first so float residue can't corrupt the output.
  let cents = Math.round(n * 100);
  if (cents === 0) cents = 0; // strip negative zero
  const sign = cents < 0 ? "-" : "";
  cents = Math.abs(cents);
  const rands = Math.floor(cents / 100);
  const rem = cents % 100;
  const whole = String(rands).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}R${whole}${rem !== 0 ? `,${String(rem).padStart(2, "0")}` : ""}`;
}

/** South African rating format: decimal comma — 4,9 not 4.9. */
export function formatRating(r: number): string {
  return r.toFixed(1).replace(".", ",");
}
