import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Camera, Trash2, Upload } from "lucide-react";
import {
  useDeleteMyModelPhoto, useRegisterMyModelPhoto, useRequestMyModelVerification, useRequestUploadUrl,
  useSetMyModelPublished, useUpdateMyModelPhoto, useUpdateMyModelProfile,
} from "@workspace/api-client-react";
import type { ModelProfileOwner, OwnerPhoto, RegisterPhotoInputKind, RegisterPhotoInputMimeType } from "@workspace/api-client-react";
import { toast } from "sonner";
import { ModelLayout } from "@/components/layout/model-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuthedImage } from "@/components/portal/authed-image";
import { StatusPill } from "@/components/portal/status-pill";
import { EmptyBlock, ErrorBlock, LoadingBlock, PageHeader } from "@/components/portal/states";
import { useModelProfile } from "@/lib/model-profile";
import { MODEL_CATEGORIES, PHOTO_SLOTS, SERVICE_CATEGORIES, VERIFICATION_STATUS, errorMessage } from "@/lib/portal";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;

function usePhotoUpload(setProfile: (p: ModelProfileOwner) => void) {
  const requestUpload = useRequestUploadUrl();
  const register = useRegisterMyModelPhoto();
  const [busy, setBusy] = useState<string | null>(null);

  const upload = async (kind: RegisterPhotoInputKind, file: File) => {
    if (!ACCEPTED.includes(file.type)) { toast.error("Use a JPEG, PNG or WebP photo."); return; }
    if (file.size > MAX_BYTES) { toast.error("That photo is over 10 MB. Choose a smaller one."); return; }
    setBusy(kind);
    try {
      const { uploadURL, objectPath } = await requestUpload.mutateAsync({ data: { name: file.name, size: file.size, contentType: file.type } });
      const put = await fetch(uploadURL, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!put.ok) throw new Error("The upload did not complete. Please try again.");
      setProfile(await register.mutateAsync({ data: { kind, objectPath, mimeType: file.type as RegisterPhotoInputMimeType } }));
      toast.success("Photo saved. It stays private until you choose to show it.");
    } catch (err) { toast.error(errorMessage(err, "The photo could not be uploaded.")); }
    finally { setBusy(null); }
  };
  return { upload, busy };
}

function PhotoCard({ title, hint, photo, busy, onFile, onVisibility, onDelete }: {
  title: string; hint?: string; photo?: OwnerPhoto; busy: boolean;
  onFile: (f: File) => void; onVisibility: (v: boolean) => void; onDelete: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between"><h3 className="font-serif font-bold text-lg">{title}</h3>{photo && <span className="text-xs text-muted-foreground">{photo.isPublic ? "Public" : "Private"}</span>}</div>
      <div className="aspect-[3/4] rounded-xl overflow-hidden border border-dashed border-border bg-muted/60 relative">
        {photo ? <AuthedImage path={photo.url} alt={`${title} photo`} className="h-full w-full" /> : (
          <button type="button" onClick={() => input.current?.click()} disabled={busy} className="h-full w-full flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground px-4 text-center">
            <Camera className="h-7 w-7 text-gold" strokeWidth={1.9} aria-hidden="true" />
            <span className="text-sm font-medium">{busy ? "Uploading…" : "Add photo"}</span>
          </button>
        )}
      </div>
      {hint && !photo && <p className="text-xs text-muted-foreground leading-relaxed">{hint}</p>}
      <input ref={input} type="file" accept={ACCEPTED.join(",")} className="sr-only" aria-label={`Choose ${title} photo`}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
      {photo && (
        <div className="space-y-3">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Show on my public profile</span>
            <Switch checked={photo.isPublic} onCheckedChange={onVisibility} aria-label={`Show ${title} photo on my public profile`} />
          </label>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-2 flex-1" disabled={busy} onClick={() => input.current?.click()}><Upload className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />{busy ? "Uploading…" : "Retake"}</Button>
            <Button type="button" variant="ghost" size="sm" onClick={onDelete} aria-label={`Remove ${title} photo`}><Trash2 className="h-4 w-4" strokeWidth={1.9} /></Button>
          </div>
        </div>
      )}
    </div>
  );
}

