// Shared server-side booking slot rules. Keep in sync with
// artifacts/glamnet/src/lib/bookingSlots.ts on the client.
export const VALID_TIMES = ["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

export function isValidSlot(date: string, time: string): { ok: true } | { ok: false; error: string } {
  if (!VALID_TIMES.includes(time)) {
    return { ok: false, error: "Selected time is outside business hours." };
  }

  const slotDate = new Date(`${date}T${time}:00`);
  if (Number.isNaN(slotDate.getTime())) {
    return { ok: false, error: "Invalid date or time." };
  }

  if (slotDate.getTime() < Date.now()) {
    return { ok: false, error: "Selected date/time is in the past." };
  }

  return { ok: true };
}

export function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  // Drizzle wraps the underlying pg error (which carries the Postgres error
  // code) in `.cause` via DrizzleQueryError — check both.
  const code = (err as any).code ?? (err as any).cause?.code;
  return code === "23505";
}
