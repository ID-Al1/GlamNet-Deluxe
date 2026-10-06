import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Redirect, useLocation, useRoute, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetBrandDashboardQueryKey,
  getGetCampaignSummaryQueryKey,
  getListCastingApplicantsQueryKey,
  useCancelCampaign,
  useConfirmCampaignPayment,
  useDecideCastingApplicant,
  useGetCampaignSummary,
  useInviteArtistToCasting,
  useListCastingApplicants,
  useListStylists,
  useStartCampaignPayment,
  useUpdateCastingCall,
  type CampaignSummary,
  type CastingApplicant,
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CampaignForm } from "@/components/campaign-form";
import { apiMessage, longDate, rand, randWhole } from "@/lib/campaign-money";
import { AlertCircle, ArrowLeft, CalendarDays, CheckCircle2, Clock, CreditCard, MapPin, Pencil, Search, ShieldAlert, Star, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

const STAGE: Record<CampaignSummary["stage"], { label: string; tone: "default" | "secondary" | "outline" }> = {
  open: { label: "Choosing your team", tone: "secondary" },
  deposit_paid: { label: "Deposit paid", tone: "default" },
  fully_paid: { label: "Paid in full", tone: "default" },
  completed: { label: "Completed", tone: "default" },
  cancelled: { label: "Cancelled", tone: "outline" },
};

const STATUS_WORDS: Record<CastingApplicant["status"], string> = {
  pending: "New applicant",
  shortlisted: "Shortlisted",
  invited: "Invited, waiting for her",
  accepted: "In your team",
  declined: "Declined your invitation",
  passed: "Passed",
};

export default function CampaignPage() {
  const { user, token } = useAuth();
  const [, params] = useRoute("/campaigns/:id");
  const id = params?.id ?? "";
  const [, navigate] = useLocation();
  const search = useSearch();
  const queryClient = useQueryClient();

  const { data: summary, isLoading, isError, error, refetch } = useGetCampaignSummary(id, {
    query: { queryKey: getGetCampaignSummaryQueryKey(id), enabled: !!id && user?.role === "brand", retry: false },
  });
  const { data: applicants } = useListCastingApplicants(id, {
    query: { queryKey: getListCastingApplicantsQueryKey(id), enabled: !!summary },
  });
  const decide = useDecideCastingApplicant();
  const invite = useInviteArtistToCasting();
  const startPayment = useStartCampaignPayment();
  const confirmPayment = useConfirmCampaignPayment();
  const cancel = useCancelCampaign();
  const edit = useUpdateCastingCall();

  const [editing, setEditing] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [busyJob, setBusyJob] = useState<string | null>(null);
  const [artistSearch, setArtistSearch] = useState("");

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetCampaignSummaryQueryKey(id) }),
      queryClient.invalidateQueries({ queryKey: getListCastingApplicantsQueryKey(id) }),
      queryClient.invalidateQueries({ queryKey: getGetBrandDashboardQueryKey() }),
    ]);
  };

  // Coming back from Stripe: confirm the payment landed. The webhook usually has already, and this is safe to repeat.
  const sessionId = useMemo(() => new URLSearchParams(search).get("session_id"), [search]);
  const confirming = useRef(false);
  const [paymentNote, setPaymentNote] = useState<string | null>(null);
  useEffect(() => {
    if (!sessionId || !id || confirming.current || user?.role !== "brand") return;
    confirming.current = true;
    (async () => {
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          await confirmPayment.mutateAsync({ castingId: id, data: { sessionId } });
          await refreshAll();
          toast.success("Payment received. Thank you.");
          setPaymentNote(null);
          navigate(`/campaigns/${id}`, { replace: true });
          return;
        } catch (err: any) {
          if (err?.status === 402 && attempt < 4) {
            setPaymentNote("Your payment is still being processed. This page will update in a moment.");
            await new Promise((r) => setTimeout(r, 2500));
            continue;
          }
          setPaymentNote(apiMessage(err, "We could not confirm your payment yet. If you were charged, it will appear here shortly."));
          return;
        }
      }
    })();
  }, [sessionId, id, user?.role]); // eslint-disable-line react-hooks/exhaustive-deps

  // Artists the brand could invite: verified artists of the right type who are not already on the campaign.
  const { data: stylists = [] } = useListStylists({ specialty: summary?.call.specialty }, {
    query: { queryKey: ["stylists", "campaign-invite", summary?.call.specialty ?? ""], enabled: summary?.stage === "open" },
  });
  const onCampaign = useMemo(() => new Set((applicants ?? []).map((a) => a.stylistId)), [applicants]);
  const inviteable = stylists
    .filter((s) => !onCampaign.has(s.id))
    .filter((s) => {
      const q = artistSearch.trim().toLowerCase();
      return !q || s.name.toLowerCase().includes(q) || (s.location ?? "").toLowerCase().includes(q);
    })
    .slice(0, 12);

  if (user && user.role !== "brand") return <Redirect to="/dashboard" />;
  if (!user) return <Redirect to="/login" />;

  if (isLoading) {
    return <div className="container mx-auto max-w-4xl space-y-4 px-4 py-10"><Skeleton className="h-24 w-full" /><Skeleton className="h-56 w-full" /><Skeleton className="h-40 w-full" /></div>;
  }
  if (isError || !summary) {
    const forbidden = (error as any)?.status === 403 || (error as any)?.status === 404;
    return (
      <div className="container mx-auto max-w-xl px-4 py-16 text-center">
        <AlertCircle className="mx-auto mb-4 h-9 w-9 text-destructive" strokeWidth={1.9} />
        <p className="font-medium">{forbidden ? "We could not find that campaign." : "Could not load the campaign."}</p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href="/dashboard"><Button variant="outline">Back to your campaigns</Button></Link>
          {!forbidden && <Button onClick={() => void refetch()}>Try again</Button>}
        </div>
      </div>
    );
  }

  const call = summary.call;
  const open = summary.stage === "open";
  const funded = summary.stage === "deposit_paid" || summary.stage === "fully_paid" || summary.stage === "completed";
  const team = applicants?.filter((a) => a.status === "accepted") ?? [];
  const waiting = applicants?.filter((a) => a.status === "pending" || a.status === "shortlisted") ?? [];
  const invited = applicants?.filter((a) => a.status === "invited") ?? [];
  const closed = applicants?.filter((a) => a.status === "declined" || a.status === "passed") ?? [];

  async function decideOn(a: CastingApplicant, decision: "shortlist" | "accept" | "pass") {
    try {
      await decide.mutateAsync({ castingId: id, applicationId: a.applicationId, data: { decision } });
      await refreshAll();
      toast.success(decision === "accept" ? `${a.name} is in your team` : decision === "shortlist" ? `${a.name} shortlisted` : `${a.name} has been told you passed`);
    } catch (e) {
      toast.error(apiMessage(e, "Could not save that decision."));
    }
  }

  async function inviteArtist(stylistId: string, name: string) {
    try {
      await invite.mutateAsync({ castingId: id, data: { stylistId } });
      await refreshAll();
      toast.success(`${name} has been invited`);
    } catch (e) {
      toast.error(apiMessage(e, "Could not send the invitation."));
    }
  }

  async function pay(kind: "deposit" | "balance" | "full") {
    try {
      const res = await startPayment.mutateAsync({ castingId: id, data: { kind } });
      window.location.href = res.url;
    } catch (e) {
      toast.error(apiMessage(e, "Could not start the payment."));
      await refreshAll();
    }
  }

  async function confirmWork(appointmentId: string, name: string) {
    setBusyJob(appointmentId);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/appointments/${appointmentId}/confirm-work`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not confirm the work.");
      await refreshAll();
      toast.success(body.payoutStatus === "released" ? `Confirmed. ${name} will be paid within 24 hours.` : `Confirmed. Waiting for ${name} to confirm too.`);
    } catch (e: any) {
      toast.error(e.message || "Could not confirm the work.");
    } finally {
      setBusyJob(null);
    }
  }

  async function cancelCampaign() {
    setConfirmingCancel(false);
    try {
      await cancel.mutateAsync({ castingId: id });
      await refreshAll();
      toast.success("Campaign cancelled. Everyone involved has been told.");
    } catch (e) {
      toast.error(apiMessage(e, "Could not cancel the campaign."));
    }
  }

  const stage = STAGE[summary.stage];
  const per = summary.cost.artists > 0 ? summary.cost.total / summary.cost.artists : 0;

  return (
    <div className="container mx-auto max-w-4xl space-y-6 px-4 py-8 sm:py-12">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.9} />Your campaigns
      </Link>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">{call.title}</h1>
          <Badge variant={stage.tone}>{stage.label}</Badge>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" strokeWidth={1.9} />{longDate(call.eventDate)} at {call.eventTime}</span>
          <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" strokeWidth={1.9} />{call.location}</span>
          <span className="flex items-center gap-1.5"><Users className="h-4 w-4" strokeWidth={1.9} />{call.spotsFilled} of {call.artistsNeeded} {call.specialty} artists</span>
        </div>
        <p className="max-w-prose text-sm leading-relaxed">{call.brief}</p>
        {open && (
          <Button variant="outline" size="sm" className="gap-1.5 rounded-full" onClick={() => setEditing(true)} data-testid="button-edit-campaign">
            <Pencil className="h-3.5 w-3.5" strokeWidth={1.9} />Edit campaign
          </Button>
        )}
      </div>

      {paymentNote && <p className="rounded-lg border border-border/60 bg-muted/40 p-3 text-sm" role="status">{paymentNote}</p>}

      {/* ── Money ─────────────────────────────────────────────────── */}
      <Card className="border-border/60 bg-card" data-testid="card-campaign-money">
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-lg"><CreditCard className="h-5 w-5" strokeWidth={1.9} />Payment</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {summary.stage === "cancelled" ? (
            <p className="text-sm text-muted-foreground">This campaign was cancelled.</p>
          ) : (open && summary.team.length === 0) ? (
            <p className="text-sm text-muted-foreground">Accept applicants or invite artists below. Once at least one has accepted, your total appears here.</p>
          ) : (
            <>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span>{summary.cost.artists} {summary.cost.artists === 1 ? "artist" : "artists"} x {randWhole(call.ratePerArtist)}, paid in full to them</span><span>{rand(summary.cost.artistFees)}</span></div>
                <div className="flex justify-between"><span>Bonisa fee (18%), paid by you on top</span><span>{rand(summary.cost.fee)}</span></div>
                <div className="flex justify-between border-t border-border/60 pt-2 text-base font-semibold"><span>Total</span><span>{rand(summary.cost.total)}</span></div>
              </div>

              {funded && (
                <div className="space-y-1 rounded-lg bg-muted/40 p-3 text-sm">
                  <div className="flex justify-between"><span>Paid so far</span><span className="font-medium">{rand(summary.paid)}</span></div>
                  {summary.outstanding > 0 && <div className="flex justify-between"><span>Still to pay</span><span className="font-medium">{rand(summary.outstanding)}</span></div>}
                  {summary.balanceDueDate && summary.outstanding > 0 && (
                    <p className={`pt-1 text-xs ${summary.balanceOverdue ? "font-semibold text-destructive" : "text-muted-foreground"}`}>
                      {summary.balanceOverdue ? "Overdue. " : ""}The balance is due by {longDate(summary.balanceDueDate)}, 3 days before the event.
                    </p>
                  )}
                </div>
              )}

              {open && !summary.canFund && summary.blockers.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">{summary.blockers.map((b) => <li key={b}>{b}</li>)}</ul>
              )}

              <div className="flex flex-wrap gap-2">
                {open && summary.depositAllowed && (
                  <Button className="rounded-full" disabled={!summary.canFund || startPayment.isPending} onClick={() => void pay("deposit")} data-testid="button-pay-deposit">
                    Pay 50% deposit {rand(summary.cost.deposit)}
                  </Button>
                )}
                {open && (
                  <Button variant={summary.depositAllowed ? "outline" : "default"} className="rounded-full" disabled={!summary.canFund || startPayment.isPending} onClick={() => void pay("full")} data-testid="button-pay-full">
                    Pay in full {rand(summary.cost.total)}
                  </Button>
                )}
                {summary.canPayBalance && (
                  <Button className="rounded-full" disabled={startPayment.isPending} onClick={() => void pay("balance")} data-testid="button-pay-balance">
                    Pay balance {rand(summary.outstanding)}
                  </Button>
                )}
              </div>
              {open && summary.canFund && (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {summary.depositAllowed
                    ? `Paying the deposit confirms your team. The balance of ${rand(summary.cost.balance)} is due 3 days before the event.`
                    : "Your event is less than 3 days away, so the full amount is paid now."}
                  {" "}Your money is held safely by Bonisa and only released to your artists after you confirm the work was done.
                </p>
              )}
              {summary.stage === "completed" && <p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-primary" strokeWidth={1.9} />All your artists have been paid.</p>}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── After payment: the jobs ───────────────────────────────── */}
      {funded && (
        <Card className="border-border/60 bg-card" data-testid="card-campaign-jobs">
          <CardHeader className="pb-2"><CardTitle className="text-lg">Your confirmed artists</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {summary.jobs.map((job) => {
              const paidInFull = job.collected + 0.001 >= job.total;
              const released = job.payoutStatus === "released";
              return (
                <div key={job.appointmentId} className="flex flex-col gap-3 rounded-lg border border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">{job.name}</p>
                    <p className="text-xs text-muted-foreground">She is paid {randWhole(job.rate)}. You pay {rand(job.total)} including the fee.</p>
                    <p className="mt-1 text-xs">
                      {released ? "Paid out to her" : job.payoutStatus === "disputed" ? "Under review by Bonisa"
                        : job.confirmedByBrand ? (job.confirmedByArtist ? "Both confirmed" : "You confirmed, waiting for her")
                          : job.confirmedByArtist ? "She has confirmed, waiting for you" : "Confirm after the event"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!released && !job.confirmedByBrand && job.payoutStatus === "held" && (
                      paidInFull ? (
                        <>
                          <Button size="sm" className="gap-1.5 rounded-full" disabled={busyJob === job.appointmentId} onClick={() => void confirmWork(job.appointmentId, job.name)} data-testid={`button-confirm-${job.appointmentId}`}>
                            <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.9} />Work was done
                          </Button>
                          <Link href={`/complaints/new?appointmentId=${encodeURIComponent(job.appointmentId)}`}>
                            <Button size="sm" variant="outline" className="gap-1.5 rounded-full text-destructive"><ShieldAlert className="h-3.5 w-3.5" strokeWidth={1.9} />Report a problem</Button>
                          </Link>
                        </>
                      ) : (
                        <p className="max-w-[16rem] text-xs text-muted-foreground">Pay the balance first. Your artists are paid once the campaign is paid in full.</p>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* ── Team and applicants ───────────────────────────────────── */}
      <Card className="border-border/60 bg-card" data-testid="card-campaign-team">
        <CardHeader className="pb-2"><CardTitle className="text-lg">{funded ? "Everyone who applied or was invited" : "Your team"}</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {applicants === undefined ? <Skeleton className="h-20 w-full" /> : applicants.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nobody yet. Verified artists can apply, or invite artists you like below.</p>
          ) : (
            <>
              {[{ title: `In your team (${team.length} of ${call.artistsNeeded})`, rows: team }, { title: "Applicants", rows: waiting }, { title: "Invited", rows: invited }, { title: "Not taking part", rows: closed }]
                .filter((g) => g.rows.length > 0)
                .map((group) => (
                  <div key={group.title} className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.title}</p>
                    {group.rows.map((a) => (
                      <div key={a.applicationId} className="flex flex-col gap-2 rounded-lg border border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between" data-testid={`applicant-${a.applicationId}`}>
                        <div>
                          <div className="font-medium">{a.name} <Badge variant="outline" className="ml-1.5 align-middle text-[11px]">{STATUS_WORDS[a.status]}</Badge></div>
                          <p className="text-xs text-muted-foreground">
                            {[a.specialty, a.location].filter(Boolean).join(" · ")} · {a.jobsCompleted} {a.jobsCompleted === 1 ? "job" : "jobs"} on Bonisa
                            {a.reviewCount > 0 && <span className="ml-1 inline-flex items-center gap-0.5"><Star className="h-3 w-3" strokeWidth={1.9} />{a.rating.toFixed(1)} ({a.reviewCount})</span>}
                          </p>
                        </div>
                        {open && (
                          <div className="flex flex-wrap gap-2">
                            {a.status === "pending" && <Button size="sm" variant="outline" className="rounded-full" onClick={() => void decideOn(a, "shortlist")}>Shortlist</Button>}
                            {(a.status === "pending" || a.status === "shortlisted") && <Button size="sm" className="rounded-full" onClick={() => void decideOn(a, "accept")}>Accept</Button>}
                            {(a.status === "pending" || a.status === "shortlisted") && <Button size="sm" variant="ghost" className="rounded-full" onClick={() => void decideOn(a, "pass")}>Pass</Button>}
                            {(a.status === "accepted" || a.status === "invited") && <Button size="sm" variant="ghost" className="rounded-full" onClick={() => void decideOn(a, "pass")}>{a.status === "invited" ? "Withdraw invite" : "Remove"}</Button>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Invite ─────────────────────────────────────────────────── */}
      {open && (
        <Card className="border-border/60 bg-card" data-testid="card-campaign-invite">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-lg"><UserPlus className="h-5 w-5" strokeWidth={1.9} />Invite a verified artist</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.9} />
              <Input className="pl-9" placeholder={`Search ${call.specialty} artists by name or area`} value={artistSearch} onChange={(e) => setArtistSearch(e.target.value)} />
            </div>
            {inviteable.length === 0 ? (
              <p className="text-sm text-muted-foreground">No other verified {call.specialty.toLowerCase()} artists match.</p>
            ) : inviteable.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{[s.specialty, s.location].filter(Boolean).join(" · ")}</p>
                </div>
                <Button size="sm" variant="outline" className="rounded-full" disabled={invite.isPending} onClick={() => void inviteArtist(s.id, s.name)} data-testid={`button-invite-${s.id}`}>Invite</Button>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">Invited artists see your rate and the date, then accept or decline. You can only pay once they have accepted.</p>
          </CardContent>
        </Card>
      )}

      {/* ── Payment history ───────────────────────────────────────── */}
      {summary.payments.length > 0 && (
        <Card className="border-border/60 bg-card">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-lg"><Clock className="h-5 w-5" strokeWidth={1.9} />Payment history</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {summary.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-border/60 p-3 text-sm">
                <span className="capitalize">{p.kind === "full" ? "Full payment" : p.kind}</span>
                <span className="text-muted-foreground">{p.status === "paid" && p.paidAt ? new Date(p.paidAt).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }) : p.status}</span>
                <span className="font-medium">{rand(p.amount)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {open && (
        <div className="pt-2">
          <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmingCancel(true)} data-testid="button-cancel-campaign">Cancel this campaign</Button>
        </div>
      )}
      {funded && summary.stage !== "completed" && (
        <p className="text-xs text-muted-foreground">Need to cancel or change a paid campaign? Contact Bonisa and we will sort it out with you and your artists.</p>
      )}

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle className="font-serif text-2xl">Edit campaign</DialogTitle></DialogHeader>
          <CampaignForm
            submitLabel="Save changes"
            isPending={edit.isPending}
            lockedMoney={team.length > 0}
            initial={{
              title: call.title, brief: call.brief, specialty: call.specialty, artistsNeeded: call.artistsNeeded,
              ratePerArtist: call.ratePerArtist, eventDate: call.eventDate ?? "", eventTime: call.eventTime, location: call.location, deadline: call.deadline,
            }}
            onSubmit={async (v) => {
              try {
                await edit.mutateAsync({ castingId: id, data: team.length > 0
                  ? { title: v.title, brief: v.brief, deadline: v.deadline, specialty: v.specialty, artistsNeeded: v.artistsNeeded }
                  : { title: v.title, brief: v.brief, deadline: v.deadline, specialty: v.specialty, artistsNeeded: v.artistsNeeded, ratePerArtist: v.ratePerArtist, eventDate: v.eventDate, eventTime: v.eventTime, location: v.location } });
                await refreshAll();
                setEditing(false);
                toast.success("Campaign updated");
              } catch (e) {
                toast.error(apiMessage(e, "Could not save the changes."));
              }
            }}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmingCancel} onOpenChange={setConfirmingCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this campaign?</AlertDialogTitle>
            <AlertDialogDescription>Nothing has been paid, so nothing is charged. Every artist who applied, was invited or accepted is told it has been cancelled.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={() => void cancelCampaign()}>Cancel campaign</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
