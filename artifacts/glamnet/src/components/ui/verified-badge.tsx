import { BadgeCheck } from "lucide-react";

interface VerifiedBadgeProps {
  size?: "sm" | "md";
  variant?: "pill" | "icon";
  className?: string;
}

export function VerifiedBadge({ size = "sm", variant = "pill", className = "" }: VerifiedBadgeProps) {
  const iconSize = size === "md" ? "h-4 w-4" : "h-3 w-3";

  if (variant === "icon") {
    return (
      <BadgeCheck
        className={`text-primary ${size === "md" ? "h-6 w-6" : "h-5 w-5"} ${className}`}
        aria-label="Verified artist"
      />
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 bg-primary/10 border border-primary/25 text-primary ${className}`}>
      <BadgeCheck className={iconSize} />
      Verified
    </span>
  );
}
