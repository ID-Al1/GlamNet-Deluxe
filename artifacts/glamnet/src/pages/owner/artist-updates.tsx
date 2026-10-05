import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListOwnerArtistUpdatesQueryKey,
  useListOwnerArtistUpdateAudience,
  useListOwnerArtistUpdates,
  useSendOwnerArtistUpdate,
  type OwnerUpdateAudienceArtist,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Inbox, Mail, MessageCircle, Phone, RefreshCw, Send, Users } from "lucide-react";

/**
 * Bonisa owner portal: Artist updates.
 *
 * One place to talk to artists. Pick who should hear it from their profile
 * (verification stage, specialty, area, what is missing, bookings), write it
 * once with placeholders, preview it for a real artist, and send. Every
 * artist gets it in her in-app Updates inbox, and by email and WhatsApp too
 * when the owner leaves that switched on.
 */

type Stage = OwnerUpdateAudienceArtist["verificationStatus"];
type Outstanding = OwnerUpdateAudienceArtist["outstanding"][number];
type BookingFilter = "any" | "none" | "some";

const STAGES: { value: Stage; label: string }[] = [
  { value: "none", label: "Not submitted" },
  { value: "pending", label: "Waiting for review" },
  { value: "verified", label: "Verified" },
];

const OUTSTANDING: Outstanding[] = ["ID number", "ID document", "Bank details", "Bio", "Services", "Portfolio"];

const PLACEHOLDERS = [
  { key: "first_name", label: "First name" },
  { key: "name", label: "Full name" },
  { key: "specialty", label: "Specialty" },
  { key: "location", label: "Area" },
  { key: "missing_items", label: "What is missing" },
] as const;

const STARTERS: { label: string; subject: string; body: string; stages: Stage[] }[] = [
  {
    label: "Finish your profile",
    stages: ["none"],
    subject: "{first_name}, you are nearly live on Bonisa",
    body:
      "Hi {first_name},\n\n" +
      "Thanks for joining Bonisa. Clients can only find and book verified artists, so finishing your profile is the step that gets you seen.\n\n" +
      "Still missing: {missing_items}.\n\n" +
      "Once that is done, tap Submit for verification on your profile and we will review it within 72 hours.",
  },
  {
    label: "Under review",
    stages: ["pending"],
    subject: "We are reviewing your profile",
    body:
      "Hi {first_name},\n\n" +
      "Your profile is with us for review. We answer every application within 72 hours, and we will tell you either way.\n\n" +
      "Nothing to do for now. Thank you for your patience.",
  },
  {
    label: "Verified artists",
    stages: ["verified"],
    subject: "News for {specialty} artists on Bonisa",
    body: "Hi {first_name},\n\n",
  },
];

