import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useListOwnerComplaints, ComplaintStatus } from "@workspace/api-client-react";
import { ShieldAlert, Inbox, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

const STATUS_MAP: Record<string, { label: string, styles: string }> = {
  new: { label: "New", styles: "bg-secondary/10 text-secondary-foreground border border-secondary/20" },
  under_review: { label: "Under review", styles: "bg-primary/10 text-primary border border-primary/20" },
  waiting_for_client: { label: "Waiting (Client)", styles: "bg-muted text-muted-foreground border border-border" },
  waiting_for_artist: { label: "Waiting (Artist)", styles: "bg-muted text-muted-foreground border border-border" },
  resolved: { label: "Resolved", styles: "bg-muted text-muted-foreground border border-border" },
  escalated: { label: "Escalated", styles: "bg-destructive/10 text-destructive border border-destructive/20" },
  closed: { label: "Closed", styles: "bg-muted text-muted-foreground border border-border" },
};

const CATEGORY_LABELS: Record<string, string> = {
  didnt_arrive: "No-show",
  poor_service: "Quality",
  payment_issue: "Payment",
  refund_request: "Refund",
  behaviour: "Behaviour",
  safety_concern: "Safety",
  false_review: "Review",
  harassment: "Harassment",
  other: "Other",
};

export default function OwnerComplaintsList() {
  const [, setLocation] = useLocation();
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [search, setSearch] = useState("");

  const { data: complaints, isLoading, error } = useListOwnerComplaints({
    status: statusFilter !== "active" && statusFilter !== "all" ? statusFilter as ComplaintStatus : undefined
  });

  const filteredComplaints = complaints?.filter(c => {
    if (statusFilter === "active" && (c.status === "resolved" || c.status === "closed")) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        c.caseNumber.toLowerCase().includes(q) ||
        (c.appointmentId && c.appointmentId.toLowerCase().includes(q)) ||
        c.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl mb-2">Case Workspace</h1>
          <p className="text-sm text-muted-foreground">
            Manage complaints, disputes, and safety reports.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-[240px]">
            <Search strokeWidth={1.9} className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search cases..."
              className="pl-9 h-9 text-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active Cases</SelectItem>
              <SelectItem value="all">All Cases</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="escalated">Escalated</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? (
        <div className="p-8 text-center bg-destructive/10 text-destructive rounded-xl border border-destructive/20">
          <p className="font-medium">Failed to load cases.</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-[88px] w-full rounded-xl" />
          ))}
        </div>
      ) : filteredComplaints && filteredComplaints.length > 0 ? (
        <div className="bg-card border border-border/60 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase tracking-wider bg-muted/20 border-b border-border/40">
              <tr>
                <th className="px-6 py-4 font-medium">Case</th>
                <th className="px-6 py-4 font-medium">Category</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium hidden md:table-cell">Opened</th>
                <th className="px-6 py-4 font-medium text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filteredComplaints.map(complaint => {
                const statusInfo = STATUS_MAP[complaint.status] || STATUS_MAP.new;
                const categoryLabel = CATEGORY_LABELS[complaint.category] || complaint.category;

                return (
                  <tr key={complaint.id} className="hover:bg-muted/10 transition-colors group cursor-pointer" onClick={() => setLocation(`/owner/complaints/${complaint.id}`)}>
                    <td className="px-6 py-4">
                      <div className="font-mono font-medium text-foreground">{complaint.caseNumber}</div>
                      <div className="text-xs text-muted-foreground capitalize mt-0.5">{complaint.complainantRole || 'User'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium">{categoryLabel}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[200px] mt-0.5">{complaint.description}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${statusInfo.styles}`}>
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground hidden md:table-cell">
                      {complaint.createdAt ? format(new Date(complaint.createdAt), "MMM d, yyyy") : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <ChevronRight strokeWidth={1.9} className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors inline-block" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-card border border-border/50 rounded-xl border-dashed">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Inbox strokeWidth={1.9} className="w-6 h-6 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-serif mb-2 text-foreground">No cases found</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            {search || statusFilter !== "active" ? "Try adjusting your filters or search terms." : "The queue is clear. No active complaints require your attention."}
          </p>
        </div>
      )}
    </div>
  );
}