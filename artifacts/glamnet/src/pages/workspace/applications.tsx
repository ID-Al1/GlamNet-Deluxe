import { Link } from "wouter";
import { Send, MessageSquare } from "lucide-react";
import { useListMyApplications, useListMyEnquiries, useWithdrawMyApplication, getListMyApplicationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ModelLayout } from "@/components/layout/model-layout";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/portal/status-pill";
import { EmptyBlock, ErrorBlock, LoadingBlock, PageHeader } from "@/components/portal/states";
import { APPLICATION_STATUS, errorMessage, formatDay, formatRand, opportunityTypeLabel } from "@/lib/portal";

export default function Applications() {
  const apps = useListMyApplications();
  const enquiries = useListMyEnquiries();
  const withdraw = useWithdrawMyApplication();
  const qc = useQueryClient();

  const doWithdraw = async (id: string) => {
    if (!window.confirm("Withdraw this application? You can apply again later while the opportunity is open.")) return;
    try { await withdraw.mutateAsync({ applicationId: id }); toast.success("Application withdrawn"); await qc.invalidateQueries({ queryKey: getListMyApplicationsQueryKey() }); }
    catch (err) { toast.error(errorMessage(err)); }
  };

  return (
    <ModelLayout>
      <PageHeader eyebrow="Applications" title="Your applications">Every application gets an outcome you can see here. Accepted does not mean agreed: terms only bind once they are recorded in writing.</PageHeader>

      <section className="space-y-4" aria-labelledby="apps-h">
        <h2 id="apps-h" className="text-2xl">Applications</h2>
        {apps.isLoading ? <LoadingBlock /> : apps.error ? <ErrorBlock onRetry={() => apps.refetch()} /> : !apps.data?.length ? (
          <EmptyBlock icon={<Send className="h-8 w-8" strokeWidth={1.9} />} title="No applications yet" action={<Link href="/workspace/opportunities"><Button variant="outline">Browse opportunities</Button></Link>}>Once you apply, the organiser's response shows up here.</EmptyBlock>
        ) : (
          <ul className="space-y-4">
            {apps.data.map((a) => (
              <li key={a.id} className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div><p className="text-xs font-semibold uppercase tracking-widest text-primary">{opportunityTypeLabel(a.opportunity.type)}</p>
                    <h3 className="text-xl font-serif font-bold"><Link href={`/opportunities/${a.opportunity.id}`} className="hover:underline underline-offset-4">{a.opportunity.title}</Link></h3>
                    <p className="text-sm text-muted-foreground">{a.opportunity.organiserName}</p></div>
                  <StatusPill status={a.status} />
                </div>
                <p className="text-sm text-muted-foreground">{APPLICATION_STATUS[a.status]?.detail}</p>
                {a.statusNote && <blockquote className="border-l-2 border-gold pl-4 text-sm"><span className="block text-xs uppercase tracking-wider text-muted-foreground mb-1">Message from the organiser</span>{a.statusNote}</blockquote>}
                <p className="text-xs text-muted-foreground">Applied {formatDay(a.createdAt)}{a.proposedFeeCents != null ? ` · You proposed ${formatRand(a.proposedFeeCents)}` : ""}</p>
                {(a.status === "applied" || a.status === "shortlisted") && <Button variant="ghost" size="sm" onClick={() => doWithdraw(a.id)} disabled={withdraw.isPending}>Withdraw application</Button>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4" aria-labelledby="enq-h">
        <h2 id="enq-h" className="text-2xl">Enquiries to you</h2>
        {enquiries.isLoading ? <LoadingBlock /> : enquiries.error ? <ErrorBlock onRetry={() => enquiries.refetch()} /> : !enquiries.data?.length ? (
          <EmptyBlock icon={<MessageSquare className="h-8 w-8" strokeWidth={1.9} />} title="No enquiries yet">Brands can send an enquiry from your public profile once you are listed. Their contact details are not shared with you here, and you are never obliged to reply.</EmptyBlock>
        ) : (
          <ul className="space-y-3">
            {enquiries.data.map((e) => (
              <li key={e.id} className="rounded-2xl border border-border bg-card p-5 space-y-2">
                <p className="text-sm"><strong>{e.fromName}</strong> <span className="text-muted-foreground">· {e.fromRole} · {formatDay(e.createdAt)}</span></p>
                <p className="text-sm whitespace-pre-line">{e.message}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </ModelLayout>
  );
}
