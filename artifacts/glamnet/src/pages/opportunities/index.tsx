import { useState } from "react";
import { Briefcase } from "lucide-react";
import { useListOpportunities, useSaveOpportunity, useUnsaveOpportunity, getListOpportunitiesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { PortalShell } from "@/components/portal/shell";
import { OpportunityCard } from "@/components/portal/opportunity-card";
import { EmptyBlock, ErrorBlock, LoadingBlock, PageHeader } from "@/components/portal/states";
import { OPPORTUNITY_TYPES, errorMessage } from "@/lib/portal";

export default function Opportunities() {
  const { user } = useAuth();
  const [type, setType] = useState("");
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useListOpportunities(type ? { type } : undefined);
  const save = useSaveOpportunity();
  const unsave = useUnsaveOpportunity();

  const toggle = async (id: string, isSaved: boolean | null | undefined) => {
    try {
      if (isSaved) await unsave.mutateAsync({ opportunityId: id }); else await save.mutateAsync({ opportunityId: id });
      await qc.invalidateQueries({ queryKey: getListOpportunitiesQueryKey() });
    } catch (err) { toast.error(errorMessage(err)); }
  };

  return (
    <PortalShell>
      <PageHeader eyebrow="Campaigns and opportunities" title="Paid opportunities">
        Every listing shows who is organising it, what is expected, what is offered, how usage rights work and when payment is due, before you apply. Nothing here is a guaranteed booking or guaranteed income.
      </PageHeader>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by type">
        {[{ value: "", label: "All" }, ...OPPORTUNITY_TYPES].map((t) => (
          <button key={t.value || "all"} onClick={() => setType(t.value)} aria-pressed={type === t.value}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${type === t.value ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? <LoadingBlock label="Loading opportunities" /> : error ? <ErrorBlock message="We could not load opportunities." onRetry={() => refetch()} /> : !data?.length ? (
        <EmptyBlock icon={<Briefcase className="h-8 w-8" strokeWidth={1.9} />} title={type ? "Nothing open in this category" : "No opportunities are open right now"}>
          Brands and organisers post here when they are looking for talent. Check back soon.
        </EmptyBlock>
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {data.map((o) => (
            <OpportunityCard key={o.id} o={o} onToggleSave={user?.role === "model" ? () => toggle(o.id, o.isSaved) : undefined} saving={save.isPending || unsave.isPending} />
          ))}
        </div>
      )}
    </PortalShell>
  );
}
