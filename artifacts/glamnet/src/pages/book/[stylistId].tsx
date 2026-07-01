import { useState, useEffect, useRef } from "react";
import { useRoute } from "wouter";
import { useGetStylist } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { useMutation } from "@tanstack/react-query";
import { Users, X, Plus, Search } from "lucide-react";

const TIMES = ["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
const ROLES = ["Makeup", "Hair", "Barber", "Nails", "Lashes", "Brows", "Skincare"];

interface TeamMemberEntry {
  stylistId: string;
  stylistName: string;
  role: string;
  payoutPercentage: number;
}

async function fetchAllStylists() {
  const res = await fetch(`${import.meta.env.BASE_URL}api/stylists`, { credentials: "include" });
  if (!res.ok) return [];
  return res.json() as Promise<{ id: string; name: string; specialty: string; location: string }[]>;
}

async function createCheckoutSession(data: {
  stylistId: string;
  serviceId: string;
  date: string;
  time: string;
  notes?: string;
  isTeamBooking?: boolean;
}): Promise<{ url: string; appointmentId?: string }> {
  const res = await fetch(`${import.meta.env.BASE_URL}api/stripe/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to start checkout");
  }
  return res.json();
}

async function addTeamMember(appointmentId: string, member: Omit<TeamMemberEntry, "stylistName">) {
  const res = await fetch(`${import.meta.env.BASE_URL}api/appointments/${appointmentId}/team-members`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(member),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to add team member");
  }
  return res.json();
}

export default function BookStylist() {
  const [, params] = useRoute("/book/:stylistId");
  const stylistId = params?.stylistId;

  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [isTeamBooking, setIsTeamBooking] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMemberEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState(ROLES[0]);
  const [selectedPayout, setSelectedPayout] = useState(20);
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; specialty: string; location: string }[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const { data: stylist, isLoading } = useGetStylist(stylistId || "", {
    query: { enabled: !!stylistId, queryKey: ["stylist", stylistId] },
  });

  const { data: allStylists = [] } = useQuery({
    queryKey: ["all-stylists"],
    queryFn: fetchAllStylists,
    enabled: isTeamBooking,
  });

  // Live filter stylists for search
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const q = searchQuery.toLowerCase();
    const results = allStylists.filter(s =>
      s.id !== stylistId &&
      !teamMembers.some(m => m.stylistId === s.id) &&
      (s.name.toLowerCase().includes(q) || s.specialty.toLowerCase().includes(q) || s.location.toLowerCase().includes(q))
    );
    setSearchResults(results.slice(0, 8));
  }, [searchQuery, allStylists, stylistId, teamMembers]);

  const checkout = useMutation({
    mutationFn: createCheckoutSession,
    onSuccess: async (data) => {
      // If team booking and we have an appointmentId before redirect, add members
      // Note: in Stripe flow, appointmentId comes back from success page; team members
      // are stored in sessionStorage for the success page to process
      if (isTeamBooking && teamMembers.length > 0) {
        sessionStorage.setItem("pendingTeamMembers", JSON.stringify(teamMembers));
      }
      window.location.href = data.url;
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to start checkout.");
    },
  });

  if (isLoading || !stylist)
    return <div className="p-12 text-center text-muted-foreground">Loading...</div>;

  const handleBook = () => {
    if (!serviceId || !date || !time) {
      toast.error("Please select a service, date, and time.");
      return;
    }
    if (isTeamBooking && teamMembers.length === 0) {
      toast.error("Add at least one team member, or turn off Team Booking.");
      return;
    }
    const totalPayout = teamMembers.reduce((sum, m) => sum + m.payoutPercentage, 0);
    if (isTeamBooking && totalPayout > 100) {
      toast.error(`Total payout splits (${totalPayout}%) exceed 100%.`);
      return;
    }
    checkout.mutate({
      stylistId: stylist.id,
      serviceId,
      date: format(date, "yyyy-MM-dd"),
      time,
      notes: notes || undefined,
      isTeamBooking,
    });
  };

  const addMember = (s: { id: string; name: string; specialty: string; location: string }) => {
    if (teamMembers.some(m => m.stylistId === s.id)) return;
    setTeamMembers(prev => [...prev, {
      stylistId: s.id,
      stylistName: s.name,
      role: selectedRole,
      payoutPercentage: selectedPayout,
    }]);
    setSearchQuery("");
    setSearchResults([]);
    setShowSearch(false);
  };

  const removeMember = (stylistId: string) => {
    setTeamMembers(prev => prev.filter(m => m.stylistId !== stylistId));
  };

  const selectedService = stylist.services.find((s) => s.id === serviceId);
  const totalPayout = teamMembers.reduce((sum, m) => sum + m.payoutPercentage, 0);

  return (
    <div className="container py-8 sm:py-12 max-w-4xl space-y-8 px-4">
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight">Book Appointment</h1>
        <p className="text-muted-foreground">with {stylist.name}</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 sm:gap-8">
        <div className="space-y-8">
          {/* Service */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Select Service</Label>
            <div className="grid gap-3">
              {stylist.services.map((s) => (
                <Card
                  key={s.id}
                  className={`cursor-pointer transition-colors ${serviceId === s.id ? "border-primary bg-primary/5" : "hover:border-border/80"}`}
                  onClick={() => setServiceId(s.id)}
                >
                  <CardContent className="p-4 flex justify-between items-center">
                    <div>
                      <h4 className="font-medium">{s.name}</h4>
                      <p className="text-sm text-muted-foreground">{s.duration} mins</p>
                    </div>
                    <div className="font-serif font-bold text-lg">R{s.price}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Team Booking toggle */}
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-xl border-border/60 bg-card/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">Team Booking</p>
                  <p className="text-xs text-muted-foreground">Invite more artists (e.g. hair + makeup + nails)</p>
                </div>
              </div>
              <Switch checked={isTeamBooking} onCheckedChange={setIsTeamBooking} />
            </div>

            {isTeamBooking && (
              <div className="space-y-4 pl-1">
                {/* Current team */}
                {teamMembers.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Team</p>
                    {teamMembers.map(m => (
                      <div key={m.stylistId} className="flex items-center justify-between p-3 border border-border/50 rounded-lg bg-card/50">
                        <div>
                          <p className="font-medium text-sm">{m.stylistName}</p>
                          <p className="text-xs text-muted-foreground">{m.role} · {m.payoutPercentage}% payout</p>
                        </div>
                        <button onClick={() => removeMember(m.stylistId)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    {totalPayout > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Total payout splits: <span className={totalPayout > 100 ? "text-destructive font-semibold" : "text-primary font-semibold"}>{totalPayout}%</span>
                        {totalPayout > 100 && " — exceeds 100%"}
                      </p>
                    )}
                  </div>
                )}

                {/* Add member form */}
                {!showSearch ? (
                  <Button variant="outline" size="sm" className="gap-1.5 w-full" onClick={() => setShowSearch(true)}>
                    <Plus className="h-3.5 w-3.5" />Add Team Member
                  </Button>
                ) : (
                  <div className="space-y-3 border border-border/50 rounded-xl p-4 bg-card/30">
                    <p className="text-sm font-medium">Add artist to team</p>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Role</Label>
                        <Select value={selectedRole} onValueChange={setSelectedRole}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Payout %</Label>
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          value={selectedPayout}
                          onChange={e => setSelectedPayout(Number(e.target.value))}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>

                    <div className="relative" ref={searchRef}>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          placeholder="Search artists by name, specialty…"
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          className="pl-8 h-8 text-xs"
                          autoFocus
                        />
                      </div>
                      {searchResults.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                          {searchResults.map(s => (
                            <button
                              key={s.id}
                              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-accent text-left text-sm transition-colors"
                              onClick={() => addMember(s)}
                            >
                              <div>
                                <span className="font-medium">{s.name}</span>
                                <span className="text-muted-foreground ml-2 text-xs">{s.specialty}</span>
                              </div>
                              <span className="text-xs text-muted-foreground">{s.location}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {searchQuery.length > 1 && searchResults.length === 0 && (
                        <p className="text-xs text-muted-foreground mt-1 pl-1">No artists found matching "{searchQuery}"</p>
                      )}
                    </div>

                    <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={() => setShowSearch(false)}>
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Additional Notes (Optional)</Label>
            <Textarea
              placeholder="Any specific requests?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="resize-none h-24"
            />
          </div>
        </div>

        {/* Right col — date + time */}
        <div className="space-y-8">
          <div className="space-y-4">
            <Label className="text-base font-semibold">Select Date</Label>
            <Card className="p-3 inline-block bg-card/50">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                className="rounded-md"
                disabled={(d) => d < new Date() || d < new Date(new Date().setHours(0, 0, 0, 0))}
              />
            </Card>
          </div>

          {date && (
            <div className="space-y-4">
              <Label className="text-base font-semibold">Select Time</Label>
              <div className="grid grid-cols-3 gap-2">
                {TIMES.map((t) => (
                  <Button
                    key={t}
                    variant={time === t ? "default" : "outline"}
                    className="w-full"
                    onClick={() => setTime(t)}
                  >
                    {t}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="pt-6 border-t flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground uppercase tracking-wider font-medium">Total</p>
          <p className="text-3xl font-serif font-bold">
            {selectedService ? `R${selectedService.price}` : "—"}
          </p>
          {isTeamBooking && teamMembers.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Users className="h-3 w-3" />
              Team booking · {teamMembers.length + 1} artist{teamMembers.length > 0 ? "s" : ""}
            </p>
          )}
        </div>
        <Button
          size="lg"
          className="h-14 px-8 text-base w-full sm:w-auto"
          disabled={!serviceId || !date || !time || checkout.isPending}
          onClick={handleBook}
        >
          {checkout.isPending ? "Redirecting to payment..." : "Pay & Confirm Booking"}
        </Button>
      </div>
    </div>
  );
}
