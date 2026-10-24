import { Wallet } from "lucide-react";
import { ModelLayout } from "@/components/layout/model-layout";
import { EmptyBlock, NotLiveNotice, PageHeader } from "@/components/portal/states";

const LINES = [
  ["Agreed gross fee", "The fee you and the organiser agreed in writing."],
  ["Platform fee", "Only if one applies to that campaign, with the exact amount and who pays it shown before you accept."],
  ["Approved expenses", "Travel, accommodation or product costs agreed in advance, kept separate from your fee."],
  ["Other deductions", "Anything else, listed line by line."],
  ["Net amount due", "What you receive after the lines above."],
  ["Due date", "When payment is due under the agreed terms."],
];
const STATES = ["Proposed", "Agreed", "Invoiced", "Payment pending", "Paid", "Disputed", "Cancelled"];

export default function Earnings() {
  return (
    <ModelLayout>
      <PageHeader eyebrow="My Earnings" title="Your earnings" />
      <NotLiveNotice title="Earnings tracking: not live yet">
        Bonisa does not process, hold or track campaign payments yet, and no money is shown as held in escrow or guaranteed. The page below describes what a campaign statement will contain once payment tracking is built and tested.
      </NotLiveNotice>
      <EmptyBlock icon={<Wallet className="h-8 w-8" strokeWidth={1.9} />} title="No earnings recorded">Nothing has been recorded for your account.</EmptyBlock>

      <section className="space-y-4" aria-labelledby="lines-h">
        <h2 id="lines-h" className="text-2xl">What each campaign statement will show</h2>
        <dl className="rounded-2xl border border-border bg-card px-5 sm:px-8">
          {LINES.map(([t, d]) => (
            <div key={t} className="grid sm:grid-cols-[220px_1fr] gap-1 sm:gap-6 py-4 border-b border-border last:border-0"><dt className="text-sm font-semibold">{t}</dt><dd className="text-sm text-muted-foreground">{d}</dd></div>
          ))}
        </dl>
        <p className="text-sm text-muted-foreground max-w-2xl">Commission is not assumed. Work you source yourself is yours. A fee only applies to a booking Bonisa generated, or where you have agreed it separately and explicitly.</p>
      </section>

      <section className="space-y-3" aria-labelledby="states-h">
        <h2 id="states-h" className="text-2xl">Payment states</h2>
        <ul className="flex flex-wrap gap-2">{STATES.map((s) => <li key={s} className="px-3 py-1 rounded-full border border-dashed border-border text-sm text-muted-foreground">{s}</li>)}</ul>
      </section>
    </ModelLayout>
  );
}
