import { useGetClientDashboard } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar, LogOut, Star } from "lucide-react";

export function ClientProfile() {
  const { user, token, logout } = useAuth();
  const { data: dashboard, isLoading } = useGetClientDashboard();
  
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
      toast.success("Phone number saved.");
    } catch {
      toast.error("Could not save phone number");
    } finally {
      setSavingPhone(false);
    }
  };

  const localDate = (a: { date: string; time?: string }) => new Date(`${a.date}T${a.time ?? "00:00"}`);
  const now = new Date();

  const allAppointments = dashboard?.recentAppointments ?? [];

  const upcoming = allAppointments
    .filter(a => (a.status === "confirmed" || a.status === "pending") && localDate(a) >= now)
    .sort((a, b) => localDate(a).getTime() - localDate(b).getTime());

  const awaitingReview = allAppointments
    .filter(a => a.status === "completed")
    .sort((a, b) => localDate(b).getTime() - localDate(a).getTime());

  // Completed appointments are shown separately below when they need a review.
  const past = allAppointments
    .filter(a => a.status === "cancelled" || a.status === "declined" ||
                 ((a.status === "confirmed" || a.status === "pending") && localDate(a) < now))
    .sort((a, b) => localDate(b).getTime() - localDate(a).getTime());

  return (
    <div className="space-y-8">
      {/* Upcoming Bookings */}
      <div className="space-y-4">
        <h3 className="text-lg font-serif font-bold">Upcoming Bookings</h3>
        {isLoading ? (
          <Skeleton className="h-24 w-full rounded-xl" />
        ) : upcoming.length > 0 ? (
          <div className="space-y-3">
            {upcoming.map(apt => (
              <Card key={apt.id} className="border-border/50 p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-sm" data-testid={`text-service-name-${apt.id}`}>{apt.serviceName}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">with <span className="font-medium text-primary">{apt.stylistName}</span></p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
                      <Calendar className="h-3 w-3" />
                      {new Date(apt.date).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })} at {apt.time}
                    </div>
                  </div>
                  <Badge variant={apt.status === "confirmed" ? "default" : "secondary"}>{apt.status}</Badge>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground p-6 text-center border border-dashed rounded-xl">No upcoming bookings.</p>
        )}
      </div>

      {/* Past Bookings */}
      <div className="space-y-4">
        <h3 className="text-lg font-serif font-bold">Past Bookings</h3>
        {isLoading ? (
          <Skeleton className="h-24 w-full rounded-xl" />
        ) : past.length > 0 ? (
          <div className="space-y-3">
            {past.slice(0, 5).map(apt => (
              <Card key={apt.id} className="border-border/50 p-4 opacity-80">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-sm">{apt.serviceName}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">with <span className="font-medium text-foreground">{apt.stylistName}</span></p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
                      <Calendar className="h-3 w-3" />
                      {new Date(apt.date).toLocaleDateString()}
                    </div>
                  </div>
                  <Badge variant="outline">{apt.status}</Badge>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground p-6 text-center border border-dashed rounded-xl">No past bookings.</p>
        )}
      </div>

      {/* Awaiting Review */}
      <div className="space-y-4">
        <h3 className="text-lg font-serif font-bold">Awaiting Review</h3>
        {isLoading ? (
          <Skeleton className="h-24 w-full rounded-xl" />
        ) : awaitingReview.length > 0 ? (
          <div className="space-y-3">
            {awaitingReview.map(apt => (
              <Card key={apt.id} className="border-border/50 p-4 bg-muted/20">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-semibold text-sm">{apt.serviceName}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">with <span className="font-medium text-foreground">{apt.stylistName}</span></p>
                    <p className="text-xs text-muted-foreground mt-1">{new Date(apt.date).toLocaleDateString()}</p>
                  </div>
                  <Link href={`/reviews/${apt.id}`}>
                    <Button variant="outline" size="sm" className="gap-1.5 rounded-full text-xs" data-testid={`link-review-${apt.id}`}>
                      <Star strokeWidth={1.9} className="h-3.5 w-3.5" />
                      Leave Review
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground p-6 text-center border border-dashed rounded-xl">No completed appointments to review.</p>
        )}
      </div>

      {/* Account Details */}
      <Card className="border-border/50 bg-card">
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Name</Label>
              <p className="font-medium text-foreground">{user?.name}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Email</Label>
              <p className="text-foreground">{user?.email}</p>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="phone" className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Phone Number</Label>
              <div className="flex gap-2 max-w-sm">
                <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+27 82 123 4567" data-testid="input-phone" />
                <Button onClick={savePhone} disabled={savingPhone} variant="secondary" data-testid="button-save-phone">
                  {savingPhone ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="bg-muted/30 border-t border-border/50 py-4 flex justify-between items-center">
          <p className="text-sm text-muted-foreground">Joined {new Date(user?.createdAt || "").toLocaleDateString()}</p>
          <Button variant="ghost" onClick={logout} className="text-destructive hover:text-destructive hover:bg-destructive/10" data-testid="button-signout">
            <LogOut className="h-4 w-4 mr-2" /> Sign Out
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
