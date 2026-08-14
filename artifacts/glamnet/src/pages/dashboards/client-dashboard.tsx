import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { useGetClientDashboard, useListStylists } from "@workspace/api-client-react";
import { SERVICE_CATEGORIES } from "@/lib/categories";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Play, ChevronRight, Star,
  Calendar, MessageCircle,
  CheckCircle, ShieldAlert, CircleCheck, Banknote,
} from "lucide-react";
import { toast } from "sonner";
import { frenchGreeting } from "@/components/bonisa-logo";
import { formatRating } from "@/lib/utils";

import heroMomentsImg from "@assets/generated_images/hero-moments.jpg";
import dateNightImg from "@assets/generated_images/moment-datenight.jpg";
import weddingImg from "@assets/generated_images/moment-wedding.jpg";
import graduationImg from "@assets/generated_images/moment-graduation.jpg";
import birthdayImg from "@assets/generated_images/moment-birthday.jpg";
import lemonadeImg from "@assets/generated_images/look-lemonade.jpg";

// ── Status chip colours ────────────────────────────────────────────────────
import { VerifiedBadge } from "@/components/ui/verified-badge";
const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-primary/15 text-primary border border-primary/25",
  completed: "bg-muted/70 text-muted-foreground border border-border/40",
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
  cancelled: "bg-destructive/10 text-destructive border border-destructive/20",
};

// ── Local helpers ──────────────────────────────────────────────────────────
const MOMENTS = [
  { label: "Date Night",  image: dateNightImg },
  { label: "Wedding",     image: weddingImg },
  { label: "Graduation",  image: graduationImg },
  { label: "Birthday",    image: birthdayImg },
];

