import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { useGetClientDashboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Heart, Scissors, Clock } from "lucide-react";

export default function ClientDashboard() {
  const { data: dashboard, isLoading, error } = useGetClientDashboard();

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading dashboard...</div>;
  if (error) return <div className="p-8 text-center text-destructive">Failed to load dashboard</div>;
  if (!dashboard) return null;

  return (
    <div className="container py-8 max-w-6xl space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-serif font-bold tracking-tight">Your Space</h1>
        <Link href="/stylists">
          <Button variant="outline">Book a Service</Button>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Upcoming</CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif font-bold">{dashboard.upcomingBookings}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Completed</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif font-bold">{dashboard.completedBookings}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total</CardTitle>
            <Scissors className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif font-bold">{dashboard.totalBookings}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Favorites</CardTitle>
            <Heart className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif font-bold">{dashboard.favouriteStylists}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="appointments" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="recommended">Recommended Stylists</TabsTrigger>
        </TabsList>
        <TabsContent value="appointments" className="space-y-4">
          {dashboard.recentAppointments && dashboard.recentAppointments.length > 0 ? (
            <div className="grid gap-4">
              {dashboard.recentAppointments.map((apt) => (
                <Card key={apt.id} className="overflow-hidden border-border/50">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6">
                    <div className="space-y-1">
                      <p className="font-medium text-lg">{apt.serviceName}</p>
                      <p className="text-sm text-muted-foreground">
                        with <Link href={`/stylists/${apt.stylistId}`} className="text-primary hover:underline">{apt.stylistName}</Link>
                      </p>
                      <div className="flex items-center text-sm text-muted-foreground gap-2 pt-2">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(apt.date).toLocaleDateString()} at {apt.time}</span>
                      </div>
                    </div>
                    <div className="mt-4 sm:mt-0 flex items-center gap-4">
                      <div className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-full ${
                        apt.status === 'confirmed' ? 'bg-primary/20 text-primary border border-primary/30' :
                        apt.status === 'completed' ? 'bg-muted text-muted-foreground border border-border' :
                        'bg-accent/10 text-accent border border-accent/20'
                      }`}>
                        {apt.status}
                      </div>
                      <Link href={`/messages`}>
                        <Button variant="outline" size="sm">Message</Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 border rounded-xl border-dashed border-border/50">
              <p className="text-muted-foreground mb-4">No appointments found</p>
              <Link href="/stylists">
                <Button variant="outline">Browse Stylists</Button>
              </Link>
            </div>
          )}
        </TabsContent>
        <TabsContent value="recommended">
          {dashboard.recommendedStylists && dashboard.recommendedStylists.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {dashboard.recommendedStylists.map((stylist) => (
                <Card key={stylist.id} className="overflow-hidden group hover:border-primary/50 transition-colors">
                  <div className="aspect-[4/3] bg-muted relative">
                    <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4">
                      <h3 className="font-serif text-xl font-bold">{stylist.name}</h3>
                      <p className="text-primary text-sm font-medium">{stylist.specialty}</p>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                      <span>{stylist.location}</span>
                      <span className="flex items-center gap-1">★ {stylist.rating}</span>
                    </div>
                    <Link href={`/stylists/${stylist.id}`}>
                      <Button className="w-full" variant="secondary">View Profile</Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 border rounded-xl border-dashed border-border/50">
              <p className="text-muted-foreground mb-4">Check back later for recommendations</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
