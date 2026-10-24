import { Link } from "wouter";
import { LogOut } from "lucide-react";
import { useUpdateMyModelProfile } from "@workspace/api-client-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ModelLayout } from "@/components/layout/model-layout";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ErrorBlock, LoadingBlock, NotLiveNotice, PageHeader } from "@/components/portal/states";
import { useModelProfile } from "@/lib/model-profile";
import { errorMessage } from "@/lib/portal";

export default function Settings() {
  const { user, logout } = useAuth();
  const { profile, isLoading, error, refetch, setProfile } = useModelProfile();
  const update = useUpdateMyModelProfile();
  return (
    <ModelLayout>
      <PageHeader eyebrow="Settings" title="Account and privacy" />
      {isLoading ? <LoadingBlock /> : error || !profile ? <ErrorBlock onRetry={() => refetch()} /> : (
        <div className="space-y-6 max-w-3xl">
          <section className="rounded-2xl border border-border bg-card p-6 space-y-3" aria-labelledby="acct">
            <h2 id="acct" className="text-2xl">Account</h2>
            <dl className="text-sm grid sm:grid-cols-[140px_1fr] gap-y-2">
              <dt className="text-muted-foreground">Name</dt><dd>{user?.name}</dd>
              <dt className="text-muted-foreground">Email</dt><dd>{user?.email}</dd>
            </dl>
            <p className="text-xs text-muted-foreground">Your email and phone are never shown on your public profile or to brands.</p>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 space-y-4" aria-labelledby="priv">
            <h2 id="priv" className="text-2xl">Privacy</h2>
            <label className="flex items-center justify-between gap-4 text-sm">
              <span><strong className="block font-medium">Accept booking enquiries</strong><span className="text-muted-foreground">Turn off to stop new enquiries.</span></span>
              <Switch checked={profile.acceptsEnquiries} aria-label="Accept booking enquiries"
                onCheckedChange={async (v) => { try { setProfile(await update.mutateAsync({ data: { acceptsEnquiries: v } })); } catch (err) { toast.error(errorMessage(err)); } }} />
            </label>
            <p className="text-sm text-muted-foreground">Choose what is public, per field and per photo, under <Link href="/workspace/portfolio" className="text-primary underline underline-offset-4">My Portfolio, Privacy and publishing</Link>.</p>
          </section>

          <NotLiveNotice title="Closing your account and your data: not available in the app yet">
            Requests to close your account, or to see, correct or delete your personal information, cannot be made from this screen yet. A support contact and the full process will be published here before real use.
          </NotLiveNotice>

          <Button variant="outline" className="gap-2" onClick={logout}><LogOut className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />Sign out</Button>
        </div>
      )}
    </ModelLayout>
  );
}
