import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetOwnerArtistReputationQueryKey,
  getListOwnerReputationDisputesQueryKey,
  getListOwnerReputationQueryKey,
  getListOwnerSafetyCheckinsQueryKey,
  useGetOwnerArtistReputation,
  useListOwnerReputation,
  useListOwnerReputationDisputes,
  useListOwnerSafetyCheckins,
  useRecordArtistNoShow,
  useRecordConductCase,
  useSetFoundingMember,
  useResolveReputationDispute,
  useReverseReputationEvent,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, HeartHandshake, Search } from "lucide-react";
import { toast } from "sonner";
import { TierBadge } from "@/components/reputation-badge";
import { FoundingBadge } from "@/components/founding-badge";
import { apiMessage, longDate } from "@/lib/campaign-money";

/**
 * Bonisa owner portal: Reputation.
 * Safety check-ins (people who said they need help come first), disputes waiting for a decision,
 * and every artist's standing with the events behind it. Nothing here changes a score silently:
 * every action needs a written reason and is kept in the audit log.
 */

function Safety() {
  const { data = [] } = useListOwnerSafetyCheckins({ query: { queryKey: getListOwnerSafetyCheckinsQueryKey(), refetchInterval: 60_000 } });
  const ordered = [...data].sort((a, b) => Number(b.status === "needs_help") - Number(a.status === "needs_help"));
  const needsHelp = ordered.filter((c) => c.status === "needs_help");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  async function openPhoto(url: string) {
    // The photo is private, so it is fetched with the owner's sign-in and shown from memory.
    const token = (JSON.parse(localStorage.getItem("glamnet_auth") ?? "{}") as { token?: string }).token;
    const res = await fetch(`${import.meta.env.BASE_URL}api${url}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) { toast.error("The photo could not be loaded."); return; }
    setPhotoUrl(URL.createObjectURL(await res.blob()));
    setPhoto(url);
  }

  return (
    <section className="space-y-3" aria-labelledby="safety-heading" data-testid="section-safety">
      <div>
        <h2 id="safety-heading" className="flex items-center gap-2 font-serif text-2xl"><HeartHandshake className="h-5 w-5" strokeWidth={1.9} />Safety check-ins</h2>
        <p className="mt-1 text-sm text-muted-foreground">Artists check in after a job with a photo and a code. Anyone who says she needs help is shown first, and you are messaged straight away.</p>
      </div>
      {needsHelp.length > 0 && (
        <Card className="border-destructive/40 bg-destructive/5" role="alert">
          <CardContent className="p-4 text-sm"><p className="font-semibold">{needsHelp.length} {needsHelp.length === 1 ? "artist says she needs help" : "artists say they need help"}</p></CardContent>
        </Card>
      )}
      {ordered.length === 0 ? <p className="text-sm text-muted-foreground">No check-ins yet.</p> : ordered.slice(0, 12).map((c) => (
        <Card key={c.id} className={`bg-card ${c.status === "needs_help" ? "border-destructive/50" : ""}`} data-testid={`checkin-${c.id}`}>
          <CardContent className="flex flex-col gap-2 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">{c.artistName} <span className="font-normal text-muted-foreground">· {c.serviceName} with {c.clientName}, {longDate(c.date)}</span></p>
              {c.note && <p className="text-xs text-muted-foreground">"{c.note}"</p>}
              <p className="mt-0.5 font-mono text-xs text-muted-foreground">{c.code}</p>
            </div>
            <div className="flex items-center gap-2">
              {c.isLastBooking && <Badge variant="secondary">Last booking</Badge>}
              <Badge variant={c.status === "needs_help" ? "destructive" : "secondary"}>{c.status === "needs_help" ? "Needs help" : "Safe"}</Badge>
              <Button size="sm" variant="outline" onClick={() => void openPhoto(c.photoUrl)}>View photo</Button>
            </div>
          </CardContent>
        </Card>
      ))}
      <Dialog open={photo !== null} onOpenChange={(o) => { if (!o) { setPhoto(null); if (photoUrl) URL.revokeObjectURL(photoUrl); setPhotoUrl(null); } }}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Check-in photo</DialogTitle></DialogHeader>{photoUrl && <img src={photoUrl} alt="Check-in" className="max-h-[70vh] w-full rounded-lg object-contain" />}</DialogContent>
      </Dialog>
    </section>
  );
}

function Disputes() {
  const qc = useQueryClient();
  const { data = [] } = useListOwnerReputationDisputes({ query: { queryKey: getListOwnerReputationDisputesQueryKey() } });
  const resolve = useResolveReputationDispute();
  const [open, setOpen] = useState<(typeof data)[number] | null>(null);
  const [note, setNote] = useState("");

  async function decide(decision: "uphold" | "reject") {
    if (!open) return;
    try {
      const res = await resolve.mutateAsync({ disputeId: open.id, data: { decision, note: note.trim() } });
      toast.success(res.message);
      setOpen(null); setNote("");
      await Promise.all([qc.invalidateQueries({ queryKey: getListOwnerReputationDisputesQueryKey() }), qc.invalidateQueries({ queryKey: getListOwnerReputationQueryKey() })]);
    } catch (e) {
      toast.error(apiMessage(e, "Could not save the decision."));
    }
  }

  return (
    <section className="space-y-3" aria-labelledby="disputes-heading" data-testid="section-disputes">
      <div className="flex items-center justify-between">
        <div>
          <h2 id="disputes-heading" className="font-serif text-2xl">Disputes to decide</h2>
          <p className="mt-1 text-sm text-muted-foreground">An artist asked for a record to be looked at again. It does not count against her until you decide. Give a reason she can read.</p>
        </div>
        <Badge variant="secondary">{data.length}</Badge>
      </div>
      {data.length === 0 ? <p className="text-sm text-muted-foreground">Nothing waiting.</p> : data.map((d) => (
        <Card key={d.id} className="bg-card" data-testid={`dispute-${d.id}`}>
          <CardContent className="flex flex-col gap-2 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">{d.artistName} <span className="font-normal text-muted-foreground">· {d.eventLabel}, {longDate(d.eventAt.slice(0, 10))}</span></p>
              <p className="text-xs text-muted-foreground">"{d.reason}"</p>
            </div>
            <Button size="sm" onClick={() => { setOpen(d); setNote(""); }}>Decide</Button>
          </CardContent>
        </Card>
      ))}
      <Dialog open={open !== null} onOpenChange={(o) => { if (!o) setOpen(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="font-serif text-2xl">Decide this dispute</DialogTitle><DialogDescription>{open?.artistName}: {open?.eventLabel}. She said: "{open?.reason}"</DialogDescription></DialogHeader>
          <Textarea rows={4} value={note} maxLength={1000} placeholder="Why you decided this. She will read it." onChange={(e) => setNote(e.target.value)} data-testid="input-decision-note" />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" disabled={note.trim().length < 5 || resolve.isPending} onClick={() => void decide("reject")} data-testid="button-reject-dispute">Record stands</Button>
            <Button disabled={note.trim().length < 5 || resolve.isPending} onClick={() => void decide("uphold")} data-testid="button-uphold-dispute">She is right, remove it</Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function ArtistDetail({ stylistId, onBack }: { stylistId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useGetOwnerArtistReputation(stylistId, { query: { queryKey: getGetOwnerArtistReputationQueryKey(stylistId) } });
  const reverse = useReverseReputationEvent();
  const conduct = useRecordConductCase();
  const noShow = useRecordArtistNoShow();
  const founding = useSetFoundingMember();
  const [reasonFor, setReasonFor] = useState<{ kind: "reverse"; id: string } | { kind: "noshow"; id: string } | { kind: "conduct" } | null>(null);
  const [reason, setReason] = useState("");
  const [severity, setSeverity] = useState<"minor" | "serious">("minor");
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: getGetOwnerArtistReputationQueryKey(stylistId) }), qc.invalidateQueries({ queryKey: getListOwnerReputationQueryKey() })]);

  async function submit() {
    if (!reasonFor) return;
    try {
      const r = reason.trim();
      const res = reasonFor.kind === "reverse" ? await reverse.mutateAsync({ eventId: reasonFor.id, data: { reason: r } })
        : reasonFor.kind === "noshow" ? await noShow.mutateAsync({ appointmentId: reasonFor.id, data: { reason: r } })
          : await conduct.mutateAsync({ stylistId, data: { severity, reason: r } });
      toast.success(res.message);
      setReasonFor(null); setReason("");
      await refresh();
    } catch (e) {
      toast.error(apiMessage(e, "Could not save that."));
    }
  }

  if (isLoading || !data) return <Skeleton className="h-64 w-full" />;
  const heading = reasonFor?.kind === "reverse" ? "Remove this event from her score" : reasonFor?.kind === "noshow" ? "Record a confirmed no-show" : "Record a confirmed conduct case";
  const help = reasonFor?.kind === "noshow" ? "Only record this after you have spoken to both sides. The client's payment is marked to be refunded." : reasonFor?.kind === "conduct" ? "Only a case you have reviewed and confirmed. An unproven claim must never be recorded." : "She will be able to see that it was removed.";

  return (
    <div className="space-y-4" data-testid="owner-artist-detail">
      <Button variant="ghost" size="sm" className="gap-1.5" onClick={onBack}><ArrowLeft className="h-4 w-4" />All artists</Button>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-serif text-2xl">{data.name}</h2>
        <TierBadge tier={data.tier} label={data.tierLabel} building={data.building} size="md" />
        {data.foundingMember && <FoundingBadge size="md" />}
        <Button size="sm" variant="outline" disabled={founding.isPending} data-testid="button-toggle-founding" onClick={async () => {
          try { const r = await founding.mutateAsync({ profileId: stylistId, data: { value: !data.foundingMember } }); toast.success(r.message); await refresh(); } catch (e) { toast.error(apiMessage(e, "Could not save that.")); }
        }}>{data.foundingMember ? "Remove Founding badge" : "Give Founding badge"}</Button>
        <span className="text-sm text-muted-foreground">Score {data.provisionalScore}{data.building ? " (provisional, not shown publicly)" : ""} · {data.completedBookings} completed</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-5">
        {data.categories.map((c) => (
          <div key={c.key} className="rounded-lg border border-border/60 bg-card p-3"><p className="text-lg font-semibold">{Math.round(c.score)}</p><p className="text-[11px] text-muted-foreground">{c.label} ({c.weightPercent}%)</p></div>
        ))}
      </div>

      <Card className="bg-card"><CardHeader className="pb-2"><CardTitle className="text-base">Events behind the score</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {data.events.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 p-2.5 text-sm">
              <span>{e.label}{e.detail ? ` · ${e.detail}` : ""} <span className="text-xs text-muted-foreground">({longDate(e.createdAt.slice(0, 10))})</span></span>
              <span className="flex items-center gap-2">
                <Badge variant={e.status === "active" ? "secondary" : "outline"}>{e.status.replace("_", " ")}</Badge>
                {e.status !== "reversed" && <Button size="sm" variant="ghost" onClick={() => { setReasonFor({ kind: "reverse", id: e.id }); setReason(""); }}>Remove</Button>}
              </span>
            </div>
          ))}
          {data.events.length === 0 && <p className="text-sm text-muted-foreground">No events yet.</p>}
        </CardContent>
      </Card>

      <Card className="bg-card"><CardHeader className="pb-2"><CardTitle className="text-base">Record something you have confirmed</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Button variant="outline" size="sm" onClick={() => { setReasonFor({ kind: "conduct" }); setReason(""); }} data-testid="button-conduct-case">Record a conduct case</Button>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mark a booking as a no-show</p>
          {data.recentBookings.filter((b) => !b.campaign && !b.noShow && b.status !== "completed").length === 0 ? <p className="text-muted-foreground">No bookings that can be marked.</p> : data.recentBookings.filter((b) => !b.campaign && !b.noShow && b.status !== "completed").map((b) => (
            <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 p-2.5">
              <span>{b.serviceName} with {b.clientName}, {longDate(b.date)} at {b.time} <span className="text-xs text-muted-foreground">({b.status})</span></span>
              <Button size="sm" variant="outline" onClick={() => { setReasonFor({ kind: "noshow", id: b.id }); setReason(""); }}>No-show</Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-card"><CardHeader className="pb-2"><CardTitle className="text-base">Audit trail</CardTitle></CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          {data.auditLog.length === 0 ? <p className="text-muted-foreground">No owner actions yet.</p> : data.auditLog.map((l) => (
            <p key={l.id}><span className="text-xs text-muted-foreground">{new Date(l.createdAt).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })} · {l.actor}</span><br />{l.action.replace(/_/g, " ")}: {l.reason}</p>
          ))}
        </CardContent>
      </Card>

      <Dialog open={reasonFor !== null} onOpenChange={(o) => { if (!o) setReasonFor(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="font-serif text-2xl">{heading}</DialogTitle><DialogDescription>{help}</DialogDescription></DialogHeader>
          {reasonFor?.kind === "conduct" && (
            <Select value={severity} onValueChange={(v) => setSeverity(v as "minor" | "serious")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="minor">Minor (lowers professionalism by 5)</SelectItem><SelectItem value="serious">Serious (lowers professionalism by 15)</SelectItem></SelectContent>
            </Select>
          )}
          <Textarea rows={4} value={reason} maxLength={1000} placeholder="The reason, in your own words. It goes in the audit log." onChange={(e) => setReason(e.target.value)} data-testid="input-owner-reason" />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setReasonFor(null)}>Cancel</Button>
            <Button disabled={reason.trim().length < (reasonFor?.kind === "reverse" ? 5 : 10)} onClick={() => void submit()} data-testid="button-owner-confirm">Confirm</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function OwnerReputation() {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const { data = [], isLoading } = useListOwnerReputation({ query: { queryKey: getListOwnerReputationQueryKey() } });
  const shown = useMemo(() => data.filter((a) => !q.trim() || a.name.toLowerCase().includes(q.trim().toLowerCase()) || a.specialty.toLowerCase().includes(q.trim().toLowerCase())), [data, q]);

  if (picked) return <ArtistDetail stylistId={picked} onBack={() => setPicked(null)} />;
  return (
    <div className="space-y-10">
      <div>
        <h1 className="mb-1 font-serif text-3xl">Reputation</h1>
        <p className="text-sm text-muted-foreground">Safety, disputes, and every artist's standing. Scores are worked out from recorded events only, and nothing is edited silently.</p>
      </div>
      <Safety />
      <Disputes />
      <section className="space-y-3" aria-labelledby="artists-heading">
        <h2 id="artists-heading" className="font-serif text-2xl">Artists</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.9} />
          <Input className="pl-9" placeholder="Search by name or speciality" value={q} onChange={(e) => setQ(e.target.value)} data-testid="input-search-artists" />
        </div>
        {isLoading ? <Skeleton className="h-32 w-full" /> : shown.length === 0 ? <p className="text-sm text-muted-foreground">No artists match.</p> : shown.map((a) => (
          <Card key={a.stylistId} className="cursor-pointer bg-card transition-colors hover:border-primary/40" onClick={() => setPicked(a.stylistId)} data-testid={`artist-row-${a.stylistId}`}>
            <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
              <div><p className="font-semibold">{a.name}</p><p className="text-xs text-muted-foreground">{a.specialty} · {a.completedBookings} completed</p></div>
              <div className="flex items-center gap-2">
                {a.openDisputes > 0 && <Badge variant="destructive">{a.openDisputes} dispute{a.openDisputes > 1 ? "s" : ""}</Badge>}
                <span className="text-muted-foreground">{a.score !== null ? Math.round(a.score) : "-"}</span>
                {a.foundingMember && <FoundingBadge />}
                <TierBadge tier={a.tier} label={a.tierLabel} building={a.building} />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
