import { useRoute, Link } from "wouter";
import { useGetStylist } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Star, MessageCircle, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VerifiedBadge } from "@/components/ui/verified-badge";

async function fetchReviews(stylistId: string) {
  const res = await fetch(`${import.meta.env.BASE_URL}api/reviews?stylistId=${stylistId}`);
  if (!res.ok) return [];
  return res.json() as Promise<{ id: string; rating: number; text: string | null; createdAt: string; reviewerName: string | null }[]>;
}

const AVATAR_PALETTES = [
  ["hsl(38 40% 88%)",  "hsl(38 50% 72%)",  "hsl(38 40% 30%)"],
  ["hsl(350 35% 86%)", "hsl(350 45% 70%)", "hsl(350 35% 32%)"],
  ["hsl(200 38% 86%)", "hsl(200 48% 70%)", "hsl(200 38% 30%)"],
  ["hsl(150 35% 86%)", "hsl(150 45% 70%)", "hsl(150 35% 28%)"],
  ["hsl(280 35% 86%)", "hsl(280 45% 70%)", "hsl(280 35% 30%)"],
];

function ArtistInitials({ name, className = "" }: { name: string; className?: string }) {
  const initials = name.trim().split(/\s+/).map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase();
  const p = AVATAR_PALETTES[name.charCodeAt(0) % AVATAR_PALETTES.length];
  return (
    <div
      className={`absolute inset-0 flex items-center justify-center ${className}`}
      style={{ background: `linear-gradient(160deg, ${p[0]}, ${p[1]})` }}
    >
      <span className="font-serif font-bold text-7xl select-none" style={{ color: p[2] }}>
        {initials}
      </span>
    </div>
  );
}

function StarDisplay({ rating, count }: { rating: number; count: number }) {
  if (count === 0) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
        style={{ background: "rgba(184,137,58,0.12)", color: "#B8893A", border: "1px solid rgba(184,137,58,0.25)" }}
      >
        <Sparkles className="w-3 h-3" />
        New artist
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5">
      <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
      <span className="font-medium">{rating.toFixed(1)}</span>
      <span className="text-muted-foreground">({count} review{count !== 1 ? "s" : ""})</span>
    </span>
  );
}

