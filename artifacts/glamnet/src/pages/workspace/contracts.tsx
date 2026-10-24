import { FileSignature } from "lucide-react";
import { ModelLayout } from "@/components/layout/model-layout";
import { EmptyBlock, NotLiveNotice, PageHeader } from "@/components/portal/states";

const RECORDED = [
  ["Image and content rights", "Recorded per asset: which photo or video, which channel, for what purpose, in which territory, for how long, and whether paid advertising is allowed."],
  ["Boosting and your handle", "Using your social account or handle in ads, or boosting content from it, needs its own separate, clear consent."],
  ["Edits and sublicensing", "Whether the organiser may edit the work or pass the rights on."],
  ["Exclusivity", "Only if narrowly defined, time-limited, compensated where appropriate and agreed in writing. Bonisa does not require universal exclusivity."],
  ["Raw files and portfolio reuse", "Whether you receive raw files and may show the finished work in your own portfolio."],
  ["Signed version", "You can review, accept or decline. The final signed version and its timestamps are kept."],
];

export default function Contracts() {
  return (
    <ModelLayout>
      <PageHeader eyebrow="Contracts & Permissions" title="Agreements and permissions" />
      <NotLiveNotice title="Agreements: not live yet">
        Campaign agreements and image-use permissions cannot be created or signed in Bonisa yet. The wording of agreement templates still has to be reviewed by a South African attorney before any real use. Nothing here is legal advice.
      </NotLiveNotice>
      <EmptyBlock icon={<FileSignature className="h-8 w-8" strokeWidth={1.9} />} title="No agreements recorded">You have not accepted or signed any agreement through Bonisa.</EmptyBlock>
      <section className="space-y-4" aria-labelledby="rec-h">
        <h2 id="rec-h" className="text-2xl">What every agreement will record</h2>
        <dl className="rounded-2xl border border-border bg-card px-5 sm:px-8">
          {RECORDED.map(([t, d]) => (
            <div key={t} className="grid sm:grid-cols-[240px_1fr] gap-1 sm:gap-6 py-4 border-b border-border last:border-0"><dt className="text-sm font-semibold">{t}</dt><dd className="text-sm text-muted-foreground">{d}</dd></div>
          ))}
        </dl>
        <p className="text-sm text-muted-foreground max-w-2xl">You keep your name, likeness, existing content and independent channels unless a right is separately and explicitly licensed. You can turn down work that conflicts with your values, availability, safety or career goals.</p>
      </section>
    </ModelLayout>
  );
}
