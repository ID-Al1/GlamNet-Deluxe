/**
 * Artist contacts: the owner's single list of every would-be artist.
 *
 * Owner:
 *   GET   /owner/contacts                   — everyone, with stage, what is missing and reminder state
 *   POST  /owner/contacts                   — add someone by hand
 *   POST  /owner/contacts/import            — import a waitlist export or spreadsheet (500 rows per call)
 *   GET   /owner/contacts/settings          — automatic reminders on or off, and what is configured
 *   PUT   /owner/contacts/settings
 *   POST  /owner/contacts/remind-due        — remind everyone due, skipping the first 3-day wait
 *   PATCH /owner/contacts/:contactId        — edit details or pause reminders
 *   GET   /owner/contacts/:contactId/timeline — every message she has been sent, and the next one
 *   POST  /owner/contacts/:contactId/remind — send her reminder now
 *   POST  /owner/contacts/:contactId/email/preview — what a branded email would look like for her
 *   POST  /owner/contacts/:contactId/email  — send her a branded email
 *   POST  /owner/contacts/email-bulk        — send a branded email to several people
 *
 * Integration:
 *   POST  /integrations/waitlist            — Supabase database webhook from the Vercel waitlist
 *
 * The rules themselves live in lib/artist-contacts.ts.
 */
import { Router } from "express";
import { randomUUID, timingSafeEqual } from "crypto";
import { and, desc, eq, ne } from "drizzle-orm";
import {
  artistContactMessagesTable,
  artistContactsTable,
  artistUpdateRecipientsTable,
  artistUpdatesTable,
  db,
  type ArtistContact,
} from "@workspace/db";
import {
  CreateArtistContactBody,
  EmailArtistContactBody,
  EmailArtistContactsBody,
  ImportArtistContactsBody,
  UpdateArtistContactBody,
  UpdateArtistContactSettingsBody,
} from "@workspace/api-zod";
import { requireOwner } from "../lib/auth";
import { param } from "../lib/params";
import { logger } from "../lib/logger";
import { sendBrandedEmail } from "../lib/notifications";
import { EMAIL_TEMPLATES, renderEmail, templateAllowed, type EmailTemplateId } from "../lib/email-templates";
import {
  MAX_REMINDERS_PER_STAGE,
  REMINDER_INTERVAL_DAYS,
  buildReminder,
  contactStatus,
  deliveryConfigured,
  dueContacts,
  getAutoRemindersEnabled,
  mapWaitlistRecord,
  needsPersonalFollowUp,
  nextReminderAt,
  normaliseContactPhone,
  normaliseEmail,
  refreshContacts,
  sendReminder,
  setAutoRemindersEnabled,
  upsertContact,
} from "../lib/artist-contacts";

const router = Router();

type Artists = Awaited<ReturnType<typeof refreshContacts>>["artists"];

function present(contact: ArtistContact, artists: Artists) {
  const status = contactStatus(contact, artists);
  const next = nextReminderAt(contact, status);
  const sentInStage = contact.reminderStage === status.stage ? contact.remindersSent : 0;
  return {
    id: contact.id,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    specialty: contact.specialty,
    location: contact.location,
    instagram: contact.instagram,
    notes: contact.notes,
    sources: contact.sources,
    stage: status.stage,
    missing: status.missing,
    reachable: status.reachable,
    remindersPaused: contact.remindersPaused,
    remindersSent: sentInStage,
    lastRemindedAt: contact.lastRemindedAt?.toISOString() ?? null,
    nextReminderAt: next?.toISOString() ?? null,
    needsPersonalFollowUp: needsPersonalFollowUp(contact, status),
    profileId: contact.stylistProfileId,
    waitlistJoinedAt: contact.waitlistJoinedAt?.toISOString() ?? null,
    createdAt: contact.createdAt.toISOString(),
  };
}

async function presentOne(contactId: string) {
  const { artists, contacts } = await refreshContacts();
  const contact = contacts.find((c) => c.id === contactId);
  return contact ? present(contact, artists) : null;
}

router.get("/owner/contacts", requireOwner, async (_req, res) => {
  const { artists, contacts } = await refreshContacts();
  contacts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || a.id.localeCompare(b.id));
  res.json(contacts.map((c) => present(c, artists)));
});

