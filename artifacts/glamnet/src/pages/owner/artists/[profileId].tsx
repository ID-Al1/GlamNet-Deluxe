import { useState } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, Star, Ban, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getGetOwnerArtistManagementQueryKey, useGetOwnerArtistManagement, useUpdateOwnerArtistAccountStatus } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
function headers() { const raw = localStorage.getItem("glamnet_auth"); const token = raw ? JSON.parse(raw)?.token : null; return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }; }
export default function OwnerArtistDetail() {
  const { profileId } = useParams<{ profileId: string }>();
  const { toast } = useToast();
  const [offset, setOffset] = useState(0);
  const [reviewPending, setReviewPending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { data: artist, isLoading, isError, refetch, isFetching } = useGetOwnerArtistManagement(profileId, { limit: 25, offset });
  const accountMutation = useUpdateOwnerArtistAccountStatus();
  async function status(next: "active" | "suspended") { const reason = window.prompt(`Reason for ${next === "suspended" ? "suspending" : "reactivating"} this account:`)?.trim(); if (!reason || accountMutation.isPending) return; try { await accountMutation.mutateAsync({ profileId, data: { status: next, reason } }); toast({ title: `Artist account ${next}` }); await queryClient.invalidateQueries({ queryKey: getGetOwnerArtistManagementQueryKey(profileId) }); } catch { toast({ title: "Could not update account", variant: "destructive" }); } }
  async function review(action: "verify" | "reject") {
    if (reviewPending || artist?.verificationStatus !== "pending") return;
    const body = action === "reject" ? { reason: window.prompt("Reason for rejecting this verification:")?.trim() } : {};
    if (action === "reject" && !body.reason) return;
    setReviewPending(true); setFeedback(null);
    try {
      const r = await fetch(`/api/owner/artists/${profileId}/${action}`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
      const text = await r.text(); let result: { error?: string } = {};
      try { result = text ? JSON.parse(text) as { error?: string } : {}; } catch { /* non-JSON error */ }
      if (!r.ok) { setFeedback(result.error || "Could not update verification"); return; }
      toast({ title: action === "verify" ? "Artist approved" : "Verification rejected" });
      await queryClient.invalidateQueries({ queryKey: getGetOwnerArtistManagementQueryKey(profileId) });
    } catch { setFeedback("Network error. Check your connection and try again."); } finally { setReviewPending(false); }
  }
  if (isLoading) return <div className="text-muted-foreground">Loading artist…</div>;
  if (isError || !artist) return <div className="text-center py-12"><p>Could not load artist.</p><Button className="mt-3" onClick={() => void refetch()}>Retry</Button></div>;
  return <div className="space-y-6 pb-10"><Link href="/owner/artists" className="inline-flex items-center text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4 mr-2" strokeWidth={1.9}/>Back to artists</Link>
    <div className="flex flex-wrap justify-between gap-4 items-start"><div><h1 className="font-serif text-3xl">{artist.name}</h1><p className="text-muted-foreground">{artist.specialty} · {artist.location || "Location not specified"}</p></div><div className="flex gap-2 items-center flex-wrap"><Badge>{artist.verificationStatus}</Badge><Badge variant={artist.accountStatus === "suspended" ? "destructive" : "secondary"}>{artist.accountStatus}</Badge>{artist.verificationStatus === "pending" && <><Button size="sm" disabled={reviewPending} onClick={() => void review("verify")}><CheckCircle2 className="h-4 w-4 mr-2" strokeWidth={1.9}/>Approve</Button><Button size="sm" variant="outline" disabled={reviewPending} onClick={() => void review("reject")}>Reject</Button></>}{artist.accountStatus === "suspended" ? <Button size="sm" disabled={accountMutation.isPending} onClick={() => void status("active")}><CheckCircle2 className="h-4 w-4 mr-2" strokeWidth={1.9}/>Reactivate</Button> : <Button size="sm" variant="outline" disabled={accountMutation.isPending} onClick={() => void status("suspended")}><Ban className="h-4 w-4 mr-2" strokeWidth={1.9}/>Suspend</Button>}</div></div>
    {feedback && <p role="alert" className="text-sm text-destructive">{feedback}</p>}
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">{[["Completed", artist.completedBookings],["Cancellation", `${Math.round(artist.cancellationRate * 100)}%`],["Rating", <><Star className="inline h-4 w-4 mr-1" strokeWidth={1.9}/>{Number(artist.rating).toFixed(1)}</>],["Earnings", `R ${Number(artist.totalEarnings).toFixed(2)}`],["Complaints", artist.complaintCount],["Disputes", artist.disputeCount]].map(([label,value]) => <Card key={String(label)}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="font-semibold text-lg mt-1">{value}</p></CardContent></Card>)}</div>
    <Card><CardHeader><CardTitle className="font-serif">Payout history</CardTitle></CardHeader><CardContent><div className="divide-y">{artist.payoutBatches.map(b => <div className="py-3 flex justify-between text-sm" key={b.id}><span>{b.reference} · {b.lineCount} bookings</span><strong>R {Number(b.totalAmount).toFixed(2)}</strong></div>)}{!artist.payoutBatches.length && <p className="text-sm text-muted-foreground">No completed payout batches.</p>}</div></CardContent></Card>
    <Card><CardHeader><CardTitle className="font-serif">Bookings</CardTitle></CardHeader><CardContent><div className="divide-y">{artist.bookings.map(b => <div className="py-3 flex justify-between text-sm" key={b.id}><span>{b.date} · {b.clientName} · {b.serviceName}</span><Badge variant="outline">{b.status}</Badge></div>)}</div></CardContent></Card>
    <div className="flex justify-between items-center"><Button variant="outline" disabled={offset === 0 || isFetching} onClick={() => setOffset(Math.max(0, offset - artist.historyLimit))}>Previous history</Button><span className="text-xs text-muted-foreground">Showing {artist.historyOffset + 1}–{artist.historyOffset + Math.max(artist.bookings.length, artist.payouts.length, artist.payoutBatches.length)}</span><Button variant="outline" disabled={artist.nextOffset == null || isFetching} onClick={() => artist.nextOffset != null && setOffset(artist.nextOffset)}>Next history</Button></div>
  </div>;
}