/**
 * Artist contacts: one list of every would-be Bonisa artist, wherever she came
 * from, with what she still needs to do and automatic reminders to do it.
 *
 * Sources feed in three ways:
 *   - Bonisa app sign-ups are linked automatically by syncAppArtists()
 *   - The Vercel waitlist (Supabase) posts each new sign-up to
 *     POST /api/integrations/waitlist, and old ones can be imported as a CSV
 *   - The owner adds anyone else by hand
 *
 * Everyone is matched on email first, then phone, so one person is one row.
 *
 * Reminder rules (owner's choice): every 3 days, at most 3 per stage, and only
 * while the owner has automatic reminders switched on. A stage is "not on
 * Bonisa yet" or "finishing her profile". Moving to the next stage starts a
 * fresh run. After 3 unanswered reminders she is flagged for a personal call.
 */
import { randomUUID } from "crypto";
import { and, eq, sql } from "drizzle-orm";
import {
  artistContactMessagesTable,
  artistContactsTable,
  db,
  ownerSettingsTable,
  stylistProfilesTable,
  usersTable,
  type ArtistContact,
} from "@workspace/db";
import { normalisePhone, notify } from "./notifications";
import { ITEM_HINTS, appUrl } from "./email-templates";
import { logger } from "./logger";

export const REMINDER_INTERVAL_DAYS = 3;
export const MAX_REMINDERS_PER_STAGE = 3;
const DAY_MS = 86_400_000;

export type ContactStage = "not_on_app" | "finishing_profile" | "waiting_review" | "live" | "suspended";
export type OutstandingItem = "ID number" | "ID document" | "Bank details" | "Bio" | "Services" | "Portfolio";

const STAGES_NEEDING_ACTION: ContactStage[] = ["not_on_app", "finishing_profile"];

// ---------------------------------------------------------------------------
// Normalising what people type
// ---------------------------------------------------------------------------

export function normaliseEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function normaliseContactPhone(raw: unknown): string | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const text = String(raw).trim();
  if (!text) return null;
  const phone = normalisePhone(text);
  return phone && phone.replace(/\D/g, "").length >= 10 ? phone : null;
}

function clean(raw: unknown, max = 200): string | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const text = String(raw).trim().slice(0, max);
  return text || null;
}

export interface ContactInput {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  specialty?: string | null;
  location?: string | null;
  instagram?: string | null;
  notes?: string | null;
  waitlistData?: Record<string, unknown> | null;
  waitlistJoinedAt?: Date | null;
}

/**
 * Turn one waitlist record (or one CSV row) into contact fields. Column names
 * vary between forms, so this matches loosely: "Full Name", "full_name" and
 * "fullname" all count as the name.
 */
export function mapWaitlistRecord(record: Record<string, unknown>): ContactInput {
  const byKey = new Map<string, unknown>();
  for (const [key, value] of Object.entries(record)) {
    byKey.set(key.toLowerCase().replace(/[^a-z0-9]/g, ""), value);
  }
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const value = byKey.get(key);
      if (value !== undefined && value !== null && String(value).trim() !== "") return value;
    }
    return undefined;
  };

  const first = clean(pick("firstname", "name1", "givenname"));
  const last = clean(pick("lastname", "surname", "familyname"));
  const name = clean(pick("fullname", "name", "displayname", "artistname"))
    ?? ([first, last].filter(Boolean).join(" ") || null);

  const joinedRaw = pick("createdat", "insertedat", "signedupat", "joinedat", "timestamp", "submittedat", "date");
  const joined = joinedRaw ? new Date(String(joinedRaw)) : null;

  return {
    name,
    email: normaliseEmail(pick("email", "emailaddress", "mail")),
    phone: normaliseContactPhone(pick(
      "phone", "phonenumber", "mobile", "mobilenumber", "cell", "cellphone", "cellnumber",
      "whatsapp", "whatsappnumber", "contactnumber", "number", "tel", "telephone",
    )),
    specialty: clean(pick("specialty", "speciality", "category", "service", "services", "skill", "skills", "craft", "artisttype", "profession")),
    location: clean(pick("location", "city", "area", "province", "region", "suburb", "town")),
    instagram: clean(pick("instagram", "ig", "instagramhandle", "insta", "socials", "social", "handle")),
    waitlistData: record,
    waitlistJoinedAt: joined && !Number.isNaN(joined.getTime()) ? joined : null,
  };
}