router.post("/owner/contacts", requireOwner, async (req, res) => {
  const parsed = CreateArtistContactBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Check the details and try again." }); return; }
  const email = parsed.data.email?.trim() ? normaliseEmail(parsed.data.email) : null;
  const phone = parsed.data.phone?.trim() ? normaliseContactPhone(parsed.data.phone) : null;
  if (parsed.data.email?.trim() && !email) { res.status(400).json({ error: "That email address does not look right." }); return; }
  if (parsed.data.phone?.trim() && !phone) { res.status(400).json({ error: "That phone number does not look right. Use a format like 082 123 4567." }); return; }
  if (!email && !phone) { res.status(400).json({ error: "Add an email address or a phone number, so there is a way to reach her." }); return; }

  const result = await upsertContact({ ...parsed.data, email, phone }, "manual");
  if (!result.contact) { res.status(400).json({ error: "Could not add this contact." }); return; }
  res.status(201).json(await presentOne(result.contact.id));
});

router.post("/owner/contacts/import", requireOwner, async (req, res) => {
  const parsed = ImportArtistContactsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Nothing to import. Send between 1 and 500 rows." }); return; }
  const totals = { created: 0, merged: 0, skipped: 0 };
  for (const row of parsed.data.rows) {
    const result = await upsertContact(mapWaitlistRecord(row as Record<string, unknown>), parsed.data.source);
    totals[result.outcome]++;
  }
  res.json(totals);
});

async function settingsResponse() {
  return {
    autoRemindersEnabled: await getAutoRemindersEnabled(),
    reminderIntervalDays: REMINDER_INTERVAL_DAYS,
    maxRemindersPerStage: MAX_REMINDERS_PER_STAGE,
    waitlistWebhookConfigured: !!process.env["WAITLIST_WEBHOOK_SECRET"],
    emailConfigured: deliveryConfigured().email,
    whatsappConfigured: deliveryConfigured().whatsapp,
  };
}

router.get("/owner/contacts/settings", requireOwner, async (_req, res) => {
  res.json(await settingsResponse());
});

router.put("/owner/contacts/settings", requireOwner, async (req, res) => {
  const parsed = UpdateArtistContactSettingsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid settings" }); return; }
  await setAutoRemindersEnabled(parsed.data.autoRemindersEnabled);
  res.json(await settingsResponse());
});

router.post("/owner/contacts/remind-due", requireOwner, async (req, res) => {
  const owner = (req as any).user;
  const due = await dueContacts(true);
  let sent = 0;
  for (const { contact, status } of due) {
    try {
      const message = await sendReminder(contact, status, "manual_reminder", owner.id);
      if (message && message.channels.length > 0) sent++;
    } catch (err) {
      logger.warn({ err, contactId: contact.id }, "Reminder failed");
    }
  }
  res.json({ sent });
});

router.patch("/owner/contacts/:contactId", requireOwner, async (req, res) => {
  const contactId = param(req.params.contactId);
  const parsed = UpdateArtistContactBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Check the details and try again." }); return; }
  const [existing] = await db.select().from(artistContactsTable).where(eq(artistContactsTable.id, contactId));
  if (!existing) { res.status(404).json({ error: "Contact not found" }); return; }

  const data = parsed.data;
  const set: Partial<typeof artistContactsTable.$inferInsert> = { updatedAt: new Date() };
  if (data.name !== undefined) set.name = data.name.trim();
  for (const field of ["specialty", "location", "instagram", "notes"] as const) {
    if (data[field] !== undefined) set[field] = data[field]?.trim() || null;
  }
  if (data.remindersPaused !== undefined) set.remindersPaused = data.remindersPaused;
  if (data.email !== undefined) {
    const email = data.email?.trim() ? normaliseEmail(data.email) : null;
    if (data.email?.trim() && !email) { res.status(400).json({ error: "That email address does not look right." }); return; }
    if (email) {
      const [other] = await db.select({ id: artistContactsTable.id }).from(artistContactsTable)
        .where(and(eq(artistContactsTable.email, email), ne(artistContactsTable.id, contactId)));
      if (other) { res.status(409).json({ error: "Someone else on the list already has that email address." }); return; }
    }
    set.email = email;
  }
  if (data.phone !== undefined) {
    const phone = data.phone?.trim() ? normaliseContactPhone(data.phone) : null;
    if (data.phone?.trim() && !phone) { res.status(400).json({ error: "That phone number does not look right." }); return; }
    if (phone) {
      const [other] = await db.select({ id: artistContactsTable.id }).from(artistContactsTable)
        .where(and(eq(artistContactsTable.phone, phone), ne(artistContactsTable.id, contactId)));
      if (other) { res.status(409).json({ error: "Someone else on the list already has that phone number." }); return; }
    }
    set.phone = phone;
  }

  await db.update(artistContactsTable).set(set).where(eq(artistContactsTable.id, contactId));
  res.json(await presentOne(contactId));
});

