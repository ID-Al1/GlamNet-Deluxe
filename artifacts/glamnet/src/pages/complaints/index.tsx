import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import { useListComplaints } from "@workspace/api-client-react";
import { ShieldAlert, ChevronRight, Inbox, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_MAP: Record<string, { label: string, styles: string }> = {
  new: { label: "Under review", styles: "bg-secondary/10 text-secondary-foreground border border-secondary/20" },
  under_review: { label: "Under review", styles: "bg-secondary/10 text-secondary-foreground border border-secondary/20" },
  waiting_for_client: { label: "Action needed", styles: "bg-primary/10 text-primary border border-primary/20" },
  waiting_for_artist: { label: "Waiting for artist", styles: "bg-muted text-muted-foreground border border-border" },
  resolved: { label: "Resolved", styles: "bg-muted text-muted-foreground border border-border" },
  escalated: { label: "Escalated", styles: "bg-destructive/10 text-destructive border border-destructive/20" },
  closed: { label: "Closed", styles: "bg-muted text-muted-foreground border border-border" },
};

const CATEGORY_LABELS: Record<string, string> = {
  didnt_arrive: "Artist didn't arrive",
  poor_service: "Poor service quality",
  payment_issue: "Payment issue",
  refund_request: "Refund request",
  behaviour: "Inappropriate behaviour",
  safety_concern: "Safety concern",
  false_review: "False review",
  harassment: "Harassment",
  other: "Other",
};

export default function ComplaintsList() {
  const { user } = useAuth();
  const { data: complaints, isLoading, error } = useListComplaints();

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive mb-4">Could not load your cases.</p>
        <Button variant="outline" onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl px-4 py-8 mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold">My Cases</h1>
          <p className="text-sm text-muted-foreground mt-1">Track complaints and support requests.</p>
        </div>
        <Link href="/complaints/new">
          <Button className="rounded-full gap-2">
            <Plus strokeWidth={1.9} className="w-4 h-4" /> Open New Case
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 rounded-2xl bg-muted/30 animate-pulse border border-border/50" />
          ))}
        </div>
      ) : complaints && complaints.length > 0 ? (
        <div className="space-y-3">
          {complaints.map(complaint => {
            const statusInfo = STATUS_MAP[complaint.status] || STATUS_MAP.new;
            const categoryLabel = CATEGORY_LABELS[complaint.category] || complaint.category;

            return (
              <Link key={complaint.id} href={`/complaints/${complaint.id}`}>
                <div className="bg-card rounded-2xl p-5 border border-border/50 shadow-sm hover:border-primary/30 transition-colors cursor-pointer flex items-center justify-between group">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{complaint.caseNumber}</span>
                      <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${statusInfo.styles}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{categoryLabel}</p>
                      <p className="text-sm text-muted-foreground line-clamp-1 max-w-md">{complaint.description}</p>
                    </div>
                  </div>
                  <ChevronRight strokeWidth={1.9} className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 px-4 border rounded-2xl border-dashed border-border/50 bg-muted/10">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Inbox strokeWidth={1.9} className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No active cases</h2>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
            If you experience an issue with a booking or a platform user, you can open a case here for Bonisa support to review.
          </p>
          <Link href="/complaints/new">
            <Button variant="outline" className="rounded-full">Open New Case</Button>
          </Link>
        </div>
      )}
    </div>
  );
}