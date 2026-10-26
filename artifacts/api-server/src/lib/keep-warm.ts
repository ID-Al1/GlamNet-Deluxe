/**
 * Keep warm: how Bonisa stays close to the first 50 artists while the live payment side is finished.
 *
 * Artists leave a long wait when nothing happens and nobody says when. So there is a short, honest
 * sequence of messages, timed from the day the Founding 50 cards went out (Day 0), and a "gone quiet"
 * list that shows who has not heard from you or spoken to you lately.
 *
 * Each step has a WhatsApp version (to post in the group) and an email version (sent from here to
 * everyone with an email address). The owner can edit any wording, and a step with an unfilled
 * [bracket] will not send, so a half-written message can never go out by accident.
 * Automatic sending is off until the owner switches it on.
 */
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { artistContactMessagesTable, artistContactsTable, db, ownerSettingsTable, type ArtistContact } from "@workspace/db";
import { contactStatus, deliveryConfigured, refreshContacts } from "./artist-contacts";
import { renderEmail } from "./email-templates";
import { sendBrandedEmail } from "./notifications";
import { logger } from "./logger";

export interface KeepWarmStep {
  key: string;
  day: number;
  title: string;
  why: string;
  subject: string;
  /** Email body. The greeting ("Hi Name") is added by the Bonisa email layout. */
  body: string;
  /** The same message for the WhatsApp group. */
  whatsapp: string;
}