// ---------------------------------------------------------------------------
// Adding and merging
// ---------------------------------------------------------------------------

async function findMatch(email: string | null, phone: string | null): Promise<ArtistContact | null> {
  if (email) {
    const [byEmail] = await db.select().from(artistContactsTable).where(eq(artistContactsTable.email, email));
    if (byEmail) return byEmail;
  }
  if (phone) {
    const [byPhone] = await db.select().from(artistContactsTable).where(eq(artistContactsTable.phone, phone));
    if (byPhone) return byPhone;
  }
  return null;
}

async function phoneTakenByOther(phone: string, contactId: string) {
  const [other] = await db.select({ id: artistContactsTable.id }).from(artistContactsTable).where(eq(artistContactsTable.phone, phone));
  return !!other && other.id !== contactId;
}

/**
 * Add a person, or fill in the gaps on the row we already have for her.
 * Never overwrites something we already know; only fills blanks.
 */
export async function upsertContact(
  input: ContactInput,
  source: "bonisa_app" | "vercel_waitlist" | "manual" | "import",
): Promise<{ outcome: "created" | "merged" | "skipped"; contact?: ArtistContact }> {
  const email = normaliseEmail(input.email);
  const phone = normaliseContactPhone(input.phone);
  if (!email && !phone) return { outcome: "skipped" };

  const existing = await findMatch(email, phone);
  if (!existing) {
    const [contact] = await db.insert(artistContactsTable).values({
      id: randomUUID(),
      name: clean(input.name) ?? "",
      email,
      phone,
      specialty: clean(input.specialty),
      location: clean(input.location),
      instagram: clean(input.instagram),
      notes: clean(input.notes, 2000),
      sources: [source],
      waitlistData: input.waitlistData ?? null,
      waitlistJoinedAt: input.waitlistJoinedAt ?? null,
    }).onConflictDoNothing().returning();
    if (contact) return { outcome: "created", contact };
    // Lost a race with a concurrent insert of the same person: merge instead.
    const raced = await findMatch(email, phone);
    if (!raced) return { outcome: "skipped" };
    return upsertInto(raced, input, email, phone, source);
  }
  return upsertInto(existing, input, email, phone, source);
}

async function upsertInto(
  existing: ArtistContact,
  input: ContactInput,
  email: string | null,
  phone: string | null,
  source: string,
): Promise<{ outcome: "merged"; contact: ArtistContact }> {
  const set: Partial<typeof artistContactsTable.$inferInsert> = { updatedAt: new Date() };
  if (!existing.name && clean(input.name)) set.name = clean(input.name)!;
  if (!existing.email && email) {
    const other = await findMatch(email, null);
    if (!other) set.email = email;
  }
  if (!existing.phone && phone && !(await phoneTakenByOther(phone, existing.id))) set.phone = phone;
  if (!existing.specialty && clean(input.specialty)) set.specialty = clean(input.specialty);
  if (!existing.location && clean(input.location)) set.location = clean(input.location);
  if (!existing.instagram && clean(input.instagram)) set.instagram = clean(input.instagram);
  if (!existing.notes && clean(input.notes, 2000)) set.notes = clean(input.notes, 2000);
  if (!existing.waitlistData && input.waitlistData) set.waitlistData = input.waitlistData;
  if (!existing.waitlistJoinedAt && input.waitlistJoinedAt) set.waitlistJoinedAt = input.waitlistJoinedAt;
  if (!existing.sources.includes(source)) set.sources = [...existing.sources, source];

  const [contact] = await db.update(artistContactsTable).set(set).where(eq(artistContactsTable.id, existing.id)).returning();
  return { outcome: "merged", contact: contact ?? existing };
}

// ---------------------------------------------------------------------------
// Bonisa app artists
// ---------------------------------------------------------------------------

interface AppArtist {
  profileId: string;
  name: string;
  email: string | null;
  phone: string | null;
  specialty: string;
  location: string;
  verificationStatus: "none" | "pending" | "verified";
  accountStatus: string;
  outstanding: OutstandingItem[];
}

