import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useReplaceMySocialLinks, useUpdateMyModelProfile } from "@workspace/api-client-react";
import type { SocialLinkInput, SocialLinkInputPlatform } from "@workspace/api-client-react";
import { toast } from "sonner";
import { ModelLayout } from "@/components/layout/model-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ErrorBlock, LoadingBlock, PageHeader } from "@/components/portal/states";
import { useModelProfile } from "@/lib/model-profile";
import { PLATFORM_LABEL, errorMessage, formatDay } from "@/lib/portal";

type Row = { platform: SocialLinkInputPlatform; url: string; handle: string; followers: string; isPublic: boolean; statUpdatedAt?: string | null };

export default function MyBrand() {
  const { profile, isLoading, error, refetch, setProfile } = useModelProfile();
  const updateProfile = useUpdateMyModelProfile();
  const replaceLinks = useReplaceMySocialLinks();
  const [identity, setIdentity] = useState({ creativeIdentity: "", collaborationPreferences: "", careerGoals: "", rate: "", rateNote: "" });
  const [rows, setRows] = useState<Row[]>([]);
  const loaded = useRef(false);

  useEffect(() => {
    if (profile && !loaded.current) {
      loaded.current = true;
      setIdentity({
        creativeIdentity: profile.creativeIdentity ?? "", collaborationPreferences: profile.collaborationPreferences ?? "", careerGoals: profile.careerGoals ?? "",
        rate: profile.startingRateCents != null ? String(profile.startingRateCents / 100) : "", rateNote: profile.rateNote ?? "",
      });
      setRows(profile.socialLinks.map((l) => ({ platform: l.platform as SocialLinkInputPlatform, url: l.url, handle: l.handle ?? "", followers: l.followerCount != null ? String(l.followerCount) : "", isPublic: l.isPublic, statUpdatedAt: l.statUpdatedAt })));
    }
  }, [profile]);

  const saveIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    const cents = identity.rate.trim() ? Math.round(parseFloat(identity.rate.replace(/[^0-9.]/g, "")) * 100) : null;
    if (cents !== null && Number.isNaN(cents)) { toast.error("Enter the rate as a number, for example 1500."); return; }
    try {
      setProfile(await updateProfile.mutateAsync({ data: {
        creativeIdentity: identity.creativeIdentity || null, collaborationPreferences: identity.collaborationPreferences || null, careerGoals: identity.careerGoals || null,
        startingRateCents: cents, rateNote: identity.rateNote || null,
      } }));
      toast.success("Saved");
    } catch (err) { toast.error(errorMessage(err)); }
  };

  const saveLinks = async () => {
    const links: SocialLinkInput[] = rows.filter((r) => r.url.trim()).map((r) => ({
      platform: r.platform, url: r.url.trim(), handle: r.handle.trim() || null,
      followerCount: r.followers.trim() ? Math.max(0, Math.round(Number(r.followers.replace(/[^0-9]/g, "")))) : null, isPublic: r.isPublic,
    }));
    try { setProfile(await replaceLinks.mutateAsync({ data: { links } })); toast.success("Links saved"); } catch (err) { toast.error(errorMessage(err)); }
  };

  const setRow = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <ModelLayout>
      <PageHeader eyebrow="My Brand" title="Your personal brand">Your brand is yours. You can grow your own channels and take independent work. Bonisa only restricts that where you agree a narrow, written term for one specific campaign.</PageHeader>
      {isLoading ? <LoadingBlock /> : error || !profile ? <ErrorBlock onRetry={() => refetch()} /> : (
        <div className="grid lg:grid-cols-2 gap-6 items-start">
          <form onSubmit={saveIdentity} className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-5">
            <h2 className="text-2xl">Identity and goals</h2>
            <div className="space-y-2"><label htmlFor="ci" className="text-sm font-medium">Creative identity</label><Textarea id="ci" rows={4} maxLength={2000} value={identity.creativeIdentity} onChange={(e) => setIdentity({ ...identity, creativeIdentity: e.target.value })} placeholder="How would you describe your look, style and what you stand for?" className="bg-background" /></div>
            <div className="space-y-2"><label htmlFor="cp" className="text-sm font-medium">Collaboration preferences</label><Textarea id="cp" rows={3} maxLength={2000} value={identity.collaborationPreferences} onChange={(e) => setIdentity({ ...identity, collaborationPreferences: e.target.value })} placeholder="Work you love, work you decline, travel limits, values." className="bg-background" /></div>
            <div className="space-y-2"><label htmlFor="cg" className="text-sm font-medium">Career goals</label><Textarea id="cg" rows={3} maxLength={2000} value={identity.careerGoals} onChange={(e) => setIdentity({ ...identity, careerGoals: e.target.value })} className="bg-background" /></div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2"><label htmlFor="rate" className="text-sm font-medium">Starting rate (R)</label><Input id="rate" inputMode="decimal" value={identity.rate} onChange={(e) => setIdentity({ ...identity, rate: e.target.value })} placeholder="Optional" className="bg-background" /></div>
              <div className="space-y-2"><label htmlFor="rn" className="text-sm font-medium">Rate note</label><Input id="rn" maxLength={300} value={identity.rateNote} onChange={(e) => setIdentity({ ...identity, rateNote: e.target.value })} placeholder="e.g. per half day" className="bg-background" /></div>
            </div>
            <p className="text-xs text-muted-foreground">Your rate is private unless you switch on "Starting rate" under Privacy and publishing. It is a guide, not a quote.</p>
            <Button type="submit" disabled={updateProfile.isPending}>{updateProfile.isPending ? "Saving" : "Save"}</Button>
          </form>

          <section className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-5" aria-labelledby="links-h">
            <h2 id="links-h" className="text-2xl">Channels and audience</h2>
            <p className="text-sm text-muted-foreground">Audience numbers are typed in by you. When shown, they are labelled as entered by the model with the date you last changed the number. Nothing here is connected to the platforms yet.</p>
            {rows.length === 0 && <p className="text-sm text-muted-foreground">No channels added yet.</p>}
            <ul className="space-y-4">
              {rows.map((r, i) => (
                <li key={i} className="rounded-xl border border-border p-4 space-y-3 bg-background">
                  <div className="grid grid-cols-[130px_1fr] gap-3">
                    <select aria-label="Platform" value={r.platform} onChange={(e) => setRow(i, { platform: e.target.value as SocialLinkInputPlatform })} className="h-10 rounded-md border border-input bg-background px-2 text-sm">
                      {Object.entries(PLATFORM_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <Input aria-label="Link" value={r.url} onChange={(e) => setRow(i, { url: e.target.value })} placeholder="https://" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input aria-label="Handle" value={r.handle} onChange={(e) => setRow(i, { handle: e.target.value })} placeholder="@handle" />
                    <Input aria-label="Followers" inputMode="numeric" value={r.followers} onChange={(e) => setRow(i, { followers: e.target.value })} placeholder="Followers" />
                  </div>
                  {r.statUpdatedAt && r.followers && <p className="text-xs text-muted-foreground">Number last changed {formatDay(r.statUpdatedAt)}. Source: entered by you.</p>}
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm"><Switch checked={r.isPublic} onCheckedChange={(v) => setRow(i, { isPublic: v })} aria-label="Show this channel on my public profile" />Show on my public profile</label>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Remove channel"><Trash2 className="h-4 w-4" strokeWidth={1.9} /></Button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex gap-3 flex-wrap">
              {rows.length < 8 && <Button type="button" variant="outline" className="gap-2" onClick={() => setRows([...rows, { platform: "instagram", url: "", handle: "", followers: "", isPublic: false }])}><Plus className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />Add channel</Button>}
              <Button type="button" onClick={saveLinks} disabled={replaceLinks.isPending}>{replaceLinks.isPending ? "Saving" : "Save channels"}</Button>
            </div>
          </section>
        </div>
      )}
    </ModelLayout>
  );
}
