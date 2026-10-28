import { Link } from "wouter";
import type { AftercareBlock } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Check, ShieldCheck } from "lucide-react";

interface Props {
  title: string;
  artistName: string;
  blocks: AftercareBlock[];
  /** Optional https link. Without one, the button goes to the artist's Bonisa profile. */
  rebookingUrl: string | null;
  artistProfileId: string | null;
}

/**
 * The page a client reads. Used for the open page and for the artist's preview, so
 * what she previews is what her client sees. Everything is shown as plain text.
 */
export function AftercareView({ title, artistName, blocks, rebookingUrl, artistProfileId }: Props) {
  return (
    <article className="mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <header className="bg-primary px-6 pb-6 pt-8 text-primary-foreground">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-80">Aftercare</p>
        <h1 className="mt-2 font-serif text-3xl font-bold leading-tight">{title || "Untitled"}</h1>
        <p className="mt-3 flex items-center gap-1.5 text-sm opacity-90">
          <ShieldCheck className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
          {artistName}, verified on Bonisa
        </p>
      </header>

      <div className="space-y-5 px-6 py-6">
        {blocks.length === 0 && <p className="text-sm text-muted-foreground">Nothing here yet.</p>}
        {blocks.map((block, index) => {
          if (block.type === "heading") {
            return <h2 key={index} className="pt-2 text-base font-semibold text-primary">{block.text}</h2>;
          }
          if (block.type === "paragraph") {
            return <p key={index} className="whitespace-pre-line text-[15px] leading-relaxed text-foreground">{block.text}</p>;
          }
          return (
            <ul key={index} className="space-y-2.5">
              {(block.items ?? []).map((item, i) => (
                <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-foreground">
                  <Check className="mt-1 h-4 w-4 shrink-0" strokeWidth={2.2} style={{ color: "hsl(var(--sage))" }} aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          );
        })}
      </div>

      <footer className="space-y-4 border-t border-border bg-muted/30 px-6 py-5">
        {rebookingUrl ? (
          <a href={rebookingUrl} target="_blank" rel="noopener noreferrer">
            <Button className="h-12 w-full text-base" type="button">Book again with {artistName}</Button>
          </a>
        ) : artistProfileId ? (
          <Link href={`/stylists/${artistProfileId}`}>
            <Button className="h-12 w-full text-base" type="button">See {artistName} on Bonisa</Button>
          </Link>
        ) : null}
        <p className="text-xs leading-relaxed text-muted-foreground">
          General guidance from your artist. It is not medical advice. If you are worried about your health, speak to a health professional.
        </p>
      </footer>
    </article>
  );
}
