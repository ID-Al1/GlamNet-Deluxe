/**
 * Campaign payments: how a brand pays Bonisa, and how that money reaches artists.
 *
 * The brand pays the artist's full rate plus Bonisa's 18% on top. Half is paid
 * up front to lock in the team (the artists see "confirmed and funded"), and
 * the rest three days before the event. If the event is closer than that, the
 * brand pays in full. Every rand is held in escrow by Bonisa and released
 * through the same two-sided confirmation as any other booking, only once the
 * campaign is paid in full.
 *
 * One Stripe payment covers the whole team. It is shared out between the
 * artists' jobs (one booking per artist, so earnings, payouts, disputes and
 * messages all work as they do everywhere else) by campaign_payment_lines,
 * which are fixed when the checkout is created, so fulfilling it is exact and
 * safe to repeat.
 */
import { randomUUID } from "crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import type Stripe from "stripe";
import {
  appointmentsTable,
  campaignPaymentLinesTable,
  campaignPaymentsTable,
  castingApplicationsTable,
  castingCallsTable,
  conversationsTable,
  db,
  paymentsTable,
  stylistProfilesTable,
  usersTable,
} from "@workspace/db";
import { campaignArtistCost, campaignBalanceDueDate, daysUntil, formatRand } from "./money";
import { holdCampaignEscrow, recordCampaignPayment, resolveCampaignCollected } from "./escrow";
import { appUrl } from "./email-templates";
import {
  buildCampaignSummary,
  formatLongDate,
  notifyStylistProfile,
  notifyUserId,
  type CallRow,
} from "./campaigns";
import { isUniqueViolation } from "./bookingValidation";
import { logger } from "./logger";

export type CampaignPaymentKind = "deposit" | "balance" | "full";
type UserRow = typeof usersTable.$inferSelect;
type Failure = { error: string; status: number };

const cents = (amount: number) => Math.round(amount * 100);
const rand = formatRand;

// ---------------------------------------------------------------------------
// Clearing out a payment that never finished
// ---------------------------------------------------------------------------

/** Mark a checkout as expired and release the artists' slots it was holding. */
async function expireRecord(paymentId: string) {
  await db.transaction(async (tx) => {
    const [cp] = await tx.select().from(campaignPaymentsTable).where(eq(campaignPaymentsTable.id, paymentId)).for("update");
    if (!cp || cp.status !== "pending") return;
    await tx.update(campaignPaymentsTable).set({ status: "expired" }).where(eq(campaignPaymentsTable.id, paymentId));
    if (cp.kind !== "balance") {
      const lines = await tx.select().from(campaignPaymentLinesTable).where(eq(campaignPaymentLinesTable.campaignPaymentId, paymentId));
      if (lines.length) {
        await tx.update(appointmentsTable).set({ status: "cancelled" })
          .where(and(inArray(appointmentsTable.id, lines.map((l) => l.appointmentId)), eq(appointmentsTable.status, "pending")));
      }
    }
  });
}

/**
 * Close a pending checkout. If the brand actually paid just before this, fulfil it
 * instead and say so, because expiring a paid session would lose track of the money.
 */
async function clearPending(stripe: Stripe | null, payment: typeof campaignPaymentsTable.$inferSelect): Promise<"cleared" | "paid"> {
  if (payment.stripeSessionId && stripe) {
    try {
      await stripe.checkout.sessions.expire(payment.stripeSessionId);
    } catch (err) {
      // Already expired or already complete. Find out which.
      try {
        const session = await stripe.checkout.sessions.retrieve(payment.stripeSessionId);
        if (session.payment_status === "paid") {
          await fulfillCampaignSession(stripe, session.id);
          return "paid";
        }
      } catch (inner) {
        logger.warn({ inner, paymentId: payment.id }, "Could not check a campaign checkout before clearing it");
      }
    }
  }
  await expireRecord(payment.id);
  return "cleared";
}

// ---------------------------------------------------------------------------
// Starting a payment
// ---------------------------------------------------------------------------

