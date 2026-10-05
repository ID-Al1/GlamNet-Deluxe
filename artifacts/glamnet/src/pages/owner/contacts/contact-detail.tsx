import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetArtistContactTimelineQueryKey,
  getListArtistContactsQueryKey,
  useGetArtistContactTimeline,
  useRemindArtistContact,
  useUpdateArtistContact,
  type ArtistContact,
} from "@workspace/api-client-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { BellRing, ExternalLink } from "lucide-react";

export const STAGE_LABELS: Record<ArtistContact["stage"], string> = {
  not_on_app: "Not on Bonisa yet",
  finishing_profile: "Finishing profile",
  waiting_review: "Waiting for your review",
  live: "Live",
  suspended: "Suspended",
};

export const SOURCE_LABELS: Record<ArtistContact["sources"][number], string> = {
  bonisa_app: "Bonisa app",
  vercel_waitlist: "Vercel waitlist",
  manual: "Added by you",
  import: "Imported list",
};

const KIND_LABELS: Record<string, string> = {
  auto_reminder: "Automatic reminder",
  manual_reminder: "Reminder you sent",
  update: "Artist update",
};

const CHANNEL_LABELS: Record<string, string> = { app: "App", email: "Email", whatsapp: "WhatsApp" };

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" });
}

/** One plain sentence about where her reminders stand. */
export function reminderLine(c: ArtistContact): string {
  if (c.stage === "live") return "Live on Bonisa";
  if (c.stage === "waiting_review") return "Waiting on you, not her";
  if (c.stage === "suspended") return "Account suspended";
  if (!c.reachable) return "No email or phone to reach her";
  if (c.remindersPaused) return "Reminders paused";
  if (c.needsPersonalFollowUp) return `${c.remindersSent} reminders sent, no response`;
  const next = c.nextReminderAt ? new Date(c.nextReminderAt).toLocaleDateString("en-ZA", { day: "numeric", month: "short" }) : null;
  return c.remindersSent > 0
    ? `Reminder ${c.remindersSent} of 3 sent${next ? `, next ${next}` : ""}`
    : next ? `First reminder due ${next}` : "No reminders yet";
}

