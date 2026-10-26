/** The message our API sends in { error }, falling back to the generic one. */
export function apiErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  const e = err as { data?: { error?: unknown }; message?: unknown } | null;
  if (typeof e?.data?.error === "string") return e.data.error;
  return typeof e?.message === "string" && e.message ? e.message : fallback;
}
