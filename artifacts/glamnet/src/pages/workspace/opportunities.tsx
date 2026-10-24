import { Briefcase, ShieldAlert } from "lucide-react";
import { Link } from "wouter";
import { useListOpportunities, useListMySavedOpportunities, useSaveOpportunity, useUnsaveOpportunity, getListOpportunitiesQueryKey, getListMySavedOpportunitiesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ModelLayout } from "@/components/layout/model-layout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OpportunityCard } from "@/components/portal/opportunity-card";
import { EmptyBlock, ErrorBlock, LoadingBlock, PageHeader } from "@/components/portal/states";
import { useModelProfile } from "@/lib/model-profile";
import { errorMessage } from "@/lib/portal";

export default function WorkspaceOpportunities() {
  const { profile } = useModelProfile();
  const open = useListOpportunities();
  const saved = useListMySavedOpportunities();
  const save = useSaveOpportunity();
  const unsave = useUnsaveOpportunity();
  const qc = useQueryClient();

  const toggle = async (id: string, isSaved: boolean | null | undefined) => {
    try {
      if (isSaved) await unsave.mutateAsync({ opportunityId: id }); else await save.mutateAsync({ opportunityId: id });
      await Promise.all([qc.invalidateQueries({ queryKey: getListOpportunitiesQueryKey() }), qc.invalidateQueries({ queryKey: getListMySavedOpportunitiesQueryKey() })]);
    } catch (err) { toast.error(errorMessage(err)); }
  };
  const list = (q: typeof open, empty: string) => q.isLoading ? <LoadingBlock /> : q.error ? <ErrorBlock onRetry={() => q.refetch()} /> : !q.data?.length ? (
    <EmptyBlock icon={<Briefcase className="h-8 w-8" strokeWidth={1.9} />} title={empty}>Open opportunities from brands and organisers appear here.</EmptyBlock>
  ) : <div className="grid md:grid-cols-2 gap-5">{q.data.map((o) => <OpportunityCard key={o.id} o={o} onToggleSave={() => toggle(o.id, o.isSaved)} saving={save.isPending || unsave.isPending} />)}</div>;

  return (
    <ModelLayout>
      <PageHeader eyebrow="Opportunities" title="Find paid work">Read every term before you apply. You can save, apply, decline or withdraw. Nothing here is guaranteed income.</PageHeader>
      {profile && profile.verificationStatus !== "verified" && (
        <div className="rounded-2xl border border-gold/50 bg-gold/10 p-5 flex gap-3 items-start" role="note">
          <ShieldAlert className="h-5 w-5 text-primary shrink-0 mt-0.5" strokeWidth={1.9} aria-hidden="true" />
          <div className="space-y-2 text-sm"><p>You can browse and save opportunities now. To apply, your profile must be verified by Bonisa.</p><Link href="/workspace/portfolio"><Button size="sm" variant="outline">Go to verification</Button></Link></div>
        </div>
      )}
      <Tabs defaultValue="open" className="space-y-6">
        <TabsList><TabsTrigger value="open">Open</TabsTrigger><TabsTrigger value="saved">Saved{saved.data?.length ? ` (${saved.data.length})` : ""}</TabsTrigger></TabsList>
        <TabsContent value="open">{list(open, "No opportunities are open right now")}</TabsContent>
        <TabsContent value="saved">{list(saved as unknown as typeof open, "You have not saved anything")}</TabsContent>
      </Tabs>
    </ModelLayout>
  );
}
