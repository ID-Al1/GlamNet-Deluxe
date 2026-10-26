import { useState } from "react";
import { Link } from "wouter";
import { useGetBookingSafetyInfo } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MapPin, MessageCircle, Phone, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api-error";
import { whatsappLink } from "@/lib/whatsapp";

/**
 * Safety tools for one booking. Everything here runs on the artist's own phone:
 * the buttons open WhatsApp and the dialler. Bonisa does not track her or message anyone.
 */
export function SafetyDialog({ appointmentId }: { appointmentId: string }) {
  const [open, setOpen] = useState(false);
  const [locationLink, setLocationLink] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const { data, isLoading, error } = useGetBookingSafetyInfo(appointmentId, {
    query: { enabled: open, staleTime: 0, gcTime: 0, retry: false } as any,
  });
  const contact = data?.trustedContact ?? null;

  const detailsText = data
    ? `Hi ${contact?.name ?? ""}, I'm doing a booking through Bonisa.\n`
      + `Client: ${data.clientName}${data.clientPhone ? ` (${data.clientPhone})` : ""}\n`
      + `Service: ${data.serviceName}\nWhen: ${data.date} at ${data.time}`
      + `${data.notes ? `\nNotes: ${data.notes}` : ""}\nI will message you when I'm done.`
    : "";

  const shareLocation = () => {
    if (!contact || !navigator.geolocation) { toast.error("Your phone could not share its location."); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const url = `https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`;
        setLocationLink(whatsappLink(contact.phone, `I'm here now: ${url}`));
      },
      () => { setLocating(false); toast.error("We could not get your location. Check that location is switched on for this site."); },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  return (
    <>
      <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs rounded-full" onClick={() => setOpen(true)}>
        <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.9} />Safety
      </Button>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setLocationLink(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stay safe at this booking</DialogTitle>
            <DialogDescription>
              These buttons open WhatsApp and your phone. Bonisa does not track you or message anyone for you.
            </DialogDescription>
          </DialogHeader>

          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {error && <p className="text-sm text-muted-foreground">{apiErrorMessage(error, "Safety details are not available right now.")}</p>}

          {data && (
            <div className="space-y-3">
              {contact ? (
                <>
                  <a href={whatsappLink(contact.phone, detailsText)} target="_blank" rel="noopener noreferrer" className="block">
                    <Button className="w-full gap-2 justify-start" type="button"><MessageCircle className="h-4 w-4" strokeWidth={1.9} />Send booking details to {contact.name}</Button>
                  </a>
                  {locationLink ? (
                    <a href={locationLink} target="_blank" rel="noopener noreferrer" className="block">
                      <Button className="w-full gap-2 justify-start" type="button"><MapPin className="h-4 w-4" strokeWidth={1.9} />Open WhatsApp with my location</Button>
                    </a>
                  ) : (
                    <Button variant="outline" className="w-full gap-2 justify-start" type="button" onClick={shareLocation} disabled={locating}>
                      <MapPin className="h-4 w-4" strokeWidth={1.9} />{locating ? "Finding your location…" : `Share my location with ${contact.name}`}
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">
                    For live tracking, open the chat in WhatsApp, tap +, choose Location, then Share live location.
                  </p>
                  <a href={`tel:${contact.phone}`} className="block">
                    <Button variant="outline" className="w-full gap-2 justify-start" type="button"><Phone className="h-4 w-4" strokeWidth={1.9} />Call {contact.name}</Button>
                  </a>
                </>
              ) : (
                <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                  You have not added a trusted contact yet.{" "}
                  <Link href="/profile" className="text-primary underline" onClick={() => setOpen(false)}>Add one in your profile</Link>
                  {" "}and these buttons will work for every booking.
                </div>
              )}
            </div>
          )}

          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">If you are in danger</p>
            <div className="grid grid-cols-2 gap-2">
              <a href="tel:10111"><Button variant="destructive" className="w-full gap-2" type="button"><Phone className="h-4 w-4" strokeWidth={1.9} />Police 10111</Button></a>
              <a href="tel:112"><Button variant="destructive" className="w-full gap-2" type="button"><Phone className="h-4 w-4" strokeWidth={1.9} />Emergency 112</Button></a>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
