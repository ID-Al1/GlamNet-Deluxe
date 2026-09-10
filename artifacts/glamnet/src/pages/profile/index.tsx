import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { OwnerProfile } from "./owner-profile";
import { BrandProfile } from "./brand-profile";
import { ClientProfile } from "./client-profile";
import { ArtistProfile } from "./artist-profile";

export default function Profile() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!user) {
      setLocation("/login");
    }
  }, [user, setLocation]);

  if (!user) return null;

  return (
    <div className="container py-8 sm:py-12 max-w-3xl px-4 mx-auto pb-24">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-serif font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground mt-2 text-sm sm:text-base">Manage your identity and account details</p>
      </div>

      {user.isOwner ? (
        <OwnerProfile />
      ) : user.role === "brand" ? (
        <BrandProfile />
      ) : user.role === "stylist" ? (
        <ArtistProfile />
      ) : (
        <ClientProfile />
      )}
    </div>
  );
}
