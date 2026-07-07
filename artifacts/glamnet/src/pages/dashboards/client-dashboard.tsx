import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { useGetClientDashboard } from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Heart, Scissors, Clock, Star, MapPin, BadgeCheck, CheckCircle, MessageCircle } from "lucide-react";
import { toast } from "sonner";

const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-primary/20 text-primary border border-primary/30",
  completed: "bg-muted/50 text-muted-foreground border border-border",
  pending: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  cancelled: "bg-destructive/10 text-destructive border border-destructive/20",
};

function StatCardSkeleton() {
  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-4 rounded" />
      </CardHeader>
      <CardContent><Skeleton className="h-9 w-16" /></CardContent>
    </Card>
  );
}

async function markAppointmentComplete(appointmentId: string) {
  const res = await fetch(`${import.meta.env.BASE_URL}api/appointments/${appointmentId}/complete`, {
    method: "PATCH",
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to mark appointment complete");
  }
  return res.json();
}

export default function ClientDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: dashboard, isLoading, error } = useGetClientDashboard();

  const completeMutation = useMutation({
    mutationFn: markAppointmentComplete,
    onSuccess: () => {
      toast.success("Appointment marked as complete! You can now leave a review.");
      qc.invalidateQueries({ queryKey: ["clientDashboard"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to mark complete"),
  });

  if (error) return <div className="p-8 text-center text-destructive">Failed to load dashboard</div>;

  return (
    <div className="container py-6 sm:py-8 max-w-6xl space-y-6 sm:space-y-8 px-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight">Your Space</h1>
          {user && <p className="text-muted-foreground mt-1">Welcome back, {user.name.split(" ")[0]}</p>}
        </div>
        <Link href="/stylists">
          <Button className="gap-2 shrink-0"><Scissors className="h-4 w-4" />Book a Service</Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-4">
        {isLoading ? (
          <><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /></>
        ) : (
          <>
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Upcoming</CardTitle>
                <Calendar className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-serif font-bold">{dashboard!.upcomingBookings}</div>
                <p className="text-xs text-muted-foreground mt-1">Booked</p>
              </CardContent>
            </Card>
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Completed</CardTitle>
                <Clock className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-serif font-bold">{dashboard!.completedBookings}</div>
                <p className="text-xs text-muted-foreground mt-1">Sessions done</p>
              </CardContent>
            </Card>
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total</CardTitle>
                <Scissors className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-serif font-bold">{dashboard!.totalBookings}</div>
                <p className="text-xs text-muted-foreground mt-1">All time</p>
              </CardContent>
            </Card>
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Favourites</CardTitle>
                <Heart className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-serif font-bold">{dashboard!.favouriteStylists}</div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Tabs defaultValue="appointments" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="recommended">Recommended</TabsTrigger>
        </TabsList>

        <TabsContent value="appointments" className="space-y-4">
          {isLoading ? (
            <div className="space-y-4">{[0,1,2].map(i => <Card key={i} className="h-28 animate-pulse bg-muted border-border/50" />)}</div>
          ) : (dashboard!.recentAppointments?.length ?? 0) > 0 ? (
            <div className="grid gap-4">
              {dashboard!.recentAppointments.map(apt => (
                <Card key={apt.id} className="overflow-hidden border-border/50 hover:border-primary/40 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 gap-4">
                    <div className="space-y-1">
                      <p className="font-semibold text-lg">{apt.serviceName}</p>
                      <p className="text-sm text-muted-foreground">
                        with <Link href={`/stylists/${apt.stylistId}`} className="text-primary hover:underline font-medium">{apt.stylistName}</Link>
                      </p>
                      <div className="flex items-center text-sm text-muted-foreground gap-1.5 pt-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(apt.date).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })} at {apt.time}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <span className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-full ${STATUS_STYLES[apt.status] ?? STATUS_STYLES.pending}`}>
                        {apt.status}
                      </span>
                      {apt.status === "confirmed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                          onClick={() => completeMutation.mutate(apt.id)}
                          disabled={completeMutation.isPending}
                        >
                          <CheckCircle className="h-3.5 w-3.5" />Mark Complete
                        </Button>
                      )}
                      {apt.status === "completed" && (
                        <Link href={`/reviews/${apt.id}`}>
                          <Button size="sm" variant="outline" className="gap-1.5">
                            <Star className="h-3.5 w-3.5" />Leave Review
                          </Button>
                        </Link>
                      )}
                      <Link href={`/messages?stylistId=${apt.stylistId}`}>
                        <Button variant="outline" size="sm" className="gap-1.5">
                          <MessageCircle className="h-3.5 w-3.5" />Message
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 border rounded-2xl border-dashed border-border/50 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-muted mx-auto flex items-center justify-center">
                <Calendar className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">No appointments yet</p>
                <p className="text-sm text-muted-foreground mt-1">Browse talented artists and book your first session.</p>
              </div>
              <Link href="/stylists">
                <Button>Find an Artist</Button>
              </Link>
            </div>
          )}
        </TabsContent>

        <TabsContent value="recommended">
          {isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[0,1,2,3].map(i => <Card key={i} className="h-64 animate-pulse bg-muted" />)}
            </div>
          ) : (dashboard!.recommendedStylists?.length ?? 0) > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {dashboard!.recommendedStylists.map(stylist => (
                <Card key={stylist.id} className="overflow-hidden group hover:border-primary/50 transition-all hover:-translate-y-0.5 bg-card/50">
                  <div className="aspect-[4/3] bg-muted relative">
                    <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
                    <div className="absolute top-3 right-3">
                      {stylist.verified && (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-background/80 backdrop-blur text-primary text-xs font-semibold">
                          <BadgeCheck className="h-3 w-3" />Verified
                        </div>
                      )}
                    </div>
                    <div className="absolute bottom-3 left-4 right-4">
                      <h3 className="font-serif text-lg font-bold">{stylist.name}</h3>
                      <p className="text-primary text-sm font-medium">{stylist.specialty}</p>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                      <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{stylist.location}</span>
                      <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 text-primary" />{stylist.rating}</span>
                    </div>
                    <Link href={`/stylists/${stylist.id}`}>
                      <Button className="w-full" variant="outline">View Profile</Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 border rounded-2xl border-dashed border-border/50">
              <p className="text-muted-foreground mb-4">Check back later for personalised recommendations</p>
              <Link href="/stylists"><Button variant="outline">Browse all artists</Button></Link>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
