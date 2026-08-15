import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ShieldCheck, ShieldX, Mail, Phone, MapPin, Clock, Inbox } from "lucide-react";
import { toast } from "sonner";

/**
 * Bonisa owner portal.
 *
 * The verification queue. Only reachable by the account whose email matches
 * OWNER_EMAIL on the server — everyone else gets a 403 from the API and an
 * access message here.
 *
 * Since verification is now a gate rather than a badge, this page is the switch
 * between an artist being invisible and being live. It is the most important
 * screen in the product for the First 50.
 */

interface PendingArtist {
  profileId: string;
  name: string;
  specialty: string;
  location: string;
  bio: string | null;
  email: string | null;
  phone: string | null;
  joinedAt: string;
}

function authHeaders(): HeadersInit {
  try {
    const stored = localStorage.getItem("glamnet_auth");
    const token = stored ? JSON.parse(stored)?.token : null;
    return token
      ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
      : { "Content-Type": "application/json" };
  } catch {
    return { "Content-Type": "application/json" };
  }
}

function daysWaiting(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function ArtistCardSkeleton() {
  return (
    <Card className="bg-card border-border/50">
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-24 mt-2" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function OwnerPortal() {
  const { user } = useAuth();
  const [artists, setArtists] = useState<PendingArtist[] | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<PendingArtist | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/owner/artists/pending", { headers: authHeaders() });
      if (res.status === 403 || res.status === 401) {
        setForbidden(true);
        setArtists([]);
        return;
      }
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      setArtists(await res.json());
      setForbidden(false);
    } catch (err) {
      toast.error("Could not load the verification queue. Check you are online and try again.");
      setArtists([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function approve(a: PendingArtist) {
    setBusyId(a.profileId);
    try {
      const res = await fetch(`/api/owner/artists/${a.profileId}/verify`, {
        method: "POST",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(await res.text());
      const body = await res.json();
      toast.success(body.message ?? `${a.name} is now verified`);
      setArtists((prev) => (prev ?? []).filter((p) => p.profileId !== a.profileId));
    } catch {
      toast.error(`Could not verify ${a.name}. Nothing was changed.`);
    } finally {
      setBusyId(null);
    }
  }

  async function reject() {
    if (!rejecting) return;
    if (!reason.trim()) {
      toast.error("Tell her what needs fixing. A rejection with no reason just loses the artist.");
      return;
    }
    setBusyId(rejecting.profileId);
    try {
      const res = await fetch(`/api/owner/artists/${rejecting.profileId}/reject`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(`${rejecting.name} has been told what to fix and can resubmit.`);
      setArtists((prev) => (prev ?? []).filter((p) => p.profileId !== rejecting.profileId));
      setRejecting(null);
      setReason("");
    } catch {
      toast.error(`Could not reject ${rejecting.name}. Nothing was changed.`);
    } finally {
      setBusyId(null);
    }
  }

  if (forbidden) {
    return (
      <div className="max-w-2xl mx-auto px-5 py-16 text-center">
        <ShieldX className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
        <h1 className="font-serif text-2xl mb-2">Owner access only</h1>
        <p className="text-sm text-muted-foreground">
          This page is limited to the Bonisa owner account. You are signed in as{" "}
          <span className="font-medium">{user?.email ?? "an unknown account"}</span>.
        </p>
        <p className="text-sm text-muted-foreground mt-3">
          If that should have access, the <code>OWNER_EMAIL</code> secret on the server needs to
          match this address exactly.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-5 py-8">
      <div className="mb-7">
        <h1 className="font-serif text-3xl mb-1">Verification queue</h1>
        <p className="text-sm text-muted-foreground">
          Only verified artists appear on Bonisa. Until you approve someone here, she is invisible
          to clients and cannot be booked.
        </p>
      </div>

      {artists === null && (
        <div className="space-y-4">
          <ArtistCardSkeleton />
          <ArtistCardSkeleton />
        </div>
      )}

      {artists !== null && artists.length === 0 && (
        <Card className="bg-card border-border/50">
          <CardContent className="py-14 text-center">
            <Inbox className="h-9 w-9 mx-auto mb-4 text-muted-foreground/50" />
            <p className="font-medium mb-1">Nobody waiting</p>
            <p className="text-sm text-muted-foreground">
              Artists appear here once they complete their profile and submit for verification.
            </p>
          </CardContent>
        </Card>
      )}

      {artists !== null && artists.length > 0 && (
        <div className="space-y-4">
          {artists.map((a) => {
            const waiting = daysWaiting(a.joinedAt);
            return (
              <Card key={a.profileId} className="bg-card border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="font-serif text-xl">{a.name}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">{a.specialty}</p>
                    </div>
                    {waiting >= 3 && (
                      <Badge variant="destructive" className="shrink-0">
                        <Clock className="h-3 w-3 mr-1" />
                        {waiting} days waiting
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {a.bio && <p className="text-sm leading-relaxed">{a.bio}</p>}

                  <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                    {a.location && (
                      <span className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5" />
                        {a.location}
                      </span>
                    )}
                    {a.email && (
                      <span className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5" />
                        {a.email}
                      </span>
                    )}
                    <span className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5" />
                      {a.phone ?? (
                        <span className="text-amber-600">
                          No phone on file, she will only be reachable by email
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button
                      onClick={() => approve(a)}
                      disabled={busyId === a.profileId}
                      className="gap-2"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      Verify
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setRejecting(a);
                        setReason("");
                      }}
                      disabled={busyId === a.profileId}
                    >
                      Needs more
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={rejecting !== null} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">
              What does {rejecting?.name} need to fix?
            </DialogTitle>
            <DialogDescription>
              She gets this word for word, by WhatsApp and email, and can submit again once it is
              sorted. Be specific and kind.
            </DialogDescription>
          </DialogHeader>

          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="Your portfolio only has one photo. Add two or three more showing finished work, and we will approve you straight away."
          />

          <div className="flex gap-2 justify-end pt-1">
            <Button variant="outline" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button onClick={reject} disabled={busyId !== null}>
              Send and reset
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
