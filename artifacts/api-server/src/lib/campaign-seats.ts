/**
 * Seats: what happens when an artist on a paid campaign cannot make it.
 *
 * A "seat" is a place in the team the brand has paid for. When an artist withdraws, her job is
 * cancelled but the money paid for the seat stays held, flagged `seatOpen`, until one of three things happens:
 *   1. A replacement takes the seat (the money moves over to her new job, the brand pays nothing extra).
 *   2. The brand gives the seat up (the money paid for it is marked as owed back to the brand).
 *   3. The campaign is cancelled by Bonisa.
 *
 * Replacements are found two ways at once, and the first artist to accept gets the seat:
 *   - The brand's backup list (people who applied) and then verified matching artists are offered the
 *     seat in waves by this module.
 *   - The brand can also choose someone itself (invite or accept an applicant).
 *
 * No artist is ever voted on or needs the others' agreement. Each artist stands alone.
 *
 * Late withdrawals are recorded with a severity. Under 48 hours is a strike, and Bonisa's owner sees
 * who has several. An artist is never paid for a job she did not do.
 */
import { randomUUID } from "crypto";
import { and, asc, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import {
  appointmentsTable,
  campaignSeatEventsTable,
  castingApplicationsTable,
  castingCallsTable,
  conversationsTable,
  db,
  paymentsTable,
  stylistProfilesTable,
  usersTable,
} from "@workspace/db";
import { campaignArtistCost } from "./money";
import { holdCampaignEscrow, resolveCampaignCollected } from "./escrow";
import { isUniqueViolation } from "./bookingValidation";
import {
  artistHasConflict,
  formatLongDate,
  hoursUntilEvent,
  notifyStylistProfile,
  notifyUserId,
  type CallRow,
} from "./campaigns";
import { logger } from "./logger";

type Fail = { status: number; error: string };
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type WithdrawalSeverity = "early" | "late" | "last_minute";

const MINUTE_MS = 60_000;
const OFFERS_PER_WAVE = 5;
const MAX_WAVES = 12;

/** 7 or more days ahead: no mark. 2 to 7 days: a late note. Under 48 hours: a strike. */
export function withdrawalSeverity(hours: number): WithdrawalSeverity {
  if (hours >= 168) return "early";
  if (hours >= 48) return "late";
  return "last_minute";
}

export const isFunded = (call: { status: string }) => call.status === "deposit_paid" || call.status === "fully_paid";

export async function strikeCount(profileId: string): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(campaignSeatEventsTable)
    .where(and(
      eq(campaignSeatEventsTable.stylistProfileId, profileId),
      eq(campaignSeatEventsTable.kind, "withdrew"),
      eq(campaignSeatEventsTable.severity, "last_minute"),
    ));
  return row?.n ?? 0;
}

function artistDetails(call: CallRow, rate: number) {
  return {
    brandName: call.brandName,
    castingTitle: call.title,
    eventDate: formatLongDate(call.eventDate),
    location: call.location,
    rate,
  };
}

/** Is every artist now working this campaign paid up in full? Decides "deposit_paid" or "fully_paid". */
async function statusAfterSeatChange(tx: Tx, callId: string): Promise<"deposit_paid" | "fully_paid"> {
  const working = await tx.select().from(appointmentsTable)
    .where(and(eq(appointmentsTable.campaignId, callId), eq(appointmentsTable.status, "confirmed")));
  for (const job of working) {
    const collected = Math.round((await resolveCampaignCollected(tx, job.id)) * 100);
    if (collected < Math.round(campaignArtistCost(job.price).total * 100)) return "deposit_paid";
  }
  return "fully_paid";
}

// ---------------------------------------------------------------------------
// An artist withdraws
// ---------------------------------------------------------------------------

