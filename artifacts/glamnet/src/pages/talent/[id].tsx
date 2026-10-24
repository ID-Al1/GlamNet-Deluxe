import { useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, ExternalLink, MapPin, Send } from "lucide-react";
import { useGetTalent, useSendTalentEnquiry } from "@workspace/api-client-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { PortalShell } from "@/components/portal/shell";
import { AuthedImage } from "@/components/portal/authed-image";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/portal/states";
import { PLATFORM_LABEL, PHOTO_SLOTS, errorMessage, formatDay, formatRand } from "@/lib/portal";

export default function TalentProfilePage() {
  const [, params] = useRoute("/talent/:id");
  const id = params?.id ?? "";
  const { user } = useAuth();
  const { data: m, isLoading, error, refetch } = useGetTalent(id);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const enquire = useSendTalentEnquiry();

  if (isLoading) return <PortalShell><LoadingBlock label="Loading profile" /></PortalShell>;
  if (error || !m) {
    const notFound = (error as { status?: number } | null)?.status === 404;
    return (
      <PortalShell narrow>
        {notFound || !error
          ? <EmptyBlock title="This profile is not available">It may be private, unpublished or not yet verified.<div className="pt-3"><Link href="/talent"><Button variant="outline">Back to talent</Button></Link></div></EmptyBlock>
          : <ErrorBlock message="We could not load this profile." onRetry={() => refetch()} />}
      </PortalShell>
    );
  }

  const digitals = PHOTO_SLOTS.map((s) => ({ slot: s, photo: m.photos.find((p) => p.kind === s.kind) })).filter((d) => d.photo);
  const editorial = m.photos.filter((p) => p.kind === "editorial");
  const lead = editorial[0] ?? m.photos.find((p) => p.kind === "front");
  const rate = formatRand(m.startingRateCents);
  const canEnquire = !!user && user.role !== "model" && m.acceptsEnquiries;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await enquire.mutateAsync({ modelId: m.id, data: { message: message.trim() } });
      setSent(true);
      setMessage("");
      toast.success("Enquiry sent");
    } catch (err) { toast.error(errorMessage(err)); }
  };

  return (
    <PortalShell>
      <Link href="/talent" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />All talent</Link>

      <div className="grid lg:grid-cols-[minmax(0,380px)_1fr] gap-8 lg:gap-12">
        <div className="space-y-4">
          <div className="aspect-[3/4] rounded-2xl overflow-hidden border border-border bg-muted">
            {lead ? <AuthedImage path={lead.url} alt={`Portrait of ${m.professionalName}`} className="h-full w-full" />
              : <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground px-6 text-center">This model has not made a photo public.</div>}
          </div>
        </div>

        <div className="space-y-8">
          <header className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <VerifiedBadge size="md" />
              {m.verifiedAt && <span className="text-xs text-muted-foreground">Verified by Bonisa on {formatDay(m.verifiedAt)}</span>}
            </div>
            <h1 className="text-4xl sm:text-5xl font-serif font-bold tracking-tight">{m.professionalName}</h1>
            <p className="text-lg text-muted-foreground flex items-center gap-3 flex-wrap">
              <span>{m.category}</span>
              {m.area && <span className="flex items-center gap-1"><MapPin className="h-4 w-4 text-gold" strokeWidth={1.9} aria-hidden="true" />{m.area}</span>}
              {m.availability && <span className="text-primary font-medium">{m.availability === "available" ? "Available" : "Limited availability"}</span>}
            </p>
          </header>

          {m.bio && <section className="space-y-2"><h2 className="text-xl">About</h2><p className="whitespace-pre-line text-foreground/90 leading-relaxed">{m.bio}</p></section>}

          {(m.skills.length > 0 || m.serviceCategories.length > 0) && (
            <section className="space-y-3">
              <h2 className="text-xl">Skills and services</h2>
              <ul className="flex flex-wrap gap-2">
                {[...m.skills, ...m.serviceCategories].map((s) => <li key={s} className="px-3 py-1 rounded-full border border-border bg-card text-sm">{s}</li>)}
              </ul>
            </section>
          )}

          {rate && (
            <section className="space-y-1">
              <h2 className="text-xl">Rates</h2>
              <p className="text-foreground/90">Starting from <strong>{rate}</strong>{m.rateNote ? `. ${m.rateNote}` : ""}</p>
              <p className="text-xs text-muted-foreground">A starting rate is a guide, not a quote or an agreement. Fees are agreed in writing per campaign.</p>
            </section>
          )}

          {m.socialLinks.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xl">Channels</h2>
              <ul className="space-y-2">
                {m.socialLinks.map((l) => (
                  <li key={l.url} className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <a href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline underline-offset-4">
                      {PLATFORM_LABEL[l.platform] ?? l.platform}{l.handle ? ` ${l.handle}` : ""}<ExternalLink className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" />
                    </a>
                    {l.followerCount !== null && l.followerCount !== undefined && (
                      <span className="text-sm text-muted-foreground">{l.followerCount.toLocaleString("en-ZA")} followers, entered by the model{l.statUpdatedAt ? `, updated ${formatDay(l.statUpdatedAt)}` : ""}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      {digitals.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-2xl">Casting digitals</h2>
          <ul className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {digitals.map(({ slot, photo }) => (
              <li key={slot.kind} className="space-y-2">
                <div className="aspect-[3/4] rounded-xl overflow-hidden border border-border bg-muted"><AuthedImage path={photo!.url} alt={`${slot.label} digital of ${m.professionalName}`} className="h-full w-full" /></div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground text-center">{slot.label}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {editorial.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-2xl">Editorial</h2>
          <ul className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {editorial.map((p) => <li key={p.id} className="aspect-[3/4] rounded-xl overflow-hidden border border-border bg-muted"><AuthedImage path={p.url} alt={`Editorial portrait of ${m.professionalName}`} className="h-full w-full" /></li>)}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-6 sm:p-8 max-w-2xl space-y-4" aria-labelledby="enquiry-heading">
        <h2 id="enquiry-heading" className="text-2xl">Booking enquiry</h2>
        {!m.acceptsEnquiries ? (
          <p className="text-sm text-muted-foreground">{m.professionalName} is not accepting enquiries right now.</p>
        ) : !user ? (
          <p className="text-sm text-muted-foreground">Sign in to send an enquiry. Contact details stay private. <Link href="/login" className="text-primary underline underline-offset-4">Sign in</Link> or <Link href="/signup" className="text-primary underline underline-offset-4">create an account</Link>.</p>
        ) : user.role === "model" ? (
          <p className="text-sm text-muted-foreground">Models cannot send enquiries to other models.</p>
        ) : sent ? (
          <p className="text-sm" role="status">Your enquiry has been sent. If {m.professionalName} is interested they will respond. An enquiry is not a booking, and nothing is agreed until terms are confirmed in writing.</p>
        ) : canEnquire ? (
          <form onSubmit={send} className="space-y-3">
            <label htmlFor="enquiry" className="text-sm font-medium">Tell them about the work: what, where, when and your budget.</label>
            <Textarea id="enquiry" value={message} onChange={(e) => setMessage(e.target.value)} rows={5} minLength={10} maxLength={2000} required className="bg-background" />
            <Button type="submit" disabled={enquire.isPending || message.trim().length < 10} className="gap-2"><Send className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />{enquire.isPending ? "Sending" : "Send enquiry"}</Button>
          </form>
        ) : null}
      </section>
    </PortalShell>
  );
}
