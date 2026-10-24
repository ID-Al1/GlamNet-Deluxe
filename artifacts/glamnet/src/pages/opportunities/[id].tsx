import { useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, Flag, ShieldCheck } from "lucide-react";
import { useGetOpportunity, useApplyToOpportunity, useReportOpportunity, getGetOpportunityQueryKey, getListOpportunitiesQueryKey, getListMyApplicationsQueryKey, useGetMyModelProfile, getGetMyModelProfileQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PortalShell } from "@/components/portal/shell";
import { StatusPill } from "@/components/portal/status-pill";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/portal/states";
import { APPLICATION_STATUS, errorMessage, formatDay, formatRand, opportunityTypeLabel } from "@/lib/portal";

function Term({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid sm:grid-cols-[200px_1fr] gap-1 sm:gap-6 py-4 border-b border-border last:border-0">
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-0.5">{label}</dt>
      <dd className="text-sm text-foreground/90 whitespace-pre-line">{children}</dd>
    </div>
  );
}

export default function OpportunityDetail() {
  const [, params] = useRoute("/opportunities/:id");
  const id = params?.id ?? "";
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: o, isLoading, error, refetch } = useGetOpportunity(id);
  const isModel = user?.role === "model";
  const { data: myProfile } = useGetMyModelProfile({ query: { enabled: isModel, queryKey: getGetMyModelProfileQueryKey() } });
  const apply = useApplyToOpportunity();
  const report = useReportOpportunity();
  const [message, setMessage] = useState("");
  const [fee, setFee] = useState("");
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");

  if (isLoading) return <PortalShell><LoadingBlock label="Loading opportunity" /></PortalShell>;
  if (error || !o) {
    const nf = (error as { status?: number } | null)?.status === 404;
    return <PortalShell narrow>{nf ? <EmptyBlock title="This opportunity could not be found"><Link href="/opportunities"><Button variant="outline">Back to opportunities</Button></Link></EmptyBlock> : <ErrorBlock onRetry={() => refetch()} />}</PortalShell>;
  }

  const fees = formatRand(o.compensationCents);
  const verified = myProfile?.verificationStatus === "verified";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const feeNumber = fee.trim() ? Math.round(parseFloat(fee.replace(/[^0-9.]/g, "")) * 100) : null;
    try {
      await apply.mutateAsync({ opportunityId: o.id, data: { message: message.trim(), proposedFeeCents: feeNumber } });
      toast.success("Application sent");
      await Promise.all([
        qc.invalidateQueries({ queryKey: getGetOpportunityQueryKey(o.id) }),
        qc.invalidateQueries({ queryKey: getListOpportunitiesQueryKey() }),
        qc.invalidateQueries({ queryKey: getListMyApplicationsQueryKey() }),
      ]);
    } catch (err) { toast.error(errorMessage(err)); }
  };

  const sendReport = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await report.mutateAsync({ opportunityId: o.id, data: { reason: reason.trim() } });
      toast.success("Thank you. Bonisa will review this listing.");
      setReporting(false); setReason("");
    } catch (err) { toast.error(errorMessage(err)); }
  };

  return (
    <PortalShell narrow>
      <Link href="/opportunities" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />All opportunities</Link>

      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">{opportunityTypeLabel(o.type)}</p>
        <h1 className="text-3xl sm:text-4xl font-serif font-bold tracking-tight">{o.title}</h1>
        <p className="text-muted-foreground">Organised by <strong className="text-foreground">{o.organiserName}</strong></p>
        <StatusPill status={o.status} kind="listing" />
      </header>

      <section aria-labelledby="terms" className="rounded-2xl border border-border bg-card px-5 sm:px-8">
        <h2 id="terms" className="sr-only">Terms</h2>
        <dl>
          <Term label="Brief">{o.brief}</Term>
          <Term label="Deliverables">{o.deliverables}</Term>
          {o.eligibility && <Term label="Who can apply">{o.eligibility}</Term>}
          <Term label="Dates">{o.startDate ? `${formatDay(o.startDate)}${o.endDate && o.endDate !== o.startDate ? ` to ${formatDay(o.endDate)}` : ""}` : "To be confirmed with the organiser"}</Term>
          <Term label="Location">{o.isRemote ? "Remote" : o.location || "To be confirmed"}</Term>
          <Term label="Offered fee">{fees ? <><strong>{fees}</strong>{o.compensationNote ? `. ${o.compensationNote}` : ""}</> : (o.compensationNote || "The organiser has not stated an amount.")}</Term>
          <Term label="Expenses">{o.expensesNote || "Not stated. Ask before you apply."}</Term>
          <Term label="Usage rights">{o.usageRights}</Term>
          <Term label="Exclusivity">{o.exclusivity}</Term>
          <Term label="Payment terms">{o.paymentTerms}</Term>
          <Term label="Platform fee">Bonisa has not set a platform fee for this listing. You will see the exact fee, who pays it, and whether the budget includes it before you accept anything.</Term>
          <Term label="Apply by">{formatDay(o.applicationDeadline)}</Term>
        </dl>
      </section>

      <p className="flex items-start gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 text-gold shrink-0 mt-0.5" strokeWidth={1.9} aria-hidden="true" />Applying does not create an agreement and is not a guaranteed booking. Work only starts once scope, fee, expenses, deadlines and rights are agreed in writing. Paid or gifted promotion must be disclosed as such.</p>

      <section className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-4" aria-labelledby="apply-h">
        <h2 id="apply-h" className="text-2xl">Apply</h2>
        {o.status !== "open" ? (
          <p className="text-sm text-muted-foreground">This opportunity is closed.</p>
        ) : !user ? (
          <p className="text-sm text-muted-foreground">Models can apply once signed in and verified. <Link href="/login" className="text-primary underline underline-offset-4">Sign in</Link> or <Link href="/signup" className="text-primary underline underline-offset-4">join as a model</Link>.</p>
        ) : !isModel ? (
          <p className="text-sm text-muted-foreground">Only models can apply to opportunities.</p>
        ) : o.myApplicationStatus && o.myApplicationStatus !== "withdrawn" ? (
          <div className="space-y-2" role="status">
            <StatusPill status={o.myApplicationStatus} />
            <p className="text-sm text-muted-foreground">{APPLICATION_STATUS[o.myApplicationStatus]?.detail}</p>
            <Link href="/workspace/applications"><Button variant="outline" size="sm">Go to my applications</Button></Link>
          </div>
        ) : !verified ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Only verified models can apply. {myProfile?.verificationStatus === "pending" ? "Bonisa is reviewing your profile." : "Complete your profile and ask Bonisa to verify it."}</p>
            <Link href="/workspace/portfolio"><Button variant="outline" size="sm">Open my portfolio</Button></Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="msg" className="text-sm font-medium">Why you are a good fit</label>
              <Textarea id="msg" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} required minLength={10} maxLength={2000} className="bg-background" />
            </div>
            <div className="space-y-2 max-w-xs">
              <label htmlFor="fee" className="text-sm font-medium">Your proposed fee in rand (optional)</label>
              <Input id="fee" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="e.g. 2500" className="bg-background" />
            </div>
            <Button type="submit" disabled={apply.isPending || message.trim().length < 10}>{apply.isPending ? "Sending" : "Send application"}</Button>
          </form>
        )}
      </section>

      {user && o.organiserName && (
        <div>
          {!reporting ? (
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={() => setReporting(true)}><Flag className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />Report this listing</Button>
          ) : (
            <form onSubmit={sendReport} className="rounded-2xl border border-border bg-card p-5 space-y-3 max-w-xl">
              <label htmlFor="reason" className="text-sm font-medium">What looks wrong? For example: asking for money upfront, unclear organiser, unsafe location.</label>
              <Textarea id="reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} required minLength={5} maxLength={1000} className="bg-background" />
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={report.isPending || reason.trim().length < 5}>Send report</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setReporting(false)}>Cancel</Button>
              </div>
            </form>
          )}
        </div>
      )}
    </PortalShell>
  );
}
