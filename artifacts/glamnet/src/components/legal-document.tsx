import type { ReactNode } from "react";
import { Link } from "wouter";

export interface LegalSection {
  heading: string;
  body: ReactNode;
}

interface LegalDocumentProps {
  title: string;
  intro: string;
  updated: string;
  sections: LegalSection[];
}

export function LegalDocument({ title, intro, updated, sections }: LegalDocumentProps) {
  return (
    <div className="container max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold text-foreground mb-2">{title}</h1>
      <p className="text-xs text-muted-foreground mb-6">Last updated {updated}</p>
      <p className="text-sm text-muted-foreground mb-10 leading-relaxed">{intro}</p>
      <div className="space-y-8">
        {sections.map((section, i) => (
          <section key={section.heading}>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              {i + 1}. {section.heading}
            </h2>
            <div className="space-y-3 text-sm text-foreground/90 leading-relaxed">
              {section.body}
            </div>
          </section>
        ))}
      </div>
      <p className="mt-12 pt-6 border-t border-border/60 text-xs text-muted-foreground">
        See also our{" "}
        <Link href="/legal" className="underline hover:text-primary transition-colors">
          legal identity
        </Link>
        ,{" "}
        <Link href="/terms" className="underline hover:text-primary transition-colors">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline hover:text-primary transition-colors">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
