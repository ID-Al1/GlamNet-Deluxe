// Shared client-side booking slot rules. Keep in sync with
// artifacts/api-server/src/lib/bookingValidation.ts on the server.
export const TIMES = ["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

export function isSlotInPast(date: Date, time: string): boolean {
  const [h, m] = time.split(":").map(Number);
  const slot = new Date(date);
  slot.setHours(h, m, 0, 0);
  return slot.getTime() < Date.now();
}
