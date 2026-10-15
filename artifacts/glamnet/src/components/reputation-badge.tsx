import { Award } from "lucide-react";

type Tier = "new_talent" | "rising" | "signature" | "elite" | "icon";

const LOOK: Record<Tier, string> = {
  new_talent: "border-border bg-muted/50 text-muted-foreground",
  rising: "border-[hsl(var(--baby-blue)/0.35)] bg-[hsl(var(--baby-blue)/0.08)] text-[hsl(var(--baby-blue))]",
  signature: "border-primary/30 bg-primary/10 text-primary",
  elite: "border-[hsl(var(--orange)/0.4)] bg-[hsl(var(--orange)/0.1)] text-[hsl(var(--orange))]",
  icon: "border-[hsl(var(--orange)/0.6)] bg-[hsl(var(--orange)/0.18)] text-[hsl(var(--orange))]",
};

/**
 * The public tier label. It never shows a number and never a low score: an artist without enough
 * history simply reads "New Talent", and a tier is a recognition, not a guarantee.
 */
export function TierBadge({ tier, label, building, size = "sm" }: { tier: string; label: string; building?: boolean; size?: "sm" | "md" }) {
  const look = LOOK[(tier as Tier) in LOOK ? (tier as Tier) : "new_talent"];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-semibold ${look} ${size === "md" ? "px-3 py-1 text-xs" : "px-2 py-0.5 text-[11px]"}`}
      title={building ? "Building reputation: this artist is new on Bonisa" : `${label}. Tiers recognise reliable service on Bonisa. They are not a guarantee.`}
      data-testid="badge-tier"
    >
      <Award className={size === "md" ? "h-3.5 w-3.5" : "h-3 w-3"} strokeWidth={1.9} />
      {building ? "Building reputation" : label}
    </span>
  );
}
