import { useState } from "react";
import { Redirect } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListCastingCallsQueryKey,
  useApplyToCastingCall,
  useListCastingCalls,
  useRespondToCastingInvitation,
  type CastingCall,
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Briefcase, CalendarDays, Clock, MapPin, Users } from "lucide-react";
import { toast } from "sonner";
import { apiMessage, longDate, randWhole } from "@/lib/campaign-money";

const SPECIALTIES = ["All", "Makeup", "Hair", "Barber", "Nails", "Lashes", "Brows", "Skincare"];

function CampaignCard({ call, busy, onApply, onRespond }: {
  call: CastingCall;
  busy: boolean;
  onApply: (id: string) => void;
  onRespond: (id: string, accept: boolean) => void;
}) {
  const spotsLeft = Math.max(0, call.artistsNeeded - call.spotsFilled);
  const confirmed = call.status === "deposit_paid" || call.status === "fully_paid";

  let action: React.ReactNode;
  switch (call.myStatus) {
    case "invited":
      action = (
        <div className="flex gap-2">
          <Button className="flex-1 rounded-full" disabled={busy} onClick={() => onRespond(call.id, true)} data-testid={`button-accept-${call.id}`}>Accept</Button>
          <Button variant="outline" className="flex-1 rounded-full" disabled={busy} onClick={() => onRespond(call.id, false)}>Decline</Button>
        </div>
      );
      break;
    case "accepted":
      action = <Badge className="justify-center py-2">{confirmed ? "Confirmed and funded" : "You are in the team"}</Badge>;
      break;
    case "shortlisted":
      action = <Badge variant="secondary" className="justify-center py-2">You are shortlisted</Badge>;
      break;
    case "pending":
      action = <Badge variant="secondary" className="justify-center py-2">Applied, waiting to hear</Badge>;
      break;
    case "declined":
      action = <Badge variant="outline" className="justify-center py-2">You declined</Badge>;
      break;
    case "passed":
      action = <Badge variant="outline" className="justify-center py-2">Not selected this time</Badge>;
      break;
    default:
      action = (
        <Button className="w-full rounded-full" disabled={busy || spotsLeft === 0 || call.status !== "open"} onClick={() => onApply(call.id)} data-testid={`button-apply-${call.id}`}>
          {spotsLeft === 0 ? "Team is full" : busy ? "Applying…" : "Apply now"}
        </Button>
      );
  }

  return (
    <Card className="group overflow-hidden border-border/50 bg-card transition-all hover:border-border hover:shadow-md" data-testid={`campaign-${call.id}`}>
      <CardContent className="p-0">
        <div className="flex flex-col md:flex-row">
          <div className="flex-1 space-y-3 p-6">
            <div className="flex flex-wrap items-start gap-3">
              <h3 className="font-serif text-2xl font-bold leading-tight">{call.title}</h3>
              <Badge variant="outline" className="mt-1 shrink-0 rounded-full text-xs font-semibold" style={{ color: "hsl(var(--baby-blue))", borderColor: "hsl(var(--baby-blue) / 0.35)", background: "hsl(var(--baby-blue) / 0.08)" }}>
                {call.specialty}
              </Badge>
              {call.myStatus === "invited" && <Badge className="mt-1 shrink-0">Invited</Badge>}
            </div>
            <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">By {call.brandName}</p>
            <p className="line-clamp-3 leading-relaxed text-muted-foreground">{call.brief}</p>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 pt-1 text-sm text-muted-foreground">
              {call.eventDate && <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" strokeWidth={1.9} />{longDate(call.eventDate)} at {call.eventTime}</span>}
              {call.location && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" strokeWidth={1.9} />{call.location}</span>}
              <span className="flex items-center gap-1.5"><Users className="h-4 w-4" strokeWidth={1.9} />{spotsLeft} of {call.artistsNeeded} places left</span>
            </div>
          </div>

          <div className="flex shrink-0 flex-col justify-between gap-5 border-t border-border/40 bg-muted/30 p-6 md:w-60 md:border-l md:border-t-0">
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">You are paid</p>
                <p className="font-serif text-2xl font-bold" style={{ color: "hsl(var(--orange))" }}>{randWhole(call.ratePerArtist)}</p>
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground">Your full rate. The brand pays Bonisa's fee on top, so nothing comes off it.</p>
              </div>
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground"><Clock className="h-3 w-3" />Applications close</p>
                <p className="text-sm font-medium">{longDate(call.deadline)}</p>
              </div>
            </div>
            {action}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CastingCalls() {
  const { user } = useAuth();
  const [specialty, setSpecialty] = useState("");
  const queryClient = useQueryClient();
  const params = specialty ? { specialty } : undefined;
  const { data: castings, isLoading, error, refetch } = useListCastingCalls(params, {
    query: { queryKey: getListCastingCallsQueryKey(params), enabled: user?.role !== "brand" },
  });
  const apply = useApplyToCastingCall();
  const respond = useRespondToCastingInvitation();
  const [busyId, setBusyId] = useState<string | null>(null);

  // Brands manage their campaigns from their dashboard.
  if (user?.role === "brand") return <Redirect to="/dashboard" />;

  const refresh = () => queryClient.invalidateQueries({ queryKey: getListCastingCallsQueryKey(params) });

  async function onApply(id: string) {
    setBusyId(id);
    try {
      const res = await apply.mutateAsync({ castingId: id });
      toast.success(res.message === "Already applied" ? "You have already applied" : "Application sent. The brand will tell you either way.");
      await refresh();
    } catch (e) {
      toast.error(apiMessage(e, "Could not apply."));
    } finally {
      setBusyId(null);
    }
  }

  async function onRespond(id: string, accept: boolean) {
    setBusyId(id);
    try {
      const res = await respond.mutateAsync({ castingId: id, data: { accept } });
      toast.success(res.message);
      await refresh();
    } catch (e) {
      toast.error(apiMessage(e, "Could not save your answer."));
    } finally {
      setBusyId(null);
    }
  }

  const invited = (castings ?? []).filter((c) => c.myStatus === "invited");
  const rest = (castings ?? []).filter((c) => c.myStatus !== "invited");

  return (
    <div className="container mx-auto max-w-6xl space-y-8 px-4 py-8 sm:py-12">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">For Artists</p>
        <h1 className="font-serif text-4xl font-bold tracking-tight sm:text-5xl">Casting Calls</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Paid campaigns from verified brands. You are paid your full rate, held safely by Bonisa until the job is done, and the brand always tells you the outcome.
        </p>
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {SPECIALTIES.map((s) => {
          const isActive = specialty === (s === "All" ? "" : s);
          return (
            <button
              key={s}
              onClick={() => setSpecialty(s === "All" ? "" : s)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-all ${isActive ? "bg-primary text-primary-foreground shadow-sm" : "border border-border/60 bg-card text-muted-foreground hover:border-border hover:text-foreground"}`}
            >
              {s}
            </button>
          );
        })}
      </div>

      {error ? (
        <div className="space-y-4 rounded-2xl border border-dashed border-destructive/40 py-24 text-center">
          <p className="font-serif text-xl font-bold text-destructive">Couldn't load casting calls</p>
          <p className="text-sm text-muted-foreground">Something went wrong. Please try again.</p>
          <Button variant="outline" size="sm" className="rounded-full px-5" onClick={() => refetch()}>Try again</Button>
        </div>
      ) : isLoading ? (
        <div className="grid gap-5">{[1, 2, 3].map((i) => <Card key={i} className="h-44 animate-pulse border-border/50 bg-muted" />)}</div>
      ) : (castings?.length ?? 0) === 0 ? (
        <div className="space-y-4 rounded-2xl border border-dashed border-border/50 py-24 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10"><Briefcase className="h-6 w-6 text-primary" /></div>
          <div className="space-y-1.5">
            <p className="font-serif text-xl font-bold">No open campaigns yet</p>
            <p className="mx-auto max-w-xs text-sm text-muted-foreground">When a verified brand posts a campaign, or invites you to one, it appears here.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {invited.length > 0 && (
            <section className="space-y-4" aria-labelledby="invites-heading">
              <h2 id="invites-heading" className="font-serif text-2xl">Invitations for you</h2>
              <div className="grid gap-5">{invited.map((c) => <CampaignCard key={c.id} call={c} busy={busyId === c.id} onApply={onApply} onRespond={onRespond} />)}</div>
            </section>
          )}
          <section className="space-y-4">
            {invited.length > 0 && rest.length > 0 && <h2 className="font-serif text-2xl">Open campaigns</h2>}
            <div className="grid gap-5">{rest.map((c) => <CampaignCard key={c.id} call={c} busy={busyId === c.id} onApply={onApply} onRespond={onRespond} />)}</div>
          </section>
        </div>
      )}
    </div>
  );
}