const VISIBILITY_FIELDS = [
  { key: "area", label: "Area", help: "Your city or province, never a street address." },
  { key: "availability", label: "Availability", help: "Whether you are available or have limited availability." },
  { key: "bio", label: "Biography", help: "Your About text." },
  { key: "skills", label: "Skills", help: "The skills listed on your profile and cards." },
  { key: "serviceCategories", label: "Services", help: "The kinds of work you take." },
  { key: "rates", label: "Starting rate", help: "A guide rate. It is not a quote or an agreement." },
];

export default function Portfolio() {
  const { profile, isLoading, error, refetch, setProfile } = useModelProfile();
  const { upload, busy } = usePhotoUpload(setProfile);
  const patchPhoto = useUpdateMyModelPhoto();
  const deletePhoto = useDeleteMyModelPhoto();
  const updateProfile = useUpdateMyModelProfile();
  const publish = useSetMyModelPublished();
  const requestVerification = useRequestMyModelVerification();

  const [form, setForm] = useState({ professionalName: "", category: "", area: "", bio: "", skills: "", serviceCategories: [] as string[], availability: "unavailable", acceptsEnquiries: true });
  const loaded = useRef(false);
  useEffect(() => {
    if (profile && !loaded.current) {
      loaded.current = true;
      setForm({
        professionalName: profile.professionalName, category: profile.category, area: profile.area, bio: profile.bio ?? "",
        skills: profile.skills.join(", "), serviceCategories: profile.serviceCategories, availability: profile.availability, acceptsEnquiries: profile.acceptsEnquiries,
      });
    }
  }, [profile]);

  const act = async <T,>(fn: () => Promise<T>, ok?: string): Promise<T | undefined> => {
    try { const r = await fn(); if (ok) toast.success(ok); return r; } catch (err) { toast.error(errorMessage(err)); return undefined; }
  };
  const photoOf = (kind: string) => profile?.photos.find((p) => p.kind === kind);
  const editorial = profile?.photos.filter((p) => p.kind === "editorial") ?? [];

  const saveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await act(() => updateProfile.mutateAsync({ data: {
      professionalName: form.professionalName, category: form.category, area: form.area, bio: form.bio || null,
      skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean), serviceCategories: form.serviceCategories,
      availability: form.availability as "available" | "limited" | "unavailable", acceptsEnquiries: form.acceptsEnquiries,
    } }), "Profile saved");
    if (r) setProfile(r);
  };

  return (
    <ModelLayout>
      <PageHeader eyebrow="My Portfolio" title="Your portfolio">Build the profile brands see. Photos and every detail stay private until you switch them on.</PageHeader>
      {isLoading ? <LoadingBlock label="Loading your portfolio" /> : error || !profile ? <ErrorBlock onRetry={() => refetch()} /> : (
        <Tabs defaultValue="digitals" className="space-y-6">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="digitals">Casting digitals</TabsTrigger>
            <TabsTrigger value="editorial">Editorial</TabsTrigger>
            <TabsTrigger value="details">Profile details</TabsTrigger>
            <TabsTrigger value="publishing">Privacy and publishing</TabsTrigger>
          </TabsList>

          <TabsContent value="digitals" className="space-y-5">
            <p className="text-sm text-muted-foreground max-w-2xl">Casting digitals are plain, consistent photos that let a brand see you as you are. Use natural light, no filters, no heavy makeup, the same plain background for all four. All four are needed before you can ask Bonisa to verify you.</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {PHOTO_SLOTS.map((s) => {
                const photo = photoOf(s.kind);
                return (
                  <PhotoCard key={s.kind} title={s.label} hint={s.hint} photo={photo} busy={busy === s.kind}
                    onFile={(f) => upload(s.kind, f)}
                    onVisibility={async (v) => { const r = await act(() => patchPhoto.mutateAsync({ photoId: photo!.id, data: { isPublic: v } })); if (r) setProfile(r); }}
                    onDelete={async () => { const r = await act(() => deletePhoto.mutateAsync({ photoId: photo!.id }), "Photo removed"); if (r) setProfile(r); }} />
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="editorial" className="space-y-5">
            <p className="text-sm text-muted-foreground max-w-2xl">Optional polished portraits from shoots you own or are allowed to share. Up to 12. The first public editorial portrait is used as your lead image.</p>
            {editorial.length === 0 && <EmptyBlock icon={<Camera className="h-8 w-8" strokeWidth={1.9} />} title="No editorial portraits yet">Add a portrait you are proud of. It stays private until you switch it on.</EmptyBlock>}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {editorial.map((p, i) => (
                <PhotoCard key={p.id} title={`Portrait ${i + 1}`} photo={p} busy={false} onFile={() => undefined}
                  onVisibility={async (v) => { const r = await act(() => patchPhoto.mutateAsync({ photoId: p.id, data: { isPublic: v } })); if (r) setProfile(r); }}
                  onDelete={async () => { const r = await act(() => deletePhoto.mutateAsync({ photoId: p.id }), "Photo removed"); if (r) setProfile(r); }} />
              ))}
              {editorial.length < 12 && (
                <PhotoCard title="Add portrait" hint="JPEG, PNG or WebP, up to 10 MB." busy={busy === "editorial"} onFile={(f) => upload("editorial", f)} onVisibility={() => undefined} onDelete={() => undefined} />
              )}
            </div>
          </TabsContent>

          <TabsContent value="details">
            <form onSubmit={saveDetails} className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-6 max-w-3xl">
              <div className="grid sm:grid-cols-2 gap-5">
                <div className="space-y-2"><label htmlFor="pn" className="text-sm font-medium">Professional name</label><Input id="pn" value={form.professionalName} onChange={(e) => setForm({ ...form, professionalName: e.target.value })} required minLength={2} maxLength={80} className="bg-background" /></div>
                <div className="space-y-2"><label htmlFor="cat" className="text-sm font-medium">Category</label>
                  <select id="cat" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">Choose a category</option>{MODEL_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select></div>
                <div className="space-y-2"><label htmlFor="area" className="text-sm font-medium">Area (city or province)</label><Input id="area" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} maxLength={80} placeholder="e.g. Cape Town" className="bg-background" /></div>
                <div className="space-y-2"><label htmlFor="av" className="text-sm font-medium">Availability</label>
                  <select id="av" value={form.availability} onChange={(e) => setForm({ ...form, availability: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="available">Available</option><option value="limited">Limited availability</option><option value="unavailable">Not available</option>
                  </select></div>
              </div>
              <div className="space-y-2"><label htmlFor="bio" className="text-sm font-medium">Short biography</label><Textarea id="bio" rows={5} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} maxLength={2000} className="bg-background" /><p className="text-xs text-muted-foreground">{form.bio.length}/2000</p></div>
              <div className="space-y-2"><label htmlFor="sk" className="text-sm font-medium">Skills (separate with commas)</label><Input id="sk" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} placeholder="Runway, Beauty close-ups, Dance" className="bg-background" /></div>
              <fieldset className="space-y-3"><legend className="text-sm font-medium">Work you take</legend>
                <div className="flex flex-wrap gap-2">{SERVICE_CATEGORIES.map((s) => {
                  const on = form.serviceCategories.includes(s);
                  return <button key={s} type="button" aria-pressed={on} onClick={() => setForm({ ...form, serviceCategories: on ? form.serviceCategories.filter((x) => x !== s) : [...form.serviceCategories, s] })}
                    className={`px-3 py-1.5 rounded-full text-sm border ${on ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"}`}>{s}</button>;
                })}</div></fieldset>
              <label className="flex items-center justify-between gap-4 text-sm"><span><strong className="block font-medium">Accept booking enquiries</strong><span className="text-muted-foreground">Brands can send you an enquiry from your public profile. They never see your contact details.</span></span>
                <Switch checked={form.acceptsEnquiries} onCheckedChange={(v) => setForm({ ...form, acceptsEnquiries: v })} aria-label="Accept booking enquiries" /></label>
              <Button type="submit" disabled={updateProfile.isPending}>{updateProfile.isPending ? "Saving" : "Save profile"}</Button>
            </form>
          </TabsContent>

          <TabsContent value="publishing" className="space-y-6 max-w-3xl">
            <section className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-4">
              <h2 className="text-2xl">What the public can see</h2>
              <p className="text-sm text-muted-foreground">Your professional name, category and verified label are always shown on a listed profile. Everything else is private until you switch it on. Each photo has its own switch on the photo tabs.</p>
              <ul className="divide-y divide-border">
                {VISIBILITY_FIELDS.map((f) => (
                  <li key={f.key} className="py-3"><label className="flex items-center justify-between gap-4 cursor-pointer">
                    <span><strong className="block text-sm font-medium">{f.label}</strong><span className="text-xs text-muted-foreground">{f.help}</span></span>
                    <Switch checked={profile.visibility[f.key] === true} aria-label={`Show ${f.label} on my public profile`}
                      onCheckedChange={async (v) => { const r = await act(() => updateProfile.mutateAsync({ data: { visibility: { [f.key]: v } } })); if (r) setProfile(r); }} />
                  </label></li>
                ))}
              </ul>
            </section>

            <section className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap"><h2 className="text-2xl">Verification</h2><StatusPill status={profile.verificationStatus} kind="verification" /></div>
              <p className="text-sm text-muted-foreground">{VERIFICATION_STATUS[profile.verificationStatus].detail} Only verified models appear in the directory and can apply to opportunities.</p>
              {profile.verificationRejectionReason && <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm" role="alert"><p className="font-semibold mb-1">Reason from Bonisa</p>{profile.verificationRejectionReason}</div>}
              {profile.missingForPublish.length > 0 && <div className="text-sm"><p className="font-medium mb-1">Still needed before you can ask for verification:</p><ul className="list-disc pl-5 text-muted-foreground">{profile.missingForPublish.map((m) => <li key={m}>{m}</li>)}</ul></div>}
              {(profile.verificationStatus === "none" || profile.verificationStatus === "rejected") && (
                <Button disabled={profile.missingForPublish.length > 0 || requestVerification.isPending}
                  onClick={async () => { const r = await act(() => requestVerification.mutateAsync(), "Sent to Bonisa for review"); if (r) setProfile(r); }}>
                  {profile.verificationStatus === "rejected" ? "Ask for another review" : "Ask Bonisa to verify me"}
                </Button>
              )}
            </section>

            <section className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-4">
              <h2 className="text-2xl">Publishing</h2>
              <p className="text-sm text-muted-foreground">{profile.isListed ? "Your profile is live in the public directory." : profile.isPublished ? "You have published, but you will only appear once Bonisa has verified you." : "Your profile is private. Publishing makes you eligible to appear once verified."}</p>
              <div className="flex gap-3 flex-wrap">
                <Button variant={profile.isPublished ? "outline" : "default"} disabled={publish.isPending || (!profile.isPublished && profile.missingForPublish.length > 0)}
                  onClick={async () => { const r = await act(() => publish.mutateAsync({ data: { published: !profile.isPublished } }), profile.isPublished ? "Profile unpublished" : "Profile published"); if (r) setProfile(r); }}>
                  {profile.isPublished ? "Unpublish my profile" : "Publish my profile"}
                </Button>
                {profile.isListed && <Link href={`/talent/${profile.id}`}><Button variant="outline">See my public profile</Button></Link>}
              </div>
            </section>
          </TabsContent>
        </Tabs>
      )}
    </ModelLayout>
  );
}
