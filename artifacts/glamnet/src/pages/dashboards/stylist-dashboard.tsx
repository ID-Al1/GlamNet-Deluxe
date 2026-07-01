import { useMemo } from "react";
import { useGetStylistDashboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Calendar as CalendarIcon, Activity, Star } from "lucide-react";

function StatCardSkeleton() {
  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-4 rounded" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-9 w-20 mb-1" />
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

const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-primary/20 text-primary border border-primary/30",
  pending: "bg-accent/10 text-accent border border-accent/20",
  completed: "bg-muted/50 text-muted-foreground border border-border/30",
  cancelled: "bg-destructive/10 text-destructive border border-destructive/20",
};

export default function StylistDashboard() {
  const { data: dashboard, isLoading, error } = useGetStylistDashboard();

  const stats = useMemo(() => {
    if (!dashboard) return null;
    return {
      upcoming: dashboard.pendingBookings + dashboard.confirmedBookings,
      strength: dashboard.profileStrength || 0,
    };
  }, [dashboard?.pendingBookings, dashboard?.confirmedBookings, dashboard?.profileStrength]);

  if (error) {
    return (
      <div className="p-8 text-center text-destructive">
        Failed to load dashboard. Please refresh.
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-6xl space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-serif font-bold tracking-tight">Studio Overview</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        {isLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-serif font-bold">
                  R{dashboard!.thisMonthEarnings.toLocaleString()}
                </div>
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
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-700"
                    style={{ width: `${stats!.strength}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Tabs defaultValue="appointments" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="appointments" className="space-y-4">
          {isLoading ? (
            <>
              <AppointmentSkeleton />
              <AppointmentSkeleton />
              <AppointmentSkeleton />
            </>
          ) : dashboard!.upcomingAppointments?.length > 0 ? (
            <div className="grid gap-4">
              {dashboard!.upcomingAppointments.map((apt) => (
                <Card key={apt.id} className="p-6 border-border/50">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                    <div>
                      <p className="font-medium text-lg">{apt.serviceName}</p>
                      <p className="text-sm text-muted-foreground">Client: {apt.clientName}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(apt.date).toLocaleDateString("en-ZA", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })} at {apt.time}
                      </p>
                    </div>
                    <div className="mt-4 sm:mt-0">
                      <span className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-full inline-block ${STATUS_STYLES[apt.status] ?? STATUS_STYLES.pending}`}>
                        {apt.status}
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 border rounded-xl border-dashed border-border/50">
              <p className="text-muted-foreground">No upcoming appointments</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="activity">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 py-3 border-b border-border/50">
                  <Skeleton className="w-2 h-2 rounded-full shrink-0" />
                  <div className="space-y-1 flex-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : dashboard!.recentActivity?.length > 0 ? (
            <div className="space-y-4">
              {dashboard!.recentActivity.map((act) => (
                <div key={act.id} className="flex items-center gap-4 py-3 border-b border-border/50 last:border-0">
                  <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                  <div>
                    <p className="text-sm">{act.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(act.createdAt).toLocaleString("en-ZA", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 border rounded-xl border-dashed border-border/50">
              <p className="text-muted-foreground">No recent activity</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
