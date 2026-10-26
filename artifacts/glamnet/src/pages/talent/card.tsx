import { Link, useRoute } from "wouter";
import { ArrowLeft, Printer } from "lucide-react";
import { useGetTalent } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { BonisaLogo } from "@/components/bonisa-logo";
import { AuthedImage } from "@/components/portal/authed-image";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/portal/states";
import { PortalShell } from "@/components/portal/shell";
import { PHOTO_SLOTS, formatDay } from "@/lib/portal";

/**
 * Comp card: the four casting digitals in identical frames, with the details a brand needs.
 * Built only from the public profile, so it can never show anything the model has kept private.
 * Print it, or choose "Save as PDF" in the print dialog.
 */
export default function CompCard() {
  const [, params] = useRoute("/talent/:id/card");
  const id = params?.id ?? "";
  const { data: m, isLoading, error, refetch } = useGetTalent(id);

  if (isLoading) return <PortalShell><LoadingBlock label="Preparing comp card" /></PortalShell>;
  if (error || !m) {
    const nf = (error as { status?: number } | null)?.status === 404;
    return <PortalShell narrow>{nf || !error ? <EmptyBlock title="This comp card is not available">The profile may be private or not yet verified.</EmptyBlock> : <ErrorBlock onRetry={() => refetch()} />}</PortalShell>;
  }
  const profileUrl = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/talent/${m.id}`;
  const lead = m.photos.find((p) => p.kind === "editorial");
  const facts = [
    m.area ? ["Based in", m.area] : null,
    m.availability ? ["Availability", m.availability === "available" ? "Available" : "Limited"] : null,
    m.skills.length ? ["Skills", m.skills.join(", ")] : null,
  ].filter(Boolean) as string[][];

  return (
    <PortalShell>
      <div className="no-print flex items-center justify-between gap-3 flex-wrap">
        <Link href={`/talent/${m.id}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />Back to profile</Link>
        <Button className="gap-2" onClick={() => window.print()}><Printer className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />Print or save as PDF</Button>
      </div>

      <article className="comp-card-sheet mx-auto w-full max-w-[820px] bg-white text-[#231519] rounded-2xl border border-border p-6 sm:p-10 space-y-8" aria-label={`Comp card for ${m.professionalName}`}>
        <div className="flex items-start justify-between gap-4 border-b-2 border-gold pb-5">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#6D1F36]">Comp card</p>
            <h1 className="text-4xl sm:text-5xl font-serif font-bold leading-none">{m.professionalName}</h1>
            <p className="text-base text-[#5b4a4f]">{m.category}</p>
          </div>
          <div className="text-right space-y-2 shrink-0">
            <BonisaLogo size={28} />
            {m.registryNumber && <p className="font-mono text-sm font-semibold tracking-wider">{m.registryNumber}</p>}
          </div>
        </div>

        <section aria-label="Casting digitals">
          <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PHOTO_SLOTS.map((s) => {
              const photo = m.photos.find((p) => p.kind === s.kind);
              return (
                <li key={s.kind} className="space-y-1.5">
                  <div className="aspect-[3/4] border border-[#EFE3D3] bg-[#FDF8F0] overflow-hidden">
                    {photo ? <AuthedImage path={photo.url} alt={`${s.label} digital of ${m.professionalName}`} className="h-full w-full" />
                      : <div className="h-full w-full flex items-center justify-center text-[11px] text-[#7a6a6f] px-2 text-center">Not shared</div>}
                  </div>
                  <p className="text-[11px] uppercase tracking-widest text-center text-[#5b4a4f]">{s.label}</p>
                </li>
              );
            })}
          </ul>
        </section>

        {lead && (
          <section aria-label="Editorial portrait" className="max-w-[240px]">
            <div className="aspect-[3/4] border border-[#EFE3D3] overflow-hidden"><AuthedImage path={lead.url} alt={`Editorial portrait of ${m.professionalName}`} className="h-full w-full" /></div>
          </section>
        )}

        {facts.length > 0 && (
          <dl className="grid sm:grid-cols-[130px_1fr] gap-y-2 text-sm">
            {facts.map(([k, v]) => (<div key={k} className="contents"><dt className="text-xs uppercase tracking-wider text-[#7a6a6f] pt-0.5">{k}</dt><dd>{v}</dd></div>))}
          </dl>
        )}

        <div className="border-t border-[#EFE3D3] pt-4 space-y-1 text-xs text-[#5b4a4f]">
          <p><strong>Verified by Bonisa{m.verifiedAt ? ` on ${formatDay(m.verifiedAt)}` : ""}.</strong> Digitals are taken by the model and reviewed by Bonisa. Starting rates and contact details are not part of this card.</p>
          <p className="break-all">Full profile and enquiries: {profileUrl}</p>
        </div>
      </article>
    </PortalShell>
  );
}