export function ContactDetail({ contact, onClose }: { contact: ArtistContact | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const update = useUpdateArtistContact();
  const remind = useRemindArtistContact();
  const { data: timeline, isLoading } = useGetArtistContactTimeline(contact?.id ?? "", {
    query: { queryKey: getGetArtistContactTimelineQueryKey(contact?.id ?? ""), enabled: !!contact },
  });

  const [form, setForm] = useState({ name: "", email: "", phone: "", specialty: "", location: "", instagram: "", notes: "" });
  useEffect(() => {
    if (!contact) return;
    setForm({
      name: contact.name,
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      specialty: contact.specialty ?? "",
      location: contact.location ?? "",
      instagram: contact.instagram ?? "",
      notes: contact.notes ?? "",
    });
  }, [contact?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!contact) return <Sheet open={false} />;

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getListArtistContactsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetArtistContactTimelineQueryKey(contact!.id) }),
    ]);
  }

  async function save(data: Parameters<typeof update.mutateAsync>[0]["data"], done: string) {
    try {
      await update.mutateAsync({ contactId: contact!.id, data });
      await refresh();
      toast({ title: done });
    } catch (error: any) {
      toast({ title: "Not saved", description: error?.data?.error ?? "Try again.", variant: "destructive" });
    }
  }

  async function sendNow() {
    try {
      const message = await remind.mutateAsync({ contactId: contact!.id });
      await refresh();
      toast(message.channels.length
        ? { title: `Reminder sent by ${message.channels.map((c) => CHANNEL_LABELS[c] ?? c).join(" and ")}` }
        : { title: "Reminder logged but not delivered", description: "Email and WhatsApp are not set up on the server yet.", variant: "destructive" });
    } catch (error: any) {
      toast({ title: "Reminder not sent", description: error?.data?.error ?? "Try again.", variant: "destructive" });
    }
  }

  const changed =
    form.name !== contact.name ||
    form.email !== (contact.email ?? "") ||
    form.phone !== (contact.phone ?? "") ||
    form.specialty !== (contact.specialty ?? "") ||
    form.location !== (contact.location ?? "") ||
    form.instagram !== (contact.instagram ?? "") ||
    form.notes !== (contact.notes ?? "");

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="font-serif text-2xl">{contact.name || "No name yet"}</SheetTitle>
          <SheetDescription asChild>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Badge variant="outline">{STAGE_LABELS[contact.stage]}</Badge>
              {contact.sources.map((s) => <Badge key={s} variant="secondary">{SOURCE_LABELS[s]}</Badge>)}
            </div>
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* What she needs to do */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">What she still needs to do</h3>
            {contact.missing.length ? (
              <div className="flex flex-wrap gap-1.5">{contact.missing.map((m) => <Badge key={m} variant="outline">{m}</Badge>)}</div>
            ) : (
              <p className="text-sm">{contact.stage === "waiting_review" ? "Nothing. Her profile is waiting for your review." : "Nothing."}</p>
            )}
            {contact.stage === "waiting_review" && (
              <Link href="/owner/verifications" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                Open the verification queue <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.9} />
              </Link>
            )}
            {contact.profileId && (
              <Link href={`/owner/artists/${contact.profileId}`} className="block text-sm font-medium text-primary hover:underline">
                View her Bonisa account
              </Link>
            )}
            {contact.waitlistJoinedAt && (
              <p className="text-xs text-muted-foreground">Joined the waitlist {formatDate(contact.waitlistJoinedAt)}</p>
            )}
          </section>

          {/* Reminders */}
          <section className="space-y-3 rounded-lg border border-border/60 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reminders</h3>
            <p className="text-sm">{reminderLine(contact)}</p>
            <div className="flex items-center gap-3">
              <Switch
                id="pause-reminders"
                checked={contact.remindersPaused}
                disabled={update.isPending}
                onCheckedChange={(v) => void save({ remindersPaused: v }, v ? "Reminders paused for her" : "Reminders back on for her")}
              />
              <Label htmlFor="pause-reminders" className="text-sm font-normal">Pause automatic reminders for her</Label>
            </div>
            {timeline?.nextReminder && (
              <details className="rounded-md bg-muted/30 p-3 text-sm">
                <summary className="cursor-pointer font-medium">See the reminder she would get ({timeline.nextReminder.reason})</summary>
                <p className="mt-3 font-semibold">{timeline.nextReminder.subject}</p>
                <p className="mt-2 whitespace-pre-wrap leading-relaxed">{timeline.nextReminder.body}</p>
              </details>
            )}
            {timeline?.nextReminder && (
              <Button size="sm" className="gap-2" disabled={remind.isPending} onClick={() => void sendNow()}>
                <BellRing className="h-4 w-4" strokeWidth={1.9} /> {remind.isPending ? "Sending..." : "Send this reminder now"}
              </Button>
            )}
          </section>

          {/* Details */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Details</h3>
            <div className="space-y-1"><Label htmlFor="c-name">Name</Label><Input id="c-name" value={form.name} onChange={set("name")} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1"><Label htmlFor="c-email">Email</Label><Input id="c-email" value={form.email} onChange={set("email")} /></div>
              <div className="space-y-1"><Label htmlFor="c-phone">Phone / WhatsApp</Label><Input id="c-phone" value={form.phone} onChange={set("phone")} /></div>
              <div className="space-y-1"><Label htmlFor="c-specialty">Specialty</Label><Input id="c-specialty" value={form.specialty} onChange={set("specialty")} /></div>
              <div className="space-y-1"><Label htmlFor="c-location">Area</Label><Input id="c-location" value={form.location} onChange={set("location")} /></div>
            </div>
            <div className="space-y-1"><Label htmlFor="c-instagram">Instagram</Label><Input id="c-instagram" value={form.instagram} onChange={set("instagram")} /></div>
            <div className="space-y-1"><Label htmlFor="c-notes">Notes</Label><Textarea id="c-notes" rows={3} value={form.notes} onChange={set("notes")} /></div>
            <Button
              variant="outline"
              size="sm"
              disabled={!changed || update.isPending}
              onClick={() => void save({
                name: form.name,
                email: form.email || null,
                phone: form.phone || null,
                specialty: form.specialty || null,
                location: form.location || null,
                instagram: form.instagram || null,
                notes: form.notes || null,
              }, "Details saved")}
            >
              Save details
            </Button>
          </section>

          {/* History */}
          <section className="space-y-3 pb-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Everything we have sent her</h3>
            {isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : !timeline?.messages.length ? (
              <p className="text-sm text-muted-foreground">Nothing yet.</p>
            ) : (
              <ol className="space-y-3">
                {timeline.messages.map((m) => (
                  <li key={m.id} className="rounded-lg border border-border/60 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold">{KIND_LABELS[m.kind] ?? m.kind}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(m.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Why: {m.reason}</p>
                    <p className="mt-1 text-xs">
                      {m.channels.length
                        ? `Sent by ${m.channels.map((c) => CHANNEL_LABELS[c] ?? c).join(", ")}`
                        : <span className="text-destructive">Not delivered (email and WhatsApp not set up)</span>}
                    </p>
                    <details className="mt-2 text-sm">
                      <summary className="cursor-pointer">{m.subject}</summary>
                      <p className="mt-2 whitespace-pre-wrap leading-relaxed text-muted-foreground">{m.body}</p>
                    </details>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
