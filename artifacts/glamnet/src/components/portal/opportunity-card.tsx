import { Link } from "wouter";
import { Bookmark, BookmarkCheck, CalendarClock, MapPin } from "lucide-react";
import type { Opportunity } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/portal/status-pill";
import { daysUntil, formatDay, formatRand, opportunityTypeLabel } from "@/lib/portal";

export function OpportunityCard({ o, onToggleSave, saving }: { o: Opportunity; onToggleSave?: () => void; saving?: boolean }) {
  const fee = formatRand(o.compensationCents);
  const left = daysUntil(o.applicationDeadline);
  return (
    <article className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">{opportunityTypeLabel(o.type)}</p>
          <h3 className="text-xl font-serif font-bold leading-snug">
            <Link href={`/opportunities/${o.id}`} className="hover:underline underline-offset-4">{o.title}</Link>
          </h3>
          <p className="text-sm text-muted-foreground">{o.organiserName}</p>
        </div>
        {onToggleSave && (
          <Button variant="ghost" size="icon" onClick={onToggleSave} disabled={saving} aria-label={o.isSaved ? "Remove from saved" : "Save for later"} aria-pressed={!!o.isSaved}>
            {o.isSaved ? <BookmarkCheck className="h-5 w-5 text-primary" strokeWidth={1.9} /> : <Bookmark className="h-5 w-5" strokeWidth={1.9} />}
          </Button>
        )}
      </div>
      <p className="text-sm text-foreground/85 line-clamp-3">{o.brief}</p>
      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wider text-muted-foreground">Offered fee</dt>
          <dd className="font-semibold">{fee ?? "Not stated"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-muted-foreground">Where</dt>
          <dd className="font-medium flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-gold" strokeWidth={1.9} aria-hidden="true" />{o.isRemote ? "Remote" : o.location || "To be confirmed"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-muted-foreground">Apply by</dt>
          <dd className="font-medium flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5 text-gold" strokeWidth={1.9} aria-hidden="true" />{formatDay(o.applicationDeadline)}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2">
          <StatusPill status={o.status} kind="listing" />
          {o.status === "open" && left >= 0 && left <= 7 && <span className="text-xs text-muted-foreground">{left === 0 ? "Closes today" : `${left} day${left === 1 ? "" : "s"} left`}</span>}
          {o.myApplicationStatus && <StatusPill status={o.myApplicationStatus} />}
        </div>
        <Link href={`/opportunities/${o.id}`}><Button variant="outline" size="sm">View all terms</Button></Link>
      </div>
    </article>
  );
}
