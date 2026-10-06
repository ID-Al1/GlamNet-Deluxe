import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListOwnerCampaignsQueryKey,
  getListPendingBrandsQueryKey,
  useListOwnerCampaigns,
  useListPendingBrands,
  useRejectBrand,
  useVerifyBrand,
  type OwnerCampaign,
  type OwnerPendingBrand,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle, Inbox, Mail, Phone, ShieldCheck, Globe } from "lucide-react";
import { toast } from "sonner";
import { apiMessage, longDate, rand } from "@/lib/campaign-money";

/**
 * Bonisa owner portal: Campaigns.
 *
 * Two jobs. Verify the brands who want to book artists (an unverified brand cannot post or
 * pay), and see where the money on every campaign stands: what has been paid, what is still
 * to come, what is held safely, what has gone to artists, and what Bonisa has earned.
 */

const STAGES: { key: OwnerCampaign["stage"] | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "open", label: "Choosing a team" },
  { key: "deposit_paid", label: "Deposit paid" },
  { key: "fully_paid", label: "Paid in full" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const STAGE_LABEL: Record<OwnerCampaign["stage"], string> = {
  open: "Choosing a team",
  deposit_paid: "Deposit paid",
  fully_paid: "Paid in full",
  completed: "Completed",
  cancelled: "Cancelled",
};

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <p className="text-xl font-semibold sm:text-2xl">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground/80">{hint}</p>}
    </div>
  );
}

