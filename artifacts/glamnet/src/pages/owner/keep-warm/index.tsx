import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetKeepWarmPlanQueryKey,
  getListQuietContactsQueryKey,
  useGetKeepWarmPlan,
  useListQuietContacts,
  useMarkKeepWarmPosted,
  useSendKeepWarmStep,
  useTouchArtistContact,
  useUpdateKeepWarmSettings,
  useUpdateKeepWarmStep,
  type KeepWarmStep,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CalendarClock, Check, Copy, Mail, MessageCircle, Pencil, PhoneCall } from "lucide-react";
import { toast } from "sonner";
import { apiMessage, longDate } from "@/lib/campaign-money";

/**
 * Bonisa owner portal: Keep warm.
 *
 * While the live payment side is finished, the first artists must not drift away. This is a short,
 * honest sequence of messages timed from Day 0 (the day the Founding 50 cards went out), the wording
 * for the WhatsApp group, and a list of people nobody has spoken to lately.
 */

const STATUS: Record<KeepWarmStep["status"], { label: string; tone: "default" | "secondary" | "outline" }> = {
  done: { label: "Done", tone: "secondary" },
  due: { label: "Due now", tone: "default" },
  upcoming: { label: "Coming up", tone: "outline" },
};

function Step({ step, emailReady, onChanged }: { step: KeepWarmStep; emailReady: boolean; onChanged: () => void }) {
  const send = useSendKeepWarmStep();
  const posted = useMarkKeepWarmPosted();
  const save = useUpdateKeepWarmStep();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [subject, setSubject] = useState(step.subject);
  const [body, setBody] = useState(step.body);
  const [whatsapp, setWhatsapp] = useState(step.whatsapp);
  const s = STATUS[step.status];

  async function copy() {
    try { await navigator.clipboard.writeText(step.whatsapp); toast.success("Copied. Paste it into your WhatsApp group."); } catch { toast.error("Could not copy. Select the text and copy it."); }
  }
  async function saveEdits() {
    try {
      await save.mutateAsync({ key: step.key, data: { subject: subject.trim(), body: body.trim(), whatsapp: whatsapp.trim() } });
      setEditing(false); onChanged(); toast.success("Saved");
    } catch (e) { toast.error(apiMessage(e, "Could not save.")); }
  }
  async function sendEmail() {
    setConfirming(false);
    try {
      const r = await send.mutateAsync({ key: step.key, data: { resend: !!step.emailSentAt } });
      toast.success(`Sent to ${r.sent} ${r.sent === 1 ? "person" : "people"}${r.notDelivered ? `, ${r.notDelivered} not delivered` : ""}.`);
      onChanged();
    } catch (e) { toast.error(apiMessage(e, "Could not send.")); }
  }
  async function markPosted() {
    try { await posted.mutateAsync({ key: step.key }); onChanged(); toast.success("Marked as posted"); } catch (e) { toast.error(apiMessage(e, "Could not save.")); }
  }

  return (
    <Card className={`bg-card ${step.status === "due" ? "border-primary/50" : ""}`} data-testid={`step-${step.key}`}>
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Day {step.day} · {longDate(step.dueDate)}{step.status === "upcoming" ? ` · in ${step.daysUntil} ${step.daysUntil === 1 ? "day" : "days"}` : ""}</p>
            <h3 className="font-serif text-xl font-bold">{step.title}</h3>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {step.postedAt && <Badge variant="secondary">Posted in group</Badge>}
            {step.emailSentAt && <Badge variant="secondary">Emailed {step.emailCount}</Badge>}
            {(step.needsFilling || step.whatsappNeedsFilling) && <Badge variant="destructive">Needs filling in</Badge>}
            <Badge variant={s.tone}>{s.label}</Badge>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{step.why}</p>
        <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm" data-testid={`whatsapp-${step.key}`}>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><MessageCircle className="h-3.5 w-3.5" strokeWidth={1.9} />WhatsApp group message</p>
          <p className="whitespace-pre-line leading-relaxed">{step.whatsapp}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" className="gap-1.5 rounded-full" onClick={() => void copy()} data-testid={`button-copy-${step.key}`}><Copy className="h-3.5 w-3.5" strokeWidth={1.9} />Copy for WhatsApp</Button>
          {!step.postedAt && <Button size="sm" variant="outline" className="gap-1.5 rounded-full" onClick={() => void markPosted()} data-testid={`button-posted-${step.key}`}><Check className="h-3.5 w-3.5" strokeWidth={1.9} />I posted it</Button>}
          <Button size="sm" variant="outline" className="gap-1.5 rounded-full" disabled={step.needsFilling || !emailReady || send.isPending} onClick={() => setConfirming(true)} data-testid={`button-email-${step.key}`}>
            <Mail className="h-3.5 w-3.5" strokeWidth={1.9} />{step.emailSentAt ? "Email again" : "Email everyone"}
          </Button>
          <Button size="sm" variant="ghost" className="gap-1.5 rounded-full" onClick={() => { setSubject(step.subject); setBody(step.body); setWhatsapp(step.whatsapp); setEditing(true); }} data-testid={`button-edit-${step.key}`}><Pencil className="h-3.5 w-3.5" strokeWidth={1.9} />Edit wording</Button>
        </div>
        {step.needsFilling && <p className="text-xs text-destructive">Fill in the [brackets] under Edit wording before this can be emailed.</p>}
        {!emailReady && <p className="text-xs text-muted-foreground">Email is not set up on this server yet, so only the WhatsApp message can be used.</p>}
      </CardContent>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle className="font-serif text-2xl">{step.title}</DialogTitle><DialogDescription>Anything in [square brackets] must be replaced before the email can be sent.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div><p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email subject</p><Input value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} data-testid="input-step-subject" /></div>
            <div><p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email message</p><Textarea rows={7} value={body} maxLength={4000} onChange={(e) => setBody(e.target.value)} data-testid="input-step-body" /></div>
            <div><p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">WhatsApp message</p><Textarea rows={8} value={whatsapp} maxLength={4000} onChange={(e) => setWhatsapp(e.target.value)} data-testid="input-step-whatsapp" /></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button><Button onClick={() => void saveEdits()} disabled={save.isPending || !subject.trim() || !body.trim() || !whatsapp.trim()} data-testid="button-save-step">Save</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{step.emailSentAt ? "Send this email again?" : "Email everyone?"}</AlertDialogTitle>
            <AlertDialogDescription>This sends the Bonisa-branded email "{step.subject}" to everyone in Artist Contacts who has an email address (except paused or suspended people). It cannot be taken back.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Not yet</AlertDialogCancel><AlertDialogAction onClick={() => void sendEmail()} data-testid="button-confirm-email">Send</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function Quiet() {
  const qc = useQueryClient();
  const [days, setDays] = useState(14);
  const { data = [], isLoading } = useListQuietContacts({ days }, { query: { queryKey: getListQuietContactsQueryKey({ days }) } });
  const touch = useTouchArtistContact();
  async function spoke(id: string, name: string) {
    try { await touch.mutateAsync({ contactId: id, data: {} }); toast.success(`Noted. ${name} is off the list for now.`); await qc.invalidateQueries({ queryKey: getListQuietContactsQueryKey({ days }) }); } catch (e) { toast.error(apiMessage(e, "Could not save.")); }
  }
  return (
    <section className="space-y-3" aria-labelledby="quiet-heading" data-testid="section-quiet">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="quiet-heading" className="font-serif text-2xl">Gone quiet</h2>
          <p className="mt-1 text-sm text-muted-foreground">Nobody has messaged or spoken to these people in a while. A short, personal message beats another group post.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">Quiet for <Input className="h-8 w-16" type="number" min={1} max={120} value={days} onChange={(e) => setDays(Math.max(1, Math.min(120, Number(e.target.value) || 14)))} data-testid="input-quiet-days" /> days</label>
      </div>
      {isLoading ? <Skeleton className="h-24 w-full" /> : data.length === 0 ? <p className="text-sm text-muted-foreground">Nobody has gone quiet. Well done.</p> : data.map((q) => (
        <Card key={q.id} className="bg-card" data-testid={`quiet-${q.id}`}>
          <CardContent className="flex flex-col gap-2 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">{q.name} <span className="font-normal text-muted-foreground">{[q.specialty, q.stage.replace(/_/g, " ")].filter(Boolean).join(" · ")}</span></p>
              <p className="text-xs text-muted-foreground">Quiet for {q.quietDays} days{q.reachable ? "" : ". No phone or email saved yet."}{q.lastTouchNote ? ` Last note: "${q.lastTouchNote}"` : ""}</p>
            </div>
            <div className="flex gap-2">
              <Link href="/owner/contacts"><Button size="sm" variant="outline">Open contacts</Button></Link>
              <Button size="sm" className="gap-1.5" disabled={touch.isPending} onClick={() => void spoke(q.id, q.name)} data-testid={`button-spoke-${q.id}`}><PhoneCall className="h-3.5 w-3.5" strokeWidth={1.9} />I spoke to her</Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

export default function OwnerKeepWarm() {
  const qc = useQueryClient();
  const { data: plan, isLoading } = useGetKeepWarmPlan({ query: { queryKey: getGetKeepWarmPlanQueryKey() } });
  const settings = useUpdateKeepWarmSettings();
  const refresh = () => qc.invalidateQueries({ queryKey: getGetKeepWarmPlanQueryKey() });

  async function setDay0(date: string) {
    if (!date) return;
    try { await settings.mutateAsync({ data: { startDate: date } }); await refresh(); toast.success("Day 0 saved"); } catch (e) { toast.error(apiMessage(e, "Could not save.")); }
  }
  const [link, setLink] = useState<string | null>(null);
  async function saveLink() {
    try { await settings.mutateAsync({ data: { groupLink: (link ?? plan?.groupLink ?? "").trim() } }); await refresh(); setLink(null); toast.success("Group link saved. It is now in every message."); } catch (e) { toast.error(apiMessage(e, "Could not save.")); }
  }
  async function setAuto(auto: boolean) {
    try { await settings.mutateAsync({ data: { auto } }); await refresh(); toast.success(auto ? "Automatic sending is on" : "Automatic sending is off"); } catch (e) { toast.error(apiMessage(e, "Could not save.")); }
  }

  if (isLoading || !plan) return <Skeleton className="h-64 w-full" />;
  const due = plan.steps.filter((s) => s.status === "due").length;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="mb-1 font-serif text-3xl">Keep warm</h1>
        <p className="text-sm text-muted-foreground">While payments are being finished, keep your first artists close: regular, honest messages, and a personal word for anyone who goes quiet.</p>
      </div>

      <Card className="bg-card" data-testid="card-keepwarm-settings">
        <CardContent className="grid gap-5 p-5 sm:grid-cols-3">
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><CalendarClock className="h-3.5 w-3.5" strokeWidth={1.9} />Day 0</p>
            <Input type="date" value={plan.startDate} onChange={(e) => void setDay0(e.target.value)} data-testid="input-day0" />
            <p className="mt-1 text-xs text-muted-foreground">The day the Founding 50 cards went out. Every step is timed from it.</p>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">This week</p>
            <p className="font-serif text-2xl font-bold">{due === 0 ? "Nothing due" : `${due} ${due === 1 ? "step" : "steps"} due`}</p>
            <p className="mt-1 text-xs text-muted-foreground">{plan.foundingArtists} Founding {plan.foundingArtists === 1 ? "Artist badge" : "Artist badges"} given so far, out of 50.</p>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Send emails automatically</p>
            <div className="flex items-center gap-2"><Switch checked={plan.auto} onCheckedChange={(v) => void setAuto(v)} aria-label="Send emails automatically" data-testid="switch-auto" /><span className="text-sm">{plan.auto ? "On" : "Off"}</span></div>
            <p className="mt-1 text-xs text-muted-foreground">When on, each email goes out on its due day. A message with unfilled [brackets] never sends. WhatsApp posts are always yours to make.</p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card" data-testid="card-group-link">
        <CardContent className="flex flex-col gap-2 p-5 sm:flex-row sm:items-end">
          <div className="flex-1">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your WhatsApp group link</p>
            <Input placeholder="https://chat.whatsapp.com/..." value={link ?? plan.groupLink} onChange={(e) => setLink(e.target.value)} data-testid="input-group-link" />
            <p className="mt-1 text-xs text-muted-foreground">Paste it once. It replaces [group link] in every message below, so you only copy and send.</p>
          </div>
          <Button onClick={() => void saveLink()} disabled={link === null || settings.isPending} data-testid="button-save-link">Save link</Button>
        </CardContent>
      </Card>

      <section className="space-y-4" aria-labelledby="steps-heading">
        <h2 id="steps-heading" className="font-serif text-2xl">The plan</h2>
        {plan.steps.map((step) => <Step key={step.key} step={step} emailReady={plan.emailConfigured} onChanged={() => void refresh()} />)}
      </section>

      <Quiet />
    </div>
  );
}
