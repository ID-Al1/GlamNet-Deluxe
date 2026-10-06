import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetMyBrandProfileQueryKey,
  useGetMyBrandProfile,
  useSubmitMyBrandProfile,
  useUpdateMyBrandProfile,
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { LogOut, ShieldCheck, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { apiMessage } from "@/lib/campaign-money";

/**
 * A brand has to be verified before it can post or pay for a campaign, so artists
 * only ever see real companies. The company name and registration number lock once
 * submitted; everything else can be updated at any time.
 */
function BrandVerificationCard() {
  const queryClient = useQueryClient();
  const { data: profile, isLoading, isError } = useGetMyBrandProfile();
  const update = useUpdateMyBrandProfile();
  const submit = useSubmitMyBrandProfile();
  const [form, setForm] = useState({ companyName: "", registrationNumber: "", vatNumber: "", website: "", billingAddress: "" });

  useEffect(() => {
    if (!profile) return;
    setForm({
      companyName: profile.companyName,
      registrationNumber: profile.registrationNumber ?? "",
      vatNumber: profile.vatNumber ?? "",
      website: profile.website ?? "",
      billingAddress: profile.billingAddress ?? "",
    });
  }, [profile?.id, profile?.verificationStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <Card className="border-border/50 bg-card"><CardContent className="p-6"><Skeleton className="h-40 w-full" /></CardContent></Card>;
  if (isError || !profile) {
    return (
      <Card className="border-border/50 bg-card">
        <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
          <AlertCircle className="h-5 w-5 text-destructive" strokeWidth={1.9} />Could not load your brand profile. Please refresh.
        </CardContent>
      </Card>
    );
  }

  const locked = profile.verificationStatus !== "none";
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const refresh = () => queryClient.invalidateQueries({ queryKey: getGetMyBrandProfileQueryKey() });

  async function save() {
    try {
      await update.mutateAsync({ data: {
        companyName: form.companyName,
        registrationNumber: form.registrationNumber || null,
        vatNumber: form.vatNumber || null,
        website: form.website || null,
        billingAddress: form.billingAddress || null,
      } });
      await refresh();
      toast.success("Brand details saved");
    } catch (error) {
      toast.error(apiMessage(error, "Could not save your details."));
    }
  }

  async function sendForReview() {
    try {
      await save();
      await submit.mutateAsync();
      await refresh();
      toast.success("Sent for verification. We will email you within 72 hours.");
    } catch (error) {
      toast.error(apiMessage(error, "Could not submit your brand."));
    }
  }

  return (
    <Card className="border-border/50 bg-card" data-testid="card-brand-verification">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Brand verification</CardTitle>
            <CardDescription className="mt-1.5 max-w-prose">
              Only verified brands can post campaigns and book artists. It keeps Bonisa full of real companies, which is why artists trust the work.
            </CardDescription>
          </div>
          {profile.verificationStatus === "verified" && <Badge className="gap-1"><ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.9} />Verified</Badge>}
          {profile.verificationStatus === "pending" && <Badge variant="secondary" className="gap-1"><Clock className="h-3.5 w-3.5" strokeWidth={1.9} />In review</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {profile.verificationStatus === "none" && profile.rejectionReason && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm" role="alert">
            <p className="font-semibold">We need a bit more before we can verify you</p>
            <p className="mt-1">{profile.rejectionReason}</p>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="b-company">Company name</Label>
          <Input id="b-company" value={form.companyName} disabled={locked} onChange={set("companyName")} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="b-reg">Company registration number</Label>
            <Input id="b-reg" placeholder="2019/123456/07" value={form.registrationNumber} disabled={locked} onChange={set("registrationNumber")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="b-web">Website or Instagram</Label>
            <Input id="b-web" placeholder="https://" value={form.website} onChange={set("website")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="b-vat">VAT number (for your invoices)</Label>
            <Input id="b-vat" value={form.vatNumber} onChange={set("vatNumber")} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="b-address">Billing address</Label>
          <Textarea id="b-address" rows={2} value={form.billingAddress} onChange={set("billingAddress")} className="resize-none" />
        </div>
        {profile.verificationStatus === "none" && profile.missing.length > 0 && (
          <p className="text-xs text-muted-foreground">Still needed to submit: {profile.missing.join(", ")}.</p>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2 border-t border-border/50 bg-muted/30 py-4">
        <Button variant="outline" onClick={() => void save()} disabled={update.isPending}>Save details</Button>
        {profile.verificationStatus === "none" && (
          <Button onClick={() => void sendForReview()} disabled={submit.isPending || update.isPending} data-testid="button-submit-brand">
            Submit for verification
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

export function BrandProfile() {
  const { user, logout } = useAuth();

  return (
    <div className="space-y-6">
      <BrandVerificationCard />
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
            {user?.businessName && (
              <div className="sm:col-span-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Business Name</Label>
                <p className="font-medium text-foreground">{user.businessName}</p>
              </div>
            )}
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