export async function withdrawArtist(
  call: CallRow,
  profile: typeof stylistProfilesTable.$inferSelect,
  reason: string | null,
): Promise<{ message: string; severity: WithdrawalSeverity | null; strikes: number } | Fail> {
  type Done = Fail | { funded: false } | { funded: true; severity: WithdrawalSeverity; hours: number; rate: number };
  const done = await db.transaction(async (tx): Promise<Done> => {
    const [locked] = await tx.select().from(castingCallsTable).where(eq(castingCallsTable.id, call.id)).for("update");
    if (!locked) return { status: 404, error: "Campaign not found" };
    if (locked.status === "cancelled") return { status: 409, error: "This campaign has been cancelled." };
    const [app] = await tx.select().from(castingApplicationsTable)
      .where(and(eq(castingApplicationsTable.castingId, locked.id), eq(castingApplicationsTable.stylistId, profile.id)));
    if (!app || app.status !== "accepted") return { status: 409, error: "You are not on this campaign's team." };

    // Not paid for yet: she simply steps out of the team. Nothing to refund, no mark against her.
    if (!isFunded(locked)) {
      await tx.update(castingApplicationsTable).set({ status: "withdrawn", respondedAt: new Date() }).where(eq(castingApplicationsTable.id, app.id));
      return { funded: false };
    }

    const hours = hoursUntilEvent(locked);
    if (hours !== null && hours <= 0) {
      return { status: 409, error: "The event has already started. Please contact Bonisa." };
    }
    const [job] = await tx.select().from(appointmentsTable).where(and(
      eq(appointmentsTable.campaignId, locked.id),
      eq(appointmentsTable.stylistId, profile.id),
      eq(appointmentsTable.status, "confirmed"),
    )).for("update");
    if (!job) return { status: 409, error: "We could not find your booking on this campaign." };
    if (job.payoutStatus !== "held" || job.workConfirmedByArtist || job.workConfirmedByClient) {
      return { status: 409, error: "This job is already being wrapped up, so you cannot withdraw. Contact Bonisa if something is wrong." };
    }

    const severity = withdrawalSeverity(hours ?? 9999);
    await tx.update(appointmentsTable).set({ status: "cancelled", seatOpen: true }).where(eq(appointmentsTable.id, job.id));
    await tx.update(castingApplicationsTable).set({ status: "withdrawn", respondedAt: new Date() }).where(eq(castingApplicationsTable.id, app.id));
    await tx.insert(campaignSeatEventsTable).values({
      id: randomUUID(),
      castingId: locked.id,
      kind: "withdrew",
      stylistProfileId: profile.id,
      stylistName: profile.name,
      severity,
      hoursBefore: hours === null ? null : Math.round(hours * 10) / 10,
      reason,
    });
    // The first replacement wave goes out straight away.
    await tx.update(castingCallsTable).set({ seatWave: 0, seatWaveAt: null, seatDecisionNotifiedAt: null }).where(eq(castingCallsTable.id, locked.id));
    return { funded: true, severity, hours: hours ?? 9999, rate: job.price };
  });
  if ("error" in done) return done;

  if (!done.funded) {
    setImmediate(() => void notifyUserId(call.brandId, "campaign.artist_declined", { artistName: profile.name, castingTitle: call.title }));
    return { message: "You are off the team. Nothing had been paid yet, so there is no mark against you.", severity: null, strikes: await strikeCount(profile.id) };
  }

  const strikes = await strikeCount(profile.id);
  const note = done.severity === "early"
    ? "Thank you for telling us early. There is no mark against you."
    : done.severity === "late"
      ? "This is a late withdrawal, so it has been noted on your record."
      : `This is a last-minute withdrawal, so it counts as a strike (${strikes} so far). Several strikes means Bonisa reviews your account. You are not paid for this job.`;

  setImmediate(async () => {
    await notifyUserId(call.brandId, "campaign.artist_withdrew", { artistName: profile.name, castingTitle: call.title });
    await notifyStylistProfile(profile.id, "campaign.withdrawal_recorded", { castingTitle: call.title, note });
    try {
      await sendSeatWave(call.id);
    } catch (err) {
      logger.warn({ err }, "Could not send the first seat offers");
    }
  });
  return { message: `You have withdrawn. ${note}`, severity: done.severity, strikes };
}

