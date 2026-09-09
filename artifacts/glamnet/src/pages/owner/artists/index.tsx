import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Search, ChevronRight, Users, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useListOwnerArtists } from "@workspace/api-client-react";
export default function OwnerArtists() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSearch(q.trim().slice(0, 80)), 250);
    return () => clearTimeout(timer);
  }, [q]);
  const { data: rows = [], isLoading, isError, refetch } = useListOwnerArtists({ q: search || undefined });
  return <div className="space-y-6">
    <div><h1 className="font-serif text-3xl mb-2">Artist Management</h1><p className="text-sm text-muted-foreground">Review artist performance, verification and account status.</p></div>
    <div className="relative max-w-xl"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" strokeWidth={1.9}/><Input className="pl-10 h-12" placeholder="Search artists by name, email or specialty…" value={q} onChange={e => setQ(e.target.value)}/></div>
    {isError ? <div className="py-12 text-center"><AlertCircle className="mx-auto mb-3 text-destructive" strokeWidth={1.9}/><p>Could not load artists.</p><button className="text-primary text-sm mt-2" onClick={() => void refetch()}>Retry</button></div> :
      isLoading ? <div className="py-12 text-center text-muted-foreground">Loading artists…</div> :
      rows.length === 0 ? <div className="py-12 text-center text-muted-foreground"><Users className="mx-auto mb-3 opacity-40" strokeWidth={1.9}/><p>No artists found.</p></div> :
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{rows.map(a =>
        <Link key={a.profileId} href={`/owner/artists/${a.profileId}`}><Card className="h-full hover:border-primary/50 transition-colors"><CardContent className="p-5 space-y-4">
          <div className="flex justify-between gap-3"><div><h2 className="font-semibold">{a.name}</h2><p className="text-sm text-muted-foreground">{a.specialty}</p></div><Badge variant={a.accountStatus === "suspended" ? "destructive" : "secondary"}>{a.accountStatus}</Badge></div>
          <div className="grid grid-cols-2 gap-3 text-sm"><div><p className="text-muted-foreground text-xs">Completed</p><p className="font-medium">{a.completedBookings}</p></div><div><p className="text-muted-foreground text-xs">Cancellation</p><p className="font-medium">{Math.round(a.cancellationRate * 100)}%</p></div><div><p className="text-muted-foreground text-xs">Rating</p><p className="font-medium">{Number(a.rating).toFixed(1)} ({a.reviewCount})</p></div><div><p className="text-muted-foreground text-xs">Complaints / disputes</p><p className="font-medium">{a.complaintCount} / {a.disputeCount}</p></div></div>
          <div className="flex justify-between text-xs text-muted-foreground border-t pt-3"><span>Earned R {Number(a.totalEarnings).toFixed(2)}</span><ChevronRight className="h-4 w-4" strokeWidth={1.9}/></div>
        </CardContent></Card></Link>)}</div>}
  </div>;
}