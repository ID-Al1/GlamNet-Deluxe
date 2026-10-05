import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetArtistContactSettingsQueryKey,
  getListArtistContactsQueryKey,
  useCreateArtistContact,
  useGetArtistContactSettings,
  useImportArtistContacts,
  useListArtistContacts,
  useRemindDueArtistContacts,
  useUpdateArtistContactSettings,
  type ArtistContact,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { AlertCircle, AlertTriangle, BellRing, Mail, Phone, RefreshCw, Search, Upload, UserPlus, Users } from "lucide-react";
import { parseCsv } from "./csv";
import { ContactDetail, SOURCE_LABELS, STAGE_LABELS, reminderLine } from "./contact-detail";

/**
 * Bonisa owner portal: Artist contacts.
 *
 * Everyone who might become a Bonisa artist, in one list, whether they signed
 * up in the app, joined the Vercel waitlist, or were added by hand. Each row
 * says who she is, where she came from, what she still needs to do, and what
 * we have sent her. Automatic reminders do the chasing.
 */

type StageFilter = ArtistContact["stage"] | "follow_up" | "all";

const TILES: { key: StageFilter; label: string }[] = [
  { key: "not_on_app", label: "Not on Bonisa yet" },
  { key: "finishing_profile", label: "Finishing profile" },
  { key: "waiting_review", label: "Waiting for your review" },
  { key: "live", label: "Live" },
  { key: "follow_up", label: "Call them yourself" },
];

function errorMessage(error: any, fallback: string) {
  return error?.data?.error ?? fallback;
}

