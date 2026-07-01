import { useMemo, useState } from "react";
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
  Home as HomeIcon, Gift, Copy, CheckCheck, Briefcase, Zap, Users, Check, X,
} from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-primary/20 text-primary border border-primary/30",
  pending: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  completed: "bg-muted/50 text-muted-foreground border border-border/30",
  cancelled: "bg-destructive/10 text-destructive border border-destructive/20",
};

function StatCardSkeleton() {
  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-4 rounded" />
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
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: dashboard, isLoading, error, refetch } = useGetStylistDashboard();
  const updateProfile = useUpdateMyStylistProfile();
  const [copied, setCopied] = useState(false);

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

  if (error) {
    return <div className="p-8 text-center text-destructive">Failed to load dashboard. Please refresh.</div>;
  }

  return (
    <div className="container py-6 sm:py-8 max-w-6xl space-y-6 sm:space-y-8 px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight">Studio Overview</h1>
          {user && <p className="text-muted-foreground mt-1">Welcome back, {user.name.split(" ")[0]}</p>}
        </div>
        <Link href="/casting">
          <Button variant="outline" className="gap-2 shrink-0">
            <Briefcase className="h-4 w-4" />Find Castings
          </Button>
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-4">
        {isLoading ? (
          <><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /></>
        ) : (
          <>
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-serif font-bold">R{dashboard!.thisMonthEarnings.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">This month</p>
              </CardContent>
            </Card>
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Upcoming</CardTitle>
                <CalendarIcon className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-serif font-bold">{stats!.upcoming}</div>
                <p className="text-xs text-muted-foreground mt-1">Appointments</p>
              </CardContent>
            </Card>
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Bookings</CardTitle>
                <Activity className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-serif font-bold">{dashboard!.totalBookings}</div>
                <p className="text-xs text-muted-foreground mt-1">All time</p>
              </CardContent>
            </Card>
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Profile Strength</CardTitle>
                <Star className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-serif font-bold">{stats!.strength}%</div>
                <div className="mt-2 h-1.5 rounded-full bg-border/50 overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${stats!.strength}%` }} />
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
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <HomeIcon className="h-5 w-5 text-primary" />
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
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-primary font-medium">
                      <Zap className="h-3 w-3" />House calls enabled — shown on your profile
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Referrals */}
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Gift className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">Referral Link</p>
                  {referralData && (
                    <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                      {referralData.totalReferrals} referred · {referralData.completedReferrals} completed
                      {referralData.pendingBonusZAR > 0 && (
                        <span className="ml-2 text-primary font-medium">· R{referralData.pendingBonusZAR} pending</span>
                      )}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground mb-3">
                    Share your code to invite artists and clients. Every sign-up boosts your profile ranking.
                  </p>
                  {referralLink ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0 bg-background border border-border/60 rounded-lg px-3 py-2 text-xs text-muted-foreground font-mono truncate">
                        {referralLink}
                      </div>
                      <Button size="sm" variant="outline" onClick={handleCopy} className="shrink-0 gap-1.5">
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

      {/* Tabs */}
      <Tabs defaultValue="active" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="appointments">All Appointments</TabsTrigger>
          <TabsTrigger value="invitations" className="relative">
            Invitations
            {invitations.length > 0 && (
              <Badge className="ml-2 h-4 w-4 p-0 text-[10px] flex items-center justify-center bg-primary text-primary-foreground rounded-full">
                {invitations.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
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
                  <Card key={apt.id} className="p-6 border-primary/30 bg-primary/5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                          <p className="font-semibold text-lg">{apt.serviceName}</p>
                        </div>
                        <p className="text-sm text-muted-foreground">Client: {apt.clientName}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(apt.date).toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" })} at {apt.time}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="font-serif font-bold text-xl">R{apt.price.toLocaleString()}</p>
                        <span className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-full ${STATUS_STYLES.confirmed}`}>Confirmed</span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 border rounded-2xl border-dashed border-border/50 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-muted mx-auto flex items-center justify-center">
                  <CalendarIcon className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">No confirmed bookings yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Complete your profile to get discovered by clients.</p>
                </div>
                <Link href="/stylists">
                  <Button variant="outline" size="sm">View your public profile</Button>
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
                <Card key={apt.id} className="p-6 border-border/50">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-lg">{apt.serviceName}</p>
                      <p className="text-sm text-muted-foreground">Client: {apt.clientName}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(apt.date).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })} at {apt.time}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-serif font-bold">R{apt.price.toLocaleString()}</p>
                      <span className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-full ${STATUS_STYLES[apt.status] ?? STATUS_STYLES.pending}`}>
                        {apt.status}
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 border rounded-2xl border-dashed border-border/50 space-y-3">
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
                <Card key={inv.id} className="p-6 border-border/50">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
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
                        <span className="text-primary">R{((inv.price ?? 0) * (inv.payoutPercentage / 100) * 0.82).toFixed(0)}</span>
                        <span className="text-xs text-muted-foreground ml-1">(after platform cut)</span>
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 border-destructive/50 text-destructive hover:bg-destructive/10"
                        onClick={() => respond.mutate({ appointmentId: inv.appointmentId, memberId: inv.id, status: "declined" })}
                        disabled={respond.isPending}
                      >
                        <X className="h-3.5 w-3.5" />Decline
                      </Button>
                      <Button
                        size="sm"
                        className="gap-1.5"
                        onClick={() => respond.mutate({ appointmentId: inv.appointmentId, memberId: inv.id, status: "confirmed" })}
                        disabled={respond.isPending}
                      >
                        <Check className="h-3.5 w-3.5" />Accept
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 border rounded-2xl border-dashed border-border/50 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-muted mx-auto flex items-center justify-center">
                <Users className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="font-medium">No pending team invitations</p>
              <p className="text-sm text-muted-foreground">You'll be notified here when a client or lead artist invites you to a team booking.</p>
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
                <div key={act.id} className="flex items-center gap-4 py-3 border-b border-border/50 last:border-0">
                  <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                  <div>
                    <p className="text-sm">{act.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(act.createdAt).toLocaleString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 border rounded-2xl border-dashed border-border/50">
              <p className="text-muted-foreground">No recent activity</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