// ---------------------------------------------------------------------------
// A replacement takes a seat
// ---------------------------------------------------------------------------

/**
 * Put an artist into the oldest open seat. The caller holds the campaign row locked and has
 * already decided she is allowed (invited, applied, or accepted by the brand). Everything the
 * brand paid for the seat moves across to her new job, so nothing extra is owed or lost.
 */
export async function fillOpenSeat(
  tx: Tx,
  call: CallRow,
  profile: typeof stylistProfilesTable.$inferSelect,
  applicationId: string,
): Promise<Fail | { replaced: string; seatsLeft: number; status: "deposit_paid" | "fully_paid" }> {
  if (!isFunded(call)) return { status: 409, error: "This campaign has no open seat." };
  if (!profile.verified) return { status: 409, error: "This artist is not verified, so she cannot be booked." };
  const [artistUser] = await tx.select({ status: usersTable.accountStatus }).from(usersTable).where(eq(usersTable.id, profile.userId));
  if (artistUser?.status === "suspended") return { status: 409, error: "This artist's account is suspended." };
  if (call.eventDate && await artistHasConflict(profile.id, call.eventDate, call.eventTime, call.id)) {
    return { status: 409, error: "This artist already has another booking at that date and time." };
  }

  const [seat] = await tx.select().from(appointmentsTable).where(and(
    eq(appointmentsTable.campaignId, call.id),
    eq(appointmentsTable.status, "cancelled"),
    eq(appointmentsTable.seatOpen, true),
  )).orderBy(asc(appointmentsTable.createdAt)).limit(1).for("update");
  if (!seat) return { status: 409, error: "Sorry, that seat has just been filled." };

  const newId = randomUUID();
  try {
    await tx.insert(appointmentsTable).values({
      id: newId,
      clientId: seat.clientId,
      clientName: seat.clientName,
      stylistId: profile.id,
      stylistName: profile.name,
      serviceId: seat.serviceId,
      serviceName: seat.serviceName,
      date: call.eventDate ?? seat.date,
      time: call.eventTime,
      status: "confirmed",
      price: seat.price,
      duration: seat.duration,
      notes: seat.notes,
      paymentMode: seat.paymentMode,
      depositAmount: seat.depositAmount,
      balanceDue: seat.balanceDue,
      isTeamBooking: false,
      campaignId: call.id,
      feeMode: "brand_on_top",
    });
  } catch (err) {
    if (isUniqueViolation(err)) return { status: 409, error: "This artist already has another booking at that date and time." };
    throw err;
  }

  // Move the brand's money over to the new job, and record it as held for her.
  await tx.update(paymentsTable).set({ appointmentId: newId }).where(eq(paymentsTable.appointmentId, seat.id));
  const collected = await resolveCampaignCollected(tx, newId);
  await holdCampaignEscrow(tx, { id: newId, price: seat.price }, collected, null);
  await tx.update(appointmentsTable).set({ seatOpen: false }).where(eq(appointmentsTable.id, seat.id));
  await tx.update(castingApplicationsTable).set({ status: "accepted", respondedAt: new Date() }).where(eq(castingApplicationsTable.id, applicationId));
  await tx.insert(campaignSeatEventsTable).values({
    id: randomUUID(), castingId: call.id, kind: "filled", stylistProfileId: profile.id, stylistName: profile.name, otherName: seat.stylistName,
  });

  const [left] = await tx.select({ n: sql<number>`count(*)::int` }).from(appointmentsTable).where(and(
    eq(appointmentsTable.campaignId, call.id), eq(appointmentsTable.status, "cancelled"), eq(appointmentsTable.seatOpen, true),
  ));
  const seatsLeft = left?.n ?? 0;
  if (seatsLeft === 0) {
    // Nobody else needs to be asked: close every offer still hanging.
    await tx.update(castingApplicationsTable).set({ status: "passed", respondedAt: new Date() }).where(and(
      eq(castingApplicationsTable.castingId, call.id),
      eq(castingApplicationsTable.source, "seat_offer"),
      eq(castingApplicationsTable.status, "invited"),
    ));
  }
  const status = await statusAfterSeatChange(tx, call.id);
  await tx.update(castingCallsTable).set({ status }).where(eq(castingCallsTable.id, call.id));
  return { replaced: seat.stylistName, seatsLeft, status };
}

