import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListPendingCheckinsQueryKey,
  useListPendingCheckins,
  useSafetyCheckin,
  type PendingCheckin,
} from "@workspace/api-client-react";
import { useUpload } from "@workspace/object-storage-web";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera, CheckCircle2, HeartHandshake, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiMessage, longDate } from "@/lib/campaign-money";

/**
 * After a job, an artist checks in: a photo, "I am safe" (or "I need help"), and whether it was her
 * last booking. She gets a short code as proof of the check-in. Only Bonisa sees the photo.
 */
export function SafetyCheckinPrompt() {
  const qc = useQueryClient();
  const { data: pending = [] } = useListPendingCheckins({ query: { queryKey: getListPendingCheckinsQueryKey(), refetchInterval: 5 * 60_000 } });
  const checkin = useSafetyCheckin();
  const { uploadFile, isUploading } = useUpload({ basePath: `${import.meta.env.BASE_URL}api/storage` });
  const fileRef = useRef<HTMLInputElement>(null);
  const [job, setJob] = useState<PendingCheckin | null>(null);
  const [photo, setPhoto] = useState<{ file: File; preview: string } | null>(null);
  const [safe, setSafe] = useState<boolean | null>(null);
  const [last, setLast] = useState(false);
  const [note, setNote] = useState("");
  const [done, setDone] = useState<{ code: string; message: string } | null>(null);

  const reset = () => { setJob(null); setPhoto(null); setSafe(null); setLast(false); setNote(""); setDone(null); };

  async function submit() {
    if (!job || !photo || safe === null) return;
    const up = await uploadFile(photo.file);
    if (!up) { toast.error("The photo could not be uploaded. Please try again."); return; }
    try {
      const res = await checkin.mutateAsync({ appointmentId: job.appointmentId, data: { objectPath: up.objectPath, mimeType: photo.file.type || "image/jpeg", safe, lastBooking: last, note: note.trim() || undefined } });
      setDone({ code: res.code, message: res.message });
      await qc.invalidateQueries({ queryKey: getListPendingCheckinsQueryKey() });
    } catch (e) {
      toast.error(apiMessage(e, "Could not save your check-in."));
    }
  }

  if (pending.length === 0 && !done) return null;
  const first = pending[0];

  return (
    <>
      {first && !job && (
        <Card className="border-primary/40 bg-primary/5" data-testid="banner-safety-checkin">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <HeartHandshake className="mt-0.5 h-5 w-5 shrink-0 text-primary" strokeWidth={1.9} />
              <div>
                <p className="font-semibold">Check in after your booking</p>
                <p className="text-sm text-muted-foreground">
                  {first.serviceName} with {first.clientName}, {longDate(first.date)} at {first.time}.
                  {pending.length > 1 ? ` (${pending.length} bookings waiting)` : ""} Add a photo and let us know you are safe.
                </p>
              </div>
            </div>
            <Button className="shrink-0 rounded-full" onClick={() => setJob(first)} data-testid="button-start-checkin">Check in</Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={job !== null || done !== null} onOpenChange={(o) => { if (!o) reset(); }}>
        <DialogContent className="sm:max-w-md">
          {done ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 font-serif text-2xl"><CheckCircle2 className="h-6 w-6 text-primary" strokeWidth={1.9} />Checked in</DialogTitle>
                <DialogDescription>{done.message}</DialogDescription>
              </DialogHeader>
              <div className="rounded-lg border border-border bg-muted/40 p-4 text-center">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Your check-in code</p>
                <p className="mt-1 font-mono text-2xl tracking-widest" data-testid="text-checkin-code">{done.code}</p>
              </div>
              <Button onClick={reset}>Done</Button>
            </>
          ) : job && (
            <>
              <DialogHeader>
                <DialogTitle className="font-serif text-2xl">Safety check-in</DialogTitle>
                <DialogDescription>{job.serviceName} with {job.clientName}. Only Bonisa sees your photo.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" data-testid="input-checkin-photo"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) setPhoto({ file: f, preview: URL.createObjectURL(f) }); }} />
                  {photo ? (
                    <div className="flex items-center gap-3">
                      <img src={photo.preview} alt="Your check-in photo" className="h-20 w-20 rounded-lg object-cover" />
                      <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Change photo</Button>
                    </div>
                  ) : (
                    <Button variant="outline" className="w-full gap-2" onClick={() => fileRef.current?.click()}><Camera className="h-4 w-4" strokeWidth={1.9} />Add a photo</Button>
                  )}
                  <p className="mt-1.5 text-xs text-muted-foreground">A photo of the finished work, or of you after the booking.</p>
                </div>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Are you safe?">
                  <Button variant={safe === true ? "default" : "outline"} onClick={() => setSafe(true)} role="radio" aria-checked={safe === true} data-testid="button-safe-yes">I am safe</Button>
                  <Button variant={safe === false ? "destructive" : "outline"} onClick={() => setSafe(false)} role="radio" aria-checked={safe === false} data-testid="button-safe-no">I need help</Button>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={last} onChange={(e) => setLast(e.target.checked)} data-testid="check-last-booking" />
                  This was my last booking for today
                </label>
                <Textarea rows={2} placeholder="Anything we should know? (optional)" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
                <Button className="w-full" disabled={!photo || safe === null || isUploading || checkin.isPending} onClick={() => void submit()} data-testid="button-submit-checkin">
                  {isUploading || checkin.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send check-in"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
