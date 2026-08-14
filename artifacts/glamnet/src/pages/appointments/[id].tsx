import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ChevronLeft, MessageCircle, Phone, CalendarDays } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { ArtistInitials } from "@/components/ui/artist-initials";

interface Appointment {
  id: string;
  clientId: string;
  clientName: string;
  stylistId: string;
  stylistName: string;
  serviceId: string;
  serviceName: string;
  date: string;
  time: string;
  status: string;
  price: number;
  duration: number;
  notes: string | null;
  workConfirmedByClient?: boolean;
  workConfirmedByArtist?: boolean;
}

const STAGES = ["Booked", "Confirmed", "In Progress", "Completed"] as const;

function stageIndex(a: Appointment): number {
  if (a.status === "completed" || (a.workConfirmedByClient && a.workConfirmedByArtist)) return 3;
  const start = new Date(`${a.date}T${a.time || "00:00"}`);
  const end = new Date(start.getTime() + (a.duration || 60) * 60_000);
  const now = new Date();
  if (a.status === "confirmed") {
    if (now >= start && now <= end) return 2;
    if (now > end) return 2;
    return 1;
  }
  return 0; // pending / anything else = booked
}

function formatDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return [h ? `${h}h` : null, m ? `${m}m` : null].filter(Boolean).join(" ") || "—";
}

