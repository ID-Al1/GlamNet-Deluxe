import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { PortalShell } from "@/components/portal/shell";
import { PageHeader } from "@/components/portal/states";

const PRINCIPLES = [
  ["You keep your name and your career", "Models keep ownership of their identity, likeness, existing content and independent channels. Bonisa never requires universal exclusivity. Any exclusivity is narrow, time-limited and agreed in writing."],
  ["You decide what is public", "A public profile shows only what the model has chosen to publish. Contact details, identity records and internal notes are never shown publicly."],
  ["Brands pay for value", "Every opportunity shows its fee, expenses, usage rights, exclusivity and payment terms before anyone applies. No opportunity is presented as guaranteed income."],
  ["Transparent by default", "Fees, who pays them and how they are calculated are shown before you accept. Paid, gifted and affiliate promotions must be disclosed."],
  ["Safety and recourse", "Report a listing, raise a complaint or flag misconduct. Bonisa reviews reports, and sensitive actions are recorded in an audit trail."],
];

export default function About() {
  return (
    <PortalShell narrow>
      <PageHeader eyebrow="About Bonisa" title="Bonisa opens doors">
        Bonisa is a talent and beauty collaboration platform. Models and beauty professionals build their own brand, discover paid work and work with trusted brands. Bonisa facilitates the collaboration. It does not own the talent.
      </PageHeader>
      <ul className="space-y-4">
        {PRINCIPLES.map(([title, body]) => (
          <li key={title} className="rounded-2xl border border-border bg-card p-6 flex gap-4">
            <span className="mt-2 h-px w-8 bg-gold shrink-0" aria-hidden="true" />
            <div className="space-y-1.5"><h2 className="text-xl">{title}</h2><p className="text-sm text-muted-foreground leading-relaxed">{body}</p></div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">Platform fees, payment handling and agreement wording are still being finalised. Agreement templates will be reviewed by a South African attorney before real use. Nothing on this page is legal advice.</p>
      <div className="flex gap-3 flex-wrap">
        <Link href="/signup"><Button>Join Bonisa</Button></Link>
        <Link href="/talent"><Button variant="outline">Discover talent</Button></Link>
      </div>
    </PortalShell>
  );
}