function SectionHeading({ title, actionLabel, href }: { title: string; actionLabel?: string; href?: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-[11px] font-bold tracking-[0.14em] uppercase text-foreground/60">{title}</h2>
      {actionLabel && href && (
        <Link href={href}>
          <span className="text-[11px] text-primary font-semibold hover:opacity-80 transition-opacity">{actionLabel}</span>
        </Link>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ClientDashboard() {
  const { user, token } = useAuth();
  const qc = useQueryClient();
  const { data: dashboard, isLoading, error } = useGetClientDashboard();
  const { data: stylists } = useListStylists({ specialty: undefined }, {
    query: { staleTime: 60_000, queryKey: ["stylists", "dashboard-featured"] },
  });
  const featured = (stylists ?? []).slice().sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0];

  const confirmWorkMutation = useMutation({
    mutationFn: async ({ appointmentId, dispute = false }: { appointmentId: string; dispute?: boolean }) => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/appointments/${appointmentId}/confirm-work`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ dispute }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Request failed");
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["clientDashboard"] });
      if (vars.dispute) {
        toast.warning("Dispute raised — Bonisa will review and contact both parties.");
      } else {
        toast.success("Work confirmed! Waiting for the artist to confirm too.");
      }
    },
    onError: (err: any) => toast.error(err.message || "Something went wrong"),
  });

  const [phone, setPhone] = useState((user as any)?.phone ?? "");
  const [savingPhone, setSavingPhone] = useState(false);
  const savePhone = async () => {
    setSavingPhone(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/auth/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phone }),
      });
      if (!res.ok) throw new Error();
      toast.success("Phone number saved — WhatsApp notifications enabled!");
    } catch {
      toast.error("Could not save phone number");
    } finally {
      setSavingPhone(false);
    }
  };

  if (error) return (
    <div className="p-8 text-center text-destructive">
      <p className="font-medium">Failed to load your dashboard.</p>
      <Button variant="outline" className="mt-4 rounded-full" onClick={() => window.location.reload()}>Retry</Button>
    </div>
  );

  // Find next appointment for the hero card
  const localDate = (a: { date: string; time?: string }) => new Date(`${a.date}T${a.time ?? "00:00"}`);
  const next = (dashboard?.recentAppointments ?? [])
    .filter(a => (a.status === "confirmed" || a.status === "pending") && localDate(a) >= new Date())
    .sort((a, b) => localDate(a).getTime() - localDate(b).getTime())[0];

  return (
    <div className="flex flex-col min-h-screen bg-background pb-[88px] overflow-x-hidden">

      {/* ── GREETING ── */}
      <div className="px-5 pt-5 pb-4">
        <p className="text-[15px] font-medium text-foreground/80">{frenchGreeting()}</p>
        <h2 className="text-3xl font-serif font-bold text-foreground">
          {user?.name.split(" ")[0]}
        </h2>
      </div>

      {/* ── HERO BANNER ── */}
      <div className="px-5 mb-8">
        <div className="relative rounded-3xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.06)] h-64 bg-gradient-to-r from-primary to-[hsl(348_40%_15%)]">
          <img
            src={heroMomentsImg}
            alt="Life's moments"
            className="absolute right-0 top-0 h-full w-3/5 object-cover object-left"
            style={{ maskImage: "linear-gradient(to right, transparent, black 40%)", WebkitMaskImage: "linear-gradient(to right, transparent, black 40%)" }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/80 to-transparent w-full" />

          <div className="relative z-10 p-6 flex flex-col h-full justify-center w-2/3">
            <p className="text-[10px] font-bold text-primary-foreground/70 tracking-widest uppercase mb-2">Your next look</p>
            <h2 className="text-2xl font-serif font-bold text-primary-foreground leading-tight mb-2">
              Beauty on<br />your terms
            </h2>
            <p className="text-xs text-primary-foreground/80 mb-5 leading-relaxed max-w-[160px]">
              Find the artist. Book the moment.
            </p>
            <Link href="/stylists">
              <Button className="bg-white/15 hover:bg-white/25 text-white border border-white/20 rounded-full text-xs font-semibold px-5 h-9 w-fit shadow-sm backdrop-blur-sm">
                Find an Artist <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* ── FOR YOUR MOMENT ── */}
      <div className="mb-8">
        <div className="px-5">
          <SectionHeading title="For Your Moment" actionLabel="See All" href="/stylists" />
        </div>
        <div className="flex gap-3 overflow-x-auto px-5 pb-4 snap-x snap-mandatory" style={{ scrollbarWidth: 'none' }}>
          {MOMENTS.map(moment => (
            <Link key={moment.label} href={`/stylists?search=${encodeURIComponent(moment.label)}`}>
              <div className="snap-start shrink-0 relative w-[90px] h-[120px] rounded-2xl overflow-hidden cursor-pointer group">
                <img src={moment.image} alt={moment.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <span className="absolute bottom-3 left-0 w-full text-center text-white text-[10px] font-bold tracking-wide">
                  {moment.label}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── AI RECOMMENDS ── */}
      {featured && (
        <div className="px-5 mb-8">
          <SectionHeading title="Chosen For You" actionLabel="See All" href="/stylists" />
          <div className="bg-card rounded-[24px] p-4 flex items-center justify-between border border-border/40 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-[60px] h-[60px] rounded-xl overflow-hidden shrink-0">
                <img src={lemonadeImg} alt={featured.name} className="w-full h-full object-cover" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-foreground">{featured.name}</h3>
                <p className="text-[11px] mt-0.5" style={{ color: 'hsl(var(--baby-blue))' }}>{featured.specialty} · Highly rated</p>
                <div className="flex items-center gap-1 mt-1.5">
                  {featured.reviewCount ? (
                    <>
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      <span className="text-xs font-semibold">{formatRating(featured.rating ?? 0)}</span>
                      <span className="text-[10px] text-muted-foreground">({featured.reviewCount})</span>
                    </>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">New artist</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/book/${featured.id}`}>
                <Button size="sm" className="bg-primary hover:bg-primary/90 text-white rounded-full text-xs font-semibold px-4 h-8">
                  Book
                </Button>
              </Link>
              <Link href={`/stylists/${featured.id}`}>
                <button className="w-8 h-8 rounded-full border border-border bg-background flex items-center justify-center text-foreground hover:bg-muted transition-colors">
                  <Play className="h-3 w-3 ml-0.5" />
                </button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── UPCOMING APPOINTMENT ── */}
      {next && (
        <div className="px-5 mb-8">
          <SectionHeading title="Upcoming Appointment" />
          <Link href={`/appointments/${next.id}`}>
            <div className="bg-primary rounded-[24px] p-5 shadow-sm text-primary-foreground flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4">
                <div className="text-center w-12 shrink-0 border-r border-white/20 pr-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">
                    {localDate(next).toLocaleDateString("en-ZA", { weekday: "short" })}
                  </p>
                  <p className="text-2xl font-serif font-bold leading-none my-1">{localDate(next).getDate()}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">
                    {localDate(next).toLocaleDateString("en-ZA", { month: "short" })}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-white/80 mb-0.5">{next.time}</p>
                  <p className="font-bold text-[15px] leading-snug">{next.stylistName}</p>
                  <p className="text-[11px] text-white/70 mb-1.5">{next.serviceName}</p>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] bg-white/10 border border-white/20 text-[9px] font-semibold uppercase tracking-wider">
                    {next.status === "confirmed" && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="opacity-80">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                    {next.status === "confirmed" ? "Confirmed" : "Pending"}
                  </span>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-white/50" />
            </div>
          </Link>
        </div>
      )}

      {/* ── BROWSE SERVICES ── */}
      <div className="px-5 mb-4">
        <SectionHeading title="Browse Services" />
        <div className="grid grid-cols-4 gap-3">
          {SERVICE_CATEGORIES.slice(0, 4).map(cat => (
            <Link key={cat.name} href={`/stylists?specialty=${encodeURIComponent(cat.name)}`}>
              <div className="flex flex-col items-center gap-2 cursor-pointer group">
                <div className="w-16 h-16 rounded-3xl bg-card border border-border/40 shadow-sm flex items-center justify-center group-hover:border-primary/30 group-hover:shadow-md transition-all text-primary">
                  {cat.icon}
                </div>
                <span className="text-[11px] font-semibold text-foreground/80">{cat.name}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── MY APPOINTMENTS ── */}
      <div className="px-5 mb-8">
        <SectionHeading title="My Appointments" />
        {isLoading ? (
          <div className="space-y-3">{[0, 1].map(i => <div key={i} className="h-24 rounded-[20px] animate-pulse bg-muted/50" />)}</div>
        ) : (dashboard?.recentAppointments?.length ?? 0) > 0 ? (
          <div className="space-y-3">
            {dashboard!.recentAppointments.map(apt => (
              <div key={apt.id} className="bg-card rounded-[20px] p-4 border border-border/40 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-foreground truncate">{apt.serviceName}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      with{" "}
                      <Link href={`/stylists/${apt.stylistId}`} className="font-semibold hover:underline" style={{ color: 'hsl(var(--plum))' }}>
                        {apt.stylistName}
                      </Link>
                    </p>
                    <div className="flex items-center text-[11px] text-muted-foreground gap-1.5 mt-1.5">
                      <Calendar className="h-3 w-3" />
                      {new Date(apt.date).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })} at {apt.time}
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider rounded-full shrink-0 ${STATUS_STYLES[apt.status] ?? STATUS_STYLES.pending}`}>
                    {apt.status}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 mt-3">
                  {(apt as any).payoutStatus === "released" && (
                    <span className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      <Banknote className="h-3 w-3" />Payout released
                    </span>
                  )}
                  {(apt as any).payoutStatus === "disputed" && (
                    <span className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                      <ShieldAlert className="h-3 w-3" />Dispute raised
                    </span>
                  )}

                  {apt.status === "confirmed" &&
                    new Date(apt.date) < new Date() &&
                    (apt as any).payoutStatus !== "disputed" &&
                    (apt as any).payoutStatus !== "released" && (
                    (apt as any).workConfirmedByClient ? (
                      <span className="flex items-center gap-1 px-2.5 py-1 text-[10px] rounded-full bg-primary/10 text-primary border border-primary/20">
                        <CircleCheck className="h-3 w-3" />You confirmed
                        {!(apt as any).workConfirmedByArtist && (
                          <span className="ml-1 text-muted-foreground">· waiting for artist</span>
                        )}
                      </span>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          className="gap-1.5 h-8 text-[11px] rounded-full"
                          onClick={() => confirmWorkMutation.mutate({ appointmentId: apt.id })}
                          disabled={confirmWorkMutation.isPending}
                        >
                          <CheckCircle className="h-3.5 w-3.5" />Yes, everything went well
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 h-8 text-[11px] rounded-full border-destructive/50 text-destructive hover:bg-destructive/10"
                          onClick={() => confirmWorkMutation.mutate({ appointmentId: apt.id, dispute: true })}
                          disabled={confirmWorkMutation.isPending}
                        >
                          <ShieldAlert className="h-3.5 w-3.5" />Report a problem
                        </Button>
                      </>
                    )
                  )}

                  {apt.status === "completed" && (
                    <Link href={`/reviews/${apt.id}`}>
                      <Button size="sm" variant="outline" className="gap-1.5 h-8 text-[11px] rounded-full">
                        <Star className="h-3.5 w-3.5" />Leave Review
                      </Button>
                    </Link>
                  )}
                  <Link href={`/messages?stylistId=${apt.stylistId}`}>
                    <Button variant="outline" size="sm" className="gap-1.5 h-8 text-[11px] rounded-full">
                      <MessageCircle className="h-3.5 w-3.5" />Message
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 border rounded-[20px] border-dashed border-border/50">
            <p className="font-semibold text-sm">No appointments yet</p>
            <p className="text-[11px] text-muted-foreground mt-1 mb-4">Book your first service to get started</p>
            <Link href="/stylists"><Button size="sm" variant="outline" className="rounded-full">Browse artists</Button></Link>
          </div>
        )}
      </div>

      {/* ── WHATSAPP NOTIFICATIONS ── */}
      <div className="px-5 mb-8">
        <SectionHeading title="WhatsApp Notifications" />
        <div className="bg-card rounded-[20px] p-4 border border-border/40 shadow-sm space-y-3">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Add your WhatsApp number and we'll message you when your booking is confirmed, declined, or completed.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-xs">WhatsApp number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+27 82 123 4567"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="bg-background h-10 rounded-xl text-sm"
            />
          </div>
          <Button onClick={savePhone} disabled={savingPhone} size="sm" className="w-full rounded-full h-9 text-xs font-bold">
            {savingPhone ? "Saving…" : "Save number"}
          </Button>
        </div>
      </div>

    </div>
  );
}
