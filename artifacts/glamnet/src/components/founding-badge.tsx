import { Sparkles } from "lucide-react";

/**
 * Shown on the profile of an artist who was one of the first on Bonisa. The owner grants it.
 * It is a recognition only: it never changes her reputation score or tier.
 */
export function FoundingBadge({ size = "sm" }: { size?: "sm" | "md" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-[hsl(var(--orange)/0.5)] bg-[hsl(var(--orange)/0.1)] font-semibold text-[hsl(var(--orange))] ${size === "md" ? "px-3 py-1 text-xs" : "px-2 py-0.5 text-[11px]"}`}
      title="One of the first artists on Bonisa"
      data-testid="badge-founding"
    >
      <Sparkles className={size === "md" ? "h-3.5 w-3.5" : "h-3 w-3"} strokeWidth={1.9} />
      Founding Artist
    </span>
  );
}