export default function OwnerArtistContacts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: contacts, isLoading, isError, refetch } = useListArtistContacts();
  const { data: settings } = useGetArtistContactSettings();
  const updateSettings = useUpdateArtistContactSettings();
  const remindDue = useRemindDueArtistContacts();

  const [stage, setStage] = useState<StageFilter>("all");
  const [source, setSource] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [confirmRemind, setConfirmRemind] = useState(false);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const contact of contacts ?? []) {
      c[contact.stage] = (c[contact.stage] ?? 0) + 1;
      if (contact.needsPersonalFollowUp) c.follow_up = (c.follow_up ?? 0) + 1;
    }
    return c;
  }, [contacts]);

  const dueNow = useMemo(
    () => (contacts ?? []).filter((c) => c.nextReminderAt && (!c.lastRemindedAt || new Date(c.nextReminderAt) <= new Date())).length,
    [contacts],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (contacts ?? []).filter((c) => {
      if (stage === "follow_up" ? !c.needsPersonalFollowUp : stage !== "all" && c.stage !== stage) return false;
      if (source !== "all" && !c.sources.includes(source as ArtistContact["sources"][number])) return false;
      if (q && ![c.name, c.email, c.phone, c.specialty, c.location].some((v) => v?.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [contacts, stage, source, query]);

  const open = contacts?.find((c) => c.id === openId) ?? null;
  const noDelivery = settings && !settings.emailConfigured && !settings.whatsappConfigured;

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: getListArtistContactsQueryKey() });
  }

  async function toggleAuto(enabled: boolean) {
    try {
      await updateSettings.mutateAsync({ data: { autoRemindersEnabled: enabled } });
      await queryClient.invalidateQueries({ queryKey: getGetArtistContactSettingsQueryKey() });
      toast({ title: enabled ? "Automatic reminders are on" : "Automatic reminders are off" });
    } catch (error) {
      toast({ title: "Could not change the setting", description: errorMessage(error, "Try again."), variant: "destructive" });
    }
  }

  async function sendDue() {
    setConfirmRemind(false);
    try {
      const result = await remindDue.mutateAsync();
      toast({
        title: result.sent === 1 ? "1 reminder sent" : `${result.sent} reminders sent`,
        description: noDelivery ? "Email and WhatsApp are not set up yet, so they were logged but not delivered." : undefined,
      });
      await refresh();
    } catch (error) {
      toast({ title: "Reminders not sent", description: errorMessage(error, "Try again."), variant: "destructive" });
    }
  }

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="font-serif text-3xl mb-1">Artist contacts</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Everyone who might become a Bonisa artist, in one list: people who signed up in the app, people on the
          Vercel waitlist, and anyone you add yourself. Each person shows what she still needs to do and everything
          we have sent her.
        </p>
      </div>

      {/* ── Automatic reminders ──────────────────────────────────────── */}
      <Card className="bg-card border-border/50">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-start gap-3">
            <Switch
              id="auto-reminders"
              checked={settings?.autoRemindersEnabled ?? false}
              disabled={!settings || updateSettings.isPending}
              onCheckedChange={(v) => void toggleAuto(v)}
            />
            <Label htmlFor="auto-reminders" className="cursor-pointer font-normal leading-snug">
              <span className="block text-sm font-semibold">Automatic reminders</span>
              <span className="block text-xs text-muted-foreground">
                Anyone with something missing gets a reminder every {settings?.reminderIntervalDays ?? 3} days by email and
                WhatsApp, up to {settings?.maxRemindersPerStage ?? 3} times for each step. It names exactly what is
                missing and stops the moment she finishes. After that she shows under "Call them yourself".
              </span>
            </Label>
          </div>
          {noDelivery && (
            <p className="flex items-start gap-2 rounded-md bg-muted/40 p-3 text-xs">
              <AlertTriangle className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.9} />
              Email and WhatsApp are not set up on the server yet, so nothing can be delivered. Reminders will start
              going out as soon as RESEND_API_KEY and EMAIL_FROM (email) or the Twilio keys (WhatsApp) are added.
            </p>
          )}
          {settings && !settings.waitlistWebhookConfigured && (
            <p className="flex items-start gap-2 rounded-md bg-muted/40 p-3 text-xs">
              <AlertTriangle className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.9} />
              The Vercel waitlist is not connected yet, so new waitlist sign-ups will not appear here on their own. Until
              it is, use Import to bring in a waitlist export.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Stage tiles ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {TILES.map((tile) => (
          <button
            key={tile.key}
            type="button"
            onClick={() => setStage(stage === tile.key ? "all" : tile.key)}
            aria-pressed={stage === tile.key}
            className={`rounded-xl border p-4 text-left transition-colors ${
              stage === tile.key ? "border-primary bg-primary/10" : "border-border/60 bg-card hover:border-primary/40"
            }`}
          >
            <p className="text-2xl font-semibold">{isLoading ? "..." : counts[tile.key] ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">{tile.label}</p>
          </button>
        ))}
      </div>

      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.9} />
          <Input className="pl-9" placeholder="Search name, email, phone or area" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setAdding(true)}>
            <UserPlus className="h-4 w-4" strokeWidth={1.9} /> Add person
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setImporting(true)}>
            <Upload className="h-4 w-4" strokeWidth={1.9} /> Import
          </Button>
          <Button size="sm" className="gap-2" disabled={dueNow === 0 || remindDue.isPending} onClick={() => setConfirmRemind(true)}>
            <BellRing className="h-4 w-4" strokeWidth={1.9} />
            {remindDue.isPending ? "Sending..." : `Remind ${dueNow} now`}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[["all", "All sources"], ...Object.entries(SOURCE_LABELS)].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSource(key!)}
            aria-pressed={source === key}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              source === key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── List ─────────────────────────────────────────────────────── */}
      {isError ? (
        <div className="py-12 text-center">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-destructive" strokeWidth={1.9} />
          <p className="text-sm mb-3">Could not load contacts.</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" strokeWidth={1.9} /> Try again
          </Button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : shown.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <Users className="mx-auto mb-3 h-8 w-8 opacity-40" strokeWidth={1.9} />
          <p className="text-sm">{contacts?.length ? "Nobody matches these filters." : "Nobody on the list yet. Add someone or import a waitlist export."}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{shown.length} {shown.length === 1 ? "person" : "people"}</p>
          {shown.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setOpenId(c.id)}
              className="w-full rounded-xl border border-border/60 bg-card p-4 text-left transition-colors hover:border-primary/50"
              data-testid={`contact-${c.id}`}
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{c.name || "No name yet"}</span>
                    <Badge variant={c.stage === "live" ? "secondary" : "outline"}>{STAGE_LABELS[c.stage]}</Badge>
                    {c.needsPersonalFollowUp && <Badge variant="destructive">Call her yourself</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {c.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" strokeWidth={1.9} />{c.email}</span>}
                    {c.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" strokeWidth={1.9} />{c.phone}</span>}
                    {[c.specialty, c.location].filter(Boolean).length > 0 && <span>{[c.specialty, c.location].filter(Boolean).join(" · ")}</span>}
                  </div>
                  {c.missing.length > 0 && (
                    <p className="text-xs"><span className="text-muted-foreground">Missing:</span> {c.missing.join(", ")}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-1 md:items-end">
                  <div className="flex flex-wrap gap-1">
                    {c.sources.map((s) => <Badge key={s} variant="secondary" className="text-[11px]">{SOURCE_LABELS[s]}</Badge>)}
                  </div>
                  <p className="text-xs text-muted-foreground">{reminderLine(c)}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <ContactDetail contact={open} onClose={() => setOpenId(null)} />
      <AddContactDialog open={adding} onClose={() => setAdding(false)} onAdded={(id) => { setAdding(false); setOpenId(id); }} />
      <ImportDialog open={importing} onClose={() => setImporting(false)} />

      <AlertDialog open={confirmRemind} onOpenChange={setConfirmRemind}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send {dueNow} {dueNow === 1 ? "reminder" : "reminders"} now?</AlertDialogTitle>
            <AlertDialogDescription>
              Everyone who still has something to do and has not had a reminder in the last 3 days gets one now, each
              naming exactly what she is missing. Anyone reminded recently is left alone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction onClick={() => void sendDue()}>Send</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AddContactDialog({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (id: string) => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const create = useCreateArtistContact();
  const [form, setForm] = useState({ name: "", email: "", phone: "", specialty: "", location: "", notes: "" });
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const contact = await create.mutateAsync({ data: form });
      await queryClient.invalidateQueries({ queryKey: getListArtistContactsQueryKey() });
      toast({ title: `${contact.name || "Contact"} is on the list` });
      setForm({ name: "", email: "", phone: "", specialty: "", location: "", notes: "" });
      onAdded(contact.id);
    } catch (error) {
      toast({ title: "Not added", description: errorMessage(error, "Check the details and try again."), variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif">Add a person</DialogTitle>
          <DialogDescription>
            If her email or phone is already on the list, these details are added to that person instead of creating a duplicate.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1"><Label htmlFor="add-name">Name</Label><Input id="add-name" value={form.name} onChange={set("name")} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label htmlFor="add-email">Email</Label><Input id="add-email" type="email" value={form.email} onChange={set("email")} /></div>
            <div className="space-y-1"><Label htmlFor="add-phone">Phone / WhatsApp</Label><Input id="add-phone" value={form.phone} onChange={set("phone")} placeholder="082 123 4567" /></div>
            <div className="space-y-1"><Label htmlFor="add-specialty">Specialty</Label><Input id="add-specialty" value={form.specialty} onChange={set("specialty")} /></div>
            <div className="space-y-1"><Label htmlFor="add-location">Area</Label><Input id="add-location" value={form.location} onChange={set("location")} /></div>
          </div>
          <div className="space-y-1"><Label htmlFor="add-notes">Notes</Label><Textarea id="add-notes" rows={2} value={form.notes} onChange={set("notes")} placeholder="Where you met her, what you spoke about" /></div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={create.isPending}>{create.isPending ? "Adding..." : "Add"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const importRows = useImportArtistContacts();
  const fileInput = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Record<string, string>[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [source, setSource] = useState<"vercel_waitlist" | "import">("vercel_waitlist");
  const [busy, setBusy] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    setRows(parseCsv(await file.text()));
  }

  function reset() {
    setRows(null);
    setFileName("");
    if (fileInput.current) fileInput.current.value = "";
  }

  async function run() {
    if (!rows?.length) return;
    setBusy(true);
    const totals = { created: 0, merged: 0, skipped: 0 };
    try {
      for (let i = 0; i < rows.length; i += 500) {
        const result = await importRows.mutateAsync({ data: { source, rows: rows.slice(i, i + 500) } });
        totals.created += result.created;
        totals.merged += result.merged;
        totals.skipped += result.skipped;
      }
      toast({
        title: `${totals.created} added, ${totals.merged} matched to people already on the list`,
        description: totals.skipped ? `${totals.skipped} rows had no usable email or phone number and were skipped.` : undefined,
      });
      reset();
      onClose();
    } catch (error) {
      toast({
        title: "Import stopped",
        description: `${totals.created + totals.merged} rows were saved before it stopped. ${errorMessage(error, "Try again.")}`,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
      await queryClient.invalidateQueries({ queryKey: getListArtistContactsQueryKey() });
    }
  }

  const columns = rows?.[0] ? Object.keys(rows[0]) : [];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif">Import a list</DialogTitle>
          <DialogDescription>
            Upload a CSV file, for example an export of the Vercel waitlist from Supabase, or a spreadsheet saved as CSV.
            Columns like name, email, phone, city and specialty are recognised automatically. People already on the
            list are matched by email or phone, not duplicated.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Where is this list from?</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant={source === "vercel_waitlist" ? "default" : "outline"} onClick={() => setSource("vercel_waitlist")}>Vercel waitlist</Button>
              <Button type="button" size="sm" variant={source === "import" ? "default" : "outline"} onClick={() => setSource("import")}>Somewhere else</Button>
            </div>
          </div>
          <Input ref={fileInput} type="file" accept=".csv,text/csv" onChange={(e) => void pick(e.target.files?.[0])} />
          {rows && (
            <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs space-y-1">
              <p><span className="font-semibold">{rows.length}</span> rows found in {fileName}.</p>
              {columns.length > 0 && <p className="text-muted-foreground">Columns: {columns.join(", ")}</p>}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancel</Button>
            <Button disabled={!rows?.length || busy} onClick={() => void run()}>{busy ? "Importing..." : `Import ${rows?.length ?? 0} rows`}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