router.get("/owner/contacts/:contactId/timeline", requireOwner, async (req, res) => {
  const contactId = param(req.params.contactId);
  const { artists, contacts } = await refreshContacts();
  const contact = contacts.find((c) => c.id === contactId);
  if (!contact) { res.status(404).json({ error: "Contact not found" }); return; }

  const reminders = await db.select().from(artistContactMessagesTable)
    .where(eq(artistContactMessagesTable.contactId, contactId))
    .orderBy(desc(artistContactMessagesTable.createdAt));

  // Updates sent from the Artist Updates screen also belong in her history.
  const updates = contact.stylistProfileId
    ? await db.select({
        id: artistUpdateRecipientsTable.id,
        subject: artistUpdateRecipientsTable.subject,
        body: artistUpdateRecipientsTable.body,
        createdAt: artistUpdateRecipientsTable.createdAt,
        audienceSummary: artistUpdatesTable.audienceSummary,
        sendExternally: artistUpdatesTable.sendExternally,
      }).from(artistUpdateRecipientsTable)
        .innerJoin(artistUpdatesTable, eq(artistUpdatesTable.id, artistUpdateRecipientsTable.updateId))
        .where(eq(artistUpdateRecipientsTable.stylistProfileId, contact.stylistProfileId))
    : [];

  const messages = [
    ...reminders.map((m) => ({
      id: m.id, kind: m.kind, reason: m.reason, subject: m.subject, body: m.body, channels: m.channels, createdAt: m.createdAt,
    })),
    ...updates.map((u) => ({
      id: u.id,
      kind: "update",
      reason: `Artist update to: ${u.audienceSummary}`,
      subject: u.subject,
      body: u.body,
      channels: u.sendExternally ? ["app", "email", "whatsapp"] : ["app"],
      createdAt: u.createdAt,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }));

  const status = contactStatus(contact, artists);
  const next = buildReminder(contact, status);
  res.json({ messages, nextReminder: next && status.reachable ? next : null });
});

router.post("/owner/contacts/:contactId/remind", requireOwner, async (req, res) => {
  const owner = (req as any).user;
  const contactId = param(req.params.contactId);
  const { artists, contacts } = await refreshContacts();
  const contact = contacts.find((c) => c.id === contactId);
  if (!contact) { res.status(404).json({ error: "Contact not found" }); return; }
  const status = contactStatus(contact, artists);
  if (!status.reachable) { res.status(409).json({ error: "There is no email or phone number for her yet." }); return; }
  if (!buildReminder(contact, status)) { res.status(409).json({ error: "She has nothing left to do, so there is nothing to remind her about." }); return; }
  const message = await sendReminder(contact, status, "manual_reminder", owner.id);
  if (!message) { res.status(409).json({ error: "A reminder was just sent. Refresh and try again." }); return; }
  res.json({ ...message, createdAt: message.createdAt.toISOString() });
});

// ---------------------------------------------------------------------------
// Branded emails (see lib/email-templates.ts)
// ---------------------------------------------------------------------------

function emailFor(contact: ArtistContact, artists: Artists, template: EmailTemplateId, subject?: string, body?: string) {
  const status = contactStatus(contact, artists);
  if (!templateAllowed(template, status.stage)) {
    return { error: `"${EMAIL_TEMPLATES[template].label}" does not fit someone who is ${status.stage.replace(/_/g, " ")}.` } as const;
  }
  if (template === "custom" && !body?.trim()) return { error: "Write the message first." } as const;
  const email = renderEmail(template, {
    name: contact.name,
    email: contact.email,
    stage: status.stage,
    missing: status.missing,
    fromWaitlist: contact.sources.includes("vercel_waitlist"),
    customSubject: subject,
    customBody: body,
  });
  return { email } as const;
}

async function sendAndLog(contact: ArtistContact, template: EmailTemplateId, email: ReturnType<typeof renderEmail>, sentByUserId: string) {
  const delivered = contact.email ? await sendBrandedEmail(contact.email, email) : false;
  const [message] = await db.insert(artistContactMessagesTable).values({
    id: randomUUID(),
    contactId: contact.id,
    kind: "email",
    reason: `Email: ${EMAIL_TEMPLATES[template].label}`,
    subject: email.subject,
    body: email.text,
    channels: delivered ? ["email"] : [],
    sentByUserId,
  }).returning();
  return message!;
}

router.post("/owner/contacts/email-bulk", requireOwner, async (req, res) => {
  const owner = (req as any).user;
  const parsed = EmailArtistContactsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Choose an email and at least one person." }); return; }
  if (parsed.data.template === "custom" && !parsed.data.body?.trim()) { res.status(400).json({ error: "Write the message first." }); return; }
  const { artists, contacts } = await refreshContacts();
  const wanted = new Set(parsed.data.contactIds);
  const result = { sent: 0, notDelivered: 0, skipped: 0 };
  for (const contact of contacts.filter((c) => wanted.has(c.id))) {
    const built = emailFor(contact, artists, parsed.data.template, parsed.data.subject, parsed.data.body);
    if ("error" in built || !contact.email) { result.skipped++; continue; }
    try {
      const message = await sendAndLog(contact, parsed.data.template, built.email, owner.id);
      if (message.channels.length) result.sent++;
      else result.notDelivered++;
    } catch (err) {
      logger.warn({ err, contactId: contact.id }, "Branded email failed");
      result.notDelivered++;
    }
  }
  result.skipped += wanted.size - contacts.filter((c) => wanted.has(c.id)).length;
  res.json(result);
});

router.post("/owner/contacts/:contactId/email/preview", requireOwner, async (req, res) => {
  const parsed = EmailArtistContactBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Choose an email." }); return; }
  const { artists, contacts } = await refreshContacts();
  const contact = contacts.find((c) => c.id === param(req.params.contactId));
  if (!contact) { res.status(404).json({ error: "Contact not found" }); return; }
  const built = emailFor(contact, artists, parsed.data.template, parsed.data.subject, parsed.data.body);
  if ("error" in built) { res.status(400).json({ error: built.error }); return; }
  res.json(built.email);
});

router.post("/owner/contacts/:contactId/email", requireOwner, async (req, res) => {
  const owner = (req as any).user;
  const parsed = EmailArtistContactBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Choose an email." }); return; }
  const { artists, contacts } = await refreshContacts();
  const contact = contacts.find((c) => c.id === param(req.params.contactId));
  if (!contact) { res.status(404).json({ error: "Contact not found" }); return; }
  if (!contact.email) { res.status(409).json({ error: "There is no email address for her yet. Add one under Details." }); return; }
  const built = emailFor(contact, artists, parsed.data.template, parsed.data.subject, parsed.data.body);
  if ("error" in built) { res.status(400).json({ error: built.error }); return; }
  const message = await sendAndLog(contact, parsed.data.template, built.email, owner.id);
  res.json({ ...message, createdAt: message.createdAt.toISOString() });
});

// ---------------------------------------------------------------------------
// Vercel waitlist (Supabase database webhook)
// ---------------------------------------------------------------------------

function secretMatches(provided: string | undefined, expected: string) {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

router.post("/integrations/waitlist", async (req, res) => {
  const expected = process.env["WAITLIST_WEBHOOK_SECRET"];
  if (!expected) { res.status(401).json({ error: "Waitlist integration is not configured" }); return; }
  const header = req.headers["x-bonisa-secret"];
  const bearer = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : undefined;
  if (!secretMatches(typeof header === "string" ? header : bearer, expected)) {
    res.status(401).json({ error: "Invalid secret" });
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  // Supabase sends { type: "INSERT" | "UPDATE" | "DELETE", table, record, old_record }.
  if (body.type === "DELETE") { res.json({ outcome: "ignored" }); return; }
  const record = body.record && typeof body.record === "object" ? body.record as Record<string, unknown> : body;

  const result = await upsertContact(mapWaitlistRecord(record), "vercel_waitlist");
  logger.info({ outcome: result.outcome }, "Waitlist sign-up received");
  res.json({ outcome: result.outcome });
});

export default router;
