/**
 * Keep warm, and the Founding Artist badge (owner only).
 *
 *   GET  /owner/keep-warm                        the plan: each step, when it is due, what was sent
 *   PUT  /owner/keep-warm/settings               set Day 0, switch automatic sending on or off
 *   PUT  /owner/keep-warm/steps/:key             edit a step's wording
 *   POST /owner/keep-warm/steps/:key/send        email it to everyone with an address
 *   POST /owner/keep-warm/steps/:key/posted      mark it as posted in the WhatsApp group
 *   GET  /owner/keep-warm/quiet                  people nobody has spoken to lately
 *   POST /owner/contacts/:id/touch               "I spoke to her"
 *   POST /owner/artists/:profileId/founding-member   give or take away the Founding Artist badge
 */
import { Router } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db, stylistProfilesTable } from "@workspace/db";
import { requireOwner } from "../lib/auth";
import { param } from "../lib/params";
import { deliveryConfigured } from "../lib/artist-contacts";
import { audit } from "../lib/reputation";
import { editStep, getPlan, logTouch, markPosted, quietContacts, sendStepEmail, updateSettings } from "../lib/keep-warm";

const router = Router();
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);

router.get("/owner/keep-warm", requireOwner, async (_req, res) => {
  const [plan, founding] = await Promise.all([
    getPlan(),
    db.select({ n: sql<number>`count(*)::int` }).from(stylistProfilesTable).where(eq(stylistProfilesTable.foundingMember, true)),
  ]);
  res.json({ ...plan, emailConfigured: deliveryConfigured().email, foundingArtists: founding[0]?.n ?? 0 });
});

router.put("/owner/keep-warm/settings", requireOwner, async (req, res) => {
  const startDate = req.body?.startDate;
  if (startDate !== undefined && !(typeof startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(startDate) && !Number.isNaN(Date.parse(`${startDate}T00:00:00Z`)))) {
    res.status(400).json({ error: "Choose a valid date for Day 0." });
    return;
  }
  const auto = req.body?.auto;
  if (auto !== undefined && typeof auto !== "boolean") { res.status(400).json({ error: "Automatic sending is on or off." }); return; }
  const groupLink = req.body?.groupLink;
  if (groupLink !== undefined && !(typeof groupLink === "string" && (groupLink === "" || /^https?:\/\/\S{4,300}$/.test(groupLink.trim())))) {
    res.status(400).json({ error: "Paste the full WhatsApp group link, starting with https://" });
    return;
  }
  await updateSettings({ startDate, auto, groupLink: typeof groupLink === "string" ? groupLink.trim() : undefined });
  res.json({ message: "Saved." });
});

router.put("/owner/keep-warm/steps/:key", requireOwner, async (req, res) => {
  const subject = text(req.body?.subject, 200), body = text(req.body?.body, 4000), whatsapp = text(req.body?.whatsapp, 4000);
  if (subject === "" || body === "" || whatsapp === "") { res.status(400).json({ error: "A message cannot be empty." }); return; }
  const ok = await editStep(param(req.params.key), { subject, body, whatsapp });
  if (!ok) { res.status(404).json({ error: "Step not found" }); return; }
  res.json({ message: "Saved." });
});

router.post("/owner/keep-warm/steps/:key/send", requireOwner, async (req, res) => {
  const result = await sendStepEmail(param(req.params.key), (req as any).user.id, { resend: req.body?.resend === true });
  if ("error" in result) { res.status(result.status).json({ error: result.error }); return; }
  res.json(result);
});

router.post("/owner/keep-warm/steps/:key/posted", requireOwner, async (req, res) => {
  const ok = await markPosted(param(req.params.key));
  if (!ok) { res.status(404).json({ error: "Step not found" }); return; }
  res.json({ message: "Marked as posted." });
});

router.get("/owner/keep-warm/quiet", requireOwner, async (req, res) => {
  const days = Math.max(1, Math.min(120, Number(req.query["days"]) || 14));
  res.json(await quietContacts(days));
});

router.post("/owner/contacts/:contactId/touch", requireOwner, async (req, res) => {
  const ok = await logTouch(param(req.params.contactId), text(req.body?.note, 300) || null);
  if (!ok) { res.status(404).json({ error: "Contact not found" }); return; }
  res.json({ message: "Noted. She is off the quiet list for now." });
});

router.post("/owner/artists/:profileId/founding-member", requireOwner, async (req, res) => {
  const value = req.body?.value;
  if (typeof value !== "boolean") { res.status(400).json({ error: "Choose true or false." }); return; }
  const id = param(req.params.profileId);
  const [before] = await db.select({ f: stylistProfilesTable.foundingMember }).from(stylistProfilesTable).where(eq(stylistProfilesTable.id, id));
  if (!before) { res.status(404).json({ error: "Artist not found" }); return; }
  await db.update(stylistProfilesTable).set({ foundingMember: value, foundingMemberSince: value ? new Date() : null }).where(and(eq(stylistProfilesTable.id, id)));
  await audit({ stylistId: id, actor: (req as any).user.email, action: value ? "founding_member_granted" : "founding_member_removed", reason: text(req.body?.reason, 300) || (value ? "Founding Artist badge granted" : "Founding Artist badge removed"), before: { foundingMember: before.f }, after: { foundingMember: value } });
  res.json({ message: value ? "Founding Artist badge granted." : "Badge removed." });
});

export default router;
