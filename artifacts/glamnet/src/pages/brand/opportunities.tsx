import { useState } from "react";
import { Redirect } from "wouter";
import { Briefcase, Plus } from "lucide-react";
import {
  useCreateOpportunity, useDecideApplication, useListMyOpportunities, useListOpportunityApplicants, useSetOpportunityStatus,
  getListMyOpportunitiesQueryKey, getListOpportunityApplicantsQueryKey,
} from "@workspace/api-client-react";
import type { Opportunity, OpportunityInputType } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PortalShell } from "@/components/portal/shell";
import { StatusPill } from "@/components/portal/status-pill";
import { EmptyBlock, ErrorBlock, LoadingBlock, PageHeader } from "@/components/portal/states";
import { OPPORTUNITY_TYPES, errorMessage, formatDay, formatRand, opportunityTypeLabel } from "@/lib/portal";

const blank = {
  type: "paid_modelling", title: "", brief: "", deliverables: "", eligibility: "", startDate: "", endDate: "", location: "", isRemote: false,
  fee: "", compensationNote: "", expensesNote: "", usageRights: "", exclusivity: "None", paymentTerms: "", applicationDeadline: "",
};

function Applicants({ o }: { o: Opportunity }) {
  const { data, isLoading, error, refetch } = useListOpportunityApplicants(o.id);
  const decide = useDecideApplication();
  const qc = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});

  const go = async (id: string, status: "shortlisted" | "accepted" | "passed") => {
    try {
      await decide.mutateAsync({ applicationId: id, data: { status, note: notes[id]?.trim() || null } });
      toast.success(status === "passed" ? "The model has been told." : status === "accepted" ? "Accepted. The model can see this." : "Shortlisted");
      await qc.invalidateQueries({ queryKey: getListOpportunityApplicantsQueryKey(o.id) });
    } catch (err) { toast.error(errorMessage(err)); }
  };

  if (isLoading) return <LoadingBlock label="Loading applicants" />;
  if (error) return <ErrorBlock onRetry={() => refetch()} />;
  if (!data?.length) return <p className="text-sm text-muted-foreground py-4">No applications yet.</p>;
  return (
    <ul className="space-y-3 pt-2">
      {data.map((a) => (
        <li key={a.id} className="rounded-xl border border-border bg-background p-4 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div><p className="font-semibold">{a.model.professionalName}</p>
              <p className="text-xs text-muted-foreground">{a.model.category}{a.model.area ? ` · ${a.model.area}` : ""} · {a.model.verified ? "Verified by Bonisa" : "Not verified"}</p></div>
            <StatusPill status={a.status} />
          </div>
          <p className="text-sm whitespace-pre-line">{a.message}</p>
          {a.proposedFeeCents != null && <p className="text-xs text-muted-foreground">Proposed fee: {formatRand(a.proposedFeeCents)}</p>}
          {(a.status === "applied" || a.status === "shortlisted") ? (
            <div className="space-y-2">
              <Textarea aria-label="Message to the model" rows={2} maxLength={1000} placeholder="Optional message the model will see with your decision" value={notes[a.id] ?? ""} onChange={(e) => setNotes({ ...notes, [a.id]: e.target.value })} className="bg-card" />
              <div className="flex gap-2 flex-wrap">
                {a.status === "applied" && <Button size="sm" variant="outline" disabled={decide.isPending} onClick={() => go(a.id, "shortlisted")}>Shortlist</Button>}
                <Button size="sm" disabled={decide.isPending} onClick={() => go(a.id, "accepted")}>Accept</Button>
                <Button size="sm" variant="ghost" disabled={decide.isPending} onClick={() => go(a.id, "passed")}>Pass</Button>
              </div>
              <p className="text-xs text-muted-foreground">Accepting is not an agreement. Fee, expenses, deadlines and rights must still be agreed in writing. The model always sees the outcome.</p>
            </div>
          ) : a.statusNote ? <p className="text-xs text-muted-foreground">Your message: {a.statusNote}</p> : null}
        </li>
      ))}
    </ul>
  );
}