export async function startCampaignPayment(
  stripe: Stripe,
  call: CallRow,
  user: UserRow,
  kind: CampaignPaymentKind,
): Promise<{ url: string } | Failure> {
  const summary = await buildCampaignSummary(call, user);

  if (kind === "balance") {
    if (call.status !== "deposit_paid") return { status: 409, error: "There is no balance to pay on this campaign." };
    if (summary.outstanding <= 0) return { status: 409, error: "This campaign is already paid in full." };
  } else {
    if (call.status !== "open") return { status: 409, error: "This campaign has already been paid for." };
    if (!summary.canFund) return { status: 409, error: summary.blockers[0] ?? "This campaign cannot be paid for yet." };
    if (kind === "deposit" && !summary.depositAllowed) {
      return { status: 400, error: "The event is less than 3 days away, so the campaign has to be paid in full." };
    }
  }

  // A payment already in progress: hand back the same checkout, or clear it so a fresh one can start.
  const pending = await db.select().from(campaignPaymentsTable)
    .where(and(eq(campaignPaymentsTable.castingId, call.id), eq(campaignPaymentsTable.status, "pending")));
  for (const p of pending) {
    if (p.kind === kind && p.stripeSessionId) {
      try {
        const session = await stripe.checkout.sessions.retrieve(p.stripeSessionId);
        if (session.status === "open" && session.url) return { url: session.url };
      } catch (err) {
        logger.warn({ err, paymentId: p.id }, "Could not reopen a pending campaign checkout");
      }
    }
    const outcome = await clearPending(stripe, p);
    if (outcome === "paid") return { status: 409, error: "Your payment has just gone through. Refresh the page." };
  }

  // Work out who is paid what, and create the payment and its jobs, in one step.
  type Plan = { paymentId: string; amount: number; lines: { appointmentId: string; amount: number }[]; names: string[] };
  let plan: Plan;
  try {
    plan = await db.transaction(async (tx): Promise<Plan> => {
      const [locked] = await tx.select().from(castingCallsTable).where(eq(castingCallsTable.id, call.id)).for("update");
      if (!locked) throw Object.assign(new Error("Campaign not found"), { status: 404 });
      const expectedStatus = kind === "balance" ? "deposit_paid" : "open";
      if (locked.status !== expectedStatus) throw Object.assign(new Error("This campaign changed while you were paying. Refresh and try again."), { status: 409 });
      const [stillPending] = await tx.select({ id: campaignPaymentsTable.id }).from(campaignPaymentsTable)
        .where(and(eq(campaignPaymentsTable.castingId, call.id), eq(campaignPaymentsTable.status, "pending"))).limit(1);
      if (stillPending) throw Object.assign(new Error("A payment is already in progress. Refresh and try again."), { status: 409 });

      const paymentId = randomUUID();
      const lines: Plan["lines"] = [];
      const names: string[] = [];

      if (kind === "balance") {
        const jobs = await tx.select().from(appointmentsTable)
          .where(and(eq(appointmentsTable.campaignId, call.id), eq(appointmentsTable.status, "confirmed")));
        for (const job of jobs) {
          const owed = cents(campaignArtistCost(job.price).total) - cents(await resolveCampaignCollected(tx, job.id));
          if (owed > 0) { lines.push({ appointmentId: job.id, amount: owed / 100 }); names.push(job.stylistName); }
        }
      } else {
        const accepted = await tx.select().from(castingApplicationsTable)
          .where(and(eq(castingApplicationsTable.castingId, call.id), eq(castingApplicationsTable.status, "accepted")));
        if (accepted.length === 0) throw Object.assign(new Error("Accept at least one artist first."), { status: 409 });
        const cost = campaignArtistCost(locked.ratePerArtist);
        for (const app of accepted) {
          const [profile] = await tx.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.id, app.stylistId));
          const [artistUser] = profile ? await tx.select({ status: usersTable.accountStatus }).from(usersTable).where(eq(usersTable.id, profile.userId)) : [];
          if (!profile?.verified || artistUser?.status === "suspended") {
            throw Object.assign(new Error(`${app.stylistName} can no longer be booked. Pass on her and choose someone else.`), { status: 409 });
          }
          const appointmentId = randomUUID();
          try {
            await tx.insert(appointmentsTable).values({
              id: appointmentId,
              clientId: user.id,
              clientName: locked.brandName,
              stylistId: app.stylistId,
              stylistName: profile.name,
              serviceId: locked.id,
              serviceName: locked.title,
              date: locked.eventDate!,
              time: locked.eventTime,
              status: "pending",
              price: cost.rate,
              duration: locked.eventDurationMinutes,
              notes: `${locked.title}${locked.location ? `, ${locked.location}` : ""}`,
              paymentMode: kind === "deposit" ? "deposit" : "full",
              depositAmount: kind === "deposit" ? cost.deposit : 0,
              balanceDue: kind === "deposit" ? cost.balance : 0,
              isTeamBooking: false,
              campaignId: locked.id,
              feeMode: "brand_on_top",
            });
          } catch (err) {
            if (isUniqueViolation(err)) {
              throw Object.assign(new Error(`${profile.name} has another booking at that date and time.`), { status: 409 });
            }
            throw err;
          }
          lines.push({ appointmentId, amount: kind === "deposit" ? cost.deposit : cost.total });
          names.push(profile.name);
        }
      }

      const amount = lines.reduce((sum, l) => sum + cents(l.amount), 0) / 100;
      if (lines.length === 0 || amount <= 0) throw Object.assign(new Error("There is nothing to pay."), { status: 409 });
      await tx.insert(campaignPaymentsTable).values({ id: paymentId, castingId: call.id, kind, amount, status: "pending" });
      await tx.insert(campaignPaymentLinesTable).values(lines.map((l) => ({
        id: randomUUID(), campaignPaymentId: paymentId, appointmentId: l.appointmentId, amount: l.amount,
      })));
      return { paymentId, amount, lines, names };
    });
  } catch (err: any) {
    if (err?.status) return { status: err.status, error: err.message };
    throw err;
  }

  // Stripe checkout for exactly that amount.
  try {
    const cost = summary.cost;
    const artists = plan.lines.length;
    const what = kind === "deposit" ? `50% deposit for ${artists} ${artists === 1 ? "artist" : "artists"}`
      : kind === "balance" ? `Balance for ${artists} ${artists === 1 ? "artist" : "artists"}`
        : `Full payment for ${artists} ${artists === 1 ? "artist" : "artists"}`;

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, name: user.name, metadata: { userId: user.id } });
      customerId = customer.id;
      await db.update(usersTable).set({ stripeCustomerId: customerId }).where(eq(usersTable.id, user.id));
    }
    const base = appUrl();
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "zar",
          unit_amount: cents(plan.amount),
          product_data: {
            name: `${call.title}: ${what}`,
            description: `Artist fees ${rand(cost.artistFees)} + Bonisa fee ${rand(cost.fee)} = ${rand(cost.total)} for the whole campaign. This payment: ${rand(plan.amount)}.`,
          },
        },
      }],
      payment_intent_data: { receipt_email: user.email },
      success_url: `${base}/campaigns/${call.id}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/campaigns/${call.id}`,
      metadata: { kind: "campaign_payment", campaignPaymentId: plan.paymentId, castingId: call.id, userId: user.id },
    });
    await db.update(campaignPaymentsTable).set({ stripeSessionId: session.id }).where(eq(campaignPaymentsTable.id, plan.paymentId));
    if (!session.url) throw new Error("Stripe returned no checkout URL");
    return { url: session.url };
  } catch (err) {
    logger.error({ err, paymentId: plan.paymentId }, "Could not start a campaign checkout");
    await expireRecord(plan.paymentId);
    return { status: 502, error: "We could not start the payment. Nothing was charged. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// A payment landed
// ---------------------------------------------------------------------------

export interface FulfilledCampaignPayment {
  castingId: string;
  userId: string;
  alreadyDone: boolean;
}

/**
 * Turn a paid checkout into booked, funded jobs. Safe to run any number of
 * times (the webhook and the page the brand returns to both call it): the
 * payment row is locked, and only the first caller changes anything.
 */
export async function fulfillCampaignSession(stripe: Stripe, sessionId: string, ownerUserId?: string, expectedCastingId?: string): Promise<FulfilledCampaignPayment> {
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.metadata?.["kind"] !== "campaign_payment") {
    throw Object.assign(new Error("Not a campaign payment"), { code: "not_campaign" });
  }
  if (session.payment_status !== "paid") {
    throw Object.assign(new Error("Payment not completed"), { code: "payment_not_completed" });
  }
  if (expectedCastingId && session.metadata["castingId"] !== expectedCastingId) {
    throw Object.assign(new Error("This payment is for a different campaign"), { code: "not_found" });
  }
  const paymentId = session.metadata["campaignPaymentId"]!;
  const metaUserId = session.metadata["userId"]!;
  if (ownerUserId && metaUserId !== ownerUserId) {
    throw Object.assign(new Error("This payment does not belong to you"), { code: "forbidden" });
  }
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;

  type Done = {
    castingId: string; alreadyDone: boolean; kind: CampaignPaymentKind; amount: number;
    call?: CallRow; artists?: { profileId: string; rate: number }[]; fullyPaid?: boolean; balanceDueDate?: string | null; total?: number;
  };
  const done = await db.transaction(async (tx): Promise<Done> => {
    const [cp] = await tx.select().from(campaignPaymentsTable).where(eq(campaignPaymentsTable.id, paymentId)).for("update");
    if (!cp) throw Object.assign(new Error("Campaign payment not found"), { code: "not_found" });
    if (cp.status === "paid") return { castingId: cp.castingId, alreadyDone: true, kind: cp.kind as CampaignPaymentKind, amount: cp.amount };

    // The money in Stripe has to match what we asked for, to the cent.
    if (cents((session.amount_total ?? 0) / 100) !== cents(cp.amount)) {
      logger.error({ sessionId, expected: cp.amount, paid: session.amount_total }, "Campaign payment amount mismatch, needs manual review");
      throw Object.assign(new Error("Amount mismatch"), { code: "amount_mismatch" });
    }

    const [call] = await tx.select().from(castingCallsTable).where(eq(castingCallsTable.id, cp.castingId)).for("update");
    if (!call) throw Object.assign(new Error("Campaign not found"), { code: "not_found" });
    const lines = await tx.select().from(campaignPaymentLinesTable).where(eq(campaignPaymentLinesTable.campaignPaymentId, cp.id));
    const kind = cp.kind as CampaignPaymentKind;
    const artists: { profileId: string; rate: number }[] = [];

    for (const line of lines) {
      const [appt] = await tx.select().from(appointmentsTable).where(eq(appointmentsTable.id, line.appointmentId)).for("update");
      if (!appt) continue;
      let amount = line.amount;

      if (kind !== "balance") {
        // Confirm the job. If the pending job was cleared while the brand was paying, bring it back.
        await tx.update(appointmentsTable).set({ status: "confirmed" })
          .where(and(eq(appointmentsTable.id, appt.id), inArray(appointmentsTable.status, ["pending", "cancelled"])));
      } else {
        // Never take in more than the job is owed. Anything extra is flagged, not hidden.
        const owed = cents(campaignArtistCost(appt.price).total) - cents(await resolveCampaignCollected(tx, appt.id));
        if (cents(amount) > owed) {
          logger.error({ appointmentId: appt.id, extra: (cents(amount) - owed) / 100 }, "Campaign overpayment, needs refunding");
          amount = Math.max(0, owed) / 100;
        }
      }

      if (amount > 0) {
        await tx.insert(paymentsTable).values({
          id: randomUUID(),
          appointmentId: appt.id,
          // Deliberately no Stripe ids here: one Stripe charge is shared by several jobs, and
          // refunds for it are handled by Bonisa support against campaign_payments.
          stripeSessionId: null,
          stripePaymentIntentId: null,
          amount,
          tipAmount: 0,
          depositAmount: kind === "deposit" ? amount : 0,
          discountAmount: 0,
          refundedAmount: 0,
          status: "succeeded",
        });
      }
      if (kind === "balance") await recordCampaignPayment(tx, appt.id, amount, metaUserId);
      else {
        await holdCampaignEscrow(tx, appt, amount, metaUserId);
        artists.push({ profileId: appt.stylistId, rate: appt.price });
      }
    }

    await tx.update(campaignPaymentsTable)
      .set({ status: "paid", paidAt: new Date(), stripePaymentIntentId: paymentIntentId })
      .where(eq(campaignPaymentsTable.id, cp.id));

    const newStatus = kind === "deposit" ? "deposit_paid" : "fully_paid";
    await tx.update(castingCallsTable).set({ status: newStatus }).where(eq(castingCallsTable.id, call.id));
    return {
      castingId: call.id, alreadyDone: false, kind, amount: cp.amount,
      call: { ...call, status: newStatus }, artists, fullyPaid: newStatus === "fully_paid",
      balanceDueDate: kind === "deposit" && call.eventDate ? campaignBalanceDueDate(call.eventDate) : null,
    };
  });

  if (done.alreadyDone || !done.call) return { castingId: done.castingId, userId: metaUserId, alreadyDone: true };

  // Everything after the money is safe: conversations, then telling people. None of it can fail the payment.
  const call = done.call;
  setImmediate(async () => {
    try {
      const jobs = await db.select().from(appointmentsTable).where(and(
        eq(appointmentsTable.campaignId, call.id), inArray(appointmentsTable.status, ["confirmed"]),
      ));
      const artistCount = jobs.length;
      if (done.kind !== "balance") {
        for (const job of jobs) {
          const [profile] = await db.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.id, job.stylistId));
          if (!profile) continue;
          try {
            const [existing] = await db.select({ id: conversationsTable.id }).from(conversationsTable)
              .where(and(eq(conversationsTable.clientId, call.brandId), eq(conversationsTable.stylistId, profile.userId)));
            if (!existing) await db.insert(conversationsTable).values({ id: randomUUID(), clientId: call.brandId, stylistId: profile.userId });
          } catch (err) {
            logger.warn({ err }, "Could not open a conversation for a campaign job");
          }
          await notifyStylistProfile(job.stylistId, "campaign.funded", {
            brandName: call.brandName, castingTitle: call.title, eventDate: formatLongDate(call.eventDate), location: call.location, rate: job.price,
          });
        }
        const per = campaignArtistCost(call.ratePerArtist);
        await notifyUserId(call.brandId, "campaign.deposit_received", {
          castingTitle: call.title, amount: done.amount, artistCount,
          balanceAmount: done.kind === "deposit" ? per.balance * artistCount : 0,
          balanceDueDate: done.balanceDueDate ? formatLongDate(done.balanceDueDate) : undefined,
        });
      } else {
        await notifyUserId(call.brandId, "campaign.balance_received", { castingTitle: call.title, amount: done.amount });
      }
    } catch (err) {
      logger.warn({ err }, "Post-payment campaign follow-up failed");
    }
  });

  return { castingId: done.castingId, userId: metaUserId, alreadyDone: false };
}

