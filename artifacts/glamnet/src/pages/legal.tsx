import { LEGAL_IDENTITY } from "@/lib/legal";

const ROWS: { label: string; value: string; email?: boolean }[] = [
  { label: "Trading/product brand", value: LEGAL_IDENTITY.brand },
  { label: "Operated by", value: LEGAL_IDENTITY.operator },
  { label: "CIPC registration number", value: LEGAL_IDENTITY.cipcRegistrationNumber },
  { label: "Registered office", value: LEGAL_IDENTITY.registeredOffice },
  { label: "Business contact", value: LEGAL_IDENTITY.businessEmail, email: true },
  { label: "Privacy contact", value: LEGAL_IDENTITY.privacyEmail, email: true },
];

export default function LegalPage() {
  return (
    <div className="container max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold text-foreground mb-2">Legal identity</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Who operates Bonisa and how to reach us.
      </p>
      <dl className="divide-y divide-border/60 border-y border-border/60">
        {ROWS.map((row) => (
          <div key={row.label} className="grid sm:grid-cols-3 gap-1 sm:gap-4 py-4">
            <dt className="text-sm font-medium text-muted-foreground">{row.label}</dt>
            <dd className="sm:col-span-2 text-sm text-foreground">
              {row.email ? (
                <a href={`mailto:${row.value}`} className="text-primary hover:underline">
                  {row.value}
                </a>
              ) : (
                row.value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
