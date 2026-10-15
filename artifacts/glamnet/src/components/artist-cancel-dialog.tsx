import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useArtistCancelBooking } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { apiMessage } from "@/lib/campaign-money";

const FREE_HOURS = 48;
const LATE_HOURS = 12;

function hoursUntil(date: string, time: string): number | null {
  const start = Date.parse(`${date}T${/^\d{2}:\d{2}$/.test(time) ? time : "09:00"}:00+02:00`);
  return Number.isNaN(start) ? null : (start - Date.now()) / 3_600_000;
}

/** Tells her, before she confirms, exactly what cancelling now would mean. The server decides the real outcome. */
export function ArtistCancelDialog({ booking, onClose }: { booking: { id: string; serviceName: string; clientName: string; date: string; time: string } | null; onClose: () => void }) {
  const qc = useQueryClient();
  const cancel = useArtistCancelBooking();
  const [reason, setReason] = useState("");
  const [emergency, setEmergency] = useState(false);
  if (!booking) return null;
  const hours = hoursUntil(booking.date, booking.time);
  const free = hours !== null && hours >= FREE_HOURS;
  const late = hours !== null && hours >= LATE_HOURS && hours < FREE_HOURS;
  const tone = free ? "bg-muted/50" : late ? "bg-amber-500/10" : "bg-destructive/10";
  const title = free ? "No mark against you" : late ? "This counts as a late cancellation" : "This counts as a last-minute cancellation";
  const text = free
    ? `You are giving ${FREE_HOURS} hours or more notice, so there is no penalty. The client is refunded in full.`
    : late
      ? `There are less than ${FREE_HOURS} hours to go, so this is noted on your reputation as a late cancellation. The client is refunded in full.`
      : `There are less than ${LATE_HOURS} hours to go, so this is noted on your reputation as a last-minute cancellation. The client is refunded in full. If it is a real emergency, tick the box below and we will review it.`;

  async function confirm() {
    try {
      const res = await cancel.mutateAsync({ appointmentId: booking!.id, data: { reason: reason.trim() || undefined, emergency } });
      toast.success(res.message);
      setReason(""); setEmergency(false);
      await qc.invalidateQueries();
      onClose();
    } catch (e) {
      toast.error(apiMessage(e, "Could not cancel this booking."));
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Cancel this booking?</DialogTitle>
          <DialogDescription>{booking.serviceName} with {booking.clientName}</DialogDescription>
        </DialogHeader>
        <div className={`rounded-lg p-3 text-sm ${tone}`} data-testid="cancel-consequence">
          <p className="font-semibold">{title}</p>
          <p className="mt-1 leading-relaxed">{text}</p>
        </div>
        {!free && (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={emergency} onChange={(e) => setEmergency(e.target.checked)} data-testid="check-emergency" />
            <span>This is a genuine emergency. Bonisa will review it and it will not count against me meanwhile.</span>
          </label>
        )}
        <Textarea rows={3} placeholder={emergency ? "Please tell us what happened (required for an emergency)" : "Tell the client why (optional)"} value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} data-testid="input-cancel-reason" />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Keep the booking</Button>
          <Button variant="destructive" disabled={cancel.isPending || (emergency && reason.trim().length < 10)} onClick={() => void confirm()} data-testid="button-confirm-artist-cancel">Cancel booking</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
