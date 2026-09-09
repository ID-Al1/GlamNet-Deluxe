import { useState } from "react";
import { useRoute, Link } from "wouter";
import {
  useGetOwnerComplaint,
  useOwnerComplaintAction,
  getGetOwnerComplaintQueryKey,
  OwnerComplaintActionAction,
  getComplaintEvidence,
  getGetOwnerPayoutsQueryKey,
  getGetOwnerPaymentsOverviewQueryKey,
  getListOwnerComplaintsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowLeft,
  ShieldAlert,
  FileText,
  Image as ImageIcon,
  Video,
  CheckCircle,
  Ban,
  Clock,
  RotateCcw,
  Banknote,
  Send,
  UserX,
  CreditCard,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

function EvidenceIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) return <ImageIcon className="w-4 h-4 text-primary" strokeWidth={1.9} />;
  if (mimeType.startsWith("video/")) return <Video className="w-4 h-4 text-primary" strokeWidth={1.9} />;
  return <FileText className="w-4 h-4 text-primary" strokeWidth={1.9} />;
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
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      toast.error("Failed to load evidence file.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <button
      onClick={handleOpen}
      disabled={downloading}
      className="text-left flex items-center gap-2 p-2 bg-card border border-border/50 rounded-lg hover:border-primary/40 transition-colors w-full relative"
    >
      <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
        <EvidenceIcon mimeType={file.mimeType} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium truncate">{file.mimeType.split('/')[1]?.toUpperCase()}</p>
      </div>
      {downloading && <Loader2 strokeWidth={1.9} className="w-3 h-3 animate-spin text-muted-foreground shrink-0" />}
    </button>
  );
}

