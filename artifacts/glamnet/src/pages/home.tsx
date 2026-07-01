import { Link } from "wouter";
import { useListStylists } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { BadgeCheck, MapPin, Star, Sparkles, Calendar, TrendingUp, Users, Briefcase, Home as HomeIcon, Gift, Zap, ShieldCheck } from "lucide-react";

const STEPS_CLIENT = [
  { icon: Users, title: "Browse talent", desc: "Filter by specialty, city, and rating to find your perfect match." },
  { icon: Calendar, title: "Book instantly", desc: "Pick a time that works. Confirmed in seconds, no back-and-forth." },
  { icon: Sparkles, title: "Show up glowing", desc: "Your artist arrives prepared. You leave looking and feeling incredible." },
];

const ARTIST_PERKS = [
  { icon: HomeIcon, title: "House Calls", desc: "Enable house calls and charge a travel premium. Clients come to you — or you go to them." },
  { icon: TrendingUp, title: "Track Every Rand", desc: "Revenue dashboard, booking history, and monthly earnings — all in one place." },
  { icon: Gift, title: "Referral Rewards", desc: "Share your unique link. Every artist you refer earns you both a bonus." },
  { icon: Briefcase, title: "Casting Calls", desc: "Apply to paid brand campaigns from Sorbet, Foschini, Clicks, and more." },
  { icon: Zap, title: "Instant Bookings", desc: "Clients book and pay directly. No phone tag, no no-shows." },
  { icon: ShieldCheck, title: "Verified Badge", desc: "Get certified and unlock 3× more profile views from serious clients." },
];

const BRAND_STEPS = [
  { icon: Briefcase, title: "Post a casting call", desc: "Describe the campaign, set your budget, and specify the specialty you need." },
  { icon: Users, title: "Artists apply", desc: "Verified professionals from across SA see your call and send proposals." },
  { icon: ShieldCheck, title: "Hire with confidence", desc: "Review portfolios, ratings, and reviews — then book directly through the platform." },
];

const STATS = [
  { value: "8+", label: "Cities" },
  { value: "50+", label: "Verified artists" },
  { value: "7", label: "Specialties" },
  { value: "R0", label: "Commission to start" },
];

