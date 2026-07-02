import { BadgeCheck } from "lucide-react";

interface VerifiedBadgeProps {
  size?: "sm" | "md";
  variant?: "pill" | "icon";
}

export function VerifiedBadge({ size = "sm", variant = "pill" }: VerifiedBadgeProps) {
  const iconSize = size === "md" ? "h-4 w-4" : "h-3 w-3";

  if (variant === "icon") {
    return (
      <BadgeCheck
        className={size === "md" ? "h-6 w-6" : "h-5 w-5"}
        style={{ color: "#B8893A" }}
        aria-label="Verified artist"
      />
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold shrink-0"
      style={{
        background: "rgba(184,137,58,0.12)",
        border: "1px solid rgba(184,137,58,0.30)",
        color: "#B8893A",
      }}
    >
      <BadgeCheck className={iconSize} />
      Verified
    </span>
  );
}