export const DEFAULT_STEPS: KeepWarmStep[] = [
  {
    key: "thanks", day: 0, title: "Thank you and the invite card",
    why: "Already sent with the cards. Kept here so the whole plan is in one place.",
    subject: "Thank you for being part of the Founding 50",
    body: "Thank you for being here before Bonisa is even live. You believed in this when it was only an idea, and that means a lot.\n\nWe are taking our time to build it properly, and our goal is our first 50 beauty professionals. If you know someone who would benefit, please share the invite with them, or send us their name and WhatsApp number and we will reach out.\n\nEvery share gets us closer. Thank you for building this with us.",
    whatsapp: "Hi Founding 50 family,\n\nThank you for being here before Bonisa is even live. You believed in this when it was only an idea, and that means a lot.\n\nWe're taking our time to build it properly, and our goal is our first 50 beauty professionals.\n\nIf you can help us get there:\n1. Forward the invite card to anyone in your circle who would benefit.\n2. Send them this group link, so they can join us here and we can all get acquainted: [group link]\n3. Tell us one thing that would make Bonisa work for you.\n\nEvery share gets us closer. Thank you for building this with us.\n\nBonisa",
  },
  {
    key: "nudge", day: 3, title: "A gentle nudge",
    why: "A few days on, thank the people who shared and ask once more. Keep it short.",
    subject: "A quick thank you from Bonisa",
    body: "A quick check-in from Bonisa. Thank you to everyone who has already shared the invite, it is making a real difference.\n\nWe are still building toward our first 50 beauty professionals. If there is someone in your circle who would benefit, whether makeup, hair, nails, lashes, brows or something else, please pass the invite on.\n\nAnd if you have not yet, tell us one thing that would make Bonisa work for you. We read every reply.",
    whatsapp: "Hi family, a quick check-in from Bonisa. Thank you to everyone who has already shared the invite, it's making a real difference.\n\nWe're still building toward our first 50 beauty professionals. If there's someone in your circle who would benefit, whether makeup, hair, nails, lashes, brows or something else, send them the group link: [group link]\n\nAnd if you haven't yet, tell us one thing that would make Bonisa work for you. We read every reply.\n\nThank you for being part of this.\n\nBonisa",
  },
  {
    key: "ready", day: 7, title: "Get ready, so you go live fast",
    why: "Gives everyone something to do. Artists who prepare now go live in days, not weeks. Send the readiness checklist PDF with it.",
    subject: "Get ready for Bonisa in 15 minutes",
    body: "Here is something you can do now, so that when we open you are live within days.\n\nGet these ready: your South African ID, five of your best photos, your services and prices, and the days you work. The attached checklist has everything on one page.\n\nProfiles are checked within 2 to 3 days after you submit. The artists who are ready first are the first people clients will see.",
    whatsapp: "Hi family, something you can do now so you're live fast when we open: get your profile pieces ready.\n\nYou'll need: your South African ID, 5 of your best photos, your services and prices, and the days you work. The checklist attached has it all on one page.\n\nWe check profiles within 2 to 3 days after you submit, and the artists who are ready first are the first clients will see.\n\nBonisa",
  },
  {
    key: "progress", day: 10, title: "Where we are, honestly",
    why: "Real news builds trust. Fill in the numbers. Say plainly what is still pending.",
    subject: "Where Bonisa is right now",
    body: "A short, honest update from us.\n\nWe now have [X] of our first 50 founding members. We are currently finishing and testing how payments work, so that your money is protected from the first booking. Until that is done, we cannot open to clients, and we would rather take a little longer than get it wrong.\n\nWe will tell you as soon as we have a date. In the meantime, the best help is the same: share the invite, and get your profile pieces ready.",
    whatsapp: "Hi family, a short and honest update from Bonisa.\n\nWe now have [X] of our first 50 founding members. We're finishing and testing how payments work, so your money is protected from the very first booking. Until that's done we can't open to clients, and we'd rather take a little longer than get it wrong.\n\nWe'll share a date as soon as we have one. Meanwhile, the best help is the same: share the invite, and get your profile pieces ready.\n\nBonisa",
  },
  {
    key: "spotlight", day: 14, title: "Founding artist spotlight and ask for names",
    why: "Show a real founding artist (with her permission). Pride and a little friendly competition keep people engaged.",
    subject: "Meet one of our founding artists",
    body: "We would like you to meet [artist name], one of our founding [speciality] artists in [area]. [One or two lines about her work and why she joined.]\n\nShe is one of the first people to help us build Bonisa, and she is an example of the artists we want to bring in. If you know someone like her, please send us their name and WhatsApp number and we will reach out.",
    whatsapp: "Hi family, meet [artist name], one of our founding [speciality] artists in [area]. [One or two lines about her work and why she joined.]\n\nShe's one of the first people helping us build Bonisa. If you know someone like her, send me their name and WhatsApp number and I'll reach out.\n\nBonisa",
  },
  {
    key: "date", day: 21, title: "The plan and the date",
    why: "By now they need a real timeline. Give your best honest estimate, even a month.",
    subject: "When Bonisa opens",
    body: "Thank you for your patience. Here is where we are, and what comes next.\n\nWe plan to open to clients in [month]. Founding artists will be the first to go live, and we will verify profiles as they come in. If the date moves, we will tell you straight away and say why.\n\nBefore then, please have your profile pieces ready (ID, five photos, services and prices, working days).",
    whatsapp: "Hi family, thank you for your patience. Here's where we are.\n\nWe plan to open to clients in [month]. Founding artists will be the first to go live, and we'll verify profiles as they come in. If the date moves, we'll tell you straight away and say why.\n\nBefore then, please have your profile pieces ready (ID, 5 photos, services and prices, working days).\n\nBonisa",
  },
  {
    key: "badge", day: 28, title: "Your Founding Artist badge",
    why: "Recognition is free and meaningful. Announce it, so people feel their wait counts for something.",
    subject: "Your Founding Artist badge",
    body: "As a thank you for being here from the start, founding artists will carry a Founding Artist badge on their Bonisa profile. It shows clients and brands that you were one of the first.\n\nTo receive it, create your profile and submit it for verification. We will add the badge when you go live.",
    whatsapp: "Hi family, a thank you for being here from the start: founding artists will carry a Founding Artist badge on their Bonisa profile. It shows clients and brands that you were one of the first.\n\nTo receive it, create your profile and submit it for verification. We'll add the badge when you go live.\n\nBonisa",
  },
];

interface StepState { subject?: string; body?: string; whatsapp?: string; emailSentAt?: string; emailCount?: number; postedAt?: string }
interface Stored { startDate?: string; auto?: boolean; groupLink?: string; steps?: Record<string, StepState> }

const DAY_MS = 86_400_000;
const KEY = "keepWarm";
const saDate = (d: Date) => new Date(d.getTime() + 2 * 3_600_000).toISOString().slice(0, 10);

