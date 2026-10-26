import { useState } from "react";
import { format } from "date-fns";
import { useGetCompletionCode } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { KeyRound } from "lucide-react";
import { apiErrorMessage } from "@/lib/api-error";

/** The client's side: shows the code to read out to the artist once the service is done. */
export function CompletionCodeDialog({ appointmentId, artistName }: { appointmentId: string; artistName: string }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading, error } = useGetCompletionCode(appointmentId, {
    query: { enabled: open, staleTime: 0, gcTime: 0 } as any,
  });

  return (
    <>
      <Button size="sm" className="gap-1.5 h-8 text-[11px] rounded-full" onClick={() => setOpen(true)}>
        <KeyRound className="h-3.5 w-3.5" strokeWidth={1.9} />Show my completion code
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your completion code</DialogTitle>
            <DialogDescription>
              Give this code to {artistName} only when you are happy with the service. Never share it before the service is finished.
            </DialogDescription>
          </DialogHeader>
          {isLoading && <p className="text-sm text-muted-foreground">Loading your code…</p>}
          {error && <p className="text-sm text-destructive">{apiErrorMessage(error, "Could not load your code.")}</p>}
          {data && (
            <div className="space-y-3 text-center">
              <p className="text-5xl font-serif font-bold tracking-[0.25em] lining-nums" data-testid="completion-code">{data.code}</p>
              <p className="text-xs text-muted-foreground">Valid until {format(new Date(data.expiresAt), "EEE d MMM, HH:mm")}.</p>
              <p className="text-sm text-muted-foreground">
                After {artistName} enters it, you have 24 hours to report a problem. Then she is paid.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
