import { Flag, ScrollText } from "lucide-react";
import { useCloseOpportunityAsOwner, useListAuditEvents, useListOpportunityReports, getListOpportunityReportsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/portal/states";
import { errorMessage } from "@/lib/portal";

export default function OwnerOversight() {
  const reports = useListOpportunityReports();
  const audit = useListAuditEvents();
  const close = useCloseOpportunityAsOwner();
  const qc = useQueryClient();

  return (
    <div className="space-y-6">
      <div className="space-y-2"><h1 className="text-3xl font-serif font-bold">Oversight</h1><p className="text-muted-foreground">Reported listings, and the access log of sensitive views and changes.</p></div>
      <Tabs defaultValue="reports" className="space-y-5">
        <TabsList><TabsTrigger value="reports">Reported listings</TabsTrigger><TabsTrigger value="log">Access log</TabsTrigger></TabsList>
        <TabsContent value="reports">
          {reports.isLoading ? <LoadingBlock /> : reports.error ? <ErrorBlock onRetry={() => reports.refetch()} /> : !reports.data?.length ? (
            <EmptyBlock icon={<Flag className="h-8 w-8" strokeWidth={1.9} />} title="Nothing has been reported">Reported opportunities appear here, most reported first.</EmptyBlock>
          ) : (
            <ul className="space-y-3">{reports.data.map((r) => (
              <li key={r.opportunityId} className="rounded-2xl border border-border bg-card p-5 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap"><div><h3 className="font-serif font-bold text-lg">{r.title}</h3><p className="text-sm text-muted-foreground">{r.organiserName} · {r.reportCount} report{r.reportCount === 1 ? "" : "s"} · {r.status}</p></div>
                  {r.status === "open" && <Button size="sm" variant="outline" disabled={close.isPending} onClick={async () => { try { await close.mutateAsync({ opportunityId: r.opportunityId }); toast.success("Listing closed"); await qc.invalidateQueries({ queryKey: getListOpportunityReportsQueryKey() }); } catch (err) { toast.error(errorMessage(err)); } }}>Close listing</Button>}</div>
                <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">{r.reasons.map((x, i) => <li key={i}>{x}</li>)}</ul>
              </li>))}</ul>
          )}
        </TabsContent>
        <TabsContent value="log">
          {audit.isLoading ? <LoadingBlock /> : audit.error ? <ErrorBlock onRetry={() => audit.refetch()} /> : !audit.data?.length ? (
            <EmptyBlock icon={<ScrollText className="h-8 w-8" strokeWidth={1.9} />} title="No events yet">Sensitive views and changes are recorded here.</EmptyBlock>
          ) : (
            <div className="rounded-2xl border border-border bg-card overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Most recent 200 audit events</caption>
                <thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border"><th className="p-3">When</th><th className="p-3">Who</th><th className="p-3">Action</th><th className="p-3">Target</th></tr></thead>
                <tbody>{audit.data.map((e) => (
                  <tr key={e.id} className="border-b border-border last:border-0 align-top">
                    <td className="p-3 whitespace-nowrap">{new Date(e.createdAt).toLocaleString("en-ZA")}</td>
                    <td className="p-3">{e.actorName ?? "Unknown"} <span className="text-muted-foreground">({e.actorRole})</span></td>
                    <td className="p-3 font-medium">{e.action}</td>
                    <td className="p-3 text-muted-foreground">{e.targetType} <span className="font-mono text-xs">{e.targetId.slice(0, 8)}</span></td>
                  </tr>))}</tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