async function load(): Promise<Stored> {
  const [row] = await db.select().from(ownerSettingsTable).where(eq(ownerSettingsTable.key, KEY));
  return (row?.value as Stored | undefined) ?? {};
}
async function save(value: Stored) {
  await db.insert(ownerSettingsTable).values({ key: KEY, value })
    .onConflictDoUpdate({ target: ownerSettingsTable.key, set: { value, updatedAt: new Date() } });
}

/** Any [bracket] left in a message means the owner has not filled something in yet. */
export const unfilled = (text: string) => /\[[^\]]+\]/.test(text);

export async function getPlan(now: Date = new Date()) {
  const stored = await load();
  const startDate = stored.startDate ?? saDate(now);
  const start = Date.parse(`${startDate}T00:00:00+02:00`);
  const today = Date.parse(`${saDate(now)}T00:00:00+02:00`);
  const steps = DEFAULT_STEPS.map((d) => {
    const s = stored.steps?.[d.key] ?? {};
    const dueDate = saDate(new Date(start + d.day * DAY_MS + 12 * 3_600_000));
    const dueMs = Date.parse(`${dueDate}T00:00:00+02:00`);
    const done = !!(s.emailSentAt || s.postedAt);
    // The group link is set once and dropped into every message that asks for it.
    const fill = (t: string) => (stored.groupLink ? t.replace(/\[group link\]/gi, stored.groupLink) : t);
    const subject = fill(s.subject ?? d.subject), body = fill(s.body ?? d.body), whatsapp = fill(s.whatsapp ?? d.whatsapp);
    return {
      key: d.key, day: d.day, title: d.title, why: d.why, dueDate,
      status: (done ? "done" : dueMs <= today ? "due" : "upcoming") as "done" | "due" | "upcoming",
      daysUntil: Math.round((dueMs - today) / DAY_MS),
      subject, body, whatsapp,
      emailSentAt: s.emailSentAt ?? null, emailCount: s.emailCount ?? 0, postedAt: s.postedAt ?? null,
      needsFilling: unfilled(subject) || unfilled(body),
      whatsappNeedsFilling: unfilled(whatsapp),
    };
  });
  return { startDate, auto: stored.auto === true, started: !!stored.startDate, groupLink: stored.groupLink ?? "", steps };
}

export async function updateSettings(input: { startDate?: string; auto?: boolean; groupLink?: string }) {
  const stored = await load();
  if (input.startDate !== undefined) stored.startDate = input.startDate;
  if (input.auto !== undefined) stored.auto = input.auto;
  if (input.groupLink !== undefined) stored.groupLink = input.groupLink || undefined;
  if (!stored.startDate) stored.startDate = saDate(new Date());
  await save(stored);
}

export async function editStep(key: string, input: { subject?: string; body?: string; whatsapp?: string }) {
  if (!DEFAULT_STEPS.some((s) => s.key === key)) return false;
  const stored = await load();
  stored.steps = stored.steps ?? {};
  stored.steps[key] = { ...stored.steps[key], ...(input.subject !== undefined ? { subject: input.subject } : {}), ...(input.body !== undefined ? { body: input.body } : {}), ...(input.whatsapp !== undefined ? { whatsapp: input.whatsapp } : {}) };
  if (!stored.startDate) stored.startDate = saDate(new Date());
  await save(stored);
  return true;
}

export async function markPosted(key: string) {
  if (!DEFAULT_STEPS.some((s) => s.key === key)) return false;
  const stored = await load();
  stored.steps = stored.steps ?? {};
  stored.steps[key] = { ...stored.steps[key], postedAt: new Date().toISOString() };
  if (!stored.startDate) stored.startDate = saDate(new Date());
  await save(stored);
  return true;
}

