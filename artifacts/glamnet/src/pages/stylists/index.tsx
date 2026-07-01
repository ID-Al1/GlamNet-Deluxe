import { useState } from "react";
import { useListStylists } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Star, BadgeCheck } from "lucide-react";

export default function StylistsList() {
  const [search, setSearch] = useState("");
  const [specialty, setSpecialty] = useState("");
  
  const { data: stylists, isLoading } = useListStylists({
    search: search || undefined,
    specialty: specialty || undefined
  });

  return (
    <div className="container py-12 max-w-6xl space-y-8">
      <div className="space-y-4">
        <h1 className="text-4xl font-serif font-bold tracking-tight">Discover Talent</h1>
        <p className="text-muted-foreground text-lg max-w-2xl">
          Connect with South Africa's finest beauty professionals.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <Input 
          placeholder="Search by name..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex gap-2 overflow-x-auto pb-2">
          {["All", "Makeup", "Hair", "Nails", "Lashes", "Skincare", "Brows"].map(s => (
            <Button
              key={s}
              variant={specialty === (s === "All" ? "" : s) ? "default" : "outline"}
              onClick={() => setSpecialty(s === "All" ? "" : s)}
              className="rounded-full"
            >
              {s}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3,4,5,6].map(i => (
            <Card key={i} className="h-80 animate-pulse bg-muted" />
          ))}
        </div>
      ) : stylists?.length === 0 ? (
        <div className="text-center py-20 border rounded-xl border-dashed">
          <p className="text-muted-foreground">No stylists found matching your criteria.</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {stylists?.map(stylist => (
            <Card key={stylist.id} className="overflow-hidden group hover:border-primary/50 transition-colors bg-card/50 backdrop-blur">
              <div className="aspect-[4/3] bg-muted relative">
                <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-serif text-xl font-bold">{stylist.name}</h3>
                    {stylist.verified && <BadgeCheck className="w-5 h-5 text-primary" />}
                  </div>
                  <p className="text-primary text-sm font-medium">{stylist.specialty}</p>
                </div>
              </div>
              <CardContent className="p-5">
                <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                  <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {stylist.location}</span>
                  <span className="flex items-center gap-1"><Star className="w-4 h-4 text-primary" /> {stylist.rating} ({stylist.reviewCount})</span>
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