/** The brand closed the checkout, or it timed out. Free the artists' slots again. */
export async function handleCampaignSessionExpired(sessionId: string): Promise<boolean> {
  const [cp] = await db.select().from(campaignPaymentsTable).where(eq(campaignPaymentsTable.stripeSessionId, sessionId));
  if (!cp) return false;
  await expireRecord(cp.id);
  return true;
}

// ---------------------------------------------------------------------------
// Cancelling a campaign that has not been paid for
// ---------------------------------------------------------------------------

export async function cancelCampaignCall(call: CallRow): Promise<{ ok: true } | Failure> {
  if (call.status !== "open") {
    return { status: 409, error: call.status === "cancelled" ? "This campaign is already cancelled." : "This campaign has been paid for. Please contact Bonisa to cancel it." };
  }
  const pending = await db.select().from(campaignPaymentsTable)
    .where(and(eq(campaignPaymentsTable.castingId, call.id), eq(campaignPaymentsTable.status, "pending")));
  if (pending.length > 0) {
    let stripe: Stripe | null = null;
    if (pending.some((p) => p.stripeSessionId)) {
      try {
        const { getUncachableStripeClient } = await import("../stripeClient");
        stripe = await getUncachableStripeClient();
      } catch (err) {
        logger.warn({ err }, "No Stripe client while cancelling a campaign");
        return { status: 409, error: "A payment is in progress and we could not cancel it just now. Please try again in a moment." };
      }
    }
    for (const p of pending) {
      if (await clearPending(stripe, p) === "paid") return { status: 409, error: "A payment has just gone through, so this campaign can no longer be cancelled here. Contact Bonisa." };
    }
  }

  const result = await db.transaction(async (tx) => {
    const [locked] = await tx.select().from(castingCallsTable).where(eq(castingCallsTable.id, call.id)).for("update");
    if (!locked || locked.status !== "open") return null;
    await tx.update(castingCallsTable).set({ status: "cancelled" }).where(eq(castingCallsTable.id, call.id));
    return await tx.select().from(castingApplicationsTable).where(and(
      eq(castingApplicationsTable.castingId, call.id),
      inArray(castingApplicationsTable.status, ["pending", "shortlisted", "invited", "accepted"]),
    ));
  });
  if (!result) return { status: 409, error: "This campaign has just changed. Refresh and try again." };

  setImmediate(async () => {
    for (const app of result) {
      await notifyStylistProfile(app.stylistId, "campaign.cancelled", { brandName: call.brandName, castingTitle: call.title });
    }
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Reminding brands about the balance
// ---------------------------------------------------------------------------

const REMIND_WITHIN_DAYS = 5;
const HOUR_MS = 3_600_000;

/**
 * Once the balance is within 5 days of falling due, tell the brand; once it is overdue,
 * tell them again every 24 hours until it is paid or a week after the event.
 */
export async function sendBalanceReminders(now: Date = new Date()): Promise<number> {
  const calls = await db.select().from(castingCallsTable).where(eq(castingCallsTable.status, "deposit_paid"));
  let sent = 0;
  for (const call of calls) {
    if (!call.eventDate) continue;
    const dueDate = campaignBalanceDueDate(call.eventDate);
    const untilDue = daysUntil(dueDate);
    const last = call.balanceReminderSentAt?.getTime() ?? 0;
    const firstReminder = !last && untilDue <= REMIND_WITHIN_DAYS;
    const overdueReminder = untilDue <= 0 && now.getTime() - last >= 24 * HOUR_MS;
    if (!firstReminder && !overdueReminder) continue;
    if (daysUntil(call.eventDate) < -7) continue;

    // Claim the reminder first so two runs never send it twice.
    const claimed = await db.update(castingCallsTable).set({ balanceReminderSentAt: now })
      .where(and(
        eq(castingCallsTable.id, call.id),
        eq(castingCallsTable.status, "deposit_paid"),
        call.balanceReminderSentAt ? eq(castingCallsTable.balanceReminderSentAt, call.balanceReminderSentAt) : sql`${castingCallsTable.balanceReminderSentAt} is null`,
      )).returning({ id: castingCallsTable.id });
    if (claimed.length === 0) continue;

    const summary = await buildCampaignSummary(call);
    await notifyUserId(call.brandId, "campaign.balance_due", {
      castingTitle: call.title, balanceAmount: summary.outstanding, balanceDueDate: formatLongDate(dueDate),
    });
    sent++;
  }
  return sent;
}

export function startCampaignReminderJob() {
  const run = () => sendBalanceReminders().catch((err) => logger.error({ err }, "Campaign balance reminder job failed"));
  setTimeout(run, 90 * 1000);
  setInterval(run, HOUR_MS);
  logger.info("Campaign balance reminder job scheduled");
}
