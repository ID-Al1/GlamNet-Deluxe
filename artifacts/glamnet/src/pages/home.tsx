import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useListStylists } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Search, Star, Play, ChevronDown } from "lucide-react";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { ArtistInitials } from "@/components/ui/artist-initials";
import { formatRating } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { SERVICE_CATEGORIES } from "@/lib/categories";

import heroMomentsImg from "@assets/generated_images/hero-moments.jpg";
import dateNightImg from "@assets/generated_images/moment-datenight.jpg";
import weddingImg from "@assets/generated_images/moment-wedding.jpg";
import graduationImg from "@assets/generated_images/moment-graduation.jpg";
import birthdayImg from "@assets/generated_images/moment-birthday.jpg";
import lemonadeImg from "@assets/generated_images/look-lemonade.jpg";

const MOMENTS = [
  { label: "Date Night",  image: dateNightImg },
  { label: "Wedding",     image: weddingImg },
  { label: "Graduation",  image: graduationImg },
  { label: "Birthday",    image: birthdayImg },
];

function SectionHeading({ title, actionLabel, href }: { title: string; actionLabel?: string; href?: string }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <h2 className="text-[11px] font-bold tracking-[0.14em] uppercase text-foreground/60">{title}</h2>
      {actionLabel && href && (
        <Link href={href}>
          <span className="text-[11px] text-primary font-semibold hover:opacity-80 transition-opacity">{actionLabel}</span>
        </Link>
      )}
    </div>
  );
}

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  // Authenticated users belong on their dashboard
  if (user) {
    setLocation("/dashboard");
    return null;
  }

  const { data: stylists } = useListStylists({ specialty: undefined }, {
    query: { staleTime: 60_000, queryKey: ["stylists", "home-featured"] },
  });

  const topStylists = useMemo(
    () => (stylists ?? []).slice().sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)),
    [stylists],
  );
  const featured = topStylists[0];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    setLocation(q ? `/stylists?search=${encodeURIComponent(q)}` : "/stylists");
  };

  return (
    <div className="flex flex-col bg-background overflow-x-hidden">

      {/* ══════════════════════════════════════════════════════
          HERO — full-viewport, aspirational imagery
      ══════════════════════════════════════════════════════ */}
      <section className="relative min-h-dvh flex flex-col">
        {/* Full-bleed background */}
        <div className="absolute inset-0">
          <img
            src={heroMomentsImg}
            alt="A woman ready for her reveal"
            className="w-full h-full object-cover object-center"
            fetchPriority="high"
          />
          {/* Multi-stop gradient: bottom-heavy dark for text legibility, subtle at top */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/75" />
          {/* Warm burgundy tint to tie into brand */}
          <div className="absolute inset-0 bg-gradient-to-t from-[hsl(348_55%_10%)/80%] via-transparent to-transparent" />
        </div>

        {/* Hero content — vertically centred, slightly low */}
        <div className="relative z-10 flex flex-col flex-1 justify-end pb-10 px-6 sm:px-8 max-w-2xl mx-auto w-full">

          {/* Eyebrow */}
          <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-white/60 mb-4">
            South Africa's Premier Beauty Platform
          </p>

          {/* Tagline */}
          <h1 className="font-serif font-bold text-white leading-[1.05] mb-6">
            <span className="block text-[clamp(2.8rem,8vw,4.5rem)]">Greet Your</span>
            <span className="block text-[clamp(3rem,9vw,5rem)] text-[hsl(39_33%_88%)]">Reveal.</span>
          </h1>

          {/* Sub-copy */}
          <p className="text-sm text-white/70 mb-8 leading-relaxed max-w-xs">
            Find, book, and celebrate with South Africa's finest hair, beauty, and barber artists.
          </p>

          {/* Search bar — frosted glass */}
          <form
            onSubmit={handleSearch}
            className="flex items-center gap-3 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl px-4 py-3.5 mb-5 shadow-[0_8px_32px_rgba(0,0,0,0.2)]"
          >
            <Search className="h-4 w-4 text-white/60 shrink-0" />
            <input
              type="text"
              placeholder="Find an artist or service…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-white placeholder:text-white/45 text-sm font-medium outline-none"
            />
            {searchQuery && (
              <button type="submit" className="shrink-0 px-4 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-bold rounded-xl transition-colors">
                Go
              </button>
            )}
          </form>

          {/* Quick-access category chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar -mx-1 px-1">
            {SERVICE_CATEGORIES.slice(0, 6).map(cat => (
              <Link key={cat.name} href={`/stylists?specialty=${encodeURIComponent(cat.name)}`}>
                <span className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/12 backdrop-blur-sm border border-white/20 text-white text-[11px] font-semibold whitespace-nowrap hover:bg-white/20 transition-colors cursor-pointer">
                  {cat.name}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <a href="#content" aria-label="Scroll to discover" className="absolute bottom-5 right-6 z-10 flex flex-col items-center gap-1 text-white/40 hover:text-white/70 transition-colors">
          <ChevronDown className="h-5 w-5 animate-bounce" />
        </a>
      </section>

      {/* ══════════════════════════════════════════════════════
          BELOW-FOLD CONTENT
      ══════════════════════════════════════════════════════ */}
      <div id="content" className="bg-background">

        {/* ── FOR YOUR MOMENT ── */}
        <section className="pt-10 pb-2">
          <div className="px-5 sm:px-8">
            <SectionHeading title="For Your Moment" actionLabel="See All" href="/stylists" />
          </div>
          <div className="flex gap-3 overflow-x-auto px-5 sm:px-8 pb-4 hide-scrollbar snap-x snap-mandatory">
            {MOMENTS.map(moment => (
              <Link key={moment.label} href={`/stylists?search=${encodeURIComponent(moment.label)}`}>
                <div className="snap-start shrink-0 relative w-[108px] h-[144px] rounded-[20px] overflow-hidden cursor-pointer group">
                  <img
                    src={moment.image}
                    alt={moment.label}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <span className="absolute bottom-3 left-0 w-full text-center text-white text-[10px] font-bold tracking-wide px-2 leading-tight">
                    {moment.label}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── TOP ARTISTS ── */}
        {topStylists.length > 0 && (
          <section className="px-5 sm:px-8 py-8">
            <SectionHeading title="Top Artists" actionLabel="Browse All" href="/stylists" />
            <div className="space-y-3">
              {topStylists.slice(0, 4).map(stylist => (
                <div
                  key={stylist.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setLocation(`/stylists/${stylist.id}`)}
                  onKeyDown={e => e.key === "Enter" && setLocation(`/stylists/${stylist.id}`)}
                  className="flex items-center justify-between p-3.5 rounded-[20px] bg-card border border-border/40 shadow-sm hover:shadow-md hover:border-primary/20 transition-all cursor-pointer group mb-3 outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 relative">
                      <ArtistInitials name={stylist.name} textClassName="text-base" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-sm text-foreground">{stylist.name}</p>
                        {stylist.verified && <VerifiedBadge variant="icon" size="sm" />}
                      </div>
                      <p className="text-[11px] text-primary font-semibold mt-0.5">{stylist.specialty}</p>
                      <div className="flex items-center gap-1 mt-0.5 text-[11px] text-muted-foreground">
                        {stylist.reviewCount ? (
                          <>
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            <span className="font-semibold text-foreground">{formatRating(stylist.rating ?? 0)}</span>
                            <span>({stylist.reviewCount})</span>
                          </>
                        ) : (
                          <span>New artist</span>
                        )}
                        {stylist.location ? <span>· {stylist.location}</span> : null}
                      </div>
                    </div>
                  </div>
                  <Link href={`/book/${stylist.id}`} onClick={e => e.stopPropagation()}>
                    <Button size="sm" className="rounded-full text-xs font-bold px-4 h-8 shrink-0">Book</Button>
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── AI RECOMMENDS ── */}
        {featured && (
          <section className="px-5 sm:px-8 pb-8">
            <SectionHeading title="Recommended For You" actionLabel="See All" href="/stylists" />
            <div className="bg-card rounded-[24px] p-4 flex items-center justify-between border border-border/40 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-[60px] h-[60px] rounded-xl overflow-hidden shrink-0 relative">
                  <img src={lemonadeImg} alt={featured.name} className="w-full h-full object-cover" />
                  {/* Actual artist avatar layered on top */}
                  <div className="absolute inset-0 opacity-0">
                    <ArtistInitials name={featured.name} textClassName="text-base" />
                  </div>
                </div>
                <div>
                  <p className="font-bold text-sm text-foreground">{featured.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{featured.specialty} · Trending this week</p>
                  <div className="flex items-center gap-1 mt-1.5">
                    {featured.reviewCount ? (
                      <>
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        <span className="text-xs font-semibold">{formatRating(featured.rating ?? 0)}</span>
                        <span className="text-[10px] text-muted-foreground">({featured.reviewCount})</span>
                      </>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">New artist</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link href={`/book/${featured.id}`}>
                  <Button size="sm" className="rounded-full text-xs font-bold px-4 h-8">Book</Button>
                </Link>
                <Link href={`/stylists/${featured.id}`}>
                  <button className="w-8 h-8 rounded-full border border-border bg-background flex items-center justify-center text-foreground hover:bg-muted transition-colors" aria-label="View profile">
                    <Play className="h-3 w-3 ml-0.5" />
                  </button>
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* ── BROWSE BY SERVICE ── */}
        <section className="px-5 sm:px-8 pb-10">
          <SectionHeading title="Browse Services" />
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
        </section>

        {/* ── AUTH CTA ── */}
        <section className="px-5 sm:px-8 pb-16 pt-4">
          <div className="relative rounded-[28px] overflow-hidden bg-primary px-7 py-10 text-center shadow-lg">
            {/* Subtle pattern overlay */}
            <div className="absolute inset-0 opacity-[0.06]" style={{
              backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }} />
            <div className="relative z-10">
              <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/60 mb-3">Join Bonisa Today</p>
              <h2 className="font-serif font-bold text-white text-2xl leading-snug mb-2">
                Your next look<br />is waiting.
              </h2>
              <p className="text-xs text-white/70 mb-7 leading-relaxed">
                Create your free account to book artists, save favourites, and track your appointments.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/signup">
                  <Button className="w-full sm:w-auto bg-white text-primary hover:bg-white/95 font-bold rounded-full px-7 h-11 text-sm shadow-md">
                    Create Free Account
                  </Button>
                </Link>
                <Link href="/login">
                  <Button variant="ghost" className="w-full sm:w-auto text-white/80 hover:text-white hover:bg-white/10 font-semibold rounded-full px-7 h-11 text-sm border border-white/20">
                    Log In
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