export default function BrandOpportunities() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useListMyOpportunities();
  const create = useCreateOpportunity();
  const setStatus = useSetOpportunityStatus();
  const [form, setForm] = useState(blank);
  const [showForm, setShowForm] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  if (!user) return <Redirect to="/login" />;
  if (user.role !== "brand") return <Redirect to="/dashboard" />;

  const set = (k: keyof typeof blank, v: string | boolean) => setForm({ ...form, [k]: v });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cents = form.fee.trim() ? Math.round(parseFloat(form.fee.replace(/[^0-9.]/g, "")) * 100) : null;
    try {
      await create.mutateAsync({ data: {
        type: form.type as OpportunityInputType, title: form.title, brief: form.brief, deliverables: form.deliverables, eligibility: form.eligibility || null,
        startDate: form.startDate || null, endDate: form.endDate || null, location: form.location, isRemote: form.isRemote, compensationCents: cents,
        compensationNote: form.compensationNote, expensesNote: form.expensesNote, usageRights: form.usageRights, exclusivity: form.exclusivity || "None",
        paymentTerms: form.paymentTerms, applicationDeadline: form.applicationDeadline,
      } });
      toast.success("Opportunity posted");
      setForm(blank); setShowForm(false);
      await qc.invalidateQueries({ queryKey: getListMyOpportunitiesQueryKey() });
    } catch (err) { toast.error(errorMessage(err)); }
  };
  const toggleStatus = async (o: Opportunity) => {
    try { await setStatus.mutateAsync({ opportunityId: o.id, data: { status: o.status === "open" ? "closed" : "open" } }); await qc.invalidateQueries({ queryKey: getListMyOpportunitiesQueryKey() }); }
    catch (err) { toast.error(errorMessage(err)); }
  };

  const field = (id: keyof typeof blank, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-2"><label htmlFor={`f-${id}`} className="text-sm font-medium">{label}</label>
      <Input id={`f-${id}`} value={String(form[id])} onChange={(e) => set(id, e.target.value)} className="bg-background" {...props} /></div>
  );
  const area = (id: keyof typeof blank, label: string, rows = 3, min = 5) => (
    <div className="space-y-2"><label htmlFor={`f-${id}`} className="text-sm font-medium">{label}</label>
      <Textarea id={`f-${id}`} rows={rows} value={String(form[id])} onChange={(e) => set(id, e.target.value)} required minLength={min} className="bg-background" /></div>
  );

  return (
    <PortalShell>
      <PageHeader eyebrow="For brands and organisers" title="Your opportunities">Post a clear brief with every material term. Models see all of it before they apply, and you can respond to each applicant.</PageHeader>
      <div><Button className="gap-2" onClick={() => setShowForm(!showForm)} aria-expanded={showForm}><Plus className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />{showForm ? "Close form" : "Post an opportunity"}</Button></div>

      {showForm && (
        <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-5">
          <h2 className="text-2xl">New opportunity</h2>
          <p className="text-sm text-muted-foreground">Terms cannot be edited after posting, so models are never surprised. Do not describe any opportunity as guaranteed income.</p>
          <div className="grid sm:grid-cols-2 gap-5">
            <div className="space-y-2"><label htmlFor="f-type" className="text-sm font-medium">Type</label>
              <select id="f-type" value={form.type} onChange={(e) => set("type", e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{OPPORTUNITY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
            {field("title", "Title", { required: true, minLength: 5, maxLength: 120 })}
          </div>
          {area("brief", "Brief", 4, 20)}
          {area("deliverables", "Deliverables")}
          {area("eligibility", "Who can apply (optional)", 2, 0)}
          <div className="grid sm:grid-cols-3 gap-5">
            {field("startDate", "Start date", { type: "date" })}{field("endDate", "End date", { type: "date" })}{field("applicationDeadline", "Apply by", { type: "date", required: true })}
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            {field("location", "Location", { maxLength: 160, placeholder: "City and venue area" })}
            <label className="flex items-center gap-2 text-sm self-end pb-2"><input type="checkbox" checked={form.isRemote} onChange={(e) => set("isRemote", e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />This work is remote</label>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            {field("fee", "Offered fee in rand (leave blank if not stated)", { inputMode: "decimal" })}
            {field("compensationNote", "Fee note", { maxLength: 500, placeholder: "e.g. flat fee, per day" })}
          </div>
          {area("expensesNote", "Expenses covered", 2, 0)}
          {area("usageRights", "Usage rights: assets, channels, territory, duration, paid ads", 3, 5)}
          {field("exclusivity", "Exclusivity (write None if there is none)", { maxLength: 500 })}
          {area("paymentTerms", "Payment terms: who pays, when, how", 2, 5)}
          <Button type="submit" disabled={create.isPending}>{create.isPending ? "Posting" : "Post opportunity"}</Button>
        </form>
      )}

      {isLoading ? <LoadingBlock /> : error ? <ErrorBlock onRetry={() => refetch()} /> : !data?.length ? (
        <EmptyBlock icon={<Briefcase className="h-8 w-8" strokeWidth={1.9} />} title="You have not posted anything yet">Post an opportunity to start receiving applications from verified models.</EmptyBlock>
      ) : (
        <ul className="space-y-4">
          {data.map((o) => (
            <li key={o.id} className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div><p className="text-xs font-semibold uppercase tracking-widest text-primary">{opportunityTypeLabel(o.type)}</p><h3 className="text-xl font-serif font-bold">{o.title}</h3>
                  <p className="text-sm text-muted-foreground">Apply by {formatDay(o.applicationDeadline)} · {o.applicantCount ?? 0} applicant{o.applicantCount === 1 ? "" : "s"}{o.reportCount ? ` · ${o.reportCount} report${o.reportCount === 1 ? "" : "s"} under review` : ""}</p></div>
                <StatusPill status={o.status} kind="listing" />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => setOpenId(openId === o.id ? null : o.id)} aria-expanded={openId === o.id}>{openId === o.id ? "Hide applicants" : "View applicants"}</Button>
                <Button size="sm" variant="ghost" onClick={() => toggleStatus(o)} disabled={setStatus.isPending}>{o.status === "open" ? "Close applications" : "Reopen"}</Button>
              </div>
              {openId === o.id && <Applicants o={o} />}
            </li>
          ))}
        </ul>
      )}
    </PortalShell>
  );
}