/** After a seat is filled: open her conversation with the brand and tell everyone. */
export async function afterSeatFilled(call: CallRow, profile: typeof stylistProfilesTable.$inferSelect, replaced: string, rate: number) {
  try {
    const [existing] = await db.select({ id: conversationsTable.id }).from(conversationsTable)
      .where(and(eq(conversationsTable.clientId, call.brandId), eq(conversationsTable.stylistId, profile.userId)));
    if (!existing) await db.insert(conversationsTable).values({ id: randomUUID(), clientId: call.brandId, stylistId: profile.userId });
  } catch (err) {
    logger.warn({ err }, "Could not open a conversation for a replacement artist");
  }
  await notifyStylistProfile(profile.id, "campaign.funded", {
    brandName: call.brandName, castingTitle: call.title, eventDate: formatLongDate(call.eventDate), location: call.location, rate,
  });
  await notifyUserId(call.brandId, "campaign.seat_filled", { artistName: profile.name, otherName: replaced, castingTitle: call.title });
}

// ---------------------------------------------------------------------------
// Offering a seat in waves
// ---------------------------------------------------------------------------

/** How long to wait between waves: relaxed when the event is far off, quick as it gets close. */
function waveGapMs(hours: number): number {
  if (hours > 72) return 120 * MINUTE_MS;
  if (hours > 24) return 60 * MINUTE_MS;
  return 15 * MINUTE_MS;
}

async function openSeatCount(callId: string): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(appointmentsTable).where(and(
    eq(appointmentsTable.campaignId, callId), eq(appointmentsTable.status, "cancelled"), eq(appointmentsTable.seatOpen, true),
  ));
  return row?.n ?? 0;
}

/**
 * Send the next wave of seat offers for one campaign. Wave one goes to the brand's backup list
 * (applicants not yet chosen). Later waves go to the best matching verified artists who are free.
 * The first to accept gets the seat. Returns how many offers went out.
 */
