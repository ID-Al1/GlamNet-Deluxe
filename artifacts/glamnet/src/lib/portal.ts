/** Labels, options and formatters shared by the model portal screens. */

export const MODEL_CATEGORIES = ["Fashion", "Editorial", "Commercial", "Runway", "Beauty", "Fitness", "Hands and parts", "Content creator"];

export const SERVICE_CATEGORIES = [
  "Paid modelling", "Brand promotions", "UGC and content", "Affiliate promotions", "Ambassador roles", "Events", "Editorial shoots",
];

export const OPPORTUNITY_TYPES: { value: string; label: string }[] = [
  { value: "paid_modelling", label: "Paid modelling" },
  { value: "brand_promotion", label: "Brand promotion" },
  { value: "artist_collaboration", label: "Artist collaboration" },
  { value: "ugc_content", label: "UGC and content" },
  { value: "affiliate", label: "Affiliate promotion" },
  { value: "ambassador", label: "Ambassador role" },
  { value: "event", label: "Event" },
  { value: "editorial_shoot", label: "Editorial shoot" },
];
export const opportunityTypeLabel = (v: string) => OPPORTUNITY_TYPES.find((t) => t.value === v)?.label ?? v;

export const PHOTO_SLOTS = [
  { kind: "front", label: "Front", hint: "Face the camera, shoulders square, hair back, neutral expression, plain background." },
  { kind: "left", label: "Left profile", hint: "Turn fully to your right so your left side faces the camera. Same light and background." },
  { kind: "right", label: "Right profile", hint: "Turn fully to your left so your right side faces the camera. Same light and background." },
  { kind: "full_length", label: "Full length", hint: "Head to toe, standing straight, fitted clothing, feet visible." },
] as const;

export const APPLICATION_STATUS: Record<string, { label: string; detail: string }> = {
  applied: { label: "Applied", detail: "Waiting for the organiser to respond." },
  shortlisted: { label: "Shortlisted", detail: "The organiser is considering you. Nothing is agreed yet." },
  accepted: { label: "Accepted", detail: "The organiser chose you. Terms are not binding until a written agreement is recorded." },
  passed: { label: "Not selected", detail: "The organiser went with someone else for this one." },
  withdrawn: { label: "Withdrawn", detail: "You withdrew this application." },
};

export const VERIFICATION_STATUS: Record<string, { label: string; detail: string }> = {
  none: { label: "Not submitted", detail: "Complete your profile, then ask Bonisa to review it." },
  pending: { label: "In review", detail: "Bonisa is reviewing your profile." },
  verified: { label: "Verified", detail: "Your profile has been reviewed and verified by Bonisa." },
  rejected: { label: "Changes needed", detail: "Bonisa could not verify your profile yet. See the reason below, fix it and ask again." },
};

export const PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", website: "Website", other: "Other",
};

export function formatRand(cents: number | null | undefined): string | null {
  if (cents === null || cents === undefined) return null;
  const rand = cents / 100;
  return "R" + rand.toLocaleString("en-ZA", { minimumFractionDigits: rand % 1 ? 2 : 0, maximumFractionDigits: 2 }).replace(/ /g, " ");
}

/** "2030-12-31" -> "31 Dec 2030". Dates arrive as plain YYYY-MM-DD strings. */
export function formatDay(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

export function daysUntil(day: string): number {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });
  return Math.round((new Date(`${day}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 86_400_000);
}

export function errorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  const e = err as { data?: { error?: string }; message?: string };
  return e?.data?.error || e?.message || fallback;
}
