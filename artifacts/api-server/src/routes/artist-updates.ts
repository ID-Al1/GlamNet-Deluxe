/**
 * Artist updates: one place for the owner to talk to artists.
 *
 * Owner:
 *   GET  /owner/artist-updates/audience — every active artist, with what she has and has not done
 *   GET  /owner/artist-updates          — sent updates, newest first, with read counts
 *   POST /owner/artist-updates          — send a personalised update to chosen artists
 *
 * Artist:
 *   GET  /artist-updates/mine           — her updates, newest first
 *   POST /artist-updates/mine/read      — mark them all read
 *
 * Every update lands in the artist's in-app Updates inbox, so it reaches her
 * even with no phone number and email delivery switched off. When the owner
 * asks for it, it also goes out by email and WhatsApp through notify().
 */
import { Router } from "express";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { artistUpdateRecipientsTable, artistUpdatesTable, db, stylistProfilesTable, usersTable } from "@workspace/db";
import { SendOwnerArtistUpdateBody } from "@workspace/api-zod";
import { requireAuth, requireOwner } from "../lib/auth";
import { notify } from "../lib/notifications";
import { logger } from "../lib/logger";

const router = Router();

type OutstandingItem = "ID number" | "ID document" | "Bank details" | "Bio" | "Services" | "Portfolio";

interface AudienceArtist {
  profileId: string;
  userId: string;
  name: string;
  firstName: string;
  specialty: string;
  location: string;
  verificationStatus: "none" | "pending" | "verified";
  outstanding: OutstandingItem[];
  email: string | null;
  phone: string | null;
  completedBookings: number;
  joinedAt: Date;
}

// The same requirements the verification queue and the artist's own banner use.
async function loadAudience(profileIds?: string[]): Promise<AudienceArtist[]> {
  const conditions = [eq(usersTable.accountStatus, "active")];
  if (profileIds) conditions.push(inArray(stylistProfilesTable.id, profileIds));
  const rows = await db.select({
    profileId: stylistProfilesTable.id,
    userId: usersTable.id,
    name: stylistProfilesTable.name,
    specialty: stylistProfilesTable.specialty,
    location: stylistProfilesTable.location,
    verificationStatus: stylistProfilesTable.verificationStatus,
    email: usersTable.email,
    phone: usersTable.phone,
    joinedAt: usersTable.createdAt,
    hasIdNumber: sql<boolean>`${stylistProfilesTable.idNumber} is not null and btrim(${stylistProfilesTable.idNumber}) <> ''`,
    hasIdDocument: sql<boolean>`${stylistProfilesTable.idDocumentUrl} is not null and btrim(${stylistProfilesTable.idDocumentUrl}) <> ''`,
    hasBankDetails: sql<boolean>`exists (select 1 from bank_accounts ba where ba.stylist_profile_id = ${stylistProfilesTable.id})`,
    hasBio: sql<boolean>`${stylistProfilesTable.bio} is not null and length(btrim(${stylistProfilesTable.bio})) >= 40`,
    hasServices: sql<boolean>`exists (select 1 from services s where s.stylist_id = ${stylistProfilesTable.id})`,
    hasPortfolio: sql<boolean>`exists (select 1 from portfolio_items pi where pi.stylist_id = ${stylistProfilesTable.id})`,
    completedBookings: sql<number>`(select count(distinct a.id)::int from appointments a left join booking_team_members tm on tm.appointment_id = a.id and tm.stylist_id = ${stylistProfilesTable.id} and tm.status = 'confirmed' where (a.stylist_id = ${stylistProfilesTable.id} or tm.stylist_id is not null) and a.status = 'completed')`,
  }).from(stylistProfilesTable)
    .innerJoin(usersTable, eq(usersTable.id, stylistProfilesTable.userId))
    .where(and(...conditions))
    .orderBy(stylistProfilesTable.name, stylistProfilesTable.id);

  return rows.map((row) => {
    const outstanding: OutstandingItem[] = [];
    if (!row.hasIdNumber) outstanding.push("ID number");
    if (!row.hasIdDocument) outstanding.push("ID document");
    if (!row.hasBankDetails) outstanding.push("Bank details");
    if (!row.hasBio) outstanding.push("Bio");
    if (!row.hasServices) outstanding.push("Services");
    if (!row.hasPortfolio) outstanding.push("Portfolio");
    return {
      profileId: row.profileId,
      userId: row.userId,
      name: row.name,
      firstName: row.name.trim().split(/\s+/)[0] || row.name,
      specialty: row.specialty,
      location: row.location,
      verificationStatus: row.verificationStatus,
      outstanding,
      email: row.email,
      phone: row.phone,
      completedBookings: row.completedBookings,
      joinedAt: row.joinedAt,
    };
  });
}

/**
 * Fill in the placeholders for one artist. Keep in step with the preview in
 * artifacts/glamnet/src/pages/owner/artist-updates.tsx.
 */
const UPDATE_PLACEHOLDERS = ["first_name", "name", "specialty", "location", "missing_items"] as const;

function personalise(template: string, artist: AudienceArtist): string {
  const values: Record<(typeof UPDATE_PLACEHOLDERS)[number], string> = {
    first_name: artist.firstName,
    name: artist.name,
    specialty: artist.specialty || "beauty",
    location: artist.location || "your area",
    missing_items: artist.outstanding.length ? artist.outstanding.join(", ") : "nothing, your profile is complete",
  };
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? values[key as keyof typeof values] : match);
}

