import { Link } from "wouter";
import { useListMyApplications } from "@workspace/api-client-react";
import { ModelLayout } from "@/components/layout/model-layout";
import { Button } from "@/components/ui/button";
import { EmptyBlock, ErrorBlock, LoadingBlock, NotLiveNotice, PageHeader } from "@/components/portal/states";
import { Clapperboard } from "lucide-react";

const STAGES = ["Draft", "Open", "Applications and invitations", "Terms agreed", "In progress", "Submitted", "Approved or disputed", "Payment due", "Paid", "Closed"];

export default function Campaigns() {
  const apps = useListMyApplications();
  const accepted = (apps.data ?? []).filter((a) => a.status === "accepted");
  return (
    <ModelLayout>
      <PageHeader eyebrow="Campaigns" title="Your campaigns" />
      <NotLiveNotice title="Campaign workspace: not live yet">
        The workspace that tracks a campaign from agreed terms through delivery and payment is still to be built. Until it is, no campaign, status or deadline shown anywhere on Bonisa is tracked here. Agree scope, fee, expenses, deadlines and rights with the organiser in writing and keep your own copy.
      </NotLiveNotice>

      <section className="space-y-4" aria-labelledby="acc-h">
        <h2 id="acc-h" className="text-2xl">Accepted applications</h2>
        {apps.isLoading ? <LoadingBlock /> : apps.error ? <ErrorBlock onRetry={() => apps.refetch()} /> : !accepted.length ? (
          <EmptyBlock icon={<Clapperboard className="h-8 w-8" strokeWidth={1.9} />} title="No accepted applications">When an organiser accepts you, it appears here as the starting point for a campaign.</EmptyBlock>
        ) : (
          <ul className="space-y-3">
            {accepted.map((a) => (
              <li key={a.id} className="rounded-2xl border border-border bg-card p-5 space-y-2">
                <h3 className="text-lg font-serif font-bold">{a.opportunity.title}</h3>
                <p className="text-sm text-muted-foreground">{a.opportunity.organiserName}. Accepted, but not yet a recorded agreement. Confirm fee, expenses, deadlines, usage rights and payment terms in writing before any work starts.</p>
                <Link href={`/opportunities/${a.opportunity.id}`}><Button variant="outline" size="sm">Review the listing terms</Button></Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4" aria-labelledby="stages-h">
        <h2 id="stages-h" className="text-2xl">How a campaign will move</h2>
        <p className="text-sm text-muted-foreground max-w-2xl">This is the planned path. It is shown so you know what to expect, not as live tracking. Team campaigns, where a model, makeup artist, hairstylist, nail technician and photographer each agree their own role and fee, are part of the plan.</p>
        <ol className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {STAGES.map((s, i) => <li key={s} className="rounded-xl border border-dashed border-border bg-card/60 px-4 py-3 text-sm"><span className="text-gold font-semibold mr-2">{i + 1}</span>{s}</li>)}
        </ol>
      </section>
    </ModelLayout>
  );
}
