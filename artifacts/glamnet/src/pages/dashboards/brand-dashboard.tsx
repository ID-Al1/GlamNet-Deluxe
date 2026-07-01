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
import { Briefcase, Users, DollarSign, Target, Plus, Star } from "lucide-react";
import { toast } from "sonner";

const SPECIALTIES = ["Makeup", "Hair", "Barber", "Nails", "Lashes", "Brows", "Skincare"];

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

function CreateCastingForm({ onSuccess }: { onSuccess: () => void }) {
  const { user } = useAuth();
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
      <Button type="submit" className="w-full h-11" disabled={createCall.isPending}>
        {createCall.isPending ? "Posting…" : "Post Casting Call"}
      </Button>
    </form>
  );
}

export default function BrandDashboard() {
  const { user } = useAuth();
  const { data: dashboard, isLoading, error, refetch } = useGetBrandDashboard();
  const [dialogOpen, setDialogOpen] = useState(false);

  if (error) return <div className="p-8 text-center text-destructive">Failed to load dashboard</div>;

  return (
    <div className="container py-6 sm:py-8 max-w-6xl space-y-6 sm:space-y-8 px-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight">Brand Hub</h1>
          {user && <p className="text-muted-foreground mt-1">{user.businessName || user.name}</p>}
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shrink-0"><Plus className="h-4 w-4" />Post Casting Call</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl">New Casting Call</DialogTitle>
            </DialogHeader>
            <CreateCastingForm onSuccess={() => { setDialogOpen(false); refetch(); }} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-4">
        {isLoading ? (
          <><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /></>
        ) : (
          <>
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Active Castings</CardTitle>
                <Briefcase className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-serif font-bold">{dashboard!.activeCastingCalls}</div>
                <p className="text-xs text-muted-foreground mt-1">Live campaigns</p>
              </CardContent>
            </Card>
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Applications</CardTitle>
                <Users className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-serif font-bold">{dashboard!.totalApplications}</div>
                <p className="text-xs text-muted-foreground mt-1">Artists applied</p>
              </CardContent>
            </Card>
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Spend</CardTitle>
                <DollarSign className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-serif font-bold">R{dashboard!.totalSpend.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Team Size</CardTitle>
                <Target className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-serif font-bold">{dashboard!.teamSize}</div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Tabs defaultValue="castings" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="castings">Active Castings</TabsTrigger>
          <TabsTrigger value="applications">Applications</TabsTrigger>
          <TabsTrigger value="discover">Discover Talent</TabsTrigger>
        </TabsList>

        <TabsContent value="castings" className="space-y-4">
          {isLoading ? (
            <div className="space-y-4">{[0,1].map(i => <Card key={i} className="h-32 animate-pulse bg-muted border-border/50" />)}</div>
          ) : (dashboard!.topCastingCalls?.length ?? 0) > 0 ? (
            <div className="grid gap-4">
              {dashboard!.topCastingCalls.map(call => (
                <Card key={call.id} className="p-6 border-border/50 hover:border-primary/40 transition-colors">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <h3 className="font-serif text-xl font-bold">{call.title}</h3>
                      <p className="text-sm text-primary font-medium mt-0.5">{call.specialty}</p>
                      <p className="text-muted-foreground text-sm mt-2 line-clamp-2">{call.brief}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-serif font-bold">{call.budget}</p>
                      <p className="text-xs text-muted-foreground mt-1">Due {new Date(call.deadline).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-sm">
                      <Users className="h-4 w-4 text-primary" />
                      <span className="font-medium">{call.applicantCount}</span>
                      <span className="text-muted-foreground">applicants</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 border rounded-2xl border-dashed border-border/50 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-muted mx-auto flex items-center justify-center">
                <Briefcase className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">No casting calls yet</p>
                <p className="text-sm text-muted-foreground mt-1">Post your first call to start receiving applications from verified artists.</p>
              </div>
              <Button onClick={() => setDialogOpen(true)} className="gap-2"><Plus className="h-4 w-4" />Post your first casting</Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="applications" className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">{[0,1,2].map(i => <Card key={i} className="h-16 animate-pulse bg-muted" />)}</div>
          ) : (dashboard!.recentApplications?.length ?? 0) > 0 ? (
            <div className="space-y-3">
              {dashboard!.recentApplications.map(app => (
                <Card key={app.id} className="p-5 flex items-center justify-between border-border/50">
                  <div>
                    <p className="font-semibold">{app.stylistName}</p>
                    <p className="text-sm text-muted-foreground">Applied for: {app.castingTitle}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{new Date(app.appliedAt).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}</p>
                  </div>
                  <div className={`px-3 py-1 text-xs font-semibold uppercase rounded-full ${
                    app.status === "accepted" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                  }`}>
                    {app.status}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 border rounded-2xl border-dashed border-border/50">
              <p className="text-muted-foreground">No applications yet. Post a casting call to get started.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="discover">
          <div className="text-center py-16 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 mx-auto flex items-center justify-center">
              <Star className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-serif font-bold text-xl">Find the right talent</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                Browse all verified artists by specialty, location, and rating. Perfect for direct bookings or campaign shortlisting.
              </p>
            </div>
            <Link href="/stylists">
              <Button className="gap-2"><Users className="h-4 w-4" />Browse All Artists</Button>
            </Link>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