export async function sendSeatWave(callId: string, now: Date = new Date()): Promise<number> {
  const [call] = await db.select().from(castingCallsTable).where(eq(castingCallsTable.id, callId));
  if (!call || !isFunded(call)) return 0;
  const hours = hoursUntilEvent(call, now);
  if (hours !== null && hours <= 0) return 0;
  if (call.seatWave >= MAX_WAVES) return 0;
  if (call.seatWaveAt && hours !== null && now.getTime() - call.seatWaveAt.getTime() < waveGapMs(hours)) return 0;
  const seats = await openSeatCount(call.id);
  if (seats === 0) return 0;

  // Claim this wave first so two runs never send it twice.
  const claimed = await db.update(castingCallsTable).set({ seatWave: call.seatWave + 1, seatWaveAt: now })
    .where(and(eq(castingCallsTable.id, call.id), eq(castingCallsTable.seatWave, call.seatWave)))
    .returning({ id: castingCallsTable.id });
  if (claimed.length === 0) return 0;

  const [firstSeat] = await db.select().from(appointmentsTable).where(and(
    eq(appointmentsTable.campaignId, call.id), eq(appointmentsTable.status, "cancelled"), eq(appointmentsTable.seatOpen, true),
  )).orderBy(asc(appointmentsTable.createdAt)).limit(1);
  const rate = firstSeat?.price ?? call.ratePerArtist;

  const targets: { stylistId: string; applicationId?: string; name: string }[] = [];

  // The brand's own backup list first.
  const backups = await db.select().from(castingApplicationsTable).where(and(
    eq(castingApplicationsTable.castingId, call.id),
    eq(castingApplicationsTable.source, "applied"),
    inArray(castingApplicationsTable.status, ["shortlisted", "pending"]),
  )).orderBy(asc(castingApplicationsTable.appliedAt), asc(castingApplicationsTable.id));
  backups.sort((a, b) => Number(b.status === "shortlisted") - Number(a.status === "shortlisted"));
  for (const b of backups) {
    if (targets.length >= OFFERS_PER_WAVE) break;
    targets.push({ stylistId: b.stylistId, applicationId: b.id, name: b.stylistName });
  }

  // Then matching verified artists who are free on the day.
  if (targets.length < OFFERS_PER_WAVE) {
    const known = await db.select({ stylistId: castingApplicationsTable.stylistId }).from(castingApplicationsTable)
      .where(eq(castingApplicationsTable.castingId, call.id));
    const skip = new Set([...known.map((k) => k.stylistId), ...targets.map((t) => t.stylistId)]);
    const candidates = await db.select({ profile: stylistProfilesTable, status: usersTable.accountStatus })
      .from(stylistProfilesTable)
      .innerJoin(usersTable, eq(usersTable.id, stylistProfilesTable.userId))
      .where(and(eq(stylistProfilesTable.verified, true), sql`lower(${stylistProfilesTable.specialty}) = lower(${call.specialty})`))
      .orderBy(desc(stylistProfilesTable.rating), desc(stylistProfilesTable.reviewCount), asc(stylistProfilesTable.id))
      .limit(80);
    for (const c of candidates) {
      if (targets.length >= OFFERS_PER_WAVE) break;
      if (skip.has(c.profile.id) || c.status === "suspended") continue;
      if (call.eventDate && await artistHasConflict(c.profile.id, call.eventDate, call.eventTime, call.id)) continue;
      targets.push({ stylistId: c.profile.id, name: c.profile.name });
    }
  }

  let sent = 0;
  for (const t of targets) {
    try {
      if (t.applicationId) {
        await db.update(castingApplicationsTable).set({ source: "seat_offer", status: "invited", respondedAt: null })
          .where(eq(castingApplicationsTable.id, t.applicationId));
      } else {
        await db.insert(castingApplicationsTable).values({
          id: randomUUID(), castingId: call.id, castingTitle: call.title, stylistId: t.stylistId, stylistName: t.name, status: "invited", source: "seat_offer",
        });
      }
      await notifyStylistProfile(t.stylistId, "casting.seat_offer", artistDetails(call, rate));
      sent++;
    } catch (err) {
      logger.warn({ err, stylistId: t.stylistId }, "Could not send a seat offer");
    }
  }
  return sent;
}

/** Runs every few minutes: next waves, and the "24 hours left, you decide" notice to the brand. */
export async function runSeatJob(now: Date = new Date()): Promise<void> {
  const calls = await db.select().from(castingCallsTable).where(inArray(castingCallsTable.status, ["deposit_paid", "fully_paid"]));
  for (const call of calls) {
    try {
      if (await openSeatCount(call.id) === 0) continue;
      const hours = hoursUntilEvent(call, now);
      if (hours === null || hours <= 0) continue;
      if (hours < 24 && !call.seatDecisionNotifiedAt) {
        const claimed = await db.update(castingCallsTable).set({ seatDecisionNotifiedAt: now })
          .where(and(eq(castingCallsTable.id, call.id), isNull(castingCallsTable.seatDecisionNotifiedAt)))
          .returning({ id: castingCallsTable.id });
        if (claimed.length) {
          await notifyUserId(call.brandId, "campaign.seat_decision", { castingTitle: call.title, seatCount: await openSeatCount(call.id) });
        }
      }
      await sendSeatWave(call.id, now);
    } catch (err) {
      logger.warn({ err, castingId: call.id }, "Seat job failed for one campaign");
    }
  }
}

