/**
 * Public waitlist form (used by the Bonisa Pixel Arcade game page at /play/).
 *
 *   POST /public/waitlist   no login needed
 *
 * People who join land in the same Artist Contacts list as everyone else, so
 * the owner sees them in one place. Clients and brands are saved too, but with
 * artist reminders switched off so they never get "create your artist profile"
 * emails by mistake.
 *
 * Because anyone on the internet can call this, it checks everything itself:
 * a consent tick is required, a hidden "website" field catches simple bots,
 * and each address can only submit a handful of times per hour.
 */
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { artistContactsTable, db } from "@workspace/db";
import { logger } from "../lib/logger";
import { mapWaitlistRecord, normaliseContactPhone, normaliseEmail, upsertContact } from "../lib/artist-contacts";

const router: IRouter = Router();

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 8;
const recent = new Map<string, number[]>();

function tooManyRequests(ip: string): boolean {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  recent.set(ip, hits);
  if (recent.size > 5000) {
    for (const [key, times] of recent) if (times[times.length - 1] < now - WINDOW_MS) recent.delete(key);
  }
  return hits.length > MAX_PER_WINDOW;
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

const ROLES = ["artist", "client", "brand"] as const;
type Role = (typeof ROLES)[number];

router.post("/public/waitlist", async (req, res) => {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = (typeof forwarded === "string" ? forwarded.split(",")[0].trim() : "") || req.ip || "unknown";
  if (tooManyRequests(ip)) {
    res.status(429).json({ error: "Too many tries. Please wait a little and try again." });
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;

  // Hidden field only bots fill in. Pretend it worked.
  if (text(body.website, 200)) { res.json({ ok: true }); return; }

  const name = text(body.name, 100);
  if (!name) { res.status(400).json({ error: "Please add your name." }); return; }
  if (body.consent !== true) { res.status(400).json({ error: "Please tick the box so we may contact you." }); return; }

  const email = normaliseEmail(body.email);
  const phone = normaliseContactPhone(body.phone);
  if (!email && !phone) {
    res.status(400).json({ error: "Please add a valid WhatsApp number or email so we can reach you." });
    return;
  }

  const role: Role = (ROLES as readonly string[]).includes(body.role as string) ? (body.role as Role) : "artist";
  const score = typeof body.score === "number" && Number.isInteger(body.score) && body.score >= 0 && body.score <= 1000 ? body.score : null;
  const specialty = role === "artist" ? text(body.specialty, 40) : "";
  const city = text(body.city, 80);
  const joinedAt = new Date();

  const input = {
    ...mapWaitlistRecord({ name, email, phone, specialty, city }),
    notes: `Joined the waitlist from the Pixel Arcade as ${role}${score !== null ? ` (game score ${score})` : ""}.`,
    waitlistData: { origin: "pixel_arcade", role, score, consent: true, consentAt: joinedAt.toISOString(), name, email, phone, specialty, city },
    waitlistJoinedAt: joinedAt,
  };

  try {
    const result = await upsertContact(input, "vercel_waitlist");
    if (role !== "artist" && result.outcome === "created" && result.contact) {
      await db.update(artistContactsTable).set({ remindersPaused: true }).where(eq(artistContactsTable.id, result.contact.id));
    }
    logger.info({ outcome: result.outcome, role }, "Pixel Arcade waitlist sign-up");
    // Same answer whether she is new or already on the list.
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Pixel Arcade waitlist sign-up failed");
    res.status(500).json({ error: "Something went wrong on our side. Please try again in a moment." });
  }
});

export default router;
