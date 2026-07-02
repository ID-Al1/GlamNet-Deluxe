import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useListStylists } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Search, MapPin, Star, Sparkles, Calendar, TrendingUp, Briefcase, Zap, ShieldCheck, Home as HomeIcon, Gift, ArrowRight, BadgeCheck } from "lucide-react";
import { VerifiedBadge } from "@/components/ui/verified-badge";

const HERO_CATEGORIES = [
  "Hair", "Makeup", "Nails", "Barber", "Skincare", "Lashes", "Brows",
];

const AVATAR_PALETTES = [
  ["hsl(38 40% 88%)", "hsl(38 50% 72%)", "hsl(38 40% 30%)"],
  ["hsl(350 35% 86%)", "hsl(350 45% 70%)", "hsl(350 35% 32%)"],
  ["hsl(200 38% 86%)", "hsl(200 48% 70%)", "hsl(200 38% 30%)"],
  ["hsl(150 35% 86%)", "hsl(150 45% 70%)", "hsl(150 35% 28%)"],
  ["hsl(280 35% 86%)", "hsl(280 45% 70%)", "hsl(280 35% 30%)"],
];

function ArtistInitials({ name }: { name: string }) {
  const initials = name.trim().split(/\s+/).map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase();
  const p = AVATAR_PALETTES[name.charCodeAt(0) % AVATAR_PALETTES.length];
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${p[0]}, ${p[1]})` }}>
      <span className="font-serif font-bold text-4xl select-none" style={{ color: p[2] }}>{initials}</span>
    </div>
  );
}

const ARTIST_PERKS = [
  { icon: HomeIcon, title: "House Calls", desc: "Enable house calls and charge a travel premium." },
  { icon: TrendingUp, title: "Track Every Rand", desc: "Revenue dashboard and monthly earnings in one place." },
  { icon: Gift, title: "Referral Rewards", desc: "Share your link. Every artist you refer earns you both a bonus." },
  { icon: Briefcase, title: "Casting Calls", desc: "Apply to paid brand campaigns from top SA brands." },
  { icon: Zap, title: "Instant Bookings", desc: "Clients book and pay directly. No phone tag, no no-shows." },
  { icon: ShieldCheck, title: "Verified Badge", desc: "Get certified and unlock 3× more profile views." },
];

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [, setLocation] = useLocation();

  const { data: stylists } = useListStylists({ specialty: undefined }, {
    query: { staleTime: 60_000 },
  });

  const featured = stylists?.filter(s => s.rating >= 4.5).slice(0, 3) ?? [];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    setLocation(q ? `/stylists?search=${encodeURIComponent(q)}` : "/stylists");
  };

  const handleCategory = (cat: string) => {
    setLocation(`/stylists?specialty=${encodeURIComponent(cat)}`);
  };

  return (
    <div className="flex flex-col min-h-screen bg-white">

      {/* ── HERO — search-first, full-width image ── */}
      <section className="relative w-full min-h-[78vh] flex flex-col items-center justify-center overflow-hidden">
        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/hero-bg.png')" }}
        />
        {/* Scrim */}
        <div className="absolute inset-0 bg-black/52" />

        <div className="relative z-10 w-full max-w-2xl mx-auto px-4 text-center space-y-7 py-24">
          <div className="space-y-3">
            <p className="text-white/70 text-sm font-medium uppercase tracking-widest">South Africa's Beauty Marketplace</p>
            <h1 className="text-white text-4xl md:text-6xl font-serif font-bold leading-tight">
              Beauty. Your Way.
            </h1>
            <p className="text-white/80 text-base md:text-lg max-w-md mx-auto">
              Discover and book South Africa's finest beauty professionals — instantly.
            </p>
          </div>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="flex items-center bg-white rounded-full shadow-2xl overflow-hidden max-w-xl mx-auto">
            <Search className="h-4 w-4 text-muted-foreground ml-4 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Find braiders, nail techs, MUAs, barbers..."
              className="flex-1 px-3 py-3.5 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
            />
            <Button type="submit" className="rounded-full m-1 px-6 h-10 shrink-0 font-semibold">
              Search
            </Button>
          </form>

          {/* Category pills */}
          <div className="flex gap-2 flex-wrap justify-center">
            {HERO_CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => handleCategory(cat)}
                className="px-4 py-1.5 rounded-full text-white/90 text-sm font-medium transition-colors border border-white/30 hover:bg-white/20 hover:text-white"
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURED ARTISTS ── */}
      {featured.length > 0 && (
        <section className="py-16 bg-white">
          <div className="container max-w-6xl px-4">
            <div className="flex items-end justify-between mb-10">
              <div>
                <p className="text-primary text-xs font-semibold uppercase tracking-widest mb-2">Top rated</p>
                <h2 className="text-2xl md:text-3xl font-serif">Recommended for you</h2>
              </div>
              <Link href="/stylists">
                <Button variant="ghost" className="text-sm text-muted-foreground hover:text-primary gap-1">
                  See all <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {featured.map(stylist => (
                <Link key={stylist.id} href={`/stylists/${stylist.id}`}>
                  <Card className="overflow-hidden group hover:shadow-md transition-all duration-200 cursor-pointer border-border/60">
                    <div className="aspect-[4/3] relative overflow-hidden bg-muted">
                      <ArtistInitials name={stylist.name} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      {stylist.verified && (
                        <div className="absolute top-3 right-3">
                          <VerifiedBadge size="sm" variant="pill" />
                        </div>
                      )}
                      <div className="absolute bottom-4 left-4 right-4">
                        <h3 className="text-white font-serif text-lg font-bold leading-tight">{stylist.name}</h3>
                        <p className="text-sm font-medium mt-0.5" style={{ color: "#D4A855" }}>{stylist.specialty}</p>
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" /> {stylist.location}
                        </span>
                        {(stylist.reviewCount ?? 0) > 0 ? (
                          <span className="flex items-center gap-1">
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                            <span className="font-semibold">{(stylist.rating ?? 0).toFixed(1)}</span>
                            <span className="text-muted-foreground">({stylist.reviewCount})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: "#B8893A" }}>
                            <Sparkles className="h-3 w-3" /> New artist
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── HOW IT WORKS ── */}
      <section className="py-20 bg-white border-t border-border/50">
        <div className="container max-w-5xl px-4">
          <div className="text-center mb-14 space-y-3">
            <p className="text-primary text-xs font-semibold uppercase tracking-widest">Simple & fast</p>
            <h2 className="text-2xl md:text-4xl font-serif">Book in 3 easy steps</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { step: "01", title: "Search", desc: "Filter by specialty, city, and rating to find your perfect match." },
              { step: "02", title: "Book", desc: "Pick a time that works. Confirmed instantly — no back-and-forth." },
              { step: "03", title: "Glow", desc: "Your artist arrives prepared. You leave looking and feeling incredible." },
            ].map(({ step, title, desc }) => (
              <div key={step} className="relative p-8 rounded-2xl border border-border/60 bg-white hover:border-primary/30 transition-colors">
                <p className="text-5xl font-serif font-bold text-muted/60 mb-4 select-none" style={{ color: "rgba(184,137,58,0.18)" }}>{step}</p>
                <h3 className="text-lg font-serif font-bold mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link href="/stylists">
              <Button size="lg" className="rounded-full px-10">Browse Artists</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOR ARTISTS — image + features ── */}
      <section className="py-20 bg-white border-t border-border/50">
        <div className="container max-w-6xl px-4">
          <div className="flex flex-col lg:flex-row gap-14 items-center">
            {/* Editorial image */}
            <div className="w-full lg:w-[45%] rounded-2xl overflow-hidden shadow-xl shrink-0">
              <img
                src="/for-artists-bg.png"
                alt="Beauty professional at work"
                className="w-full h-full object-cover aspect-[4/3]"
              />
            </div>

            <div className="w-full lg:w-[55%] space-y-8">
              <div className="space-y-3">
                <p className="text-primary text-xs font-semibold uppercase tracking-widest">For artists & barbers</p>
                <h2 className="text-2xl md:text-4xl font-serif leading-snug">
                  Everything you need<br />to grow your business
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  Your studio in your pocket. Manage bookings, earn more, and get discovered by brands — all in one place.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {ARTIST_PERKS.map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="flex gap-3 p-4 rounded-xl border border-border/60 hover:border-primary/30 transition-colors bg-white">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{title}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Link href="/signup">
                <Button size="lg" className="rounded-full px-10">Join as an Artist</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOR BRANDS ── */}
      <section className="py-20 border-t border-border/50 bg-white">
        <div className="container max-w-5xl px-4">
          <div className="text-center mb-14 space-y-3">
            <p className="text-primary text-xs font-semibold uppercase tracking-widest">For brands & agencies</p>
            <h2 className="text-2xl md:text-4xl font-serif">Find the right talent, fast</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Post a casting call and receive applications from verified beauty professionals across South Africa.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { n: "01", title: "Post a casting call", desc: "Describe the campaign, set your budget, specify the specialty you need." },
              { n: "02", title: "Artists apply", desc: "Verified professionals from across SA see your call and send proposals." },
              { n: "03", title: "Hire with confidence", desc: "Review portfolios and ratings — then book directly through the platform." },
            ].map(({ n, title, desc }) => (
              <div key={n} className="p-8 rounded-2xl border border-border/60 bg-white hover:border-primary/30 transition-colors space-y-3">
                <p className="font-serif font-bold text-4xl select-none" style={{ color: "rgba(184,137,58,0.20)" }}>{n}</p>
                <h3 className="font-serif font-bold text-lg">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link href="/casting">
              <Button size="lg" variant="outline" className="rounded-full px-10 border-border/70 hover:border-primary/40">
                View Open Castings →
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-20 border-t border-border/50 bg-white">
        <div className="container max-w-2xl px-4 text-center space-y-6">
          <h2 className="text-2xl md:text-4xl font-serif">Ready to get started?</h2>
          <p className="text-muted-foreground text-base">
            Join South Africa's beauty community. It's free to sign up.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link href="/signup">
              <Button size="lg" className="rounded-full px-10 h-12 text-base">Create your account</Button>
            </Link>
            <Link href="/stylists">
              <Button size="lg" variant="outline" className="rounded-full px-10 h-12 text-base border-border/70">
                Browse talent first
              </Button>
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