function unknownPlaceholders(text: string): string[] {
  const found = [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!);
  return [...new Set(found.filter((key) => !(UPDATE_PLACEHOLDERS as readonly string[]).includes(key)))];
}

router.get("/owner/artist-updates/audience", requireOwner, async (_req, res) => {
  const audience = await loadAudience();
  res.json(audience.map(({ userId: _userId, email, phone, joinedAt, ...artist }) => ({
    ...artist,
    hasEmail: !!email,
    hasPhone: !!phone,
    joinedAt: joinedAt.toISOString(),
  })));
});

router.get("/owner/artist-updates", requireOwner, async (_req, res) => {
  const rows = await db.select({
    id: artistUpdatesTable.id,
    subject: artistUpdatesTable.subject,
    body: artistUpdatesTable.body,
    audienceSummary: artistUpdatesTable.audienceSummary,
    sendExternally: artistUpdatesTable.sendExternally,
    recipientCount: artistUpdatesTable.recipientCount,
    // Spelled out in full: drizzle drops the table prefix on a single-table
    // select, and a bare "id" here would resolve to r.id.
    readCount: sql<number>`(select count(*)::int from artist_update_recipients r where r.update_id = "artist_updates"."id" and r.read_at is not null)`,
    createdAt: artistUpdatesTable.createdAt,
  }).from(artistUpdatesTable)
    .orderBy(desc(artistUpdatesTable.createdAt), desc(artistUpdatesTable.id))
    .limit(100);
  res.json(rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })));
});

router.post("/owner/artist-updates", requireOwner, async (req, res) => {
  const owner = (req as any).user;
  const parsed = SendOwnerArtistUpdateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Add a subject, a message and at least one artist." });
    return;
  }
  const subject = parsed.data.subject.trim();
  const body = parsed.data.body.trim();
  if (!subject || !body) {
    res.status(400).json({ error: "Add a subject and a message." });
    return;
  }
  const unknown = unknownPlaceholders(`${subject}\n${body}`);
  if (unknown.length) {
    res.status(400).json({
      error: `These placeholders are not recognised: ${unknown.map((k) => `{${k}}`).join(", ")}. Use ${UPDATE_PLACEHOLDERS.map((k) => `{${k}}`).join(", ")}.`,
    });
    return;
  }

  const recipients = await loadAudience([...new Set(parsed.data.profileIds)]);
  if (recipients.length === 0) {
    res.status(400).json({ error: "None of the chosen artists can be messaged. They may have been suspended or removed." });
    return;
  }

  const updateId = randomUUID();
  const now = new Date();
  const personalised = recipients.map((artist) => ({
    artist,
    subject: personalise(subject, artist),
    body: personalise(body, artist),
  }));

  await db.transaction(async (tx) => {
    await tx.insert(artistUpdatesTable).values({
      id: updateId,
      subject,
      body,
      audienceSummary: parsed.data.audienceSummary.trim() || `${recipients.length} artists`,
      sendExternally: parsed.data.sendExternally,
      recipientCount: recipients.length,
      sentByUserId: owner.id,
      createdAt: now,
    });
    for (let i = 0; i < personalised.length; i += 500) {
      await tx.insert(artistUpdateRecipientsTable).values(personalised.slice(i, i + 500).map((p) => ({
        id: randomUUID(),
        updateId,
        stylistProfileId: p.artist.profileId,
        userId: p.artist.userId,
        subject: p.subject,
        body: p.body,
        createdAt: now,
      })));
    }
  });

  res.status(201).json({
    id: updateId,
    subject,
    body,
    audienceSummary: parsed.data.audienceSummary.trim() || `${recipients.length} artists`,
    sendExternally: parsed.data.sendExternally,
    recipientCount: recipients.length,
    readCount: 0,
    createdAt: now.toISOString(),
  });

  // Email and WhatsApp go out after the response, one at a time so a large
  // send does not trip provider rate limits. notify() never throws and alerts
  // the admin number when a delivery fails.
  if (parsed.data.sendExternally) {
    setImmediate(async () => {
      for (const p of personalised) {
        try {
          await notify(
            { phone: p.artist.phone, email: p.artist.email, name: p.artist.name },
            "artist.update",
            { artistName: p.artist.firstName, updateSubject: p.subject, updateBody: p.body },
          );
        } catch (err) {
          logger.warn({ err, updateId, profileId: p.artist.profileId }, "Artist update delivery failed");
        }
      }
    });
  }
});

router.get("/artist-updates/mine", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const rows = await db.select({
    id: artistUpdateRecipientsTable.id,
    subject: artistUpdateRecipientsTable.subject,
    body: artistUpdateRecipientsTable.body,
    createdAt: artistUpdateRecipientsTable.createdAt,
    readAt: artistUpdateRecipientsTable.readAt,
  }).from(artistUpdateRecipientsTable)
    .where(eq(artistUpdateRecipientsTable.userId, user.id))
    .orderBy(desc(artistUpdateRecipientsTable.createdAt), desc(artistUpdateRecipientsTable.id))
    .limit(100);
  res.json(rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt?.toISOString() ?? null,
  })));
});

router.post("/artist-updates/mine/read", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const marked = await db.update(artistUpdateRecipientsTable)
    .set({ readAt: new Date() })
    .where(and(eq(artistUpdateRecipientsTable.userId, user.id), isNull(artistUpdateRecipientsTable.readAt)))
    .returning({ id: artistUpdateRecipientsTable.id });
  res.json({ marked: marked.length });
});

export default router;
