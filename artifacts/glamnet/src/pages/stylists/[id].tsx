import { useEffect, useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useGetStylist } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { formatRating, formatRands } from "@/lib/utils";
import { ChevronLeft, MessageCircle, MapPin, Star, MoreHorizontal, Heart } from "lucide-react";

import studioBgImg from "@assets/generated_images/studio-bg.jpg";
import lemonadeImg from "@assets/generated_images/look-lemonade.jpg";
import softGlamImg from "@assets/generated_images/look-softglam.jpg";
import dateNightImg from "@assets/generated_images/moment-datenight.jpg";
import weddingImg from "@assets/generated_images/moment-wedding.jpg";

export default function StylistProfile() {
  const [, params] = useRoute("/stylists/:id");
  const stylistId = params?.id;
  const [, setLocation] = useLocation();

  const { data: stylist, isLoading, error } = useGetStylist(stylistId || "", {
    query: { enabled: !!stylistId, queryKey: ["stylist", stylistId] },
  });

  if (isLoading) {
    return <div className="p-12 flex justify-center"><div className="animate-pulse w-8 h-8 rounded-full bg-primary/20" /></div>;
  }

  if (error || !stylist) {
    return <div className="p-12 text-center text-destructive">Failed to load profile</div>;
  }

  return (
    <div className="flex flex-col min-h-screen bg-background relative pb-[100px] overflow-x-hidden">
      
      {/* ── HEADER ── */}
      <div className="absolute top-0 left-0 right-0 z-20 flex justify-between items-center p-5 pt-12">
        <button onClick={() => window.history.back()} className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center text-foreground shadow-sm">
          <ChevronLeft className="h-5 w-5 pr-0.5" />
        </button>
      </div>

      {/* ── HERO IMAGE ── */}
      <div className="relative w-full h-[400px]">
        <img 
          src={studioBgImg} 
          alt={`${stylist.name} studio`} 
          className="w-full h-full object-cover" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10" />
      </div>

      {/* ── SHEET CONTENT ── */}
      <div className="relative -mt-10 bg-background rounded-t-[32px] pt-8 px-6 min-h-[500px]">
        {/* Drag handle pill */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 rounded-full bg-muted-foreground/20" />

        <div className="flex items-center gap-2 mb-2">
          <h1 className="text-2xl font-serif font-bold text-foreground">{stylist.name}</h1>
          {stylist.verified && <VerifiedBadge size="sm" variant="pill" className="border-0 bg-transparent text-primary p-0" />}
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold text-muted-foreground mb-5">
          <span className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            {formatRating(stylist.rating)} ({stylist.reviewCount})
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {stylist.location}
          </span>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto hide-scrollbar">
          {["Professional", "Clean", "Friendly"].map((tag, i) => (
            <span key={i} className="px-4 py-2 rounded-full bg-card border border-border/40 text-[11px] font-semibold tracking-wide text-foreground/80 shrink-0">
              {tag}
            </span>
          ))}
        </div>

        <Link href={`/book/${stylist.id}`}>
          <Button className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold text-[15px] mb-8 shadow-sm">
            Book Now
          </Button>
        </Link>

        {/* ── PORTFOLIO ── */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[11px] font-bold tracking-widest uppercase text-foreground/70">Style Inspiration</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto hide-scrollbar -mx-6 px-6 pb-2">
            {[
              lemonadeImg,
              softGlamImg,
              dateNightImg
            ].map((img, i) => (
              <div key={i} className="w-[100px] h-[130px] rounded-[20px] overflow-hidden shrink-0 shadow-sm border border-border/20">
                <img src={img} alt="Portfolio item" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>

        {/* ── SERVICES ── */}
        <div className="mb-6">
          <h2 className="text-[11px] font-bold tracking-widest uppercase text-foreground/70 mb-4">Services</h2>
          <div className="space-y-4">
            {stylist.services.map((service, i) => {
              // Map mock images to services for visual richness
              const imgs = [
                lemonadeImg,
                softGlamImg,
                weddingImg
              ];
              const img = imgs[i % imgs.length];

              return (
                <div key={service.id} className="flex items-center gap-4 bg-card rounded-[24px] p-2.5 pr-4 border border-border/40 shadow-sm">
                  <div className="w-[68px] h-[68px] rounded-[16px] overflow-hidden shrink-0">
                    <img src={img} alt={service.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-[13px] text-foreground mb-1 truncate">{service.name}</h3>
                    <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
                      <span className="text-foreground">{formatRands(service.price)}</span>
                      <span className="w-1 h-1 rounded-full bg-border" />
                      <span className="flex items-center gap-1">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        {Math.floor(service.duration / 60)}h {service.duration % 60}m
                      </span>
                    </div>
                  </div>
                  <Link href={`/book/${stylist.id}?serviceId=${service.id}`}>
                    <Button size="sm" className="bg-primary hover:bg-primary/90 text-white rounded-full text-xs font-semibold px-5 h-8">
                      Book
                    </Button>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
}
