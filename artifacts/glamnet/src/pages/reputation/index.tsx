import { useState } from "react";
import { Link, Redirect } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetMyReputationQueryKey,
  useDisputeReputationEvent,
  useGetMyReputation,
  type ReputationEventView,
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle, ArrowLeft, Copy, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { TierBadge } from "@/components/reputation-badge";
import { apiMessage, longDate } from "@/lib/campaign-money";

const STATUS_WORDS: Record<ReputationEventView["status"], string> = {
  active: "Counts",
  under_review: "Under review, not counted",
  reversed: "Removed",
};

/**
 * The artist's own standing, in plain words: where she is, why, what is next, and how to
 * ask for a record to be looked at again. Verification and reputation are different things:
 * verification says who she is, reputation is how she has worked on Bonisa.
 */
export default function ReputationPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useGetMyReputation({ query: { queryKey: getGetMyReputationQueryKey(), enabled: user?.role === "stylist" } });
  const dispute = useDisputeReputationEvent();
  const [disputing, setDisputing] = useState<ReputationEventView | null>(null);
  const [reason, setReason] = useState("");

  if (user && user.role !== "stylist") return <Redirect to="/dashboard" />;

  async function sendDispute() {
    if (!disputing) return;
    try {
      const res = await dispute.mutateAsync({ eventId: disputing.id, data: { reason: reason.trim() } });
      toast.success(res.message);
      setDisputing(null);
      setReason("");
      await qc.invalidateQueries({ queryKey: getGetMyReputationQueryKey() });
    } catch (e) {
      toast.error(apiMessage(e, "Could not send that."));
    }
  }

  if (isLoading) return <div className="container mx-auto max-w-3xl space-y-4 px-4 py-10"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (isError || !data) {
    return (
      <div className="container mx-auto max-w-xl px-4 py-16 text-center">
        <AlertCircle className="mx-auto mb-4 h-9 w-9 text-destructive" strokeWidth={1.9} />
        <p className="font-medium">Could not load your reputation.</p>
        <Button className="mt-4" onClick={() => void refetch()}>Try again</Button>
      </div>
    );
  }

  const next = data.nextTier;
  const code = data.referral.code;

  return (
    <div className="container mx-auto max-w-3xl space-y-6 px-4 py-8 sm:py-12">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.9} />Dashboard
      </Link>

      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">Your reputation</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">{data.building ? "Building reputation" : data.tierLabel}</h1>
          <TierBadge tier={data.tier} label={data.tierLabel} building={data.building} size="md" />
        </div>
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.9} />
          <span>
            {data.verified ? "You are verified, which confirms who you are. " : ""}Your reputation is different: it shows how you work on Bonisa, and it is built from real bookings and reviews. A tier is a recognition, not a guarantee of bookings or income.
          </span>
        </p>
      </header>

      {data.building ? (
        <Card className="border-primary/30 bg-card" data-testid="card-building">
          <CardContent className="space-y-3 p-6">
            <p className="font-serif text-xl font-bold">You are new here, and that is fine.</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We rate you once you have completed {data.completedBookings + data.bookingsToRate} bookings, so the score is fair. Until then clients see "Building reputation", never a low number.
              You have completed {data.completedBookings} so far{data.bookingsToRate > 0 ? `, ${data.bookingsToRate} to go` : ""}.
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuemin={0} aria-valuemax={data.completedBookings + data.bookingsToRate} aria-valuenow={data.completedBookings} aria-label="Bookings completed toward your first rating">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (data.completedBookings / Math.max(1, data.completedBookings + data.bookingsToRate)) * 100)}%` }} />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card" data-testid="card-score">
          <CardContent className="flex flex-wrap items-end justify-between gap-4 p-6">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Reputation score</p>
              <p className="font-serif text-5xl font-bold">{Math.round(data.score ?? 0)}<span className="text-lg font-normal text-muted-foreground"> / 100</span></p>
            </div>
            <p className="text-sm text-muted-foreground">{data.completedBookings} completed bookings · {data.reviewCount} {data.reviewCount === 1 ? "review" : "reviews"} · {data.monthsSinceVerified} {data.monthsSinceVerified === 1 ? "month" : "months"} verified</p>
          </CardContent>
        </Card>
      )}

      <Card className="bg-card">
        <CardHeader className="pb-2"><CardTitle className="text-lg">How your score is made</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {data.categories.map((c) => (
            <div key={c.key} data-testid={`category-${c.key}`}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-semibold">{c.label} <span className="font-normal text-muted-foreground">· {c.weightPercent}% of your score</span></p>
                <p className="text-sm font-semibold">{Math.round(c.score)}</p>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(c.score)} aria-label={c.label}>
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, c.score)}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{c.help}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {next && (
        <Card className="bg-card" data-testid="card-next-tier">
          <CardHeader className="pb-2"><CardTitle className="text-lg">Next: {next.label}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.building ? (
              <p className="text-muted-foreground">Complete your first {data.completedBookings + data.bookingsToRate} bookings to get rated. Then the next tier opens up.</p>
            ) : next.pointsNeeded === 0 && next.bookingsNeeded === 0 && next.monthsNeeded === 0 ? (
              <p className="text-muted-foreground">You meet every requirement. Tiers are reviewed monthly, so it will be applied at the next review.</p>
            ) : (
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                {next.pointsNeeded > 0 && <li>{next.pointsNeeded} more score points</li>}
                {next.bookingsNeeded > 0 && <li>{next.bookingsNeeded} more completed bookings</li>}
                {next.monthsNeeded > 0 && <li>{next.monthsNeeded} more {next.monthsNeeded === 1 ? "month" : "months"} on Bonisa</li>}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">A tier needs the score, the bookings and the time together. A great score alone does not unlock it.</p>
          </CardContent>
        </Card>
      )}

      <Card className="bg-card" data-testid="card-cancellation-policy">
        <CardHeader className="pb-2"><CardTitle className="text-lg">If you need to cancel a booking</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p><span className="font-medium text-foreground">{data.cancellationPolicy.freeNoticeHours} hours or more:</span> no mark against you.</p>
          <p><span className="font-medium text-foreground">{data.cancellationPolicy.lateNoticeHours} to {data.cancellationPolicy.freeNoticeHours} hours:</span> a late cancellation, lightly counted.</p>
          <p><span className="font-medium text-foreground">Under {data.cancellationPolicy.lateNoticeHours} hours:</span> a last-minute cancellation, counted more.</p>
          <p className="pt-1">A real emergency can be flagged when you cancel. We review it, and it does not count against you meanwhile. Client cancellations and Bonisa's own problems are never held against you.</p>
        </CardContent>
      </Card>

      <Card className="bg-card" data-testid="card-referral">
        <CardHeader className="pb-2"><CardTitle className="text-lg">Bring artists to Bonisa</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">Share your code. You earn credit only when the artist you referred is verified and has completed {data.referral.bookingsRequired} real bookings, so it rewards good artists, not quick sign-ups.</p>
          {code && (
            <div className="flex items-center gap-2">
              <code className="rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-base tracking-wider" data-testid="text-referral-code">{code}</code>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { void navigator.clipboard?.writeText(code); toast.success("Code copied"); }}><Copy className="h-3.5 w-3.5" />Copy</Button>
            </div>
          )}
          <p className="text-muted-foreground">{data.referral.referred} referred · {data.referral.credited} earned credit (up to {data.referral.creditCap} count each year)</p>
        </CardContent>
      </Card>

      <Card className="bg-card" data-testid="card-events">
        <CardHeader className="pb-2"><CardTitle className="text-lg">What has counted</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {data.events.length === 0 ? <p className="text-sm text-muted-foreground">Nothing yet. Your first completed booking will appear here.</p> : data.events.map((e) => (
            <div key={e.id} className="flex flex-col gap-2 rounded-lg border border-border/60 p-3 text-sm sm:flex-row sm:items-center sm:justify-between" data-testid={`event-${e.id}`}>
              <div>
                <p className="font-medium">{e.label}{e.detail ? <span className="font-normal text-muted-foreground"> · {e.detail}</span> : null}</p>
                <p className="text-xs text-muted-foreground">{longDate(e.createdAt.slice(0, 10))}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={e.status === "active" ? "secondary" : "outline"}>{STATUS_WORDS[e.status]}</Badge>
                {e.dispute && <Badge variant="outline">{e.dispute.status === "open" ? "Review requested" : `Review: ${e.dispute.status}`}</Badge>}
                {e.canDispute && <Button size="sm" variant="ghost" onClick={() => { setDisputing(e); setReason(""); }} data-testid={`button-dispute-${e.id}`}>This looks wrong</Button>}
              </div>
              {e.dispute?.note && <p className="w-full text-xs text-muted-foreground">Bonisa's decision: {e.dispute.note}</p>}
            </div>
          ))}
        </CardContent>
      </Card>

      {data.history.length > 0 && (
        <Card className="bg-card">
          <CardHeader className="pb-2"><CardTitle className="text-lg">Tier history</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.history.map((h) => (
              <div key={h.id} className="rounded-lg border border-border/60 p-3 text-sm">
                <p className="font-medium">{h.from ? `${h.from} to ${h.to}` : h.to}</p>
                <p className="text-xs text-muted-foreground">{longDate(h.createdAt.slice(0, 10))}. {h.reason}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={disputing !== null} onOpenChange={(o) => { if (!o) { setDisputing(null); setReason(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Ask us to look again</DialogTitle>
            <DialogDescription>{disputing?.label}. While we review it, it does not count against you. Tell us what is wrong.</DialogDescription>
          </DialogHeader>
          <Textarea rows={4} value={reason} maxLength={1000} placeholder="For example: the client asked me to move the time." onChange={(e) => setReason(e.target.value)} data-testid="input-dispute-reason" />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDisputing(null)}>Cancel</Button>
            <Button disabled={reason.trim().length < 10 || dispute.isPending} onClick={() => void sendDispute()} data-testid="button-send-dispute">Send for review</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