export default function Home() {
  const { data: stylists } = useListStylists({ specialty: undefined }, {
    query: { staleTime: 60_000 }
  });

  const featured = stylists?.filter(s => s.verified && s.rating >= 4.7).slice(0, 3) ?? [];

  return (
    <div className="flex flex-col min-h-screen">

      {/* ── HERO ── */}
      <section className="relative w-full min-h-[88vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background/95 to-primary/5" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(184,118,92,0.15),transparent)]" />

        <div className="container relative z-10 flex flex-col items-center text-center space-y-8 max-w-4xl px-4 py-24">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
            <Sparkles className="h-3.5 w-3.5" />
            South Africa's beauty industry platform
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-serif font-bold tracking-tight leading-[1.05]">
            Where Beauty <br />
            <em className="text-primary not-italic">Meets Opportunity</em>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed">
            Book top makeup artists, hair stylists, barbers, and estheticians — or grow your career with every tool you need to succeed.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 pt-2">
            <Link href="/stylists">
              <Button size="lg" className="h-14 px-10 text-base font-semibold">
                Find a Stylist
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="lg" variant="outline" className="h-14 px-10 text-base bg-card/60 hover:bg-card">
                Join as a Professional
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── STATS BAND ── */}
      <section className="bg-primary py-8 border-y border-primary/20">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {STATS.map(({ value, label }) => (
              <div key={label}>
                <div className="text-3xl md:text-4xl font-serif font-bold text-primary-foreground">{value}</div>
                <div className="text-sm text-primary-foreground/70 mt-1 uppercase tracking-wider">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS — CLIENTS ── */}
      <section className="py-24 bg-card/30 border-b border-border/60">
        <div className="container px-4 max-w-5xl">
          <div className="text-center mb-16 space-y-4">
            <p className="text-primary text-sm font-semibold uppercase tracking-widest">For clients</p>
            <h2 className="text-3xl md:text-5xl font-serif font-bold">Beauty, on your terms.</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Browse hundreds of verified professionals, read real reviews, and book in under a minute.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {STEPS_CLIENT.map(({ icon: Icon, title, desc }, i) => (
              <div key={title} className="flex flex-col items-center text-center p-8 rounded-2xl bg-card border border-border/60 hover:border-primary/40 transition-colors">
                <div className="relative mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </div>
                </div>
                <h3 className="font-serif text-xl font-bold mb-3">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link href="/stylists">
              <Button size="lg" className="h-12 px-8">Browse Artists Now</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── FEATURED TALENT ── */}
      {featured.length > 0 && (
        <section className="py-24 border-b border-border/60">
          <div className="container px-4">
            <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
              <div className="space-y-3">
                <p className="text-primary text-sm font-semibold uppercase tracking-widest">Hand-picked</p>
                <h2 className="text-3xl md:text-4xl font-serif font-bold">Featured Talent</h2>
                <p className="text-muted-foreground text-lg">Top-rated artists leading the industry across South Africa.</p>
              </div>
              <Link href="/stylists">
                <Button variant="ghost" className="text-primary shrink-0">View all talent →</Button>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {featured.map(stylist => (
                <Link key={stylist.id} href={`/stylists/${stylist.id}`}>
                  <div className="group relative rounded-2xl overflow-hidden bg-card border border-border/60 hover:border-primary/50 transition-all hover:-translate-y-1 cursor-pointer">
                    <div className="aspect-[4/5] bg-muted w-full relative">
                      <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/30 to-transparent z-10" />
                      <div className="absolute top-4 right-4 z-20">
                        {stylist.verified && (
                          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-background/80 backdrop-blur text-primary text-xs font-semibold">
                            <BadgeCheck className="h-3 w-3" />
                            Verified
                          </div>
                        )}
                      </div>
                      <div className="absolute bottom-4 left-4 right-4 z-20 space-y-1">
                        <h3 className="text-xl font-serif font-bold">{stylist.name}</h3>
                        <p className="text-sm text-primary font-medium">{stylist.specialty}</p>
                        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{stylist.location}</span>
                          <span className="flex items-center gap-1"><Star className="h-3 w-3 text-primary" />{stylist.rating} ({stylist.reviewCount})</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── FOR ARTISTS ── */}
      <section className="py-24 bg-card/30 border-b border-border/60">
        <div className="container px-4 max-w-5xl">
          <div className="text-center mb-16 space-y-4">
            <p className="text-primary text-sm font-semibold uppercase tracking-widest">For artists & barbers</p>
            <h2 className="text-3xl md:text-5xl font-serif font-bold">Everything you need to grow.</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Your studio in your pocket. Manage bookings, earn more, and get discovered by brands — all in one place.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {ARTIST_PERKS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="p-6 rounded-2xl bg-card border border-border/60 hover:border-primary/40 transition-colors space-y-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-serif font-bold text-lg">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link href="/signup">
              <Button size="lg" className="h-12 px-8">Start for free →</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOR BRANDS ── */}
      <section className="py-24 border-b border-border/60">
        <div className="container px-4 max-w-5xl">
          <div className="text-center mb-16 space-y-4">
            <p className="text-primary text-sm font-semibold uppercase tracking-widest">For brands & agencies</p>
            <h2 className="text-3xl md:text-5xl font-serif font-bold">Find the right talent, fast.</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Post a casting call today and receive applications from verified beauty professionals across South Africa.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {BRAND_STEPS.map(({ icon: Icon, title, desc }, i) => (
              <div key={title} className="flex flex-col items-center text-center p-8 rounded-2xl bg-card border border-border/60 hover:border-primary/40 transition-colors">
                <div className="relative mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </div>
                </div>
                <h3 className="font-serif text-xl font-bold mb-3">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link href="/casting">
              <Button size="lg" variant="outline" className="h-12 px-8 bg-card">View Open Castings →</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-24 bg-primary/5 border-b border-border/60">
        <div className="container px-4 max-w-2xl text-center space-y-6">
          <h2 className="text-3xl md:text-5xl font-serif font-bold">Ready to get started?</h2>
          <p className="text-muted-foreground text-lg">
            Join thousands of beauty professionals and clients already on GlamNet. It's free to sign up.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
            <Link href="/signup">
              <Button size="lg" className="h-14 px-10 text-base">Create your account</Button>
            </Link>
            <Link href="/stylists">
              <Button size="lg" variant="outline" className="h-14 px-10 text-base bg-card">Browse talent first</Button>
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