/** Every artist account with what she has and has not done. Same rules as the verification queue. */
export async function loadAppArtists(): Promise<Map<string, AppArtist>> {
  const rows = await db.select({
    profileId: stylistProfilesTable.id,
    name: stylistProfilesTable.name,
    email: usersTable.email,
    phone: usersTable.phone,
    specialty: stylistProfilesTable.specialty,
    location: stylistProfilesTable.location,
    verificationStatus: stylistProfilesTable.verificationStatus,
    accountStatus: usersTable.accountStatus,
    hasIdNumber: sql<boolean>`${stylistProfilesTable.idNumber} is not null and btrim(${stylistProfilesTable.idNumber}) <> ''`,
    hasIdDocument: sql<boolean>`${stylistProfilesTable.idDocumentUrl} is not null and btrim(${stylistProfilesTable.idDocumentUrl}) <> ''`,
    hasBankDetails: sql<boolean>`exists (select 1 from bank_accounts ba where ba.stylist_profile_id = ${stylistProfilesTable.id})`,
    hasBio: sql<boolean>`${stylistProfilesTable.bio} is not null and length(btrim(${stylistProfilesTable.bio})) >= 40`,
    hasServices: sql<boolean>`exists (select 1 from services s where s.stylist_id = ${stylistProfilesTable.id})`,
    hasPortfolio: sql<boolean>`exists (select 1 from portfolio_items pi where pi.stylist_id = ${stylistProfilesTable.id})`,
  }).from(stylistProfilesTable).innerJoin(usersTable, eq(usersTable.id, stylistProfilesTable.userId));

  const artists = new Map<string, AppArtist>();
  for (const row of rows) {
    const outstanding: OutstandingItem[] = [];
    if (!row.hasIdNumber) outstanding.push("ID number");
    if (!row.hasIdDocument) outstanding.push("ID document");
    if (!row.hasBankDetails) outstanding.push("Bank details");
    if (!row.hasBio) outstanding.push("Bio");
    if (!row.hasServices) outstanding.push("Services");
    if (!row.hasPortfolio) outstanding.push("Portfolio");
    artists.set(row.profileId, {
      profileId: row.profileId,
      name: row.name,
      email: normaliseEmail(row.email),
      phone: row.phone ? normaliseContactPhone(row.phone) : null,
      specialty: row.specialty,
      location: row.location,
      verificationStatus: row.verificationStatus,
      accountStatus: row.accountStatus,
      outstanding,
    });
  }
  return artists;
}

/**
 * Make sure every Bonisa artist account is on the contact list and linked to
 * the right row, so a waitlist contact who signs up stops being "not on
 * Bonisa yet" without anyone touching anything.
 */
export async function syncAppArtists(): Promise<Map<string, AppArtist>> {
  const artists = await loadAppArtists();
  const contacts = await db.select().from(artistContactsTable);
  const linked = new Set(contacts.map((c) => c.stylistProfileId).filter(Boolean));

  for (const artist of artists.values()) {
    if (linked.has(artist.profileId)) continue;
    const match = contacts.find((c) => !c.stylistProfileId && (
      (artist.email && c.email === artist.email) || (artist.phone && c.phone === artist.phone)
    ));
    if (match) {
      const merged = await upsertInto(match, { name: artist.name, email: artist.email, phone: artist.phone, specialty: artist.specialty, location: artist.location }, artist.email, artist.phone, "bonisa_app");
      await db.update(artistContactsTable).set({ stylistProfileId: artist.profileId }).where(eq(artistContactsTable.id, merged.contact.id));
      match.stylistProfileId = artist.profileId;
      continue;
    }
    const result = await upsertContact({
      name: artist.name, email: artist.email, phone: artist.phone, specialty: artist.specialty, location: artist.location,
    }, "bonisa_app");
    if (result.contact && !result.contact.stylistProfileId) {
      await db.update(artistContactsTable).set({ stylistProfileId: artist.profileId }).where(eq(artistContactsTable.id, result.contact.id));
    }
  }
  return artists;
}

// ---------------------------------------------------------------------------
// Where each person is up to
// ---------------------------------------------------------------------------

export interface ContactStatus {
  stage: ContactStage;
  missing: string[];
  reachable: boolean;
}

export function contactStatus(contact: ArtistContact, artists: Map<string, AppArtist>): ContactStatus {
  const reachable = !!(contact.email || contact.phone);
  const artist = contact.stylistProfileId ? artists.get(contact.stylistProfileId) : undefined;
  if (!artist) return { stage: "not_on_app", missing: ["Bonisa account"], reachable };
  if (artist.accountStatus === "suspended") return { stage: "suspended", missing: [], reachable };
  if (artist.verificationStatus === "verified") return { stage: "live", missing: [], reachable };
  if (artist.verificationStatus === "pending") return { stage: "waiting_review", missing: [], reachable };
  return {
    stage: "finishing_profile",
    missing: artist.outstanding.length ? artist.outstanding : ["Submit for verification"],
    reachable,
  };
}

