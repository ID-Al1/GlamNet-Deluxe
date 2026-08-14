import { useMemo, useState, useEffect } from "react";
import { useGetStylistDashboard, useUpdateMyStylistProfile } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  DollarSign, Calendar as CalendarIcon, Activity, Star,
  Home as HomeIcon, Gift, Copy, CheckCheck, Briefcase, Zap, Users, Check, X, MessageCircle, Bell,
  Scissors, Plus, Pencil, Trash2, Clock, ListChecks, CheckCircle2, CircleDashed,
  ShieldAlert, Banknote, Receipt, RefreshCw, Loader2, AlertCircle, RotateCcw, TrendingUp,
} from "lucide-react";
import { frenchGreeting } from "@/components/bonisa-logo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PRESET_SERVICES = [
  "Full Glam Makeup",
  "Natural / Everyday Makeup",
  "Bridal Makeup",
  "Bridal Party Makeup",
  "Airbrush Makeup",
  "Editorial / Avant-Garde Makeup",
  "Body Makeup",
  "Eyebrow Shaping & Tint",
  "Lash Application",
  "Makeup Lesson",
  "Hair Styling",
  "Blowout",
  "Updo / Formal Style",
  "Hair Braiding",
  "Hair Colour & Highlights",
  "Keratin Treatment",
  "Wig Fitting & Styling",
  "Manicure",
  "Pedicure",
  "Gel Nails",
  "Acrylic Nails",
  "Nail Art",
  "Skincare Facial",
  "Waxing",
  "Henna / Mehndi",
  "Touch-up / Refresh",
  "Custom",
] as const;

const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-primary/15 text-primary border border-primary/25",
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
  completed: "bg-muted/70 text-muted-foreground border border-border/40",
  cancelled: "bg-destructive/10 text-destructive border border-destructive/20",
};

function StatCardSkeleton() {
  return (
    <Card className="bg-card border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-8 rounded-xl" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-9 w-20 mb-2" />
        <Skeleton className="h-3 w-16" />
      </CardContent>
    </Card>
  );
}

function AppointmentSkeleton() {
  return (
    <Card className="p-6 border-border/50">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    </Card>
  );
}

