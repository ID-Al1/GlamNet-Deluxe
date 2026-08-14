import { useState } from "react";
import { useGetBrandDashboard, useCreateCastingCall } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Briefcase, Users, DollarSign, Target, Plus, Star, Bell } from "lucide-react";
import { toast } from "sonner";

const SPECIALTIES = ["Makeup", "Hair", "Barber", "Nails", "Lashes", "Brows", "Skincare"];

function StatCardSkeleton() {
  return (
    <Card className="bg-card border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-8 rounded-xl" />
      </CardHeader>
      <CardContent><Skeleton className="h-9 w-16" /></CardContent>
    </Card>
  );
}

function CreateCastingForm({ onSuccess }: { onSuccess: () => void }) {
  const createCall = useCreateCastingCall();
  const [form, setForm] = useState({
    title: "",
    brief: "",
    specialty: "Makeup",
    budget: "",
    deadline: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.brief || !form.budget || !form.deadline) {
      toast.error("Please fill in all fields");
      return;
    }
    try {
      await createCall.mutateAsync({
        data: {
          title: form.title,
          brief: form.brief,
          specialty: form.specialty,
          budget: form.budget,
          deadline: form.deadline,
        },
      });
      toast.success("Casting call posted");
      onSuccess();
    } catch {
      toast.error("Failed to post casting call");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pt-2">
      <div className="space-y-2">
        <Label htmlFor="title">Campaign title <span className="text-destructive">*</span></Label>
        <Input id="title" required placeholder="e.g. Summer Nail Campaign 2026" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="bg-background" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="brief">Brief <span className="text-destructive">*</span></Label>
        <Textarea id="brief" required rows={4} placeholder="Describe what you need, who you're looking for, and any requirements…" value={form.brief} onChange={e => setForm(p => ({ ...p, brief: e.target.value }))} className="bg-background resize-none" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Specialty <span className="text-destructive">*</span></Label>
          <Select value={form.specialty} onValueChange={v => setForm(p => ({ ...p, specialty: v }))}>
            <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>{SPECIALTIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="budget">Budget range <span className="text-destructive">*</span></Label>
          <Input id="budget" required placeholder="e.g. R5,000 - R15,000" value={form.budget} onChange={e => setForm(p => ({ ...p, budget: e.target.value }))} className="bg-background" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="deadline">Application deadline <span className="text-destructive">*</span></Label>
        <Input id="deadline" required type="date" value={form.deadline} onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))} className="bg-background" min={new Date().toISOString().split("T")[0]} />
      </div>
      <Button type="submit" className="w-full h-11 rounded-full" disabled={createCall.isPending}>
        {createCall.isPending ? "Posting…" : "Post Casting Call"}
      </Button>
    </form>
  );
}