function remindersInStage(contact: ArtistContact, stage: ContactStage) {
  return contact.reminderStage === stage ? contact.remindersSent : 0;
}

export function nextReminderAt(contact: ArtistContact, status: ContactStatus): Date | null {
  if (!STAGES_NEEDING_ACTION.includes(status.stage) || !status.reachable || contact.remindersPaused) return null;
  if (remindersInStage(contact, status.stage) >= MAX_REMINDERS_PER_STAGE) return null;
  const since = contact.reminderStage === status.stage
    ? contact.lastRemindedAt ?? contact.stageSince ?? contact.createdAt
    : new Date();
  return new Date(since.getTime() + REMINDER_INTERVAL_DAYS * DAY_MS);
}

export function needsPersonalFollowUp(contact: ArtistContact, status: ContactStatus) {
  if (!STAGES_NEEDING_ACTION.includes(status.stage)) return false;
  return !status.reachable || remindersInStage(contact, status.stage) >= MAX_REMINDERS_PER_STAGE;
}

/**
 * Record stage changes, so reminder counting restarts when she moves on.
 * Called on every sync; cheap because it only writes rows that changed.
 */
async function trackStages(contacts: ArtistContact[], artists: Map<string, AppArtist>) {
  for (const contact of contacts) {
    const { stage } = contactStatus(contact, artists);
    if (contact.reminderStage === stage) continue;
    const now = new Date();
    await db.update(artistContactsTable)
      .set({ reminderStage: stage, stageSince: now, remindersSent: 0, lastRemindedAt: null })
      .where(eq(artistContactsTable.id, contact.id));
    Object.assign(contact, { reminderStage: stage, stageSince: now, remindersSent: 0, lastRemindedAt: null });
  }
}

/** One call that brings the whole list up to date. */
export async function refreshContacts() {
  const artists = await syncAppArtists();
  const contacts = await db.select().from(artistContactsTable);
  await trackStages(contacts, artists);
  return { artists, contacts };
}

// ---------------------------------------------------------------------------
// Reminder wording
// ---------------------------------------------------------------------------

