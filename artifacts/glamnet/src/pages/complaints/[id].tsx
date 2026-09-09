import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useGetComplaint, getComplaintEvidence } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, Image as ImageIcon, Video, Loader2, Download } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

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

function EvidenceIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) return <ImageIcon className="w-5 h-5 text-primary" strokeWidth={1.9} />;
  if (mimeType.startsWith("video/")) return <Video className="w-5 h-5 text-primary" strokeWidth={1.9} />;
  return <FileText className="w-5 h-5 text-primary" strokeWidth={1.9} />;
}

function EvidenceItem({ file }: { file: { id: string, mimeType: string } }) {
  const [downloading, setDownloading] = useState(false);

  const handleOpen = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (downloading) return;
    setDownloading(true);
    try {
      const blob = await getComplaintEvidence(file.id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      // Clean up after a short delay so the browser can open it
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      toast.error("Failed to load evidence file.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <button
      key={file.id}
      onClick={handleOpen}
      disabled={downloading}
      className="text-left flex items-center gap-3 p-3 bg-card border border-border/50 rounded-xl hover:border-primary/40 hover:bg-muted/20 transition-colors w-full relative"
    >
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <EvidenceIcon mimeType={file.mimeType} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">Attachment</p>
        <p className="text-xs text-muted-foreground">{file.mimeType.split('/')[1]?.toUpperCase()}</p>
      </div>
      {downloading && <Loader2 strokeWidth={1.9} className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />}
    </button>
  );
}

export default function ComplaintDetail() {
  const [, params] = useRoute("/complaints/:id");
  const complaintId = params?.id || "";

  const { data: complaint, isLoading, error } = useGetComplaint(complaintId);

  if (error) {
    return (
      <div className="container max-w-2xl px-4 py-16 mx-auto text-center">
        <h2 className="text-2xl font-serif mb-4">Case Not Found</h2>
        <p className="text-muted-foreground mb-8">This case may not exist or you do not have permission to view it.</p>
        <Link href="/complaints">
          <Button variant="outline" className="rounded-full">Back to My Cases</Button>
        </Link>
      </div>
    );
  }

  if (isLoading || !complaint) {
    return (
      <div className="container max-w-2xl px-4 py-8 mx-auto space-y-6">
        <div className="h-6 w-32 bg-muted animate-pulse rounded" />
        <div className="h-40 w-full bg-muted/30 animate-pulse rounded-2xl" />
        <div className="h-64 w-full bg-muted/30 animate-pulse rounded-2xl" />
      </div>
    );
  }

  const statusInfo = STATUS_MAP[complaint.status] || STATUS_MAP.new;
  const categoryLabel = CATEGORY_LABELS[complaint.category] || complaint.category;

  return (
    <div className="container max-w-2xl px-4 py-8 mx-auto">
      <Link href="/complaints" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft strokeWidth={1.9} className="w-4 h-4 mr-1" /> Back to My Cases
      </Link>

      <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm mb-6">
        <div className="p-6 border-b border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/10">
          <div>
            <p className="text-xs font-mono font-medium text-muted-foreground mb-1 uppercase tracking-wider">Case Reference</p>
            <h1 className="text-2xl font-bold font-serif">{complaint.caseNumber}</h1>
          </div>
          <div className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${statusInfo.styles}`}>
            {statusInfo.label}
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Category</p>
              <p className="font-medium text-sm">{categoryLabel}</p>
            </div>
            {complaint.appointmentId && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Booking ID</p>
                <Link href={`/appointments/${complaint.appointmentId}`} className="font-mono text-sm text-primary hover:underline">
                  {complaint.appointmentId.slice(0, 8)}...
                </Link>
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Description</p>
            <div className="p-4 bg-muted/30 rounded-xl text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
              {complaint.description}
            </div>
          </div>
        </div>
      </div>

      {complaint.evidence && complaint.evidence.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground px-2">Attached Evidence</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {complaint.evidence.map((file) => (
              <EvidenceItem key={file.id} file={file} />
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 p-4 rounded-xl bg-primary/5 border border-primary/10 text-sm text-primary/80 text-center">
        Bonisa support is reviewing this case. You will receive an email update when there is progress.
      </div>
    </div>
  );
}