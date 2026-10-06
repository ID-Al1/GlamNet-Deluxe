import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetBrandDashboardQueryKey, useGetBrandDashboard, useCreateCastingCall, useGetMyBrandProfile } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { CampaignForm } from "@/components/campaign-form";
import { apiMessage, longDate, randWhole } from "@/lib/campaign-money";
import { Link } from "wouter";
import { Briefcase, Users, DollarSign, Target, Plus, Star, Bell, ShieldCheck, ArrowRight } from "lucide-react";
import { toast } from "sonner";

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

function NewCampaign({ onSuccess }: { onSuccess: () => void }) {
  const createCall = useCreateCastingCall();
  return (
    <CampaignForm
      submitLabel="Post campaign"
      isPending={createCall.isPending}
      onSubmit={async (v) => {
        try {
          await createCall.mutateAsync({
            data: {
              title: v.title,
              brief: v.brief,
              specialty: v.specialty,
              artistsNeeded: v.artistsNeeded,
              ratePerArtist: v.ratePerArtist,
              eventDate: v.eventDate,
              eventTime: v.eventTime,
              location: v.location,
              deadline: v.deadline,
            },
          });
          toast.success("Campaign posted. Verified artists can now apply, or you can invite them.");
          onSuccess();
        } catch (error) {
          toast.error(apiMessage(error, "Could not post the campaign."));
        }
      }}
    />
  );
}

const STAGE_LABEL: Record<string, string> = {
  open: "Choosing your team",
  deposit_paid: "Deposit paid",
  fully_paid: "Paid in full",
  cancelled: "Cancelled",
};

export default function BrandDashboard() {
  const { user, token } = useAuth();
  const { data: dashboard, isLoading, error, refetch } = useGetBrandDashboard();
  const { data: brandProfile } = useGetMyBrandProfile();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const verified = brandProfile?.verificationStatus === "verified";

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
            <Button className="gap-2 shrink-0 rounded-full px-5" disabled={!verified} data-testid="button-new-campaign"><Plus className="h-4 w-4" />New campaign</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl">New campaign</DialogTitle>
            </DialogHeader>
            <NewCampaign onSuccess={() => { setDialogOpen(false); void queryClient.invalidateQueries({ queryKey: getGetBrandDashboardQueryKey() }); void refetch(); }} />
          </DialogContent>
        </Dialog>
      </div>

      {brandProfile && !verified && (
        <Card className="border-primary/30 bg-primary/5" data-testid="banner-brand-verification">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" strokeWidth={1.9} />
              <div>
                <p className="font-semibold">
                  {brandProfile.verificationStatus === "pending" ? "Your brand is being verified" : "Verify your brand to book artists"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {brandProfile.verificationStatus === "pending"
                    ? "We review every brand within 72 hours and will email you. You can post campaigns as soon as you are verified."
                    : brandProfile.rejectionReason
                      ? `We need a bit more: ${brandProfile.rejectionReason}`
                      : "Artists only ever see real companies. Add your company details and we will verify you within 72 hours."}
                </p>
              </div>
            </div>
            {brandProfile.verificationStatus !== "pending" && (
              <Link href="/profile"><Button className="gap-2 rounded-full">Complete brand profile<ArrowRight className="h-4 w-4" /></Button></Link>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {isLoading ? (
          <><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /></>
        ) : (
          <>
            <Card className="bg-card border-border/50 hover:border-border transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Campaigns</CardTitle>
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Briefcase className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent className="pb-5">
                <div className="text-3xl font-serif font-bold">{dashboard!.activeCastingCalls}</div>
                <p className="text-xs text-muted-foreground mt-1">Not cancelled</p>
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
                <div className="text-3xl font-serif font-bold">{randWhole(dashboard!.totalSpend)}</div>
                <p className="text-xs text-muted-foreground mt-1">Paid so far</p>
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
          <TabsTrigger value="castings" className="rounded-lg">Campaigns</TabsTrigger>
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
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-serif text-xl font-bold">{call.title}</h3>
                          <Badge variant={call.status === "cancelled" ? "outline" : "secondary"}>{STAGE_LABEL[call.status] ?? call.status}</Badge>
                        </div>
                        <p className="text-sm font-semibold mt-0.5" style={{ color: 'hsl(var(--baby-blue))' }}>{call.specialty}</p>
                        <p className="text-muted-foreground text-sm mt-2 line-clamp-2">{call.brief}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-serif font-bold text-lg" style={{ color: 'hsl(var(--orange))' }}>
                          {call.ratePerArtist > 0 ? `${randWhole(call.ratePerArtist)} each` : "No rate set"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">{call.eventDate ? longDate(call.eventDate) : `Due ${new Date(call.deadline).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}`}</p>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-border/40 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'hsl(var(--baby-blue) / 0.10)' }}>
                            <Users className="h-3.5 w-3.5" style={{ color: 'hsl(var(--baby-blue))' }} />
                          </div>
                          <span className="font-semibold">{call.applicantCount}</span>
                          <span className="text-muted-foreground">applied or invited</span>
                        </div>
                        <span className="text-muted-foreground">{call.spotsFilled} of {call.artistsNeeded} in your team</span>
                      </div>
                      <Link href={`/campaigns/${call.id}`}>
                        <Button size="sm" variant="outline" className="gap-1.5 rounded-full" data-testid={`button-manage-${call.id}`}>Manage<ArrowRight className="h-3.5 w-3.5" /></Button>
                      </Link>
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
                <p className="font-serif text-xl font-bold">No campaigns yet</p>
                <p className="text-sm text-muted-foreground mt-1.5 max-w-sm mx-auto">Post your first campaign to start receiving applications from verified artists, or invite artists you like.</p>
              </div>
              <Button onClick={() => setDialogOpen(true)} disabled={!verified} className="gap-2 rounded-full px-6"><Plus className="h-4 w-4" />Post your first campaign</Button>
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
                      <p className="text-sm text-muted-foreground mt-0.5">Applied for: <Link href={`/campaigns/${app.castingId}`} className="text-primary hover:underline">{app.castingTitle}</Link></p>
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
              <p className="text-muted-foreground">No applications yet. Post a campaign to get started.</p>
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
                Add your WhatsApp number and we'll message you the moment an artist applies to one of your campaigns. No refresh needed.
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
