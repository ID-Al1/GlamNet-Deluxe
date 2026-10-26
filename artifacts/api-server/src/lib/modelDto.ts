import { db, modelProfilesTable, modelPhotosTable, modelSocialLinksTable } from "@workspace/db";
import { asc, eq } from "drizzle-orm";

type Profile = typeof modelProfilesTable.$inferSelect;
type Photo = typeof modelPhotosTable.$inferSelect;
type Link = typeof modelSocialLinksTable.$inferSelect;

export const DIGITAL_KINDS = ["front", "left", "right", "full_length"] as const;
const DIGITAL_LABEL: Record<string, string> = {
  front: "Front digital",
  left: "Left profile digital",
  right: "Right profile digital",
  full_length: "Full-length digital",
};

/** A profile is in the public directory only when published AND verified. */
export function isListed(p: Pick<Profile, "isPublished" | "verificationStatus">): boolean {
  return p.isPublished && p.verificationStatus === "verified";
}

/** True only when the model switched this field on. Missing means private. */
export function shows(p: Pick<Profile, "visibility">, key: string): boolean {
  return p.visibility?.[key] === true;
}

export function missingForPublish(p: Profile, photos: Photo[]): string[] {
  const missing: string[] = [];
  if (p.professionalName.trim().length < 2) missing.push("Professional name");
  if (!p.category.trim()) missing.push("Category");
  if (!p.area.trim()) missing.push("Area (city or province)");
  if (!p.bio?.trim()) missing.push("Short biography");
  for (const kind of DIGITAL_KINDS) {
    if (!photos.some((ph) => ph.kind === kind)) missing.push(DIGITAL_LABEL[kind]);
  }
  return missing;
}

export async function loadModelParts(profileId: string) {
  const [photos, links] = await Promise.all([
    db.select().from(modelPhotosTable).where(eq(modelPhotosTable.modelProfileId, profileId)).orderBy(asc(modelPhotosTable.createdAt)),
    db.select().from(modelSocialLinksTable).where(eq(modelSocialLinksTable.modelProfileId, profileId)),
  ]);
  return { photos, links };
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/** Everything the model themselves may see. Photo URLs are authenticated routes, never public file URLs. */
export function ownerProfileDto(p: Profile, photos: Photo[], links: Link[], photoUrl: (id: string) => string) {
  return {
    id: p.id,
    professionalName: p.professionalName,
    category: p.category,
    area: p.area,
    bio: p.bio,
    skills: p.skills,
    serviceCategories: p.serviceCategories,
    availability: p.availability as "available" | "limited" | "unavailable",
    acceptsEnquiries: p.acceptsEnquiries,
    startingRateCents: p.startingRateCents,
    rateNote: p.rateNote,
    creativeIdentity: p.creativeIdentity,
    collaborationPreferences: p.collaborationPreferences,
    careerGoals: p.careerGoals,
    visibility: p.visibility ?? {},
    isPublished: p.isPublished,
    verificationStatus: p.verificationStatus as "none" | "pending" | "verified" | "rejected",
    verificationRequestedAt: iso(p.verificationRequestedAt),
    verifiedAt: iso(p.verifiedAt),
    verificationRejectionReason: p.verificationRejectionReason,
    registryNumber: p.registryNumber,
    isSpotlight: p.spotlightAt !== null,
    spotlightNote: p.spotlightNote,
    photos: photos.map((ph) => ({ id: ph.id, kind: ph.kind as "front" | "left" | "right" | "full_length" | "editorial", url: photoUrl(ph.id), isPublic: ph.isPublic })),
    socialLinks: links.map((l) => ({
      id: l.id, platform: l.platform, url: l.url, handle: l.handle, followerCount: l.followerCount,
      statSource: l.statSource, statUpdatedAt: iso(l.statUpdatedAt), isPublic: l.isPublic,
    })),
    missingForPublish: missingForPublish(p, photos),
    isListed: isListed(p),
  };
}

function publicPhotos(photos: Photo[]) {
  return photos.filter((ph) => ph.isPublic).map((ph) => ({
    id: ph.id,
    kind: ph.kind as "front" | "left" | "right" | "full_length" | "editorial",
    url: `/talent/photos/${ph.id}`,
  }));
}

/** Public card: built field by field so a new column can never leak by accident. */
export function talentCardDto(p: Profile, photos: Photo[]) {
  const pub = publicPhotos(photos);
  const portrait = pub.find((ph) => ph.kind === "editorial") ?? pub.find((ph) => ph.kind === "front") ?? null;
  return {
    id: p.id,
    professionalName: p.professionalName,
    category: p.category,
    area: shows(p, "area") && p.area ? p.area : null,
    availability: shows(p, "availability") && p.availability !== "unavailable" ? (p.availability as "available" | "limited") : null,
    skills: shows(p, "skills") ? p.skills : [],
    verified: true as const,
    portraitUrl: portrait?.url ?? null,
    registryNumber: p.registryNumber,
    isSpotlight: p.spotlightAt !== null,
    spotlightNote: p.spotlightAt !== null ? p.spotlightNote : null,
  };
}

export function talentProfileDto(p: Profile, photos: Photo[], links: Link[]) {
  const card = talentCardDto(p, photos);
  return {
    id: card.id,
    professionalName: card.professionalName,
    category: card.category,
    area: card.area,
    availability: card.availability,
    bio: shows(p, "bio") ? p.bio : null,
    skills: card.skills,
    serviceCategories: shows(p, "serviceCategories") ? p.serviceCategories : [],
    verified: true as const,
    verifiedAt: iso(p.verifiedAt),
    registryNumber: p.registryNumber,
    isSpotlight: card.isSpotlight,
    spotlightNote: card.spotlightNote,
    acceptsEnquiries: p.acceptsEnquiries,
    startingRateCents: shows(p, "rates") ? p.startingRateCents : null,
    rateNote: shows(p, "rates") ? p.rateNote : null,
    socialLinks: links.filter((l) => l.isPublic).map((l) => ({
      platform: l.platform, url: l.url, handle: l.handle,
      followerCount: l.followerCount, statSource: l.statSource, statUpdatedAt: iso(l.statUpdatedAt),
    })),
    photos: publicPhotos(photos),
  };
}