async function fetchTeamInvitations() {
  const res = await fetch(`${import.meta.env.BASE_URL}api/team-invitations`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load invitations");
  return res.json() as Promise<any[]>;
}

async function respondToInvitation(appointmentId: string, memberId: string, status: "confirmed" | "declined") {
  const res = await fetch(`${import.meta.env.BASE_URL}api/appointments/${appointmentId}/team-members/${memberId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("Failed to respond to invitation");
  return res.json();
}

async function fetchReferrals() {
  const res = await fetch(`${import.meta.env.BASE_URL}api/referrals`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load referrals");
  return res.json() as Promise<{
    referrals: any[];
    bonusPerReferral: number;
    pendingBonusZAR: number;
    totalReferrals: number;
    completedReferrals: number;
  }>;
}

export default function StylistDashboard() {
  const { user, token } = useAuth();
  const qc = useQueryClient();
  // Support ?tab=services deep link (from profile page "Manage Services" button)
  const initialTab = (() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("tab");
      if (p) return p;
    }
    return null;
  })();
  const [activeTab, setActiveTab] = useState<string | null>(initialTab);
  const { data: dashboard, isLoading, error, refetch } = useGetStylistDashboard();
  const updateProfile = useUpdateMyStylistProfile();
  const [copied, setCopied] = useState(false);
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

  const referralCode = (user as any)?.referralCode ?? null;
  const referralLink = referralCode ? `${window.location.origin}/signup?ref=${referralCode}` : "";

  const { data: invitations = [], isLoading: invLoading } = useQuery({
    queryKey: ["team-invitations"],
    queryFn: fetchTeamInvitations,
  });

  const { data: referralData } = useQuery({
    queryKey: ["referrals"],
    queryFn: fetchReferrals,
  });

  const respond = useMutation({
    mutationFn: ({ appointmentId, memberId, status }: { appointmentId: string; memberId: string; status: "confirmed" | "declined" }) =>
      respondToInvitation(appointmentId, memberId, status),
    onSuccess: (_, vars) => {
      toast.success(vars.status === "confirmed" ? "Invitation accepted!" : "Invitation declined.");
      qc.invalidateQueries({ queryKey: ["team-invitations"] });
    },
    onError: () => toast.error("Failed to respond to invitation"),
  });

  const stats = useMemo(() => {
    if (!dashboard) return null;
    return {
      upcoming: (dashboard.pendingBookings ?? 0) + (dashboard.confirmedBookings ?? 0),
      strength: dashboard.profileStrength || 0,
    };
  }, [dashboard?.pendingBookings, dashboard?.confirmedBookings, dashboard?.profileStrength]);

  const houseCalls = (dashboard as any)?.houseCalls ?? false;

  // ── Services & Availability ──────────────────────────────────────────────
  const [newSvc, setNewSvc] = useState({ name: "", price: "", duration: "60" });
  const [editingSvcId, setEditingSvcId] = useState<string | null>(null);
  const [editSvc, setEditSvc] = useState({ name: "", price: "", duration: "" });
  const [avail, setAvail] = useState<string[]>([]);
  const [savingAvail, setSavingAvail] = useState(false);
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const { data: myProfile } = useQuery({
    queryKey: ["my-stylist-profile"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/stylists/me/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!token,
  });

  useEffect(() => {
    if (myProfile?.availability) setAvail(myProfile.availability);
  }, [myProfile?.availability]);

  // Auto-navigate to Services tab when artist has no services yet
  useEffect(() => {
    if (!initialTab && myProfile && (!myProfile.services || myProfile.services.length === 0)) {
      setActiveTab("services");
    }
  }, [myProfile?.services?.length]);

  const confirmWork = useMutation({
    mutationFn: async ({ appointmentId, dispute = false }: { appointmentId: string; dispute?: boolean }) => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/appointments/${appointmentId}/confirm-work`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ dispute }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed"); }
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["stylistDashboard"] });
      if (vars.dispute) {
        toast.warning("Dispute raised — Bonisa will review and contact both parties.");
      } else {
        toast.success("Work confirmed! Payout releases once the client confirms too.");
      }
    },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  const addSvc = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/stylists/me/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newSvc.name, price: parseFloat(newSvc.price), duration: parseInt(newSvc.duration) }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed to save service"); }
      return res.json();
    },
    onSuccess: () => {
      setNewSvc({ name: "", price: "", duration: "60" });
      qc.invalidateQueries({ queryKey: ["my-stylist-profile"] });
      toast.success("Service saved and listed!");
    },
    onError: (e: any) => toast.error(e.message || "Failed to add service"),
  });

  const updateSvc = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/stylists/me/services/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: editSvc.name, price: parseFloat(editSvc.price), duration: parseInt(editSvc.duration) }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => { setEditingSvcId(null); qc.invalidateQueries({ queryKey: ["my-stylist-profile"] }); toast.success("Service updated!"); },
    onError: (e: any) => toast.error(e.message || "Failed to update service"),
  });

  const deleteSvc = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/stylists/me/services/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to remove service");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-stylist-profile"] }); toast.success("Service removed"); },
    onError: (e: any) => toast.error(e.message || "Failed to remove service"),
  });

  const saveAvailability = async () => {
    setSavingAvail(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/stylists/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ availability: avail }),
      });
      if (!res.ok) throw new Error();
      toast.success("Availability saved!");
      qc.invalidateQueries({ queryKey: ["my-stylist-profile"] });
    } catch { toast.error("Could not save availability"); }
    finally { setSavingAvail(false); }
  };

  const handleHouseCallsToggle = async (enabled: boolean) => {
    await updateProfile.mutateAsync({ data: { houseCalls: enabled } as any });
    refetch();
  };

  const handleCopy = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // ── Stylist payment history ──────────────────────────────────────────────
  interface StylistPaymentRecord {
    id: string;
    appointmentId: string | null;
    stripePaymentIntentId: string | null;
    amount: number;
    tipAmount: number;
    depositAmount: number;
    discountAmount: number;
    couponCode: string | null;
    refundedAmount: number;
    status: "succeeded" | "refunded" | "partial_refunded" | "failed" | "pending";
    createdAt: string;
  }
  interface StylistAppointmentWithPayment {
    id: string;
    clientId: string;
    clientName: string;
    serviceName: string;
    date: string;
    time: string;
    status: string;
    price: number;
    paymentMode: string;
    depositAmount: number;
    tipAmount: number;
    balanceDue: number;
    payoutStatus: string | null;
    artistPayoutAmount: number | null;
    stripeSessionId: string | null;
    createdAt: string;
    payment: StylistPaymentRecord | null;
  }
  const {
    data: stylistPayments = [],
    isLoading: stylistPaymentsLoading,
    refetch: refetchStylistPayments,
  } = useQuery<StylistAppointmentWithPayment[]>({
    queryKey: ["stylist-payments"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/stripe/stylist-payments`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: !!token,
  });

  const [stylistRefundTarget, setStylistRefundTarget] = useState<StylistAppointmentWithPayment | null>(null);
  const [stylistRefundAmount, setStylistRefundAmount] = useState("");
  const [stylistRefundPending, setStylistRefundPending] = useState(false);
  const [stylistRefundIdempotencyKey, setStylistRefundIdempotencyKey] = useState("");

  function openStylistRefundDialog(appt: StylistAppointmentWithPayment) {
    setStylistRefundTarget(appt);
    setStylistRefundAmount("");
    setStylistRefundIdempotencyKey(crypto.randomUUID());
  }

  function formatZAR(amount: number) {
    return `R${Number(amount).toFixed(2)}`;
  }

  function stylistPaymentBadge(appt: StylistAppointmentWithPayment) {
    if (appt.paymentMode === "pay_at_appointment") {
      return <Badge variant="outline" className="text-xs">Pay at Appointment</Badge>;
    }
    if (!appt.payment) return <Badge variant="outline" className="text-xs text-muted-foreground">No record</Badge>;
    switch (appt.payment.status) {
      case "succeeded":
        return <Badge className="text-xs bg-green-500/15 text-green-700 border-green-500/30 hover:bg-green-500/20">Paid</Badge>;
      case "refunded":
        return <Badge variant="secondary" className="text-xs">Refunded</Badge>;
      case "partial_refunded":
        return <Badge variant="secondary" className="text-xs">Partial Refund</Badge>;
      case "failed":
        return <Badge variant="destructive" className="text-xs">Failed</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{appt.payment.status}</Badge>;
    }
  }

  function canStylistRefund(appt: StylistAppointmentWithPayment) {
    if (!appt.payment) return false;
    if (appt.paymentMode === "pay_at_appointment") return false;
    if (appt.payment.status === "refunded") return false;
    if (!appt.payment.stripePaymentIntentId) return false;
    const refundable = appt.payment.amount - (appt.payment.refundedAmount ?? 0);
    return refundable > 0;
  }

  async function submitStylistRefund() {
    if (!stylistRefundTarget) return;

    // Validate: if the user typed something, it must be a finite positive number
    // within the refundable ceiling. Empty = full refund (intentional).
    if (stylistRefundAmount.trim() !== "") {
      const amt = parseFloat(stylistRefundAmount);
      const refundable =
        (stylistRefundTarget.payment?.amount ?? 0) -
        (stylistRefundTarget.payment?.refundedAmount ?? 0);
      if (!isFinite(amt) || amt <= 0) {
        toast.error("Please enter a valid refund amount greater than R0, or leave blank for a full refund.");
        return;
      }
      if (amt > refundable + 0.001) {
        toast.error(`Maximum refundable amount is ${formatZAR(refundable)}.`);
        return;
      }
    }

    setStylistRefundPending(true);
    try {
      const body: any = {
        appointmentId: stylistRefundTarget.id,
        idempotencyKey: stylistRefundIdempotencyKey,
      };
      // Only include amount when the field is non-empty AND valid (validated above)
      const amt = parseFloat(stylistRefundAmount);
      if (stylistRefundAmount.trim() !== "" && isFinite(amt) && amt > 0) body.amount = amt;
      const res = await fetch(`${import.meta.env.BASE_URL}api/stripe/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Refund failed");
      toast.success(
        data.isFullRefund
          ? `Full refund of ${formatZAR(data.refundedAmount)} issued to client.`
          : `Partial refund of ${formatZAR(data.refundedAmount)} issued to client.`
      );
      setStylistRefundTarget(null);
      setStylistRefundAmount("");
      refetchStylistPayments();
    } catch (err: any) {
      toast.error(err.message || "Refund failed. Please try again.");
    } finally {
      setStylistRefundPending(false);
    }
  }

  // Earnings summary derived from stylistPayments
  const earningsSummary = useMemo(() => {
    const totalPaid = stylistPayments.reduce((sum, a) => {
      if (!a.payment || a.payment.status === "failed") return sum;
      return sum + (a.payment.amount - (a.payment.refundedAmount ?? 0));
    }, 0);
    // Outstanding deposit balances: client paid a deposit but balance is still owed
    const depositBalance = stylistPayments
      .filter(a => a.paymentMode === "deposit" && a.balanceDue > 0 && a.status === "confirmed")
      .reduce((sum, a) => sum + a.balanceDue, 0);
    // Pay-at-appointment: full amount still owed at time of service
    const payAtApptDue = stylistPayments
      .filter(a => a.paymentMode === "pay_at_appointment" && a.status === "confirmed")
      .reduce((sum, a) => sum + a.price, 0);
    const balanceDueTotal = depositBalance + payAtApptDue;
    return { totalPaid, depositBalance, payAtApptDue, balanceDueTotal };
  }, [stylistPayments]);

  if (error) {
    return <div className="p-8 text-center text-destructive">Failed to load dashboard. Please refresh.</div>;
  }

  return (
    <div className="container py-8 sm:py-12 max-w-6xl space-y-8 px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="text-accent text-xs font-semibold uppercase tracking-widest mb-2">Artist Studio</p>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold tracking-tight">Studio Overview</h1>
          {user && (
            <div className="mt-1.5">
              <p className="text-sm text-muted-foreground/70">{frenchGreeting()}</p>
              <p className="font-serif font-semibold text-xl">{user.name.split(" ")[0]}</p>
            </div>
          )}
        </div>
        <Link href="/casting">
          <Button variant="outline" className="gap-2 shrink-0 rounded-full px-5">
            <Briefcase className="h-4 w-4" />Find Castings
          </Button>
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {isLoading ? (
          <><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /></>
        ) : (
          <>
            <Card className="bg-card border-border/50 hover:border-border transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Available Earnings</CardTitle>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'hsl(var(--orange) / 0.12)' }}>
                  <DollarSign className="h-4 w-4" style={{ color: 'hsl(var(--orange))' }} />
                </div>
              </CardHeader>
              <CardContent className="pb-5">
                <div className="text-3xl font-serif font-bold">R{((dashboard as any)!.availableEarnings ?? 0).toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Net of 18% fee · <span className="text-amber-600">R{((dashboard as any)!.pendingEarnings ?? 0).toLocaleString()} in escrow</span>
                </p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border/50 hover:border-border transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Upcoming</CardTitle>
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <CalendarIcon className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent className="pb-5">
                <div className="text-3xl font-serif font-bold">{stats!.upcoming}</div>
                <p className="text-xs text-muted-foreground mt-1">Appointments</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border/50 hover:border-border transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Bookings</CardTitle>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'hsl(var(--baby-blue) / 0.12)' }}>
                  <Activity className="h-4 w-4" style={{ color: 'hsl(var(--baby-blue))' }} />
                </div>
              </CardHeader>
              <CardContent className="pb-5">
                <div className="text-3xl font-serif font-bold">{dashboard!.totalBookings}</div>
                <p className="text-xs text-muted-foreground mt-1">All time</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border/50 hover:border-border transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Profile Strength</CardTitle>
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Star className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent className="pb-5">
                <div className="text-3xl font-serif font-bold">{stats!.strength}%</div>
                <div className="mt-2.5 h-1.5 rounded-full bg-border overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${stats!.strength}%`, background: 'hsl(var(--plum))' }}
                  />
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Quick actions row */}
      {!isLoading && (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* House Calls */}
          <Card className="bg-card border-border/50">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'hsl(var(--baby-blue) / 0.12)' }}>
                  <HomeIcon className="h-5 w-5" style={{ color: 'hsl(var(--baby-blue))' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold">House Calls</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {houseCalls
                          ? "You're open to travelling to clients."
                          : "Enable this to offer on-location services."}
                      </p>
                    </div>
                    <Switch checked={houseCalls} onCheckedChange={handleHouseCallsToggle} disabled={updateProfile.isPending} />
                  </div>
                  {houseCalls && (
                    <div className="mt-3 flex items-center gap-1.5 text-xs font-medium" style={{ color: 'hsl(var(--baby-blue))' }}>
                      <Zap className="h-3 w-3" />House calls enabled — shown on your profile
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Referrals */}
          <Card className="bg-card border-border/50">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'hsl(var(--orange) / 0.12)' }}>
                  <Gift className="h-5 w-5" style={{ color: 'hsl(var(--orange))' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">Referral Link</p>
                  {referralData && (
                    <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                      {referralData.totalReferrals} referred · {referralData.completedReferrals} completed
                      {referralData.pendingBonusZAR > 0 && (
                        <span className="ml-2 font-semibold" style={{ color: 'hsl(var(--orange))' }}>· R{referralData.pendingBonusZAR} pending</span>
                      )}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground mb-3">
                    Share your code to invite artists and clients. Every sign-up boosts your profile ranking.
                  </p>
                  {referralLink ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0 bg-muted/50 border border-border/60 rounded-lg px-3 py-2 text-xs text-muted-foreground font-mono truncate">
                        {referralLink}
                      </div>
                      <Button size="sm" variant="outline" onClick={handleCopy} className="shrink-0 gap-1.5 rounded-full">
                        {copied ? <CheckCheck className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied ? "Copied" : "Copy"}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Log out and back in to see your referral link.</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Profile Readiness */}
      {myProfile?.profileReadiness && (
        <Card className={`border overflow-hidden ${myProfile.profileReadiness.isFullyReady ? "border-emerald-500/40 bg-emerald-500/5" : myProfile.profileReadiness.canBeBooked ? "border-primary/30 bg-primary/5" : "border-amber-500/30 bg-amber-500/5"}`}>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-primary shrink-0" />
                <h3 className="font-semibold text-sm">Profile Readiness</h3>
                <span className="text-xs text-muted-foreground">— complete your profile so clients can book you</span>
              </div>
              {myProfile.profileReadiness.isFullyReady ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5" /> All 7 criteria met
                </span>
              ) : myProfile.profileReadiness.canBeBooked ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/12 text-primary border border-primary/25">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Open to Bookings
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/12 text-amber-600 border border-amber-500/25">
                  <CircleDashed className="w-3.5 h-3.5" /> {myProfile.profileReadiness.completedCount}/{myProfile.profileReadiness.totalCount} complete
                </span>
              )}
            </div>
            {/* Progress bar */}
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${myProfile.profileReadiness.isFullyReady ? "bg-emerald-500" : myProfile.profileReadiness.canBeBooked ? "bg-primary" : "bg-amber-500"}`}
                style={{ width: `${Math.round((myProfile.profileReadiness.completedCount / myProfile.profileReadiness.totalCount) * 100)}%` }}
              />
            </div>
            {/* Criteria grid */}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {myProfile.profileReadiness.criteria.map((c: { id: number; label: string; met: boolean; hint: string }) => (
                <div
                  key={c.id}
                  className={`flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs border ${c.met ? "bg-emerald-500/8 border-emerald-500/20" : "bg-muted/40 border-border/40"}`}
                  title={c.met ? undefined : c.hint}
                >
                  {c.met
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    : <CircleDashed className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 mt-0.5" />}
                  <div>
                    <p className={`font-medium leading-snug ${c.met ? "" : "text-muted-foreground/70"}`}>{c.id}. {c.label}</p>
                    {!c.met && <p className="text-muted-foreground/60 mt-0.5 leading-snug">{c.hint}</p>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs
        value={activeTab ?? "active"}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <TabsList className="mb-8 h-auto p-1 gap-1 flex-wrap">
          <TabsTrigger value="active" className="rounded-lg">Active</TabsTrigger>
          <TabsTrigger value="appointments" className="rounded-lg">All Appointments</TabsTrigger>
          <TabsTrigger value="invitations" className="relative rounded-lg">
            Invitations
            {invitations.length > 0 && (
              <Badge className="ml-2 h-4 w-4 p-0 text-[10px] flex items-center justify-center bg-accent text-accent-foreground rounded-full">
                {invitations.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="activity" className="rounded-lg">Activity</TabsTrigger>
          <TabsTrigger value="services" className={`rounded-lg ${!myProfile?.services?.length ? "ring-1 ring-primary/50 ring-offset-1" : ""}`}>
            <Scissors className="h-3.5 w-3.5 mr-1.5" />Services
            {!myProfile?.services?.length && <span className="ml-1.5 text-[10px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 font-semibold">!</span>}
          </TabsTrigger>
          <TabsTrigger value="payments" className="rounded-lg"><DollarSign className="h-3.5 w-3.5 mr-1.5" />Payments</TabsTrigger>
          <TabsTrigger value="settings" className="rounded-lg"><Bell className="h-3.5 w-3.5 mr-1.5" />Notifications</TabsTrigger>
        </TabsList>

        {/* Active — confirmed bookings only */}
        <TabsContent value="active" className="space-y-4">
          {isLoading ? (
            <><AppointmentSkeleton /><AppointmentSkeleton /></>
          ) : (() => {
            const active = dashboard!.upcomingAppointments?.filter(a => a.status === "confirmed") ?? [];
            return active.length > 0 ? (
              <div className="grid gap-4">
                {active.map(apt => (
                  <Card key={apt.id} className="overflow-hidden border-l-4 border-l-primary border-border/50 bg-card">
                    <CardContent className="p-6">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                            <p className="font-semibold text-lg">{apt.serviceName}</p>
                          </div>
                          <p className="text-sm text-muted-foreground">Client: {apt.clientName}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(apt.date).toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" })} at {apt.time}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <div className="flex items-center gap-2">
                            <p className="font-serif font-bold text-xl" style={{ color: 'hsl(var(--orange))' }}>R{apt.price.toLocaleString()}</p>
                            <span className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-full ${STATUS_STYLES.confirmed}`}>Confirmed</span>
                          </div>
                          {/* Payout info */}
                          {new Date(apt.date) < new Date() && (apt as any).payoutStatus !== "released" && (apt as any).payoutStatus !== "disputed" && (
                            <p className="text-xs text-muted-foreground">
                              Your payout: <span className="font-semibold text-emerald-600">R{((apt.price + ((apt as any).tipAmount ?? 0)) * 0.82).toFixed(2)}</span>
                              <span className="ml-1 opacity-60">(after 18% platform fee)</span>
                            </p>
                          )}
                          {(apt as any).payoutStatus === "released" && (
                            <span className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                              <Banknote className="h-3 w-3" />R{(apt as any).artistPayoutAmount?.toFixed(2)} released
                            </span>
                          )}
                          {(apt as any).payoutStatus === "disputed" && (
                            <span className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                              <ShieldAlert className="h-3 w-3" />Dispute raised
                            </span>
                          )}
                          <div className="flex gap-1.5 flex-wrap justify-end">
                            {/* Dual-confirmation buttons for past appointments */}
                            {new Date(apt.date) < new Date() &&
                              (apt as any).payoutStatus !== "released" &&
                              (apt as any).payoutStatus !== "disputed" && (
                              (apt as any).workConfirmedByArtist ? (
                                <span className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-full bg-primary/10 text-primary border border-primary/20">
                                  <CheckCircle2 className="h-3 w-3" />You confirmed
                                  {!(apt as any).workConfirmedByClient && <span className="ml-1 text-muted-foreground">· waiting for client</span>}
                                </span>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    className="gap-1.5 h-8 text-xs rounded-full"
                                    onClick={() => confirmWork.mutate({ appointmentId: apt.id })}
                                    disabled={confirmWork.isPending}
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" />Yes, appointment completed
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1.5 h-8 text-xs rounded-full border-destructive/50 text-destructive hover:bg-destructive/10"
                                    onClick={() => confirmWork.mutate({ appointmentId: apt.id, dispute: true })}
                                    disabled={confirmWork.isPending}
                                  >
                                    <ShieldAlert className="h-3.5 w-3.5" />Report an issue
                                  </Button>
                                </>
                              )
                            )}
                            <Link href={`/messages?clientId=${(apt as any).clientId}`}>
                              <Button size="sm" variant="outline" className="gap-1.5 h-8 rounded-full">
                                <MessageCircle className="h-3.5 w-3.5" />Message
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 border rounded-2xl border-dashed border-border/50 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 mx-auto flex items-center justify-center">
                  <CalendarIcon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-serif text-xl font-bold">No confirmed bookings yet</p>
                  <p className="text-sm text-muted-foreground mt-1.5 max-w-xs mx-auto">Complete your profile to get discovered by clients.</p>
                </div>
                <Link href="/stylists">
                  <Button variant="outline" size="sm" className="rounded-full px-5">View your public profile</Button>
                </Link>
              </div>
            );
          })()}
        </TabsContent>

        {/* All appointments */}
        <TabsContent value="appointments" className="space-y-4">
          {isLoading ? (
            <><AppointmentSkeleton /><AppointmentSkeleton /><AppointmentSkeleton /></>
          ) : (dashboard!.upcomingAppointments?.length ?? 0) > 0 ? (
            <div className="grid gap-4">
              {dashboard!.upcomingAppointments.map(apt => (
                <Card key={apt.id} className="overflow-hidden border-border/50 hover:border-border transition-colors bg-card">
                  <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-lg">{apt.serviceName}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">Client: {apt.clientName}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(apt.date).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })} at {apt.time}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <p className="font-serif font-bold">R{apt.price.toLocaleString()}</p>
                        <span className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-full ${STATUS_STYLES[apt.status] ?? STATUS_STYLES.pending}`}>
                          {apt.status}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 border rounded-2xl border-dashed border-border/50 space-y-3">
              <p className="text-muted-foreground">No upcoming appointments</p>
            </div>
          )}
        </TabsContent>

        {/* Team Invitations */}
        <TabsContent value="invitations" className="space-y-4">
          {invLoading ? (
            <><AppointmentSkeleton /><AppointmentSkeleton /></>
          ) : invitations.length > 0 ? (
            <div className="grid gap-4">
              {invitations.map((inv: any) => (
                <Card key={inv.id} className="overflow-hidden border-border/50 bg-card">
                  <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'hsl(var(--baby-blue) / 0.12)' }}>
                            <Users className="h-3.5 w-3.5" style={{ color: 'hsl(var(--baby-blue))' }} />
                          </div>
                          <p className="font-semibold">Team Booking — {inv.role}</p>
                        </div>
                        <p className="text-sm text-muted-foreground">Client: {inv.clientName}</p>
                        <p className="text-sm text-muted-foreground">Service: {inv.serviceName}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(inv.date).toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" })} at {inv.time}
                        </p>
                        <p className="text-sm font-medium">
                          Your share: {inv.payoutPercentage}% of R{inv.price?.toLocaleString() ?? "—"}
                          {" = "}
                          <span className="font-bold" style={{ color: 'hsl(var(--orange))' }}>R{((inv.price ?? 0) * (inv.payoutPercentage / 100) * 0.82).toFixed(0)}</span>
                          <span className="text-xs text-muted-foreground ml-1">(after platform cut)</span>
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 rounded-full border-destructive/50 text-destructive hover:bg-destructive/10"
                          onClick={() => respond.mutate({ appointmentId: inv.appointmentId, memberId: inv.id, status: "declined" })}
                          disabled={respond.isPending}
                        >
                          <X className="h-3.5 w-3.5" />Decline
                        </Button>
                        <Button
                          size="sm"
                          className="gap-1.5 rounded-full"
                          onClick={() => respond.mutate({ appointmentId: inv.appointmentId, memberId: inv.id, status: "confirmed" })}
                          disabled={respond.isPending}
                        >
                          <Check className="h-3.5 w-3.5" />Accept
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 border rounded-2xl border-dashed border-border/50 space-y-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto" style={{ background: 'hsl(var(--baby-blue) / 0.10)' }}>
                <Users className="h-6 w-6" style={{ color: 'hsl(var(--baby-blue))' }} />
              </div>
              <div>
                <p className="font-serif text-xl font-bold">No pending invitations</p>
                <p className="text-sm text-muted-foreground mt-1.5 max-w-xs mx-auto">You'll be notified here when a client or lead artist invites you to a team booking.</p>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Activity */}
        <TabsContent value="activity">
          {isLoading ? (
            <div className="space-y-4">
              {[0, 1, 2].map(i => (
                <div key={i} className="flex items-center gap-4 py-3 border-b border-border/50">
                  <Skeleton className="w-2 h-2 rounded-full shrink-0" />
                  <div className="space-y-1 flex-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : (dashboard!.recentActivity?.length ?? 0) > 0 ? (
            <div className="space-y-1">
              {dashboard!.recentActivity.map(act => (
                <div key={act.id} className="flex items-center gap-4 py-3.5 border-b border-border/40 last:border-0">
                  <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{act.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(act.createdAt).toLocaleString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 border rounded-2xl border-dashed border-border/50">
              <p className="text-muted-foreground">No recent activity</p>
            </div>
          )}
        </TabsContent>

        {/* Services & Availability */}
        <TabsContent value="services" className="space-y-8">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-lg">Your Services</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Clients choose from these when booking you.</p>
              </div>
            </div>

            <div className="space-y-3">
              {(myProfile?.services ?? []).length === 0 && (
                <div className="text-center py-10 border rounded-2xl border-dashed border-border/50">
                  <Scissors className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                  <p className="font-medium">No services yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Add at least one service so clients can book you.</p>
                </div>
              )}
              {(myProfile?.services ?? []).map((svc: { id: string; name: string; price: number; duration: number }) => (
                <Card key={svc.id} className="border-border/50">
                  <CardContent className="p-4">
                    {editingSvcId === svc.id ? (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-1">
                          <Label className="text-xs text-muted-foreground mb-1 block">Service name</Label>
                          <Select
                            value={PRESET_SERVICES.includes(editSvc.name as any) ? editSvc.name : "Custom"}
                            onValueChange={v => setEditSvc(p => ({ ...p, name: v === "Custom" ? "" : v }))}
                          >
                            <SelectTrigger className="bg-background"><SelectValue placeholder="Pick a service" /></SelectTrigger>
                            <SelectContent>
                              {PRESET_SERVICES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          {(!PRESET_SERVICES.includes(editSvc.name as any) || editSvc.name === "") && (
                            <Input
                              value={editSvc.name}
                              onChange={e => setEditSvc(p => ({ ...p, name: e.target.value }))}
                              placeholder="Type your service name"
                              className="bg-background mt-2"
                            />
                          )}
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">Price (ZAR)</Label>
                          <Input type="number" value={editSvc.price} onChange={e => setEditSvc(p => ({ ...p, price: e.target.value }))} placeholder="800" className="bg-background" />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">Duration (min)</Label>
                          <Input type="number" value={editSvc.duration} onChange={e => setEditSvc(p => ({ ...p, duration: e.target.value }))} placeholder="60" className="bg-background" />
                        </div>
                        <div className="sm:col-span-3 flex gap-2">
                          <Button size="sm" className="rounded-full" onClick={() => updateSvc.mutate(svc.id)} disabled={updateSvc.isPending || !editSvc.name || !editSvc.price}>
                            <Check className="h-3.5 w-3.5 mr-1" />Save
                          </Button>
                          <Button size="sm" variant="outline" className="rounded-full" onClick={() => setEditingSvcId(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{svc.name}</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3" /> {svc.duration} min
                          </p>
                        </div>
                        <p className="font-serif font-bold text-lg shrink-0" style={{ color: 'hsl(var(--orange))' }}>R{svc.price.toLocaleString()}</p>
                        <div className="flex gap-1 shrink-0">
                          <Button size="sm" variant="ghost" onClick={() => { setEditingSvcId(svc.id); setEditSvc({ name: svc.name, price: String(svc.price), duration: String(svc.duration) }); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteSvc.mutate(svc.id)} disabled={deleteSvc.isPending}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Add new service form */}
            <Card className="border-dashed border-border/60 bg-muted/20">
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-medium flex items-center gap-2"><Plus className="h-4 w-4 text-primary" />Add a service</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-1 space-y-2">
                    <Label className="text-xs text-muted-foreground block">Service</Label>
                    <Select
                      value={PRESET_SERVICES.includes(newSvc.name as any) ? newSvc.name : newSvc.name ? "Custom" : ""}
                      onValueChange={v => setNewSvc(p => ({ ...p, name: v === "Custom" ? "" : v }))}
                    >
                      <SelectTrigger className="bg-background"><SelectValue placeholder="Choose a service…" /></SelectTrigger>
                      <SelectContent>
                        {PRESET_SERVICES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {newSvc.name !== "" && !PRESET_SERVICES.slice(0, -1).includes(newSvc.name as any) && (
                      <Input
                        value={newSvc.name}
                        onChange={e => setNewSvc(p => ({ ...p, name: e.target.value }))}
                        placeholder="Type your service name"
                        className="bg-background"
                      />
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Price (ZAR)</Label>
                    <Input type="number" min="0" value={newSvc.price} onChange={e => setNewSvc(p => ({ ...p, price: e.target.value }))} placeholder="800" className="bg-background" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Duration (min)</Label>
                    <Input type="number" min="15" value={newSvc.duration} onChange={e => setNewSvc(p => ({ ...p, duration: e.target.value }))} placeholder="60" className="bg-background" />
                  </div>
                </div>
                <Button size="sm" className="rounded-full gap-1.5" onClick={() => addSvc.mutate()} disabled={addSvc.isPending || !newSvc.name || !newSvc.price || !newSvc.duration}>
                  {addSvc.isPending ? "Saving…" : <><Plus className="h-3.5 w-3.5" />Save service</>}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Availability */}
          <div className="space-y-4">
            <div>
              <h2 className="font-semibold text-lg">Working Days</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Clients will only see these days available in the booking calendar.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {DAYS.map(day => (
                <button
                  key={day}
                  onClick={() => setAvail(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                    avail.includes(day)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border/60 hover:border-primary/50"
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
            {avail.length === 0 && (
              <p className="text-xs text-amber-500">⚠ No working days set — all days will show as available in the booking calendar.</p>
            )}
            <Button size="sm" className="rounded-full gap-1.5" onClick={saveAvailability} disabled={savingAvail}>
              {savingAvail ? "Saving…" : <><Check className="h-3.5 w-3.5" />Save working days</>}
            </Button>
          </div>
        </TabsContent>

        {/* Payments */}
        <TabsContent value="payments" className="space-y-6">
          {/* Earnings summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="bg-card border-border/50">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'hsl(var(--orange) / 0.12)' }}>
                  <DollarSign className="h-5 w-5" style={{ color: 'hsl(var(--orange))' }} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Released</p>
                  <p className="text-2xl font-serif font-bold">R{((dashboard as any)?.availableEarnings ?? 0).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">After 18% fee</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border/50">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-amber-500/10">
                  <TrendingUp className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">In Escrow</p>
                  <p className="text-2xl font-serif font-bold text-amber-600">R{((dashboard as any)?.pendingEarnings ?? 0).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Pending confirmation</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border/50">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'hsl(var(--baby-blue) / 0.12)' }}>
                  <AlertCircle className="h-5 w-5" style={{ color: 'hsl(var(--baby-blue))' }} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Balance Due</p>
                  <p className="text-2xl font-serif font-bold">R{earningsSummary.balanceDueTotal.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {earningsSummary.depositBalance > 0 && earningsSummary.payAtApptDue > 0
                      ? "Deposits + pay-at-appt"
                      : earningsSummary.depositBalance > 0
                      ? "Deposit balances owed"
                      : "Pay at appointment"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Per-appointment list */}
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Booking Payments</h2>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => refetchStylistPayments()} disabled={stylistPaymentsLoading}>
              <RefreshCw className={`h-3.5 w-3.5 ${stylistPaymentsLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {stylistPaymentsLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading payments…</span>
            </div>
          ) : stylistPayments.length === 0 ? (
            <Card>
              <CardContent className="py-14 flex flex-col items-center gap-3 text-center text-muted-foreground">
                <Receipt className="h-10 w-10 opacity-30" />
                <p className="font-medium">No payment records yet</p>
                <p className="text-sm">Payment details for your bookings will appear here.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {stylistPayments.map((appt) => {
                const payment = appt.payment;
                const paid = payment?.amount ?? 0;
                const refunded = payment?.refundedAmount ?? 0;
                const net = paid - refunded;
                const isPastDate = new Date(appt.date) < new Date();
                return (
                  <Card key={appt.id} className="border-border/50">
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{appt.serviceName}</p>
                          <p className="text-sm text-muted-foreground">
                            Client: {appt.clientName} · {new Date(appt.date).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })} at {appt.time}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`px-2 py-0.5 text-xs font-semibold uppercase tracking-wide rounded-full ${STATUS_STYLES[appt.status] ?? STATUS_STYLES.pending}`}>
                              {appt.status}
                            </span>
                            {appt.payoutStatus === "released" && (
                              <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                <Banknote className="h-3 w-3" />R{(appt.artistPayoutAmount ?? 0).toFixed(2)} paid out
                              </span>
                            )}
                            {appt.payoutStatus === "held" && isPastDate && (
                              <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                <Clock className="h-3 w-3" />Payout held
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {stylistPaymentBadge(appt)}
                          <span className="font-serif font-bold text-lg">
                            {appt.paymentMode === "pay_at_appointment" ? formatZAR(appt.price) : formatZAR(net)}
                          </span>
                        </div>
                      </div>

                      {/* Payment breakdown */}
                      {payment && (
                        <div className="text-xs text-muted-foreground space-y-1 border-t border-border/50 pt-3">
                          <div className="flex justify-between">
                            <span>Service</span>
                            <span>{formatZAR(appt.price)}</span>
                          </div>
                          {payment.tipAmount > 0 && (
                            <div className="flex justify-between">
                              <span>Tip</span>
                              <span>{formatZAR(payment.tipAmount)}</span>
                            </div>
                          )}
                          {payment.discountAmount > 0 && (
                            <div className="flex justify-between text-green-600">
                              <span>Discount {payment.couponCode ? `(${payment.couponCode})` : ""}</span>
                              <span>-{formatZAR(payment.discountAmount)}</span>
                            </div>
                          )}
                          {refunded > 0 && (
                            <div className="flex justify-between text-blue-600">
                              <span>Refunded to client</span>
                              <span>-{formatZAR(refunded)}</span>
                            </div>
                          )}
                          <div className="flex justify-between font-semibold text-foreground pt-1 border-t border-border/30">
                            <span>Total charged</span>
                            <span>{formatZAR(paid)}</span>
                          </div>
                          {appt.payoutStatus !== "released" && net > 0 && (
                            <div className="flex justify-between text-muted-foreground pt-0.5">
                              <span>Your share (82%)</span>
                              <span className="font-medium" style={{ color: 'hsl(var(--orange))' }}>{formatZAR(net * 0.82)}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Deposit / balance-due notice */}
                      {appt.paymentMode === "deposit" && appt.balanceDue > 0 && (
                        <div className="text-xs border-t border-border/50 pt-3">
                          <p className="flex items-center gap-1.5 text-amber-600">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            Balance due at appointment: {formatZAR(appt.balanceDue)}
                            {appt.depositAmount > 0 && <span className="text-muted-foreground ml-1">· Deposit paid: {formatZAR(appt.depositAmount)}</span>}
                          </p>
                        </div>
                      )}

                      {appt.paymentMode === "pay_at_appointment" && (
                        <div className="text-xs text-muted-foreground border-t border-border/50 pt-3">
                          <p className="flex items-center gap-1.5">
                            <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                            Client pays {formatZAR(appt.price)} directly at the appointment
                          </p>
                        </div>
                      )}

                      {/* Refund action */}
                      {canStylistRefund(appt) && (
                        <div className="pt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs h-8"
                            onClick={() => openStylistRefundDialog(appt)}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Issue Refund to Client
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Refund dialog */}
          <Dialog open={!!stylistRefundTarget} onOpenChange={(open) => { if (!open) setStylistRefundTarget(null); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Issue Refund to Client</DialogTitle>
                <DialogDescription>
                  {stylistRefundTarget && (
                    <>
                      Refunding <strong>{stylistRefundTarget.clientName}</strong> for <strong>{stylistRefundTarget.serviceName}</strong>.
                      {" "}Paid: {formatZAR(stylistRefundTarget.payment?.amount ?? 0)},
                      {" "}already refunded: {formatZAR(stylistRefundTarget.payment?.refundedAmount ?? 0)}.
                    </>
                  )}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Refund amount (ZAR)</Label>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder={`Leave blank for full refund (${formatZAR(
                      (stylistRefundTarget?.payment?.amount ?? 0) - (stylistRefundTarget?.payment?.refundedAmount ?? 0)
                    )})`}
                    value={stylistRefundAmount}
                    onChange={(e) => setStylistRefundAmount(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Leave blank to refund the full remaining amount.</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setStylistRefundTarget(null)} disabled={stylistRefundPending}>
                  Cancel
                </Button>
                <Button onClick={submitStylistRefund} disabled={stylistRefundPending}>
                  {stylistRefundPending
                    ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processing…</>
                    : "Issue Refund"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Notification settings */}
        <TabsContent value="settings">
          <Card className="max-w-md border-border/50 bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />WhatsApp Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Add your WhatsApp number and we'll message you the moment a client books or when a casting application comes in — so you never miss a booking.
              </p>
              <div className="space-y-2">
                <Label htmlFor="phone">WhatsApp number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+27 82 123 4567"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="bg-background"
                />
                <p className="text-xs text-muted-foreground">South African numbers accepted (e.g. 082 123 4567 or +27 82 123 4567)</p>
              </div>
              <Button onClick={savePhone} disabled={savingPhone} className="w-full rounded-full">
                {savingPhone ? "Saving…" : "Save number"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