export default function OwnerComplaintWorkspace() {
  const [, params] = useRoute("/owner/complaints/:id");
  const complaintId = params?.id || "";
  const queryClient = useQueryClient();

  const { data: complaint, isLoading, error } = useGetOwnerComplaint(complaintId);
  const actionMutation = useOwnerComplaintAction();

  const [noteText, setNoteText] = useState("");
  const [suspendDialog, setSuspendDialog] = useState<{ open: boolean, targetId: string, name: string }>({ open: false, targetId: "", name: "" });
  const [suspendReason, setSuspendReason] = useState("");
  const [refundDialog, setRefundDialog] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");

  if (error) {
    return (
      <div className="p-8 text-center bg-card rounded-xl border border-border/50 max-w-2xl mx-auto mt-8">
        <ShieldAlert strokeWidth={1.9} className="w-8 h-8 text-destructive mx-auto mb-4" />
        <h2 className="text-xl font-serif mb-2">Case Not Found</h2>
        <p className="text-muted-foreground mb-6">{(error as any)?.data?.error || "This case does not exist or you lack permission."}</p>
        <Link href="/owner/complaints"><Button variant="outline">Back to Cases</Button></Link>
      </div>
    );
  }

  if (isLoading || !complaint) {
    return <div className="p-8 text-center text-muted-foreground">Loading workspace...</div>;
  }

  const statusInfo = STATUS_MAP[complaint.status] || STATUS_MAP.new;
  const categoryLabel = CATEGORY_LABELS[complaint.category] || complaint.category;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getGetOwnerComplaintQueryKey(complaintId) });
    queryClient.invalidateQueries({ queryKey: getListOwnerComplaintsQueryKey() });
    queryClient.invalidateQueries({ queryKey: ["/api/owner/command-centre"] });
    queryClient.invalidateQueries({ queryKey: getGetOwnerPayoutsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetOwnerPaymentsOverviewQueryKey() });
  };

  const handleStatusChange = (newStatus: string) => {
    actionMutation.mutate({
      complaintId,
      data: { action: "status" as OwnerComplaintActionAction, status: newStatus }
    }, {
      onSuccess: () => {
        toast.success(`Status updated to ${STATUS_MAP[newStatus]?.label || newStatus}`);
        invalidateAll();
      },
      onError: (err: any) => toast.error(err?.data?.error || "Failed to update status")
    });
  };

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    actionMutation.mutate({
      complaintId,
      data: { action: "note" as OwnerComplaintActionAction, note: noteText.trim() }
    }, {
      onSuccess: () => {
        setNoteText("");
        toast.success("Private note added");
        invalidateAll();
      },
      onError: (err: any) => toast.error(err?.data?.error || "Failed to add note")
    });
  };

  const handleSuspend = () => {
    if (!suspendReason.trim()) {
      toast.error("Please provide a reason for the audit log");
      return;
    }
    actionMutation.mutate({
      complaintId,
      data: { action: "suspend" as OwnerComplaintActionAction, userId: suspendDialog.targetId, note: suspendReason.trim() }
    }, {
      onSuccess: () => {
        setSuspendDialog({ open: false, targetId: "", name: "" });
        setSuspendReason("");
        toast.success(`Account suspended`);
        invalidateAll();
      },
      onError: (err: any) => toast.error(err?.data?.error || "Failed to suspend account")
    });
  };

  const handleHold = () => {
    actionMutation.mutate({
      complaintId,
      data: { action: "hold" as OwnerComplaintActionAction }
    }, {
      onSuccess: () => {
        toast.success("Payout placed on hold");
        invalidateAll();
      },
      onError: (err: any) => toast.error(err?.data?.error || "Failed to hold payout")
    });
  };

  const handleRelease = () => {
    actionMutation.mutate({
      complaintId,
      data: { action: "release" as OwnerComplaintActionAction }
    }, {
      onSuccess: () => {
        toast.success("Payout released to artist");
        invalidateAll();
      },
      onError: (err: any) => toast.error(err?.data?.error || "Failed to release payout")
    });
  };

  const handleRefund = () => {
    const amt = parseFloat(refundAmount);
    if (!refundAmount.trim() || isNaN(amt) || amt <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    actionMutation.mutate({
      complaintId,
      data: { action: "refund" as OwnerComplaintActionAction, amount: amt }
    }, {
      onSuccess: () => {
        setRefundDialog(false);
        setRefundAmount("");
        toast.success("Refund processed");
        invalidateAll();
      },
      onError: (err: any) => toast.error(err?.data?.error || "Refund failed")
    });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full pb-12">
      <Link href="/owner/complaints" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-2">
        <ArrowLeft strokeWidth={1.9} className="w-4 h-4 mr-1" /> Back to Cases
      </Link>

      <div className="flex flex-col md:flex-row gap-6">

        {/* LEFT COLUMN: Case Details */}
        <div className="w-full md:w-2/3 space-y-6">

          <div className="bg-card border border-border/60 rounded-xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-border/40 bg-muted/10 flex justify-between items-center">
              <div>
                <div className="text-xs font-mono text-muted-foreground mb-1 uppercase tracking-wider">Case {complaint.caseNumber}</div>
                <h1 className="text-xl font-bold font-serif flex items-center gap-3">
                  {categoryLabel}
                  <Select value={complaint.status} onValueChange={handleStatusChange}>
                    <SelectTrigger className={`h-7 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider w-auto border-0 focus:ring-0 focus:ring-offset-0 ${statusInfo.styles}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="under_review">Under Review</SelectItem>
                      <SelectItem value="waiting_for_client">Waiting (Client)</SelectItem>
                      <SelectItem value="waiting_for_artist">Waiting (Artist)</SelectItem>
                      <SelectItem value="escalated">Escalated</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </h1>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                Opened {complaint.createdAt ? format(new Date(complaint.createdAt), "MMM d, yyyy") : ''}
              </div>
            </div>

            <div className="p-6">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Claimant Report</h3>
              <div className="p-4 bg-muted/20 rounded-xl text-sm leading-relaxed whitespace-pre-wrap text-foreground/90 border border-border/40">
                {complaint.description}
              </div>
            </div>

            {complaint.evidence && complaint.evidence.length > 0 && (
              <div className="px-6 pb-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Evidence</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {complaint.evidence.map((file) => (
                    <EvidenceItem key={file.id} file={file} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Activity & Notes */}
          <div className="bg-card border border-border/60 rounded-xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-border/40 bg-muted/10">
              <h2 className="font-serif font-bold text-lg">Case Log</h2>
            </div>

            <div className="p-6 space-y-6">
              <div className="relative">
                <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border/50" />
                <div className="space-y-4">

                  {/* Combine activities and notes, sort chronologically */}
                  {[
                    ...(complaint.activities || []).map(a => ({ ...a, type: 'activity' as const })),
                    ...(complaint.notes || []).map(n => ({ ...n, type: 'note' as const }))
                  ]
                  .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                  .map((item) => (
                    <div key={item.id} className="relative pl-8">
                      <div className={`absolute left-0 top-1 w-[23px] h-[23px] rounded-full border-2 border-background flex items-center justify-center ${item.type === 'note' ? 'bg-secondary/20 text-secondary-foreground' : 'bg-muted text-muted-foreground'}`}>
                        {item.type === 'note' ? <FileText strokeWidth={1.9} className="w-3 h-3" /> : <Clock strokeWidth={1.9} className="w-3 h-3" />}
                      </div>
                      <div className={`p-3 rounded-lg text-sm ${item.type === 'note' ? 'bg-secondary/10 border border-secondary/20' : 'bg-muted/30 border border-border/30'}`}>
                        <div className="flex justify-between items-start mb-1 gap-2">
                          <span className="font-medium text-xs text-muted-foreground uppercase tracking-wider">
                            {item.type === 'note' ? 'Private Note' : (item as any).action.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {format(new Date(item.createdAt), "MMM d, HH:mm")}
                          </span>
                        </div>
                        <p className="text-foreground/90 whitespace-pre-wrap">{item.type === 'note' ? (item as any).note : (item as any).details}</p>
                      </div>
                    </div>
                  ))}

                </div>
              </div>

              <div className="pt-4 border-t border-border/40">
                <Label className="sr-only">Add private note</Label>
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Add an internal note to the audit log..."
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    className="min-h-[80px] bg-muted/10 resize-none text-sm"
                  />
                  <Button
                    className="h-auto shrink-0"
                    onClick={handleAddNote}
                    disabled={!noteText.trim() || actionMutation.isPending}
                  >
                    <Send strokeWidth={1.9} className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Context & Actions */}
        <div className="w-full md:w-1/3 space-y-6">

          {/* Parties */}
          <div className="bg-card border border-border/60 rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border/40 bg-muted/10 font-medium text-sm">Parties</div>
            <div className="p-4 space-y-4">

              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1">Complainant ({complaint.complainantRole})</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{complaint.complainant.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{complaint.complainant.userId.slice(0,8)}...</p>
                  </div>
                  {complaint.complainant.accountStatus === 'suspended' ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-destructive/10 text-destructive uppercase">Suspended</span>
                  ) : (
                    <Button variant="outline" size="sm" className="h-7 text-xs text-destructive hover:bg-destructive/10 border-destructive/30" onClick={() => setSuspendDialog({ open: true, targetId: complaint.complainant.userId, name: complaint.complainant.name })}>
                      Suspend
                    </Button>
                  )}
                </div>
              </div>

              {complaint.subject && (
                <div className="pt-3 border-t border-border/30">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1">Subject ({complaint.subject.role})</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{complaint.subject.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{complaint.subject.userId.slice(0,8)}...</p>
                    </div>
                    {complaint.subject.accountStatus === 'suspended' ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-destructive/10 text-destructive uppercase">Suspended</span>
                    ) : (
                      <Button variant="outline" size="sm" className="h-7 text-xs text-destructive hover:bg-destructive/10 border-destructive/30" onClick={() => setSuspendDialog({ open: true, targetId: complaint.subject!.userId, name: complaint.subject!.name })}>
                        Suspend
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Booking Context */}
          {complaint.appointment && (
            <div className="bg-card border border-border/60 rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-border/40 bg-muted/10 font-medium text-sm flex justify-between items-center">
                <span>Booking Context</span>
                <Link href={`/owner/payments-overview`} className="text-xs text-primary hover:underline font-normal">Ledger</Link>
              </div>
              <div className="p-4 space-y-4">

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Date</p>
                    <p className="font-medium">{format(new Date(complaint.appointment.date), "MMM d, yyyy")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="font-medium capitalize">{complaint.appointment.bookingStatus}</p>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-border/30">
                    <p className="text-xs text-muted-foreground">Service</p>
                    <p className="font-medium">{complaint.appointment.serviceName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{complaint.appointment.artistName} for {complaint.appointment.clientName}</p>
                  </div>
                </div>

                <div className="bg-muted/20 p-3 rounded-lg border border-border/40 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Collected</span>
                    <span className="font-medium">R {complaint.appointment.grossCollected.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Payout Status</span>
                    <span className="font-medium capitalize">{complaint.appointment.payoutStatus}</span>
                  </div>
                  {complaint.appointment.refundedAmount > 0 && (
                    <div className="flex justify-between text-sm text-destructive">
                      <span>Refunded</span>
                      <span className="font-medium">R {complaint.appointment.refundedAmount.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-center bg-secondary/10 text-secondary-foreground hover:bg-secondary/20 border-secondary/30"
                      onClick={handleHold}
                      disabled={complaint.appointment.payoutStatus !== 'held'}
                    >
                      Hold Payout
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-center bg-primary/10 text-primary hover:bg-primary/20 border-primary/30"
                      onClick={handleRelease}
                      disabled={complaint.appointment.payoutStatus !== 'disputed'}
                    >
                      Release
                    </Button>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2 border-primary/30 text-primary hover:bg-primary/10"
                    onClick={() => setRefundDialog(true)}
                    disabled={complaint.appointment.refundableAmount <= 0}
                  >
                    <RotateCcw strokeWidth={1.9} className="w-4 h-4" />
                    {complaint.appointment.refundableAmount > 0 ? `Refund (Max R${complaint.appointment.refundableAmount.toFixed(2)})` : 'Fully Refunded'}
                  </Button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Suspend Dialog */}
      <Dialog open={suspendDialog.open} onOpenChange={(open) => !open && setSuspendDialog({ open: false, targetId: "", name: "" })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend Account</DialogTitle>
            <DialogDescription>
              You are about to suspend <strong>{suspendDialog.name}</strong>. They will immediately lose access to the platform. Active bookings may be affected.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Audit Reason (Required)</Label>
            <Textarea
              placeholder="e.g. Violation of safety policy as established in case..."
              value={suspendReason}
              onChange={e => setSuspendReason(e.target.value)}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendDialog({ open: false, targetId: "", name: "" })}>Cancel</Button>
            <Button variant="destructive" onClick={handleSuspend} disabled={!suspendReason.trim() || actionMutation.isPending}>
              <UserX strokeWidth={1.9} className="w-4 h-4 mr-2" /> Confirm Suspension
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund Dialog */}
      <Dialog open={refundDialog} onOpenChange={setRefundDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Refund</DialogTitle>
            <DialogDescription>
              Refund the client directly via Stripe. This will deduct from the available escrow balance.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="p-3 bg-muted rounded-lg text-sm flex justify-between items-center">
              <span>Maximum Refundable</span>
              <span className="font-bold">R {complaint.appointment?.refundableAmount?.toFixed(2) || '0.00'}</span>
            </div>
            <div>
              <Label>Refund Amount (ZAR)</Label>
              <div className="relative mt-2">
                <span className="absolute left-3 top-2.5 text-muted-foreground">R</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max={complaint.appointment?.refundableAmount}
                  value={refundAmount}
                  onChange={e => setRefundAmount(e.target.value)}
                  className="pl-8"
                  placeholder={complaint.appointment?.refundableAmount?.toFixed(2)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialog(false)}>Cancel</Button>
            <Button onClick={handleRefund} disabled={!refundAmount || actionMutation.isPending}>
              Confirm Refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}