function PendingBrands() {
  const queryClient = useQueryClient();
  const { data: brands, isLoading, isError, refetch } = useListPendingBrands();
  const verify = useVerifyBrand();
  const reject = useRejectBrand();
  const [rejecting, setRejecting] = useState<OwnerPendingBrand | null>(null);
  const [reason, setReason] = useState("");

  const refresh = () => queryClient.invalidateQueries({ queryKey: getListPendingBrandsQueryKey() });

  async function approve(b: OwnerPendingBrand) {
    try {
      const res = await verify.mutateAsync({ brandProfileId: b.profileId });
      toast.success(res.message);
      await refresh();
    } catch (e) {
      toast.error(apiMessage(e, "Could not verify this brand."));
    }
  }

  async function sendBack() {
    if (!rejecting) return;
    if (reason.trim().length < 3) {
      toast.error("Tell them what needs fixing. A rejection with no reason just loses the brand.");
      return;
    }
    try {
      const res = await reject.mutateAsync({ brandProfileId: rejecting.profileId, data: { reason: reason.trim() } });
      toast.success(res.message);
      setRejecting(null);
      setReason("");
      await refresh();
    } catch (e) {
      toast.error(apiMessage(e, "Could not send this brand back."));
    }
  }

  const waitingDays = (iso: string | null) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : 0);

  return (
    <section className="space-y-4" aria-labelledby="brands-heading">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="brands-heading" className="font-serif text-2xl">Brands waiting for verification</h2>
          <p className="mt-1 text-sm text-muted-foreground">An unverified brand cannot post a campaign or pay for artists. Check the company is real before you approve.</p>
        </div>
        {brands && <Badge variant="secondary">{brands.length}</Badge>}
      </div>

      {isLoading ? <Skeleton className="h-28 w-full" /> : isError ? (
        <Card className="bg-card"><CardContent className="py-8 text-center">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-destructive" strokeWidth={1.9} />
          <p className="mb-3 text-sm">Could not load the brands.</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>Try again</Button>
        </CardContent></Card>
      ) : !brands || brands.length === 0 ? (
        <Card className="bg-card"><CardContent className="py-10 text-center">
          <Inbox className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" strokeWidth={1.9} />
          <p className="font-medium">No brands waiting</p>
        </CardContent></Card>
      ) : brands.map((b) => {
        const days = waitingDays(b.submittedAt);
        return (
          <Card key={b.profileId} className="bg-card" data-testid={`pending-brand-${b.profileId}`}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="font-serif text-xl">{b.companyName}</CardTitle>
                {days >= 3 && <Badge variant="destructive">{days} days waiting</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                <p><span className="text-muted-foreground">Registration:</span> {b.registrationNumber ?? "not given"}</p>
                <p><span className="text-muted-foreground">VAT:</span> {b.vatNumber ?? "not given"}</p>
                <p className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.9} />{b.website ?? "no website"}</p>
                <p><span className="text-muted-foreground">Billing:</span> {b.billingAddress ?? "not given"}</p>
                <p className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.9} />{b.contactName}, {b.email}</p>
                <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.9} />{b.phone ?? "no phone on file"}</p>
              </div>
              <div className="flex gap-2 pt-1">
                <Button className="gap-2" onClick={() => void approve(b)} disabled={verify.isPending} data-testid={`button-verify-brand-${b.profileId}`}><ShieldCheck className="h-4 w-4" strokeWidth={1.9} />Verify</Button>
                <Button variant="outline" onClick={() => { setRejecting(b); setReason(""); }}>Needs more</Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={rejecting !== null} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">What does {rejecting?.companyName} need to fix?</DialogTitle>
            <DialogDescription>They get this word for word, by email, and can submit again once it is sorted. Be specific and kind.</DialogDescription>
          </DialogHeader>
          <Textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Please add your company registration number so we can check it." />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button onClick={() => void sendBack()} disabled={reject.isPending}>Send back</Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function CampaignMoney() {
  const { data: campaigns, isLoading, isError, refetch } = useListOwnerCampaigns({ query: { queryKey: getListOwnerCampaignsQueryKey() } });
  const [stage, setStage] = useState<OwnerCampaign["stage"] | "all">("all");

  const totals = useMemo(() => {
    const funded = (campaigns ?? []).filter((c) => c.stage !== "open" && c.stage !== "cancelled");
    const sum = (f: (c: OwnerCampaign) => number, list = funded) => Math.round(list.reduce((s, c) => s + f(c), 0) * 100) / 100;
    return {
      collected: sum((c) => c.paid, campaigns ?? []),
      outstanding: sum((c) => c.outstanding),
      held: sum((c) => c.heldInEscrow),
      released: sum((c) => c.releasedToArtists),
      fee: sum((c) => c.bonisaFee),
    };
  }, [campaigns]);

  const shown = (campaigns ?? []).filter((c) => stage === "all" || c.stage === stage);
  const overdue = (campaigns ?? []).filter((c) => c.balanceOverdue);

  return (
    <section className="space-y-4" aria-labelledby="money-heading">
      <div>
        <h2 id="money-heading" className="font-serif text-2xl">Campaign money</h2>
        <p className="mt-1 text-sm text-muted-foreground">Brands pay each artist's full rate plus Bonisa's 18% on top. Money is held until the brand has paid in full and both sides confirm the work.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Figure label="Collected from brands" value={rand(totals.collected)} />
        <Figure label="Still to come" value={rand(totals.outstanding)} hint="Balances not yet paid" />
        <Figure label="Held safely" value={rand(totals.held)} hint="Paid in, not yet released" />
        <Figure label="Released to artists" value={rand(totals.released)} hint="Their full rates" />
        <Figure label="Bonisa's fee" value={rand(totals.fee)} hint="On funded campaigns" />
      </div>

      {overdue.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5" role="alert">
          <CardContent className="p-4 text-sm">
            <p className="font-semibold">{overdue.length === 1 ? "A balance is overdue" : `${overdue.length} balances are overdue`}</p>
            <ul className="mt-1 space-y-0.5">{overdue.map((c) => <li key={c.id}>{c.brandName}, {c.title}: {rand(c.outstanding)} was due {longDate(c.balanceDueDate)}</li>)}</ul>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {STAGES.map((s) => (
          <button key={s.key} type="button" onClick={() => setStage(s.key)} aria-pressed={stage === s.key}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${stage === s.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/50"}`}>
            {s.label}
          </button>
        ))}
      </div>

      {isLoading ? <Skeleton className="h-32 w-full" /> : isError ? (
        <div className="py-10 text-center">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-destructive" strokeWidth={1.9} />
          <p className="mb-3 text-sm">Could not load campaigns.</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>Try again</Button>
        </div>
      ) : shown.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{campaigns?.length ? "No campaigns at this stage." : "No campaigns yet. They appear here as soon as a verified brand posts one."}</p>
      ) : (
        <div className="space-y-3">
          {shown.map((c) => (
            <Card key={c.id} className="bg-card" data-testid={`owner-campaign-${c.id}`}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{c.title}</p>
                    <p className="text-xs text-muted-foreground">{c.brandName} · {c.specialty}{c.eventDate ? ` · ${longDate(c.eventDate)}` : ""}</p>
                  </div>
                  <div className="flex gap-1.5">
                    {c.balanceOverdue && <Badge variant="destructive">Balance overdue</Badge>}
                    <Badge variant={c.stage === "cancelled" ? "outline" : "secondary"}>{STAGE_LABEL[c.stage]}</Badge>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
                  <div><p className="text-xs text-muted-foreground">Brand pays</p><p className="font-medium">{rand(c.total)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Paid so far</p><p className="font-medium">{rand(c.paid)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Still to come</p><p className="font-medium">{rand(c.outstanding)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Artists get</p><p className="font-medium">{rand(c.artistFees)} ({c.artistsFunded})</p></div>
                  <div><p className="text-xs text-muted-foreground">Bonisa fee</p><p className="font-medium">{rand(c.bonisaFee)}</p></div>
                </div>
                {c.stage !== "open" && c.stage !== "cancelled" && (
                  <p className="text-xs text-muted-foreground">
                    {c.jobsReleased} of {c.jobsTotal} artists paid out ({rand(c.releasedToArtists)}). {rand(c.heldInEscrow)} held safely.
                    {c.balanceDueDate && c.outstanding > 0 ? ` Balance due ${longDate(c.balanceDueDate)}.` : ""}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

export default function OwnerCampaigns() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="mb-1 font-serif text-3xl">Campaigns</h1>
        <p className="text-sm text-muted-foreground">Verify brands, and follow every rand brands pay for artists.</p>
      </div>
      <PendingBrands />
      <CampaignMoney />
    </div>
  );
}