export function startSeatJob() {
  const run = () => runSeatJob().catch((err) => logger.error({ err }, "Seat job failed"));
  setTimeout(run, 120 * 1000);
  setInterval(run, 5 * MINUTE_MS);
  logger.info("Campaign seat job scheduled");
}

// ---------------------------------------------------------------------------
// The brand gives a seat up, or asks Bonisa to cancel
// ---------------------------------------------------------------------------

/** Go ahead with fewer artists. What was paid for the open seats is marked as owed back to the brand. */
export async function giveUpOpenSeats(call: CallRow): Promise<{ seats: number; refund: number } | Fail> {
  const result = await db.transaction(async (tx): Promise<Fail | { seats: number; refund: number; names: string[] }> => {
    const [locked] = await tx.select().from(castingCallsTable).where(eq(castingCallsTable.id, call.id)).for("update");
    if (!locked || !isFunded(locked)) return { status: 409, error: "This campaign has no open seats." };
    const seats = await tx.select().from(appointmentsTable).where(and(
      eq(appointmentsTable.campaignId, locked.id), eq(appointmentsTable.status, "cancelled"), eq(appointmentsTable.seatOpen, true),
    )).for("update");
    if (seats.length === 0) return { status: 409, error: "There are no open seats to give up." };
    const [working] = await tx.select({ n: sql<number>`count(*)::int` }).from(appointmentsTable)
      .where(and(eq(appointmentsTable.campaignId, locked.id), eq(appointmentsTable.status, "confirmed")));
    if ((working?.n ?? 0) === 0) return { status: 409, error: "Every artist has withdrawn. Ask Bonisa to cancel the campaign instead." };

    let refund = 0;
    for (const seat of seats) {
      const collected = await resolveCampaignCollected(tx, seat.id);
      refund += collected;
      await tx.update(appointmentsTable).set({ seatOpen: false, refundDueAmount: collected }).where(eq(appointmentsTable.id, seat.id));
      await tx.insert(campaignSeatEventsTable).values({
        id: randomUUID(), castingId: locked.id, kind: "given_up", stylistName: seat.stylistName, otherName: seat.stylistName, amount: collected,
      });
    }
    await tx.update(castingApplicationsTable).set({ status: "passed", respondedAt: new Date() }).where(and(
      eq(castingApplicationsTable.castingId, locked.id),
      eq(castingApplicationsTable.source, "seat_offer"),
      eq(castingApplicationsTable.status, "invited"),
    ));
    const status = await statusAfterSeatChange(tx, locked.id);
    await tx.update(castingCallsTable).set({ status }).where(eq(castingCallsTable.id, locked.id));
    return { seats: seats.length, refund: Math.round(refund * 100) / 100, names: seats.map((s) => s.stylistName) };
  });
  if ("error" in result) return result;
  setImmediate(() => void notifyUserId(call.brandId, "campaign.seat_refund", { castingTitle: call.title, amount: result.refund }));
  return { seats: result.seats, refund: result.refund };
}