export default function BrandDashboard() {
  const { user, token } = useAuth();
  const { data: dashboard, isLoading, error, refetch } = useGetBrandDashboard();
  const [dialogOpen, setDialogOpen] = useState(false);

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

  if (error) return <div className="p-8 text-center text-destructive">Failed to load dashboard</div>;

  return (
    <div className="container py-8 sm:py-12 max-w-6xl space-y-8 px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="text-accent text-xs font-semibold uppercase tracking-widest mb-2">Brand Partner</p>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold tracking-tight">Brand Hub</h1>
          {user && <p className="text-muted-foreground mt-1.5">{user.businessName || user.name}</p>}
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shrink-0 rounded-full px-5"><Plus className="h-4 w-4" />Post Casting Call</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl">New Casting Call</DialogTitle>
            </DialogHeader>
            <CreateCastingForm onSuccess={() => { setDialogOpen(false); refetch(); }} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {isLoading ? (
          <><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /></>
        ) : (
          <>
            <Card className="bg-card border-border/50 hover:border-border transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Castings</CardTitle>
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Briefcase className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent className="pb-5">
                <div className="text-3xl font-serif font-bold">{dashboard!.activeCastingCalls}</div>
                <p className="text-xs text-muted-foreground mt-1">Live campaigns</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border/50 hover:border-border transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Applications</CardTitle>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'hsl(var(--baby-blue) / 0.12)' }}>
                  <Users className="h-4 w-4" style={{ color: 'hsl(var(--baby-blue))' }} />
                </div>
              </CardHeader>
              <CardContent className="pb-5">
                <div className="text-3xl font-serif font-bold">{dashboard!.totalApplications}</div>
                <p className="text-xs text-muted-foreground mt-1">Artists applied</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border/50 hover:border-border transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Spend</CardTitle>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'hsl(var(--orange) / 0.12)' }}>
                  <DollarSign className="h-4 w-4" style={{ color: 'hsl(var(--orange))' }} />
                </div>
              </CardHeader>
              <CardContent className="pb-5">
                <div className="text-3xl font-serif font-bold">R{dashboard!.totalSpend.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">All campaigns</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border/50 hover:border-border transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Team Size</CardTitle>
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Target className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent className="pb-5">
                <div className="text-3xl font-serif font-bold">{dashboard!.teamSize}</div>
                <p className="text-xs text-muted-foreground mt-1">Artists engaged</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Tabs defaultValue="castings" className="w-full">
        <TabsList className="mb-8 h-auto p-1 gap-1">
          <TabsTrigger value="castings" className="rounded-lg">Active Castings</TabsTrigger>
          <TabsTrigger value="applications" className="rounded-lg">Applications</TabsTrigger>
          <TabsTrigger value="discover" className="rounded-lg">Discover Talent</TabsTrigger>
          <TabsTrigger value="settings" className="rounded-lg">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="castings" className="space-y-4">
          {isLoading ? (
            <div className="space-y-4">{[0,1].map(i => <Card key={i} className="h-32 animate-pulse bg-muted border-border/50" />)}</div>
          ) : (dashboard!.topCastingCalls?.length ?? 0) > 0 ? (
            <div className="grid gap-4">
              {dashboard!.topCastingCalls.map(call => (
                <Card key={call.id} className="overflow-hidden border-border/50 hover:border-border transition-colors bg-card">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-serif text-xl font-bold">{call.title}</h3>
                        <p className="text-sm font-semibold mt-0.5" style={{ color: 'hsl(var(--baby-blue))' }}>{call.specialty}</p>
                        <p className="text-muted-foreground text-sm mt-2 line-clamp-2">{call.brief}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-serif font-bold text-lg" style={{ color: 'hsl(var(--orange))' }}>{call.budget}</p>
                        <p className="text-xs text-muted-foreground mt-1">Due {new Date(call.deadline).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}</p>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-border/40 flex items-center gap-4">
                      <div className="flex items-center gap-1.5 text-sm">
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'hsl(var(--baby-blue) / 0.10)' }}>
                          <Users className="h-3.5 w-3.5" style={{ color: 'hsl(var(--baby-blue))' }} />
                        </div>
                        <span className="font-semibold">{call.applicantCount}</span>
                        <span className="text-muted-foreground">applicants</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 border rounded-2xl border-dashed border-border/50 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 mx-auto flex items-center justify-center">
                <Briefcase className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-serif text-xl font-bold">No casting calls yet</p>
                <p className="text-sm text-muted-foreground mt-1.5 max-w-sm mx-auto">Post your first call to start receiving applications from verified artists.</p>
              </div>
              <Button onClick={() => setDialogOpen(true)} className="gap-2 rounded-full px-6"><Plus className="h-4 w-4" />Post your first casting</Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="applications" className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">{[0,1,2].map(i => <Card key={i} className="h-16 animate-pulse bg-muted" />)}</div>
          ) : (dashboard!.recentApplications?.length ?? 0) > 0 ? (
            <div className="space-y-3">
              {dashboard!.recentApplications.map(app => (
                <Card key={app.id} className="overflow-hidden border-border/50 bg-card">
                  <div className="p-5 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold">{app.stylistName}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">Applied for: {app.castingTitle}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{new Date(app.appliedAt).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}</p>
                    </div>
                    <div className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-full ${
                      app.status === "accepted"
                        ? "bg-primary/15 text-primary border border-primary/25"
                        : "bg-muted text-muted-foreground border border-border/40"
                    }`}>
                      {app.status}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 border rounded-2xl border-dashed border-border/50">
              <p className="text-muted-foreground">No applications yet. Post a casting call to get started.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="discover">
          <div className="text-center py-20 space-y-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto" style={{ background: 'hsl(var(--baby-blue) / 0.12)' }}>
              <Star className="h-6 w-6" style={{ color: 'hsl(var(--baby-blue))' }} />
            </div>
            <div>
              <p className="font-serif font-bold text-2xl">Find the right talent</p>
              <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                Browse all verified artists by specialty, location, and rating. Perfect for direct bookings or campaign shortlisting.
              </p>
            </div>
            <Link href="/stylists">
              <Button className="gap-2 rounded-full px-6"><Users className="h-4 w-4" />Browse All Artists</Button>
            </Link>
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <Card className="max-w-md border-border/50 bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />WhatsApp Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Add your WhatsApp number and we'll message you the moment an artist applies to one of your casting calls. No refresh needed.
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
