import { useState } from "react";
import { Link } from "wouter";
import { Search, MapPin, Users } from "lucide-react";
import { useListTalent } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { PortalShell } from "@/components/portal/shell";
import { AuthedImage } from "@/components/portal/authed-image";
import { EmptyBlock, ErrorBlock, LoadingBlock, PageHeader } from "@/components/portal/states";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { MODEL_CATEGORIES } from "@/lib/portal";

export default function TalentDirectory() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [available, setAvailable] = useState(false);
  const params = {
    ...(q.trim() ? { q: q.trim() } : {}),
    ...(category ? { category } : {}),
    ...(available ? { availability: "available" as const } : {}),
  };
  const { data, isLoading, error, refetch } = useListTalent(params);
  const filtered = !!(q.trim() || category || available);

  return (
    <PortalShell>
      <PageHeader eyebrow="Discover talent" title="Models on Bonisa">
        Every model listed here has been reviewed and verified by Bonisa, and has chosen what to show. Locations are kept coarse and contact details are never shown.
      </PageHeader>

      <div className="space-y-4">
        <div className="relative max-w-xl">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.9} aria-hidden="true" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, category, skill or area" className="pl-10 h-11 bg-card" aria-label="Search talent" />
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by category">
          {["", ...MODEL_CATEGORIES].map((c) => (
            <button
              key={c || "all"}
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${category === c ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}
            >
              {c || "All"}
            </button>
          ))}
          <label className="ml-1 flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
            Available now
          </label>
        </div>
      </div>

      {isLoading ? <LoadingBlock label="Loading talent" /> : error ? <ErrorBlock message="We could not load the directory." onRetry={() => refetch()} /> : !data?.length ? (
        <EmptyBlock icon={<Users className="h-8 w-8" strokeWidth={1.9} />} title={filtered ? "No models match those filters" : "No models are listed yet"}>
          {filtered
            ? "Try a different category or clear the search."
            : "Models appear here once they have completed their profile, been verified by Bonisa, and chosen to publish."}
        </EmptyBlock>
      ) : (
        <ul className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {data.map((m) => (
            <li key={m.id}>
              <Link href={`/talent/${m.id}`} className="group block rounded-2xl overflow-hidden border border-border bg-card focus-visible:ring-2 ring-ring">
                <div className="aspect-[3/4] bg-muted overflow-hidden">
                  {m.portraitUrl
                    ? <AuthedImage path={m.portraitUrl} alt={`Portrait of ${m.professionalName}`} className="h-full w-full transition-transform duration-300 group-hover:scale-[1.02]" />
                    : <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground px-4 text-center">No public photo</div>}
                </div>
                <div className="p-4 space-y-1.5">
                  <h3 className="font-serif font-bold text-lg leading-tight">{m.professionalName}</h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    <VerifiedBadge />
                    <span className="text-xs text-muted-foreground">{m.category}</span>
                  </div>
                  {m.area && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3 text-gold" strokeWidth={1.9} aria-hidden="true" />{m.area}</p>}
                  {m.availability && <p className="text-xs font-medium text-primary">{m.availability === "available" ? "Available" : "Limited availability"}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PortalShell>
  );
}