/** Email one step to everyone with an address (not suspended, not paused). Never twice unless asked. */
export async function sendStepEmail(key: string, sentByUserId: string | null, opts: { resend?: boolean } = {}): Promise<{ sent: number; notDelivered: number; skipped: number } | { error: string; status: number }> {
  const plan = await getPlan();
  const step = plan.steps.find((s) => s.key === key);
  if (!step) return { status: 404, error: "That step does not exist." };
  if (step.emailSentAt && !opts.resend) return { status: 409, error: "This email has already been sent. Send it again only if you really mean to." };
  if (step.needsFilling) return { status: 409, error: "Fill in the [brackets] in the message first, so nothing half-written goes out." };

  const { artists, contacts } = await refreshContacts();
  const result = { sent: 0, notDelivered: 0, skipped: 0 };
  for (const contact of contacts) {
    const status = contactStatus(contact, artists);
    if (status.stage === "suspended" || contact.remindersPaused || !contact.email) { result.skipped++; continue; }
    const email = renderEmail("custom", {
      name: contact.name, email: contact.email, stage: status.stage, missing: status.missing,
      fromWaitlist: contact.sources.includes("vercel_waitlist"), customSubject: step.subject, customBody: step.body,
    });
    try {
      const delivered = await sendBrandedEmail(contact.email, email);
      await db.insert(artistContactMessagesTable).values({
        id: randomUUID(), contactId: contact.id, kind: "email", reason: `Keep warm: ${step.title}`,
        subject: email.subject, body: email.text, channels: delivered ? ["email"] : [], sentByUserId,
      });
      if (delivered) result.sent++; else result.notDelivered++;
    } catch (err) {
      logger.warn({ err, contactId: contact.id }, "Keep-warm email failed");
      result.notDelivered++;
    }
  }
  const stored = await load();
  stored.steps = stored.steps ?? {};
  stored.steps[key] = { ...stored.steps[key], emailSentAt: new Date().toISOString(), emailCount: result.sent };
  await save(stored);
  return result;
}

// ---------------------------------------------------------------------------
// Who has gone quiet
// ---------------------------------------------------------------------------

export async function quietContacts(days = 14, now: Date = new Date()) {
  const { artists, contacts } = await refreshContacts();
  const msgs = await db.select({ contactId: artistContactMessagesTable.contactId, at: artistContactMessagesTable.createdAt }).from(artistContactMessagesTable);
  const lastMsg = new Map<string, number>();
  for (const m of msgs) lastMsg.set(m.contactId, Math.max(lastMsg.get(m.contactId) ?? 0, m.at.getTime()));
  const rows = [];
  for (const c of contacts as ArtistContact[]) {
    const status = contactStatus(c, artists);
    if (status.stage === "suspended") continue;
    const last = Math.max(c.lastTouchAt?.getTime() ?? 0, c.lastRemindedAt?.getTime() ?? 0, lastMsg.get(c.id) ?? 0, c.createdAt.getTime());
    const quietDays = Math.floor((now.getTime() - last) / DAY_MS);
    if (quietDays < days) continue;
    rows.push({
      id: c.id, name: c.name || c.email || c.phone || "Unnamed", specialty: c.specialty ?? null, stage: status.stage,
      reachable: status.reachable, email: c.email, phone: c.phone, quietDays,
      lastTouchNote: c.lastTouchNote ?? null,
    });
  }
  return rows.sort((a, b) => b.quietDays - a.quietDays);
}

export async function logTouch(contactId: string, note: string | null) {
  const updated = await db.update(artistContactsTable).set({ lastTouchAt: new Date(), lastTouchNote: note, updatedAt: new Date() })
    .where(eq(artistContactsTable.id, contactId)).returning({ id: artistContactsTable.id });
  return updated.length > 0;
}

// ---------------------------------------------------------------------------
// Automatic sending (off until the owner turns it on)
// ---------------------------------------------------------------------------

export async function runKeepWarmJob(now: Date = new Date()) {
  const plan = await getPlan(now);
  if (!plan.auto || !plan.started) return 0;
  if (!deliveryConfigured().email) return 0;
  let sent = 0;
  for (const step of plan.steps) {
    if (step.status !== "due" || step.emailSentAt) continue;
    if (step.needsFilling) continue; // never send a half-written message
    const r = await sendStepEmail(step.key, null);
    if (!("error" in r)) sent++;
  }
  if (sent) logger.info({ sent }, "Keep-warm steps sent automatically");
  return sent;
}

export function startKeepWarmJob() {
  const run = () => runKeepWarmJob().catch((err) => logger.error({ err }, "Keep-warm job failed"));
  setTimeout(run, 4 * 60_000);
  setInterval(run, 6 * 3_600_000);
  logger.info("Keep-warm job scheduled (sends nothing unless switched on)");
}