/** Keep in step with personalise() in artifacts/api-server/src/routes/artist-updates.ts. */
function personalise(template: string, artist: OwnerUpdateAudienceArtist): string {
  const values: Record<string, string> = {
    first_name: artist.firstName,
    name: artist.name,
    specialty: artist.specialty || "beauty",
    location: artist.location || "your area",
    missing_items: artist.outstanding.length ? artist.outstanding.join(", ") : "nothing, your profile is complete",
  };
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

function unknownPlaceholders(text: string): string[] {
  const known = PLACEHOLDERS.map((p) => p.key as string);
  const found = [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!);
  return [...new Set(found.filter((key) => !known.includes(key)))];
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:border-primary/50"
      }`}
    >
      {children}
    </button>
  );
}

function stageLabel(stage: Stage) {
  return STAGES.find((s) => s.value === stage)?.label ?? stage;
}

export default function OwnerArtistUpdates() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: audience, isLoading, isError, refetch } = useListOwnerArtistUpdateAudience();
  const { data: history, isLoading: historyLoading } = useListOwnerArtistUpdates();
  const sendMutation = useSendOwnerArtistUpdate();

  const [stages, setStages] = useState<Stage[]>([]);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [area, setArea] = useState("");
  const [missing, setMissing] = useState<Outstanding[]>([]);
  const [bookings, setBookings] = useState<BookingFilter>("any");
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [showList, setShowList] = useState(false);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sendExternally, setSendExternally] = useState(true);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const specialtyOptions = useMemo(
    () => [...new Set((audience ?? []).map((a) => a.specialty).filter(Boolean))].sort(),
    [audience],
  );

  const matched = useMemo(() => {
    const areaQuery = area.trim().toLowerCase();
    return (audience ?? []).filter((a) => {
      if (stages.length && !stages.includes(a.verificationStatus)) return false;
      if (specialties.length && !specialties.includes(a.specialty)) return false;
      if (areaQuery && !a.location.toLowerCase().includes(areaQuery)) return false;
      if (missing.length && !missing.some((item) => a.outstanding.includes(item))) return false;
      if (bookings === "none" && a.completedBookings > 0) return false;
      if (bookings === "some" && a.completedBookings === 0) return false;
      return true;
    });
  }, [audience, stages, specialties, area, missing, bookings]);

  const recipients = matched.filter((a) => !excluded.has(a.profileId));
  const previewArtist = recipients.find((a) => a.profileId === previewId) ?? recipients[0] ?? null;
  const unknown = unknownPlaceholders(`${subject}\n${body}`);
  const withoutContact = recipients.filter((a) => !a.hasEmail && !a.hasPhone).length;

  const audienceSummary = useMemo(() => {
    const parts: string[] = [];
    parts.push(stages.length ? stages.map(stageLabel).join(" or ") : "All stages");
    if (specialties.length) parts.push(specialties.join(" or "));
    if (area.trim()) parts.push(`area contains "${area.trim()}"`);
    if (missing.length) parts.push(`missing ${missing.join(" or ")}`);
    if (bookings === "none") parts.push("no completed bookings");
    if (bookings === "some") parts.push("has completed bookings");
    const removed = matched.length - recipients.length;
    if (removed > 0) parts.push(`${removed} removed by hand`);
    return parts.join(", ").slice(0, 300);
  }, [stages, specialties, area, missing, bookings, matched.length, recipients.length]);

  const canSend = recipients.length > 0 && subject.trim() && body.trim() && unknown.length === 0 && !sendMutation.isPending;

  function insertPlaceholder(key: string) {
    setBody((prev) => `${prev}{${key}}`);
  }

  function applyStarter(starter: (typeof STARTERS)[number]) {
    setSubject(starter.subject);
    setBody(starter.body);
    setStages(starter.stages);
    setExcluded(new Set());
  }

  function clearFilters() {
    setStages([]);
    setSpecialties([]);
    setArea("");
    setMissing([]);
    setBookings("any");
    setExcluded(new Set());
  }

  async function send() {
    setConfirming(false);
    try {
      const result = await sendMutation.mutateAsync({
        data: {
          subject: subject.trim(),
          body: body.trim(),
          profileIds: recipients.map((a) => a.profileId),
          audienceSummary,
          sendExternally,
        },
      });
      toast({ title: `Update sent to ${result.recipientCount} ${result.recipientCount === 1 ? "artist" : "artists"}` });
      setSubject("");
      setBody("");
      setExcluded(new Set());
      await queryClient.invalidateQueries({ queryKey: getListOwnerArtistUpdatesQueryKey() });
    } catch (error: any) {
      toast({
        title: "Update not sent",
        description: error?.data?.error ?? "Nothing was sent. Check your connection and try again.",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="max-w-3xl mx-auto w-full space-y-8">
      <div>
        <h1 className="font-serif text-3xl mb-1">Artist updates</h1>
        <p className="text-sm text-muted-foreground">
          Write once, choose exactly who hears it, and every artist gets a version with her own details filled in.
          It always lands in her Updates inbox in the app.
        </p>
      </div>

      {/* ── 1. Who gets it ─────────────────────────────────────────────── */}
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-lg">1. Who gets it</CardTitle>
            <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={clearFilters}>
              Clear filters
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {isError ? (
            <div className="py-6 text-center">
              <AlertCircle className="h-8 w-8 mx-auto mb-3 text-destructive" strokeWidth={1.9} />
              <p className="text-sm mb-3">Could not load artists.</p>
              <Button variant="outline" size="sm" onClick={() => void refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" strokeWidth={1.9} />
                Try again
              </Button>
            </div>
          ) : isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-8 w-1/2" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Verification stage</p>
                <div className="flex flex-wrap gap-2">
                  {STAGES.map((s) => (
                    <Chip key={s.value} active={stages.includes(s.value)} onClick={() => setStages(toggle(stages, s.value))}>
                      {s.label}
                    </Chip>
                  ))}
                </div>
              </div>

              {specialtyOptions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Specialty</p>
                  <div className="flex flex-wrap gap-2">
                    {specialtyOptions.map((s) => (
                      <Chip key={s} active={specialties.includes(s)} onClick={() => setSpecialties(toggle(specialties, s))}>
                        {s}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="update-area" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Area
                </Label>
                <Input
                  id="update-area"
                  placeholder="For example Durban or Sandton"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="max-w-sm"
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Still missing from profile</p>
                <div className="flex flex-wrap gap-2">
                  {OUTSTANDING.map((item) => (
                    <Chip key={item} active={missing.includes(item)} onClick={() => setMissing(toggle(missing, item))}>
                      {item}
                    </Chip>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bookings</p>
                <div className="flex flex-wrap gap-2">
                  <Chip active={bookings === "any"} onClick={() => setBookings("any")}>Any</Chip>
                  <Chip active={bookings === "none"} onClick={() => setBookings("none")}>No completed bookings yet</Chip>
                  <Chip active={bookings === "some"} onClick={() => setBookings("some")}>Has completed bookings</Chip>
                </div>
              </div>

              <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm">
                    <span className="font-semibold">{recipients.length}</span>{" "}
                    {recipients.length === 1 ? "artist" : "artists"} will get this
                    {matched.length !== recipients.length && (
                      <span className="text-muted-foreground"> ({matched.length - recipients.length} removed by hand)</span>
                    )}
                  </p>
                  {matched.length > 0 && (
                    <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setShowList((v) => !v)}>
                      {showList ? "Hide list" : "See and edit list"}
                    </button>
                  )}
                </div>
                {withoutContact > 0 && sendExternally && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {withoutContact} of them have no email or phone on file and will only see it in the app.
                  </p>
                )}

                {showList && matched.length > 0 && (
                  <ul className="mt-4 max-h-80 overflow-y-auto divide-y divide-border/60 rounded-md border border-border/60 bg-card">
                    {matched.map((a) => {
                      const included = !excluded.has(a.profileId);
                      return (
                        <li key={a.profileId} className="flex items-start gap-3 px-3 py-2.5">
                          <Checkbox
                            id={`recipient-${a.profileId}`}
                            checked={included}
                            onCheckedChange={() =>
                              setExcluded((prev) => {
                                const next = new Set(prev);
                                if (next.has(a.profileId)) next.delete(a.profileId);
                                else next.add(a.profileId);
                                return next;
                              })
                            }
                            className="mt-0.5"
                          />
                          <label htmlFor={`recipient-${a.profileId}`} className="min-w-0 flex-1 cursor-pointer">
                            <span className="block text-sm font-medium">{a.name}</span>
                            <span className="block text-xs text-muted-foreground">
                              {[a.specialty, a.location, stageLabel(a.verificationStatus)].filter(Boolean).join(" · ")}
                            </span>
                          </label>
                          <span className="flex shrink-0 gap-1.5 text-muted-foreground" aria-label="Contact details on file">
                            {a.hasEmail && <Mail className="h-3.5 w-3.5" strokeWidth={1.9} aria-label="Email" />}
                            {a.hasPhone && <Phone className="h-3.5 w-3.5" strokeWidth={1.9} aria-label="Phone" />}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── 2. Message ─────────────────────────────────────────────────── */}
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">2. What it says</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Start from</p>
            <div className="flex flex-wrap gap-2">
              {STARTERS.map((s) => (
                <Button key={s.label} type="button" variant="outline" size="sm" onClick={() => applyStarter(s)}>
                  {s.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="update-subject">Subject</Label>
            <Input id="update-subject" value={subject} maxLength={120} onChange={(e) => setSubject(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="update-body">Message</Label>
            <Textarea id="update-body" value={body} maxLength={2000} rows={8} onChange={(e) => setBody(e.target.value)} />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Insert:</span>
              {PLACEHOLDERS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => insertPlaceholder(p.key)}
                  className="rounded border border-border/70 bg-muted/30 px-2 py-0.5 text-xs hover:border-primary/50"
                >
                  {p.label}
                </button>
              ))}
            </div>
            {unknown.length > 0 && (
              <p className="text-xs text-destructive">
                {unknown.map((k) => `{${k}}`).join(", ")} {unknown.length === 1 ? "is" : "are"} not recognised. Use the Insert buttons above.
              </p>
            )}
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-border/60 p-3">
            <Switch id="update-external" checked={sendExternally} onCheckedChange={setSendExternally} />
            <Label htmlFor="update-external" className="cursor-pointer font-normal leading-snug">
              <span className="block text-sm font-medium">Also send by email and WhatsApp</span>
              <span className="block text-xs text-muted-foreground">
                Off means it only appears in the artist's Updates inbox in the app.
              </span>
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* ── 3. Preview and send ────────────────────────────────────────── */}
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">3. Check and send</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {previewArtist && (subject.trim() || body.trim()) ? (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Preview as</span>
                <select
                  className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground"
                  value={previewArtist.profileId}
                  onChange={(e) => setPreviewId(e.target.value)}
                >
                  {recipients.slice(0, 200).map((a) => (
                    <option key={a.profileId} value={a.profileId}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div className="rounded-lg border border-border/60 bg-background p-4">
                <p className="font-semibold text-sm">{personalise(subject, previewArtist) || "(no subject)"}</p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{personalise(body, previewArtist)}</p>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {recipients.length === 0
                ? "No artists match yet. Loosen the filters in step 1."
                : "Write a subject and message to see exactly what an artist will receive."}
            </p>
          )}

          <Button className="w-full sm:w-auto gap-2" disabled={!canSend} onClick={() => setConfirming(true)}>
            <Send className="h-4 w-4" strokeWidth={1.9} />
            {sendMutation.isPending ? "Sending..." : `Send to ${recipients.length} ${recipients.length === 1 ? "artist" : "artists"}`}
          </Button>
        </CardContent>
      </Card>

      {/* ── Sent updates ───────────────────────────────────────────────── */}
      <section className="space-y-4" aria-labelledby="sent-updates-heading">
        <h2 id="sent-updates-heading" className="font-serif text-2xl">Sent updates</h2>
        {historyLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : !history || history.length === 0 ? (
          <Card className="bg-card border-border/50">
            <CardContent className="py-10 text-center">
              <Inbox className="h-8 w-8 mx-auto mb-3 text-muted-foreground/50" strokeWidth={1.9} />
              <p className="text-sm text-muted-foreground">Nothing sent yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {history.map((u) => (
              <Card key={u.id} className="bg-card border-border/50">
                <CardContent className="p-4 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-medium text-sm">{u.subject}</p>
                    <span className="text-xs text-muted-foreground">
                      {new Date(u.createdAt).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{u.audienceSummary}</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="gap-1">
                      <Users className="h-3 w-3" strokeWidth={1.9} />
                      Read by {u.readCount} of {u.recipientCount}
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <MessageCircle className="h-3 w-3" strokeWidth={1.9} />
                      {u.sendExternally ? "App, email and WhatsApp" : "App only"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Send to {recipients.length} {recipients.length === 1 ? "artist" : "artists"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {sendExternally
                ? "It goes to their Updates inbox now, and out by email and WhatsApp straight after. A sent update cannot be recalled."
                : "It goes to their Updates inbox now. A sent update cannot be recalled."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction onClick={() => void send()}>Send</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
