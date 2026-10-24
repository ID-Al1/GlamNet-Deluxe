import { APPLICATION_STATUS, VERIFICATION_STATUS } from "@/lib/portal";

const TONE: Record<string, string> = {
  applied: "bg-secondary text-foreground border-border",
  shortlisted: "bg-gold/15 text-primary border-gold/40",
  accepted: "bg-primary/10 text-primary border-primary/30",
  passed: "bg-muted text-muted-foreground border-border",
  withdrawn: "bg-muted text-muted-foreground border-border",
  none: "bg-muted text-muted-foreground border-border",
  pending: "bg-gold/15 text-primary border-gold/40",
  verified: "bg-primary/10 text-primary border-primary/30",
  rejected: "bg-destructive/10 text-destructive border-destructive/30",
  open: "bg-primary/10 text-primary border-primary/30",
  closed: "bg-muted text-muted-foreground border-border",
};

/** Always text, never colour alone. */
export function StatusPill({ status, kind = "application" }: { status: string; kind?: "application" | "verification" | "listing" }) {
  const label =
    kind === "application" ? APPLICATION_STATUS[status]?.label :
    kind === "verification" ? VERIFICATION_STATUS[status]?.label :
    status === "open" ? "Open" : "Closed";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONE[status] ?? TONE.none}`}>
      {label ?? status}
    </span>
  );
}
