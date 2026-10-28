import { useState } from "react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetMyDeletionRequestQueryKey, useGetMyDeletionRequest, useRequestAccountDeletion, useWithdrawDeletionRequest,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api-error";

/**
 * A person's right to ask Bonisa to delete their personal information (POPIA).
 * Asking only sends a request. The owner checks that nothing is owed or in progress
 * and then approves it, so no one loses money by deleting at the wrong moment.
 */
export function DeleteAccountCard() {
  const qc = useQueryClient();
  const { data, isLoading } = useGetMyDeletionRequest();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: getGetMyDeletionRequestQueryKey() });

  const request = useRequestAccountDeletion({
    mutation: {
      onSuccess: () => { setOpen(false); setNote(""); refresh(); toast.success("Request received. We will reply within 30 days."); },
      onError: (e) => toast.error(apiErrorMessage(e)),
    },
  });
  const withdraw = useWithdrawDeletionRequest({
    mutation: { onSuccess: () => { refresh(); toast.success("Request withdrawn."); }, onError: (e) => toast.error(apiErrorMessage(e)) },
  });

  const latest = data?.request ?? null;
  const pending = latest?.status === "pending";

  return (
    <section className="space-y-4" aria-labelledby="delete-account-heading">
      <h2 id="delete-account-heading" className="flex items-center gap-2 text-xl font-serif font-bold">
        <Trash2 className="h-5 w-5 text-muted-foreground" strokeWidth={1.9} aria-hidden="true" />
        Delete my account and data
      </h2>
      <Card className="border-border/50 bg-card">
        <CardContent className="space-y-4 pt-6 text-sm">
          <p className="text-muted-foreground">
            You can ask Bonisa to delete your personal information: your name, email, phone number, photo and anything you wrote in chat.
            We keep booking and payment records the law requires, without your name on them.
          </p>
          <p className="text-muted-foreground">
            We cannot delete your account while you have a booking coming up, a payment still being settled, or a complaint open. We will tell you if that is the case.
          </p>

          {isLoading && <p className="text-muted-foreground">Loading…</p>}

          {latest?.status === "rejected" && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3" data-testid="deletion-rejected">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Your last request was not approved</p>
              <p className="mt-1 text-foreground">{latest.ownerNote}</p>
            </div>
          )}

          {pending ? (
            <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-3" data-testid="deletion-pending">
              <p>
                We received your request on {format(new Date(latest.requestedAt), "d MMMM yyyy")}. We will review it and reply within 30 days.
                Until then you can keep using Bonisa.
              </p>
              <Button variant="outline" size="sm" disabled={withdraw.isPending} onClick={() => withdraw.mutate()}>Withdraw my request</Button>
            </div>
          ) : (
            <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => setOpen(true)} data-testid="deletion-open">
              Request deletion
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request deletion of your account?</DialogTitle>
            <DialogDescription>
              Once we approve this, your account is closed and your personal information is removed. You will not be able to sign in again. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="deletion-note">Anything you would like us to know (optional)</Label>
            <Textarea id="deletion-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} data-testid="deletion-note" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Keep my account</Button>
            <Button variant="destructive" disabled={request.isPending} onClick={() => request.mutate({ data: { note: note.trim() || undefined } })} data-testid="deletion-send">
              Send request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
