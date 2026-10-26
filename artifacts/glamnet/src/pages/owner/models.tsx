import { useState } from "react";
import { AlertTriangle, Users } from "lucide-react";
import { useGetOwnerModel, useListOwnerModels, useRejectModel, useSetModelSpotlight, useVerifyModel, getListOwnerModelsQueryKey, getGetOwnerModelQueryKey } from "@workspace/api-client-react";
import type { OwnerModelRow } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AuthedImage } from "@/components/portal/authed-image";
import { StatusPill } from "@/components/portal/status-pill";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/portal/states";
import { PLATFORM_LABEL, errorMessage, formatDay } from "@/lib/portal";

function Review({ row, onClose }: { row: OwnerModelRow; onClose: () => void }) {
  const { data, isLoading, error, refetch } = useGetOwnerModel(row.id);
  const verify = useVerifyModel();
  const reject = useRejectModel();
  const spotlight = useSetModelSpotlight();
  const [note, setNote] = useState("");
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const done = async (msg: string) => { toast.success(msg); await Promise.all([qc.invalidateQueries({ queryKey: getListOwnerModelsQueryKey() }), qc.invalidateQueries({ queryKey: getGetOwnerModelQueryKey(row.id) })]); };

  return (
    <section className="rounded-2xl border border-border bg-card p-6 space-y-5" aria-label={`Review ${row.professionalName}`}>
      <div className="flex items-start justify-between gap-3"><div><h2 className="text-2xl font-serif font-bold">{row.professionalName}</h2><p className="text-sm text-muted-foreground">{row.category} · {row.area || "No area"}</p></div><Button variant="ghost" size="sm" onClick={onClose}>Close</Button></div>
      <p className="text-xs text-muted-foreground">Opening this record, and each photo, is written to the access log.</p>
      {isLoading ? <LoadingBlock /> : error || !data ? <ErrorBlock onRetry={() => refetch()} /> : (
        <>
          <dl className="grid sm:grid-cols-[120px_1fr] gap-y-1 text-sm">
            <dt className="text-muted-foreground">Email</dt><dd>{data.email}</dd>
            <dt className="text-muted-foreground">Phone</dt><dd>{data.phone ?? "None"}</dd>
            <dt className="text-muted-foreground">Bio</dt><dd className="whitespace-pre-line">{data.bio ?? "None"}</dd>
            <dt className="text-muted-foreground">Skills</dt><dd>{data.skills.join(", ") || "None"}</dd>
            <dt className="text-muted-foreground">Channels</dt><dd>{data.socialLinks.length ? data.socialLinks.map((l) => `${PLATFORM_LABEL[l.platform] ?? l.platform}${l.followerCount != null ? ` (${l.followerCount.toLocaleString("en-ZA")}, self-reported)` : ""}`).join(", ") : "None"}</dd>
          </dl>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {data.photos.filter((p) => p.kind !== "editorial").map((p) => (
              <figure key={p.id} className="space-y-1"><div className="aspect-[3/4] rounded-lg overflow-hidden border border-border bg-muted"><AuthedImage path={p.url} alt={`${p.kind} digital`} className="h-full w-full" /></div><figcaption className="text-xs text-center text-muted-foreground">{p.kind.replace("_", " ")}</figcaption></figure>
            ))}
          </div>
          {data.row.verificationStatus === "verified" && (
            <div className="space-y-3 border-t border-border pt-5">
              <p className="text-sm"><strong>Bonisa ID {data.row.registryNumber}</strong></p>
              {data.row.isSpotlight ? (
                <div className="space-y-2">
                  <p className="text-sm">Featured in the Spotlight{data.row.spotlightNote ? `: "${data.row.spotlightNote}"` : ""}.</p>
                  <Button variant="outline" size="sm" disabled={spotlight.isPending} onClick={async () => { try { await spotlight.mutateAsync({ modelId: row.id, data: { spotlight: false } }); await done("Removed from the Spotlight"); } catch (err) { toast.error(errorMessage(err)); } }}>Remove from Spotlight</Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <label htmlFor="note" className="text-sm font-medium">Feature in the Spotlight (an editorial pick, shown with a short line)</label>
                  <input id="note" value={note} maxLength={140} onChange={(e) => setNote(e.target.value)} placeholder="Optional line, e.g. Known for striking beauty close-ups" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
                  <Button size="sm" disabled={spotlight.isPending} onClick={async () => { try { await spotlight.mutateAsync({ modelId: row.id, data: { spotlight: true, note: note.trim() || null } }); setNote(""); await done("Added to the Spotlight"); } catch (err) { toast.error(errorMessage(err)); } }}>Add to Spotlight</Button>
                  <p className="text-xs text-muted-foreground">The model sees this on their overview. Only pick on merit you can stand behind, never on popularity.</p>
                </div>
              )}
            </div>
          )}
          {data.row.verificationStatus === "pending" && (
            <div className="space-y-3 border-t border-border pt-5">
              {!rejecting ? (
                <div className="flex gap-2 flex-wrap">
                  <Button disabled={verify.isPending} onClick={async () => { try { await verify.mutateAsync({ modelId: row.id }); await done("Verified"); onClose(); } catch (err) { toast.error(errorMessage(err)); } }}>Verify after reviewing</Button>
                  <Button variant="outline" onClick={() => setRejecting(true)}>Reject with a reason</Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <label htmlFor="why" className="text-sm font-medium">Reason. The model receives this word for word.</label>
                  <Textarea id="why" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} minLength={10} maxLength={1000} className="bg-background" />
                  <div className="flex gap-2">
                    <Button variant="destructive" disabled={reject.isPending || reason.trim().length < 10} onClick={async () => { try { await reject.mutateAsync({ modelId: row.id, data: { reason: reason.trim() } }); await done("Rejected. The model can see your reason."); onClose(); } catch (err) { toast.error(errorMessage(err)); } }}>Send rejection</Button>
                    <Button variant="ghost" onClick={() => setRejecting(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default function OwnerModels() {
  const { data, isLoading, error, refetch } = useListOwnerModels();
  const [selected, setSelected] = useState<OwnerModelRow | null>(null);
  const waiting = (data ?? []).filter((m) => m.verificationStatus === "pending");
  const rest = (data ?? []).filter((m) => m.verificationStatus !== "pending");

  const Row = ({ m }: { m: OwnerModelRow }) => (
    <li><button onClick={() => setSelected(m)} className="w-full text-left rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-3 hover:border-primary transition-colors">
      <div><p className="font-semibold">{m.professionalName}{m.isSpotlight ? " · Spotlight" : ""}</p><p className="text-xs text-muted-foreground">{m.registryNumber ? `${m.registryNumber} · ` : ""}{m.category || "No category"} · {m.photoCount} photo{m.photoCount === 1 ? "" : "s"} · joined {formatDay(m.createdAt)}</p></div>
      <div className="flex items-center gap-2">
        {m.verificationStatus === "pending" && m.daysWaiting != null && (
          <span className={`text-xs font-semibold flex items-center gap-1 ${m.daysWaiting >= 3 ? "text-destructive" : "text-muted-foreground"}`}>{m.daysWaiting >= 3 && <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" />}Waiting {m.daysWaiting === 0 ? "today" : `${m.daysWaiting} day${m.daysWaiting === 1 ? "" : "s"}`}{m.daysWaiting >= 3 ? ", over 72 hours" : ""}</span>
        )}
        <StatusPill status={m.verificationStatus} kind="verification" />
      </div>
    </button></li>
  );

  return (
    <div className="space-y-8">
      <div className="space-y-2"><h1 className="text-3xl font-serif font-bold">Model registry</h1><p className="text-muted-foreground">Who is waiting, and for how long. Nobody should wait past 72 hours. Always open the record before deciding.</p></div>
      {isLoading ? <LoadingBlock /> : error ? <ErrorBlock onRetry={() => refetch()} /> : !data?.length ? (
        <EmptyBlock icon={<Users className="h-8 w-8" strokeWidth={1.9} />} title="No models have signed up yet">New model accounts appear here.</EmptyBlock>
      ) : (
        <>
          {selected && <Review key={selected.id} row={selected} onClose={() => setSelected(null)} />}
          <section className="space-y-3" aria-labelledby="w-h"><h2 id="w-h" className="text-xl">Waiting for verification ({waiting.length})</h2>
            {waiting.length ? <ul className="space-y-2">{waiting.map((m) => <Row key={m.id} m={m} />)}</ul> : <p className="text-sm text-muted-foreground">Nobody is waiting.</p>}</section>
          <section className="space-y-3" aria-labelledby="a-h"><h2 id="a-h" className="text-xl">Everyone else ({rest.length})</h2>
            {rest.length ? <ul className="space-y-2">{rest.map((m) => <Row key={m.id} m={m} />)}</ul> : <p className="text-sm text-muted-foreground">No other models.</p>}</section>
        </>
      )}
    </div>
  );
}