export default function MyAppointment() {
  const [, params] = useRoute("/appointments/:id");
  const id = params?.id;
  const { token } = useAuth();

  const { data: appt, isLoading, error } = useQuery<Appointment>({
    queryKey: ["appointment", id],
    enabled: !!id && !!token,
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/appointments/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to load appointment");
      return res.json();
    },
  });

  if (isLoading) {
    return <div className="p-12 flex justify-center"><div className="animate-pulse w-8 h-8 rounded-full bg-primary/20" /></div>;
  }

  if (error || !appt) {
    return (
      <div className="p-12 text-center">
        <p className="text-sm text-muted-foreground mb-4">We couldn't find this appointment.</p>
        <Link href="/dashboard"><Button variant="outline" className="rounded-full">Back to Dashboard</Button></Link>
      </div>
    );
  }

  const start = new Date(`${appt.date}T${appt.time || "00:00"}`);
  const validDate = !isNaN(start.getTime());
  const weekday = validDate ? start.toLocaleDateString("en-ZA", { weekday: "short" }) : "";
  const dayNum = validDate ? start.getDate() : "—";
  const month = validDate ? start.toLocaleDateString("en-ZA", { month: "short" }) : "";
  const longDate = validDate ? start.toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : appt.date;
  const timeLabel = validDate ? start.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" }) : appt.time;

  const active = stageIndex(appt);
  const progressPct = [15, 45, 80, 100][active];
  const progressLabel = [
    "Waiting for your artist to confirm",
    "Your artist is preparing for your appointment",
    "Your appointment is underway",
    "All done — hope you love the result",
  ][active];
  const statusChip = appt.status === "confirmed" ? "Confirmed"
    : appt.status === "completed" ? "Completed"
    : appt.status === "cancelled" || appt.status === "declined" ? "Cancelled"
    : "Pending";

  return (
    <div className="flex flex-col min-h-screen bg-background pb-8 overflow-x-hidden">

      {/* ── HEADER ── */}
      <div className="flex justify-between items-center p-5 pt-12 relative">
        <button onClick={() => window.history.back()} className="w-10 h-10 rounded-full flex items-center justify-center text-foreground hover:bg-card/50 transition-colors absolute left-5">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-[15px] font-bold tracking-wide text-foreground w-full text-center">My Appointment</h1>
      </div>

      {/* ── HERO CARD ── */}
      <div className="px-5 mb-8 mt-2">
        <div className="bg-primary rounded-[24px] p-5 shadow-sm text-primary-foreground flex items-center">
          <div className="text-center w-[72px] shrink-0 border-r border-white/20 pr-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">{weekday}</p>
            <p className="text-3xl font-serif font-bold leading-none my-1.5">{dayNum}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">{month}</p>
          </div>
          <div className="pl-5">
            <p className="text-[11px] font-bold tracking-wide text-white/80 mb-1">{timeLabel}</p>
            <p className="font-serif font-bold text-[17px] leading-snug mb-0.5">{appt.stylistName}</p>
            <p className="text-[11px] text-white/70 mb-2.5">{appt.serviceName}</p>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[6px] bg-white/10 border border-white/20 text-[10px] font-bold tracking-wide">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="opacity-80">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              {statusChip}
            </span>
          </div>
        </div>
      </div>

      {/* ── PROGRESS TRACKER ── */}
      <div className="px-5 mb-8">
        <h2 className="text-[10px] font-bold tracking-widest uppercase text-foreground/70 mb-5">Your Appointment</h2>

        <div className="relative mb-8">
          <div className="absolute top-[9px] left-[10%] right-[10%] h-[1px] bg-border -z-10" />
          <div className="absolute top-[9px] left-[10%] h-[2px] bg-primary -z-10" style={{ width: `${(active / (STAGES.length - 1)) * 80}%` }} />

          <div className="flex justify-between items-start">
            {STAGES.map((label, i) => {
              const state = i < active ? "done" : i === active ? "active" : "pending";
              return (
                <div key={label} className="flex flex-col items-center gap-2 relative">
                  <div className={`w-[20px] h-[20px] rounded-full flex items-center justify-center border-2 bg-background transition-colors ${
                    state === "pending" ? "border-border bg-border" : "border-primary"
                  }`}>
                    {state !== "pending" && <div className="w-[10px] h-[10px] rounded-full bg-primary" />}
                  </div>
                  <span className={`text-[9px] font-bold tracking-wide ${state === "pending" ? "text-muted-foreground" : "text-foreground"}`}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <h2 className="text-[10px] font-bold tracking-widest uppercase text-foreground/70 mb-3">Live Progress</h2>
        <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground mb-2">
          <span>{progressLabel}</span>
          <span className="text-foreground">{progressPct}%</span>
        </div>
        <div className="h-1.5 w-full bg-border/50 rounded-full overflow-hidden mb-8">
          <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${progressPct}%` }} />
        </div>

        {/* ── STYLIST ROW ── */}
        <div className="flex items-center justify-between bg-card rounded-[20px] p-3 border border-border/40 shadow-sm mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden border border-border/20 relative">
              <ArtistInitials name={appt.stylistName} textClassName="text-sm" />
            </div>
            <div>
              <p className="font-bold text-sm">{appt.stylistName}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Your Stylist</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/messages">
              <button className="w-10 h-10 rounded-full bg-background border border-border flex items-center justify-center text-foreground hover:bg-muted transition-colors" aria-label="Message your stylist">
                <MessageCircle className="h-4 w-4" />
              </button>
            </Link>
            <Link href="/messages">
              <button className="w-10 h-10 rounded-full bg-background border border-border flex items-center justify-center text-foreground hover:bg-muted transition-colors" aria-label="Contact your stylist">
                <Phone className="h-4 w-4" />
              </button>
            </Link>
          </div>
        </div>

        {/* ── APPOINTMENT DETAILS ── */}
        <div className="mb-8">
          <h2 className="text-[10px] font-bold tracking-widest uppercase text-foreground/70 mb-4">Appointment Details</h2>
          <div className="space-y-4 text-xs">
            <div className="flex justify-between items-start">
              <span className="text-muted-foreground font-medium">Service</span>
              <span className="font-bold text-right">{appt.serviceName}</span>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-muted-foreground font-medium">Date</span>
              <span className="font-bold text-right">{longDate}</span>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-muted-foreground font-medium">Time</span>
              <span className="font-bold text-right">{timeLabel}</span>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-muted-foreground font-medium">Duration</span>
              <span className="font-bold text-right">{formatDuration(appt.duration)}</span>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-muted-foreground font-medium">Stylist</span>
              <Link href={`/stylists/${appt.stylistId}`}>
                <span className="font-bold text-right cursor-pointer">{appt.stylistName} &gt;</span>
              </Link>
            </div>
          </div>
        </div>

      </div>

      {/* ── RESCHEDULE BUTTON ── */}
      <div className="px-5 mt-auto pb-4">
        <Link href={`/book/${appt.stylistId}`}>
          <Button variant="outline" className="w-full h-12 rounded-[16px] font-bold text-xs bg-transparent border-border/60 hover:bg-card">
            <CalendarDays className="h-3.5 w-3.5 mr-2" />
            Reschedule Appointment
          </Button>
        </Link>
      </div>

    </div>
  );
}