export default function StylistProfile() {
  const [, params] = useRoute("/stylists/:id");
  const stylistId = params?.id;

  const { data: stylist, isLoading, error } = useGetStylist(stylistId || "", {
    query: { enabled: !!stylistId, queryKey: ["stylist", stylistId] },
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ["reviews", stylistId],
    queryFn: () => fetchReviews(stylistId!),
    enabled: !!stylistId,
  });

  if (isLoading) {
    return (
      <div className="container py-8 max-w-5xl px-4 space-y-8">
        <div className="flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-1/3 aspect-[4/5] bg-muted animate-pulse rounded-2xl" />
          <div className="w-full md:w-2/3 space-y-4">
            <div className="h-10 bg-muted animate-pulse rounded-full w-2/3" />
            <div className="h-5 bg-muted animate-pulse rounded-full w-1/3" />
            <div className="h-20 bg-muted animate-pulse rounded-xl w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !stylist) {
    return <div className="p-12 text-center text-destructive">Failed to load profile</div>;
  }

  return (
    <>
      <div className="container py-8 max-w-5xl space-y-8 px-4 pb-24 md:pb-8">
        {/* Profile header */}
        <div className="flex flex-col md:flex-row gap-8 items-start">
          {/* Brand-texture hero — no fake photos */}
          <div className="w-full md:w-1/3 aspect-[4/5] rounded-2xl relative overflow-hidden shadow-lg">
            <ArtistInitials name={stylist.name} />
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
          </div>

          <div className="w-full md:w-2/3 space-y-5">
            {/* Name + verified */}
            <div>
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <h1 className="text-4xl font-serif font-bold tracking-tight">{stylist.name}</h1>
                {stylist.verified && <VerifiedBadge size="md" variant="pill" />}
              </div>
              {/* Specialty pill */}
              <span
                className="inline-block px-3 py-1 rounded-full text-sm font-semibold"
                style={{ background: "rgba(184,137,58,0.12)", color: "#B8893A", border: "1px solid rgba(184,137,58,0.25)" }}
              >
                {stylist.specialty}
              </span>
            </div>

            {/* Trust row */}
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {stylist.location}{stylist.area ? `, ${stylist.area}` : ""}
              </span>
              <StarDisplay rating={stylist.rating ?? 0} count={stylist.reviewCount ?? 0} />
            </div>

            {/* Bio */}
            <p className="text-muted-foreground leading-relaxed">
              {stylist.bio || "This artist hasn't added a bio yet."}
            </p>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link href={`/book/${stylist.id}`} className="hidden md:block">
                <Button size="lg" className="h-12 px-8 gap-2 font-semibold w-full sm:w-auto">
                  <Sparkles className="h-4 w-4" />
                  Book Appointment
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="h-12 px-8 bg-transparent w-full sm:w-auto">
                <MessageCircle className="w-5 h-5 mr-2" /> Message
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="services" className="w-full mt-12">
          <TabsList className="mb-8 border-b rounded-none w-full justify-start h-auto p-0 bg-transparent">
            <TabsTrigger
              value="services"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 px-6 font-medium"
            >
              Services & Pricing
            </TabsTrigger>
            <TabsTrigger
              value="portfolio"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 px-6 font-medium"
            >
              Portfolio
            </TabsTrigger>
            <TabsTrigger
              value="reviews"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 px-6 font-medium"
            >
              Reviews {reviews.length > 0 && `(${reviews.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="services" className="space-y-4">
            {stylist.services && stylist.services.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {stylist.services.map((service) => (
                  <Card key={service.id} className="bg-card/50 backdrop-blur border-border/50">
                    <CardContent className="p-6 flex justify-between items-center">
                      <div>
                        <h3 className="font-medium text-lg">{service.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                          <ClockIcon className="w-3 h-3" /> {service.duration} mins
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-serif text-xl font-bold">R{service.price}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center border rounded-2xl border-dashed border-border/50 space-y-2">
                <p className="font-medium">No services listed yet</p>
                <p className="text-sm text-muted-foreground">This artist hasn't added their services yet.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="portfolio">
            {stylist.portfolio && stylist.portfolio.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {stylist.portfolio.map((item) => (
                  <div key={item.id} className="aspect-square bg-muted rounded-xl relative group overflow-hidden">
                    <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                      <h4 className="font-bold">{item.title}</h4>
                      <p className="text-sm text-muted-foreground">{item.type}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center border rounded-2xl border-dashed border-border/50 space-y-2">
                <p className="font-medium">No portfolio items yet</p>
                <p className="text-sm text-muted-foreground">This artist hasn't added work yet. Check back soon.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="reviews" className="space-y-4">
            {reviews.length === 0 ? (
              <div className="py-16 text-center border rounded-2xl border-dashed border-border/50 space-y-2">
                <Star className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                <p className="font-medium">No reviews yet</p>
                <p className="text-sm text-muted-foreground">Reviews appear here after completed bookings.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {reviews.map(review => (
                  <Card key={review.id} className="bg-card/50 border-border/50">
                    <CardContent className="p-5 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map(s => (
                            <Star key={s} className={`h-4 w-4 ${s <= review.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20"}`} />
                          ))}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(review.createdAt).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                      {review.text && <p className="text-sm text-muted-foreground leading-relaxed">{review.text}</p>}
                      <p className="text-xs text-muted-foreground font-medium">{review.reviewerName ?? "Client"}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Sticky "Book Appointment" button — mobile only */}
      <div className="fixed bottom-0 left-0 right-0 z-40 p-4 bg-background/95 backdrop-blur-md border-t border-border/50 md:hidden">
        <Link href={`/book/${stylist.id}`}>
          <Button size="lg" className="w-full h-12 font-semibold gap-2">
            <Sparkles className="h-4 w-4" />
            Book Appointment
          </Button>
        </Link>
      </div>
    </>
  );
}

function ClockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
