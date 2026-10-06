/**
 * Campaign money routes.
 *
 *   GET  /casting/:castingId/summary          — team, cost, payments and jobs (the brand, or the owner)
 *   POST /casting/:castingId/fund             — start a Stripe checkout: deposit, balance or full
 *   POST /casting/:castingId/confirm-payment  — the brand returns from Stripe, confirm the payment landed
 *   GET  /owner/campaigns                     — every campaign with what is paid, held and released
 *
 * The amounts are worked out here, never taken from the screen.
 */
import { Router } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { castingCallsTable, db } from "@workspace/db";
import { ConfirmCampaignPaymentBody, MarkSeatRefundedBody, StartCampaignPaymentBody } from "@workspace/api-zod";
import { requireAuth, requireOwner } from "../lib/auth";
import { param } from "../lib/params";
import { getUncachableStripeClient } from "../stripeClient";
import { logger } from "../lib/logger";
import { buildCampaignSummary, isBrandVerified, isOwnerUser } from "../lib/campaigns";
import { fulfillCampaignSession, startCampaignPayment } from "../lib/campaign-payments";
import { markSeatRefunded, ownerSeatAttention } from "../lib/campaign-seats";

const router = Router();

async function loadCall(castingId: string) {
  const [call] = await db.select().from(castingCallsTable).where(eq(castingCallsTable.id, castingId));
  return call;
}

router.get("/casting/:castingId/summary", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const call = await loadCall(param(req.params.castingId));
  if (!call) { res.status(404).json({ error: "Campaign not found" }); return; }
  if (call.brandId !== user.id && !isOwnerUser(user)) { res.status(403).json({ error: "This campaign belongs to another brand." }); return; }
  res.json(await buildCampaignSummary(call, user));
});

router.post("/casting/:castingId/fund", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const call = await loadCall(param(req.params.castingId));
  if (!call) { res.status(404).json({ error: "Campaign not found" }); return; }
  if (call.brandId !== user.id) { res.status(403).json({ error: "Only the brand that owns this campaign can pay for it." }); return; }
  if (user.role !== "brand" || !(await isBrandVerified(user.id))) {
    res.status(403).json({ error: "Your brand needs to be verified before you can pay." });
    return;
  }
  const parsed = StartCampaignPaymentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Choose deposit, balance or full payment." }); return; }

  let stripe;
  try {
    stripe = await getUncachableStripeClient();
  } catch (err) {
    logger.error({ err }, "Stripe is not available for a campaign payment");
    res.status(503).json({ error: "Payments are not available right now. Please try again shortly." });
    return;
  }
  const result = await startCampaignPayment(stripe, call, user, parsed.data.kind);
  if ("error" in result) { res.status(result.status).json({ error: result.error }); return; }
  res.json({ url: result.url });
});

router.post("/casting/:castingId/confirm-payment", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const castingId = param(req.params.castingId);
  const parsed = ConfirmCampaignPaymentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Missing sessionId" }); return; }
  const call = await loadCall(castingId);
  if (!call) { res.status(404).json({ error: "Campaign not found" }); return; }
  if (call.brandId !== user.id) { res.status(403).json({ error: "This campaign belongs to another brand." }); return; }

  try {
    const stripe = await getUncachableStripeClient();
    await fulfillCampaignSession(stripe, parsed.data.sessionId, user.id, castingId);
  } catch (err: any) {
    if (err.code === "payment_not_completed") { res.status(402).json({ error: "Payment not completed" }); return; }
    if (err.code === "forbidden") { res.status(403).json({ error: "This payment does not belong to you." }); return; }
    if (err.code === "not_found" || err.code === "not_campaign") { res.status(404).json({ error: "Payment not found for this campaign." }); return; }
    if (err.code === "amount_mismatch") { res.status(409).json({ error: "The amount paid does not match this campaign. Bonisa has been alerted and will sort it out." }); return; }
    logger.error({ err }, "Could not confirm a campaign payment");
    res.status(500).json({ error: "We could not confirm the payment just now. If you were charged, it will appear here shortly." });
    return;
  }
  const updated = await loadCall(castingId);
  res.json(await buildCampaignSummary(updated!, user));
});

router.get("/owner/seat-attention", requireOwner, async (_req, res) => {
  res.json(await ownerSeatAttention());
});

router.post("/owner/seat-refunds/:appointmentId/paid", requireOwner, async (req, res) => {
  const parsed = MarkSeatRefundedBody.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: "Check the reference and try again." }); return; }
  const ok = await markSeatRefunded(param(req.params.appointmentId), parsed.data.reference?.trim() || null);
  if (!ok) { res.status(409).json({ error: "There is no unpaid refund for that seat." }); return; }
  res.json({ message: "Refund recorded." });
});

router.get("/owner/campaigns", requireOwner, async (_req, res) => {
  const calls = await db.select().from(castingCallsTable)
    .where(sql`${castingCallsTable.ratePerArtist} > 0`)
    .orderBy(desc(castingCallsTable.createdAt), desc(castingCallsTable.id))
    .limit(100);
  const rows = [];
  for (const call of calls) {
    const s = await buildCampaignSummary(call);
    const released = s.jobs.filter((j) => j.payoutStatus === "released");
    rows.push({
      id: call.id,
      title: call.title,
      brandId: call.brandId,
      brandName: call.brandName,
      specialty: call.specialty,
      eventDate: call.eventDate ?? null,
      stage: s.stage,
      artistsFunded: s.jobs.length,
      artistFees: s.cost.artistFees,
      bonisaFee: s.cost.fee,
      total: s.cost.total,
      paid: s.paid,
      outstanding: s.outstanding,
      balanceDueDate: s.balanceDueDate,
      balanceOverdue: s.balanceOverdue,
      heldInEscrow: Math.round((s.jobs.filter((j) => j.payoutStatus !== "released").reduce((sum, j) => sum + j.collected, 0) + s.seatMoneyHeld) * 100) / 100,
      releasedToArtists: Math.round(released.reduce((sum, j) => sum + j.rate, 0) * 100) / 100,
      jobsReleased: released.length,
      jobsTotal: s.jobs.length,
      createdAt: call.createdAt.toISOString(),
    });
  }
  res.json(rows);
});

export default router;
