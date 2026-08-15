/**
 * Express route params are typed as `string | string[]`.
 * Drizzle's eq() and most functions that accept a column value only accept
 * `string`. Named route params (`:id`, `:appointmentId`, etc.) are always
 * scalars at runtime, but TypeScript cannot see that without help.
 *
 * Import this helper and wrap every `req.params.xxx` that flows into a DB
 * call or any function typed as `(id: string) => …`.
 *
 * One helper, one import — do not copy this inline.
 */
export function param(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}
