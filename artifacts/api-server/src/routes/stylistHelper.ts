import { db, stylistProfilesTable, servicesTable, portfolioItemsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export function serializePublicStylistProfile(
  profile: typeof stylistProfilesTable.$inferSelect,
  services: typeof servicesTable.$inferSelect[],
  portfolio: typeof portfolioItemsTable.$inferSelect[],
  reputationScore: number | null = null,
) {
  return {
    id: profile.id,
    name: profile.name,
    specialty: profile.specialty,
    location: profile.location,
    area: profile.area,
    bio: profile.bio ?? null,
    rating: profile.rating,
    reviewCount: profile.reviewCount,
    verified: profile.verified,
    services: services.map(s => ({ id: s.id, name: s.name, price: s.price, duration: s.duration })),
    portfolio: portfolio.map(p => ({ id: p.id, title: p.title, description: p.description ?? null, type: p.type, imageUrl: p.imageUrl ?? null })),
    availability: profile.availability,
    tags: profile.tags,
    instagram: profile.instagram ?? null,
    website: profile.website ?? null,
    accentColor: profile.accentColor ?? null,
    houseCalls: profile.houseCalls,
    reputationScore,
  };
}

export default async function buildStylistResponse(profileId: string) {
  const [profile] = await db.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.id, profileId));
  if (!profile) return null;
  const services = await db.select().from(servicesTable).where(eq(servicesTable.stylistId, profileId));
  const portfolio = await db.select().from(portfolioItemsTable).where(eq(portfolioItemsTable.stylistId, profileId));
  return serializePublicStylistProfile(profile, services, portfolio);
}
