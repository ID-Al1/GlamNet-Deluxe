import { useState } from "react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListOwnerDeletionRequestsQueryKey, useApproveDeletionRequest, useListOwnerDeletionRequests, useRejectDeletionRequest,
} from "@workspace/api-client-react";
import type { OwnerDeletionRequest } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { apiErrorMessage } from "@/lib/api-error";
import { Inbox } from "lucide-react";
import { toast } from "sonner";

const ROLE_LABELS: Record<string, string> = { client: "Client", stylist: "Artist", brand: "Brand" };

function blockerLines(b: NonNullable<OwnerDeletionRequest["blockers"]>): string[] {
  const lines: string[] = [];
  if (b.isOwnerAccount) lines.push("This is the owner account.");
  if (b.openBookings) lines.push(`${b.openBookings} booking${b.openBookings > 1 ? "s" : ""} coming up or waiting for the artist.`);
  if (b.moneyHeld) lines.push(`${b.moneyHeld} booking${b.moneyHeld > 1 ? "s" : ""} with money still held or disputed.`);
  if (b.moneyOwed) lines.push(`${b.moneyOwed} payout${b.moneyOwed > 1 ? "s" : ""} still owed to this artist.`);
  if (b.openComplaints) lines.push(`${b.openComplaints} complaint${b.openComplaints > 1 ? "s" : ""} still open.`);
  return lines;
}

export default function OwnerDeletions() {
  const qc = useQueryClient();
  const { data, isLoading } = useListOwnerDeletionRequests();
  const [approving, setApproving] = useState<OwnerDeletionRequest | null>(null);
  const [rejecting, setRejecting] = useState<OwnerDeletionRequest | null>(null);
  const [reason, setReason] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: getListOwnerDeletionRequestsQueryKey() });

  const approve = useApproveDeletionRequest({
    mutation: {
      onSuccess: (result) => {
        setApproving(null); refresh();
        if (result.idDocumentDeleted) toast.success("Deleted. Remember to delete this person in your payment provider too.");
        else toast.warning("Deleted from Bonisa, but the stored ID document could not be removed automatically. Delete that file by hand, and delete this person in your payment provider.", { duration: 12000 });
      },
      onError: (e) => { setApproving(null); refresh(); toast.error(apiErrorMessage(e)); },
    },
  });
  const reject = useRejectDeletionRequest({
    mutation: {
      onSuccess: () => { setRejecting(null); setReason(""); refresh(); toast.success("Declined. The person will see your reason."); },
      onError: (e) => toast.error(apiErrorMessage(e)),
    },
  });

  const waiting = (data ?? []).filter((r) => r.status === "pending");
  const done = (data ?? []).filter((r) => r.status !== "pending");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-bold">Deletion requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">People asking Bonisa to delete their personal information. Nothing is deleted until you approve it.</p>
      </div>

      {isLoading && <Skeleton className="h-32 w-full" />}
      {data && waiting.length === 0 && (
        <Card className="bg-card"><CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground"><Inbox className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />No requests waiting.</CardContent></Card>
      )}

      <div className="space-y-3">
        {waiting.map((r) => {
          const lines = r.blockers ? blockerLines(r.blockers) : [];
          return (
            <Card key={r.id} className="bg-card" data-testid={`deletion-${r.id}`}>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{ROLE_LABELS[r.role] ?? r.role} · {r.email} · asked {format(new Date(r.requestedAt), "d MMM yyyy")}</p>
                  </div>
                  <Badge variant="outline">Waiting</Badge>
                </div>
                {r.userNote && <p className="rounded-md bg-muted/50 p-3 text-sm">"{r.userNote}"</p>}
                {lines.length > 0 ? (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                    <p className="font-medium">Not possible yet</p>
                    <ul className="mt-1 list-disc pl-5 text-muted-foreground">{lines.map((l) => <li key={l}>{l}</li>)}</ul>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nothing is owed or in progress. This can be approved.</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" disabled={lines.length > 0 || approve.isPending} onClick={() => setApproving(r)} data-testid={`deletion-approve-${r.id}`}>Approve and delete</Button>
                  <Button size="sm" variant="outline" onClick={() => setRejecting(r)} data-testid={`deletion-reject-${r.id}`}>Decline with a reason</Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {done.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Handled</h2>
          {done.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 text-sm">
              <span className="min-w-0 truncate">{r.name} · {ROLE_LABELS[r.role] ?? r.role}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {r.status === "completed" ? "Deleted" : r.status === "rejected" ? "Declined" : "Withdrawn"}
                {r.handledAt ? `, ${format(new Date(r.handledAt), "d MMM yyyy")}` : ""}
              </span>
            </div>
          ))}
        </section>
      )}

      <Dialog open={!!approving} onOpenChange={(o) => !o && setApproving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {approving?.name}'s information?</DialogTitle>
            <DialogDescription>
              Their name, email, phone, photo, chat words, bank details and ID details are removed, and they can never sign in again. Booking and payment records stay, without their name. This cannot be undone. Afterwards, also delete them in your payment provider.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproving(null)}>Cancel</Button>
            <Button variant="destructive" disabled={approve.isPending} onClick={() => approving && approve.mutate({ requestId: approving.id })} data-testid="deletion-confirm-approve">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline {rejecting?.name}'s request</DialogTitle>
            <DialogDescription>They will read your reason word for word, so say what they can do next.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Reason</Label>
            <Textarea id="reject-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={3} data-testid="deletion-reason" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button disabled={!reason.trim() || reject.isPending} onClick={() => rejecting && reject.mutate({ requestId: rejecting.id, data: { note: reason.trim() } })} data-testid="deletion-confirm-reject">Send reason</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