/** A brand with a paid campaign cannot cancel it alone. This tells Bonisa, who decides what is fair. */
export async function requestCancellation(call: CallRow, reason: string | null): Promise<{ ok: true } | Fail> {
  const claimed = await db.update(castingCallsTable).set({ cancellationRequestedAt: new Date(), cancellationReason: reason })
    .where(and(eq(castingCallsTable.id, call.id), inArray(castingCallsTable.status, ["deposit_paid", "fully_paid"])))
    .returning({ id: castingCallsTable.id });
  if (claimed.length === 0) return { status: 409, error: "Only a campaign that has been paid for needs a cancellation request." };
  setImmediate(async () => {
    const ownerEmail = process.env["OWNER_EMAIL"]?.trim().toLowerCase();
    if (!ownerEmail) return;
    const [owner] = await db.select({ id: usersTable.id }).from(usersTable).where(sql`lower(${usersTable.email}) = ${ownerEmail}`);
    if (owner) await notifyUserId(owner.id, "campaign.cancellation_requested", { brandName: call.brandName, castingTitle: call.title, note: reason ?? undefined });
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// For the owner's portal
// ---------------------------------------------------------------------------

export async function ownerSeatAttention() {
  const refundRows = await db.select({
    appointmentId: appointmentsTable.id,
    castingId: appointmentsTable.campaignId,
    amount: appointmentsTable.refundDueAmount,
    refundedAt: appointmentsTable.refundedAt,
    reference: appointmentsTable.refundReference,
    artistName: appointmentsTable.stylistName,
    brandName: appointmentsTable.clientName,
    title: appointmentsTable.serviceName,
  }).from(appointmentsTable).where(sql`${appointmentsTable.refundDueAmount} > 0`).orderBy(desc(appointmentsTable.createdAt)).limit(100);

  const cancellations = await db.select().from(castingCallsTable)
    .where(and(sql`${castingCallsTable.cancellationRequestedAt} is not null`, inArray(castingCallsTable.status, ["deposit_paid", "fully_paid"])))
    .orderBy(desc(castingCallsTable.cancellationRequestedAt));

  const since = new Date(Date.now() - 60 * 86_400_000);
  const withdrawals = await db.select({ e: campaignSeatEventsTable, title: castingCallsTable.title, brandName: castingCallsTable.brandName })
    .from(campaignSeatEventsTable)
    .innerJoin(castingCallsTable, eq(castingCallsTable.id, campaignSeatEventsTable.castingId))
    .where(and(eq(campaignSeatEventsTable.kind, "withdrew"), gte(campaignSeatEventsTable.createdAt, since)))
    .orderBy(desc(campaignSeatEventsTable.createdAt)).limit(100);

  const strikeRows = await db.select({
    profileId: campaignSeatEventsTable.stylistProfileId,
    n: sql<number>`count(*)::int`,
  }).from(campaignSeatEventsTable)
    .where(and(eq(campaignSeatEventsTable.kind, "withdrew"), eq(campaignSeatEventsTable.severity, "last_minute")))
    .groupBy(campaignSeatEventsTable.stylistProfileId);
  const strikes = new Map(strikeRows.map((r) => [r.profileId ?? "", r.n]));

  return {
    refunds: refundRows.map((r) => ({
      appointmentId: r.appointmentId,
      castingId: r.castingId ?? "",
      campaignTitle: r.title,
      brandName: r.brandName,
      artistName: r.artistName,
      amount: r.amount,
      refundedAt: r.refundedAt?.toISOString() ?? null,
      reference: r.reference ?? null,
    })),
    cancellationRequests: cancellations.map((c) => ({
      castingId: c.id,
      campaignTitle: c.title,
      brandName: c.brandName,
      reason: c.cancellationReason ?? null,
      requestedAt: c.cancellationRequestedAt!.toISOString(),
    })),
    withdrawals: withdrawals.map(({ e, title, brandName }) => ({
      id: e.id,
      castingId: e.castingId,
      campaignTitle: title,
      brandName,
      artistName: e.stylistName,
      stylistId: e.stylistProfileId ?? "",
      severity: (e.severity ?? "early") as WithdrawalSeverity,
      hoursBefore: e.hoursBefore ?? null,
      reason: e.reason ?? null,
      strikes: strikes.get(e.stylistProfileId ?? "") ?? 0,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}

export async function markSeatRefunded(appointmentId: string, reference: string | null): Promise<boolean> {
  const updated = await db.update(appointmentsTable).set({ refundedAt: new Date(), refundReference: reference })
    .where(and(eq(appointmentsTable.id, appointmentId), sql`${appointmentsTable.refundDueAmount} > 0`, isNull(appointmentsTable.refundedAt)))
    .returning({ id: appointmentsTable.id });
  return updated.length > 0;
}