export function buildReminder(contact: ArtistContact, status: ContactStatus): { subject: string; body: string; reason: string } | null {
  const first = contact.name.trim().split(/\s+/)[0] || "there";
  const url = appUrl();

  if (status.stage === "not_on_app") {
    const fromWaitlist = contact.sources.includes("vercel_waitlist");
    const signUpWith = contact.email ? `this email address (${contact.email})` : "this phone number";
    return {
      reason: "Not on Bonisa yet",
      subject: `${first}, your Bonisa artist profile is waiting`,
      body:
        `Hi ${first},\n\n` +
        (fromWaitlist
          ? "Thank you for joining the Bonisa waitlist. Bonisa is open to artists now, and your next step is to create your free artist profile:\n"
          : "Thank you for your interest in Bonisa. Your next step is to create your free artist profile:\n") +
        `${url}/signup\n\n` +
        `Please sign up with ${signUpWith} so we can match you to your spot.\n\n` +
        "It helps to have these ready:\n" +
        Object.values(ITEM_HINTS).map((hint) => `  - ${hint[0]!.toUpperCase()}${hint.slice(1)}`).join("\n") +
        "\n\nOnly verified artists appear on Bonisa, and we review every complete profile within 72 hours.",
    };
  }

  if (status.stage === "finishing_profile") {
    const onlySubmit = status.missing.length === 1 && status.missing[0] === "Submit for verification";
    return {
      reason: onlySubmit ? "Profile complete, not submitted" : `Missing: ${status.missing.join(", ")}`,
      subject: `${first}, you are nearly live on Bonisa`,
      body: onlySubmit
        ? `Hi ${first},\n\nEverything on your Bonisa profile is filled in. The last step is to tap Submit for verification:\n${url}/profile\n\nWe review every profile within 72 hours, and then clients can find and book you.`
        : `Hi ${first},\n\nYour Bonisa profile is almost ready. Clients can only find and book verified artists, so these are the last things we need:\n` +
          status.missing.map((item) => `  - ${item}: ${ITEM_HINTS[item] ?? item}`).join("\n") +
          `\n\nAdd them here, then tap Submit for verification:\n${url}/profile`,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

/**
 * Send one reminder now and log it. Claims the slot first, so two runs can
 * never send the same reminder twice.
 */
export async function sendReminder(
  contact: ArtistContact,
  status: ContactStatus,
  kind: "auto_reminder" | "manual_reminder",
  sentByUserId: string | null,
) {
  const reminder = buildReminder(contact, status);
  if (!reminder || !status.reachable) return null;

  const sentSoFar = remindersInStage(contact, status.stage);
  const [claimed] = await db.update(artistContactsTable)
    .set({ reminderStage: status.stage, remindersSent: sentSoFar + 1, lastRemindedAt: new Date(), updatedAt: new Date() })
    .where(and(
      eq(artistContactsTable.id, contact.id),
      eq(artistContactsTable.remindersSent, contact.remindersSent),
      contact.reminderStage === null
        ? sql`${artistContactsTable.reminderStage} is null`
        : eq(artistContactsTable.reminderStage, contact.reminderStage),
    ))
    .returning({ id: artistContactsTable.id });
  if (!claimed) return null;

  const channels = await notify(
    { email: contact.email, phone: contact.phone, name: contact.name },
    "artist.reminder",
    { artistName: contact.name, updateSubject: reminder.subject, updateBody: reminder.body },
  );
  // Nothing reached her (no provider set up, or every send failed): log the
  // attempt so the owner can see it, but do not use up one of her reminders.
  if (channels.length === 0) {
    await db.update(artistContactsTable)
      .set({ remindersSent: sentSoFar })
      .where(eq(artistContactsTable.id, contact.id));
  }

  const [message] = await db.insert(artistContactMessagesTable).values({
    id: randomUUID(),
    contactId: contact.id,
    kind,
    reason: reminder.reason,
    subject: reminder.subject,
    body: reminder.body,
    channels,
    sentByUserId,
  }).returning();
  return message;
}

/**
 * Everyone who is owed a reminder right now. With skipFirstWait, people who
 * have not been reminded yet are included straight away instead of after
 * their first 3 days; anyone reminded in the last 3 days is still left alone.
 */
export async function dueContacts(skipFirstWait = false) {
  const { artists, contacts } = await refreshContacts();
  const now = Date.now();
  return contacts.flatMap((contact) => {
    const status = contactStatus(contact, artists);
    const next = nextReminderAt(contact, status);
    if (!next) return [];
    const neverReminded = !contact.lastRemindedAt;
    if (next.getTime() > now && !(skipFirstWait && neverReminded)) return [];
    return [{ contact, status }];
  });
}

export function deliveryConfigured() {
  const email = !!(process.env["RESEND_API_KEY"] && process.env["EMAIL_FROM"]);
  const whatsapp = !!(process.env["TWILIO_ACCOUNT_SID"] && process.env["TWILIO_AUTH_TOKEN"] && process.env["TWILIO_WHATSAPP_FROM"]);
  return { email, whatsapp };
}

export async function getAutoRemindersEnabled(): Promise<boolean> {
  const [row] = await db.select().from(ownerSettingsTable).where(eq(ownerSettingsTable.key, "autoReminders"));
  return (row?.value as { enabled?: boolean } | undefined)?.enabled === true;
}

export async function setAutoRemindersEnabled(enabled: boolean) {
  await db.insert(ownerSettingsTable).values({ key: "autoReminders", value: { enabled } })
    .onConflictDoUpdate({ target: ownerSettingsTable.key, set: { value: { enabled }, updatedAt: new Date() } });
}

async function runAutoReminders() {
  const { email, whatsapp } = deliveryConfigured();
  if (!(await getAutoRemindersEnabled()) || (!email && !whatsapp)) {
    await refreshContacts();
    return;
  }
  const due = await dueContacts();
  let sent = 0;
  for (const { contact, status } of due) {
    try {
      const message = await sendReminder(contact, status, "auto_reminder", null);
      if (message && message.channels.length > 0) sent++;
    } catch (err) {
      logger.warn({ err, contactId: contact.id }, "Automatic reminder failed");
    }
  }
  if (sent) logger.info({ sent }, "Automatic artist reminders sent");
}

export function startArtistReminderJob() {
  const run = () => runAutoReminders().catch((err) => logger.error({ err }, "Artist reminder job failed"));
  setTimeout(run, 60 * 1000);
  setInterval(run, 60 * 60 * 1000);
  logger.info({ intervalDays: REMINDER_INTERVAL_DAYS, maxPerStage: MAX_REMINDERS_PER_STAGE }, "Artist reminder job scheduled");
}
