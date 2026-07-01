import { useGetStylistDashboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, Calendar as CalendarIcon, Activity, Star } from "lucide-react";

export default function StylistDashboard() {
  const { data: dashboard, isLoading, error } = useGetStylistDashboard();

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading dashboard...</div>;
  if (error) return <div className="p-8 text-center text-destructive">Failed to load dashboard</div>;
  if (!dashboard) return null;

  return (
    <div className="container py-8 max-w-6xl space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-serif font-bold tracking-tight">Studio Overview</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif font-bold">R{dashboard.thisMonthEarnings.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">This month</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Upcoming</CardTitle>
            <CalendarIcon className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif font-bold">{dashboard.pendingBookings + dashboard.confirmedBookings}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Bookings</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif font-bold">{dashboard.totalBookings}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Profile Strength</CardTitle>
            <Star className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif font-bold">{dashboard.profileStrength || 0}%</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="appointments" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="appointments" className="space-y-4">
          {dashboard.upcomingAppointments && dashboard.upcomingAppointments.length > 0 ? (
            <div className="grid gap-4">
              {dashboard.upcomingAppointments.map((apt) => (
                <Card key={apt.id} className="p-6 border-border/50">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                    <div>
                      <p className="font-medium text-lg">{apt.serviceName}</p>
                      <p className="text-sm text-muted-foreground">Client: {apt.clientName}</p>
                      <p className="text-sm text-muted-foreground">{new Date(apt.date).toLocaleDateString()} at {apt.time}</p>
                    </div>
                    <div className="mt-4 sm:mt-0">
                      <div className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-full inline-block ${
                        apt.status === 'confirmed' ? 'bg-primary/20 text-primary border border-primary/30' :
                        'bg-accent/10 text-accent border border-accent/20'
                      }`}>
                        {apt.status}
                      </div>
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
          {dashboard.recentActivity && dashboard.recentActivity.length > 0 ? (
             <div className="space-y-4">
               {dashboard.recentActivity.map((act) => (
                 <div key={act.id} className="flex items-center gap-4 py-3 border-b border-border/50 last:border-0">
                   <div className="w-2 h-2 rounded-full bg-primary" />
                   <div>
                     <p className="text-sm">{act.description}</p>
                     <p className="text-xs text-muted-foreground">{new Date(act.createdAt).toLocaleString()}</p>
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
