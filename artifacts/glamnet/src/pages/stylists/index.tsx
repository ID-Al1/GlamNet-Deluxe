import { useState, useEffect } from "react";
import { useListStylists } from "@workspace/api-client-react";
import { Link, useSearch, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ChevronRight, Play, Star } from "lucide-react";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { ArtistInitials } from "@/components/ui/artist-initials";
import { formatRating } from "@/lib/utils";
import { SERVICE_CATEGORIES } from "@/lib/categories";

import softGlamImg from "@assets/generated_images/look-softglam.jpg";
import lemonadeImg from "@assets/generated_images/look-lemonade.jpg";
import weddingImg from "@assets/generated_images/moment-wedding.jpg";
import graduationImg from "@assets/generated_images/moment-graduation.jpg";
import dateNightImg from "@assets/generated_images/moment-datenight.jpg";

export default function StylistsList() {
  const rawSearch = useSearch();
  const [, setLocation] = useLocation();

  const urlParams = new URLSearchParams(rawSearch);
  const activeQuery = (urlParams.get("q") ?? urlParams.get("search") ?? "").trim();
  const activeSpecialty = (urlParams.get("specialty") ?? "").trim();

  const [searchQuery, setSearchQuery] = useState(activeQuery);
  useEffect(() => { setSearchQuery(activeQuery); }, [activeQuery]);

  const { data: stylists = [] } = useListStylists(
    { specialty: activeSpecialty || undefined },
    { query: { queryKey: ["stylists", "browse", activeSpecialty] } },
  );

  const q = activeQuery.toLowerCase();
  const results = stylists.filter((s) =>
    !q ||
    s.name.toLowerCase().includes(q) ||
    (s.specialty ?? "").toLowerCase().includes(q) ||
    (s.location ?? "").toLowerCase().includes(q) ||
    (s.services ?? []).some((sv) => sv.name.toLowerCase().includes(q)),
  );
  const isFiltering = !!(activeQuery || activeSpecialty);

  const updateSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    setLocation(trimmed ? `/stylists?q=${encodeURIComponent(trimmed)}` : "/stylists", { replace: true });
  };


  return (
    <div className="flex flex-col min-h-screen bg-background pb-[88px] overflow-x-hidden">
      <div className="px-5 pt-12 pb-6">
        <h1 className="text-3xl font-serif font-bold text-foreground mb-6">Browse</h1>
        
        {/* Search */}
        <form onSubmit={updateSearch} className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search for services or styles" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 h-12 rounded-2xl bg-card border-border/40 shadow-sm text-sm"
          />
        </form>

        {/* Categories */}
        <div className="mb-8">
          <h2 className="text-[11px] font-bold tracking-widest uppercase text-foreground/70 mb-4">Categories</h2>
          <div className="grid grid-cols-4 gap-3">
            {SERVICE_CATEGORIES.slice(0, 4).map(cat => (
              <Link key={cat.name} href={`/stylists?specialty=${encodeURIComponent(cat.name)}`}>
                <div className="flex flex-col items-center gap-2 cursor-pointer group">
                  <div className="w-full aspect-square rounded-[22px] bg-card border border-border/40 shadow-sm flex items-center justify-center group-hover:border-primary/30 group-hover:shadow-md transition-all">
                    {cat.icon}
                  </div>
                  <span className="text-[11px] font-semibold text-foreground/80">{cat.name}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Artists */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[11px] font-bold tracking-widest uppercase text-foreground/70">
              {isFiltering ? `Results${activeSpecialty ? ` · ${activeSpecialty}` : ""}` : "Artists"}
            </h2>
            {isFiltering && (
              <Link href="/stylists">
                <Button variant="link" className="text-[11px] text-muted-foreground h-auto p-0 font-medium">Clear</Button>
              </Link>
            )}
          </div>
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No artists found{activeQuery ? ` for “${activeQuery}”` : ""}. Try another search.
            </p>
          ) : (
            <div className="space-y-3">
              {results.map((s) => (
                <Link key={s.id} href={`/stylists/${s.id}`}>
                  {/*
                    Card order (spec § Browse / Find Artists):
                    1. Name
                    2. Verified badge + tier — tier hidden until schema exists
                    3. Jobs completed on Bonisa — hidden until schema exists
                    4. Specialty and area
                    5. Rating (secondary, never headline)
                    No price. Button says View.
                  */}
                  <div className="flex items-start gap-3 p-4 rounded-[20px] bg-card border border-border/40 shadow-sm hover:bg-card/80 transition-colors cursor-pointer">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0">
                      <ArtistInitials name={s.name} textClassName="text-base" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* 1. Name */}
                      <h3 className="font-semibold text-sm text-foreground leading-snug">{s.name}</h3>

                      {/* 2. Verified badge + tier slot */}
                      {s.verified && (
                        <div className="flex items-center gap-2 mt-1">
                          <VerifiedBadge variant="pill" size="sm" />
                          {/* tier slot — render when tier field exists */}
                        </div>
                      )}

                      {/* 3. Jobs completed — render when completedJobs field exists */}

                      {/* 4. Specialty · area */}
                      <p className="text-xs text-muted-foreground mt-1.5 leading-snug">
                        {s.specialty}
                        {(s.area || s.location) ? ` · ${s.area || s.location}` : ""}
                      </p>

                      {/* 5. Rating — secondary, never headline */}
                      {s.reviewCount ? (
                        <div className="flex items-center gap-1 mt-1 text-[11px] text-muted-foreground">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" strokeWidth={0} />
                          <span>{formatRating(s.rating ?? 0)}</span>
                          <span>({s.reviewCount})</span>
                        </div>
                      ) : null}
                    </div>

                    {/* View — not Book, not a price */}
                    <div className="shrink-0 self-center text-[11px] font-semibold text-primary border border-primary/30 rounded-full px-3 py-1 bg-primary/5">
                      View
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Trending Looks */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[11px] font-bold tracking-widest uppercase text-foreground/70">Trending Looks</h2>
            <Link href="/stylists">
              <Button variant="link" className="text-[11px] text-muted-foreground h-auto p-0 font-medium">See All</Button>
            </Link>
          </div>
          <div className="flex gap-4 overflow-x-auto hide-scrollbar snap-x snap-mandatory -mx-5 px-5 pb-2">
            {[
              { title: "Soft Glam Makeup", img: softGlamImg },
              { title: "Lemonade Hair", img: lemonadeImg },
            ].map((look, i) => (
              <Link key={i} href={`/stylists?search=${encodeURIComponent(look.title.split(" ").pop() || "")}`}>
              <div className="snap-start shrink-0 relative w-[160px] h-[160px] rounded-3xl overflow-hidden shadow-sm cursor-pointer">
                <img src={look.img} alt={look.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
                  <span className="text-white text-xs font-bold leading-tight max-w-[80px]">
                    {look.title.replace(" ", "\n")}
                  </span>
                  <div className="w-7 h-7 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
                    <Play className="h-3 w-3 text-white fill-white ml-0.5" />
                  </div>
                </div>
              </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Collections */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[11px] font-bold tracking-widest uppercase text-foreground/70">Collections</h2>
            <Link href="/stylists">
              <Button variant="link" className="text-[11px] text-muted-foreground h-auto p-0 font-medium">See All</Button>
            </Link>
          </div>
          <div className="space-y-3">
            {[
              { title: "Wedding Season", looks: 12, img: weddingImg },
              { title: "Graduation", looks: 8, img: graduationImg },
              { title: "Date Night", looks: 10, img: dateNightImg },
            ].map((col, i) => (
              <Link key={i} href={`/stylists?search=${encodeURIComponent(col.title.split(" ")[0])}`}>
              <div className="flex items-center justify-between p-3 rounded-[20px] bg-transparent hover:bg-card/50 transition-colors cursor-pointer border border-transparent hover:border-border/40">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0">
                    <img src={col.img} alt={col.title} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">{col.title}</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{col.looks} looks</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
