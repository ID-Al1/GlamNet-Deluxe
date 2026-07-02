import { useState } from "react";
import { useListStylists } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Star, Sparkles } from "lucide-react";
import { VerifiedBadge } from "@/components/ui/verified-badge";

const CATEGORIES = [
  { label: "All",      bg: "linear-gradient(135deg, #F5F0EB, #E8E1DA)", icon: "✨" },
  { label: "Makeup",   bg: "linear-gradient(135deg, #F7D6D8, #E9A8B2)", icon: "💄" },
  { label: "Hair",     bg: "linear-gradient(135deg, #F5E6C0, #D4A440)", icon: "💇" },
  { label: "Barber",   bg: "linear-gradient(135deg, #D8E0EC, #A8B8CC)", icon: "✂️" },
  { label: "Nails",    bg: "linear-gradient(135deg, #EDD8F5, #C8A8D8)", icon: "💅" },
  { label: "Lashes",   bg: "linear-gradient(135deg, #2C2020, #1A1410)", icon: "🪬" },
  { label: "Brows",    bg: "linear-gradient(135deg, #EAD8C0, #C8A870)", icon: "🤎" },
  { label: "Skincare", bg: "linear-gradient(135deg, #D4E8D0, #A0C890)", icon: "🌿" },
];

const AVATAR_PALETTES = [
  ["hsl(38 40% 88%)",  "hsl(38 50% 72%)",  "hsl(38 40% 30%)"],
  ["hsl(350 35% 86%)", "hsl(350 45% 70%)", "hsl(350 35% 32%)"],
  ["hsl(200 38% 86%)", "hsl(200 48% 70%)", "hsl(200 38% 30%)"],
  ["hsl(150 35% 86%)", "hsl(150 45% 70%)", "hsl(150 35% 28%)"],
  ["hsl(280 35% 86%)", "hsl(280 45% 70%)", "hsl(280 35% 30%)"],
];

function ArtistInitials({ name }: { name: string }) {
  const initials = name.trim().split(/\s+/).map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase();
  const p = AVATAR_PALETTES[name.charCodeAt(0) % AVATAR_PALETTES.length];
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ background: `linear-gradient(135deg, ${p[0]}, ${p[1]})` }}
    >
      <span className="font-serif font-bold text-5xl select-none" style={{ color: p[2] }}>
        {initials}
      </span>
    </div>
  );
}

function RatingDisplay({ rating, count }: { rating: number; count: number }) {
  if (!count) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
        style={{ background: "rgba(184,137,58,0.12)", color: "#B8893A", border: "1px solid rgba(184,137,58,0.25)" }}
      >
        <Sparkles className="w-2.5 h-2.5" />
        New artist
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-sm">
      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
      <span className="font-medium">{rating.toFixed(1)}</span>
      <span className="text-muted-foreground">({count})</span>
    </span>
  );
}

export default function StylistsList() {
  const [search, setSearch] = useState("");
  const [specialty, setSpecialty] = useState("");

  const { data: stylists, isLoading } = useListStylists({
    search: search || undefined,
    specialty: specialty || undefined,
  });

  return (
    <div className="container py-8 sm:py-12 max-w-6xl space-y-8 px-4">
      <div className="space-y-3">
        <h1 className="text-4xl font-serif font-bold tracking-tight">Discover Talent</h1>
        <p className="text-muted-foreground text-lg max-w-2xl">
          Connect with South Africa's finest beauty professionals.
        </p>
      </div>

      {/* Search */}
      <Input
        placeholder="Find braiders, barbers, MUAs, nail techs..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {/* Category image tiles */}
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4" style={{ scrollbarWidth: "none" }}>
        {CATEGORIES.map(cat => {
          const isActive = specialty === (cat.label === "All" ? "" : cat.label);
          const isLashes = cat.label === "Lashes";
          return (
            <button
              key={cat.label}
              onClick={() => setSpecialty(cat.label === "All" ? "" : cat.label)}
              className={`shrink-0 flex flex-col items-center gap-1.5 transition-all ${
                isActive ? "scale-105" : "opacity-70 hover:opacity-100"
              }`}
            >
              <div
                className={`w-[68px] h-[68px] rounded-2xl flex items-center justify-center text-2xl shadow-sm transition-all ${
                  isActive ? "ring-2 ring-offset-2 ring-offset-background" : ""
                }`}
                style={{
                  background: cat.bg,
                  ringColor: "#B8893A",
                  ...(isActive ? { outline: "2px solid #B8893A", outlineOffset: "3px" } : {}),
                }}
              >
                <span role="img" aria-label={cat.label}>{cat.icon}</span>
              </div>
              <span
                className="text-[11px] font-medium leading-none"
                style={{ color: isActive ? "#B8893A" : undefined }}
              >
                {cat.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i} className="overflow-hidden">
              <div className="aspect-[4/3] bg-muted animate-pulse" />
              <CardContent className="p-5 space-y-3">
                <div className="h-4 bg-muted animate-pulse rounded-full w-2/3" />
                <div className="h-3 bg-muted animate-pulse rounded-full w-1/3" />
                <div className="h-9 bg-muted animate-pulse rounded-lg w-full mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : stylists?.length === 0 ? (
        <div className="text-center py-20 border rounded-2xl border-dashed border-border/50 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <p className="font-serif text-lg font-bold">No artists found</p>
          <p className="text-muted-foreground text-sm">Try a different search or specialty.</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {stylists?.map(stylist => (
            <Card
              key={stylist.id}
              className="overflow-hidden group hover:border-primary/40 transition-all duration-200 hover:-translate-y-0.5 bg-card/50 backdrop-blur"
            >
              {/* Image area — brand-texture placeholder, no fake photos */}
              <div className="aspect-[4/3] relative overflow-hidden">
                <ArtistInitials name={stylist.name} />
                <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/20 to-transparent" />
                {stylist.verified && (
                  <div className="absolute top-3 right-3">
                    <VerifiedBadge size="sm" variant="pill" />
                  </div>
                )}
                <div className="absolute bottom-4 left-4 right-4">
                  <h3 className="font-serif text-xl font-bold drop-shadow-sm">{stylist.name}</h3>
                  <p className="text-sm font-medium mt-0.5" style={{ color: "#B8893A" }}>
                    {stylist.specialty}
                  </p>
                </div>
              </div>

              <CardContent className="p-5">
                <div className="flex items-center justify-between text-sm mb-4">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    {stylist.location}
                  </span>
                  <RatingDisplay rating={stylist.rating ?? 0} count={stylist.reviewCount ?? 0} />
                </div>
                <Link href={`/stylists/${stylist.id}`}>
                  <Button className="w-full">View Profile</Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
