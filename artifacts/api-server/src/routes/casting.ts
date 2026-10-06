/**
 * Casting calls, now brand campaigns with real numbers.
 *
 * Anyone signed in:
 *   GET   /casting                  — campaigns you may see
 *   GET   /casting/:id
 * Verified brand (and only the brand that owns the campaign):
 *   POST  /casting                  — post a campaign
 *   PATCH /casting/:id              — edit while nothing has been paid
 *   DELETE /casting/:id             — same as cancel
 *   GET   /casting/:id/applicants   — applicants and invited artists (the owner can read too)
 *   POST  /casting/:id/applicants/:applicationId/decision  — shortlist, accept or pass
 *   POST  /casting/:id/invite       — invite a verified artist
 *   POST  /casting/:id/cancel       — cancel before paying
 * Verified artist:
 *   POST  /casting/:id/apply
 *   POST  /casting/:id/invitation   — accept or decline an invitation
 *
 * Money lives in routes/campaign-payments.ts. Every rule here is enforced on the
 * server, because a native app is a second client of this API.
 *
 * An applicant always finds out the outcome: shortlisted, accepted or passed over.
 */
import { Router } from "express";
import type { Request, Response } from "express";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import {
  castingApplicationsTable,
  castingCallsTable,
  db,
  stylistProfilesTable,
  usersTable,
} from "@workspace/db";
import {
  CreateCastingCallBody,
  DecideCastingApplicantBody,
  InviteArtistToCastingBody,
  RespondToCastingInvitationBody,
  UpdateCastingCallBody,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { param } from "../lib/params";
import { sendNotification } from "../lib/notifications";
import { daysUntil } from "../lib/money";
import {
  artistHasConflict,
  artistJobsCompleted,
  budgetText,
  deadlinePassed,
  formatCalls,
  formatLongDate,
  getOrCreateBrandProfile,
  isBrandVerified,
  isOwnerUser,
  notifyStylistProfile,
  notifyUserId,
  type ApplicationRow,
  type CallRow,
} from "../lib/campaigns";
import { cancelCampaignCall } from "../lib/campaign-payments";

const router = Router();

type Fail = { status: number; error: string };

const isValidDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

/** The brand that owns this campaign, and only that brand. */
async function loadOwnCall(req: Request, res: Response, castingId: string, opts: { allowOwner?: boolean } = {}) {
  const user = (req as any).user;
  const [call] = await db.select().from(castingCallsTable).where(eq(castingCallsTable.id, castingId));
  if (!call) { res.status(404).json({ error: "Campaign not found" }); return null; }
  const isOwner = call.brandId === user.id;
  if (!isOwner && !(opts.allowOwner && isOwnerUser(user))) {
    res.status(403).json({ error: "This campaign belongs to another brand." });
    return null;
  }
  return { call, user };
}

async function requireVerifiedBrandUser(user: any, res: Response): Promise<boolean> {
  if (user.role !== "brand") { res.status(403).json({ error: "Only brand accounts can do this." }); return false; }
  if (!(await isBrandVerified(user.id))) {
    res.status(403).json({ error: "Your brand needs to be verified first. Complete your brand profile and submit it for review." });
    return false;
  }
  return true;
}

function presentApplicant(app: ApplicationRow, profile: typeof stylistProfilesTable.$inferSelect | undefined, jobs: number) {
  return {
    applicationId: app.id,
    stylistId: app.stylistId,
    name: profile?.name ?? app.stylistName,
    specialty: profile?.specialty ?? "",
    location: profile?.location ?? "",
    source: app.source as "applied" | "invited",
    status: app.status as "pending" | "shortlisted" | "invited" | "accepted" | "declined" | "passed",
    jobsCompleted: jobs,
    rating: profile?.rating ?? 0,
    reviewCount: profile?.reviewCount ?? 0,
    appliedAt: app.appliedAt.toISOString(),
  };
}

async function presentApplicantById(applicationId: string) {
  const [app] = await db.select().from(castingApplicationsTable).where(eq(castingApplicationsTable.id, applicationId));
  const [profile] = await db.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.id, app!.stylistId));
  const jobs = await artistJobsCompleted([app!.stylistId]);
  return presentApplicant(app!, profile, jobs.get(app!.stylistId) ?? 0);
}

/** How many artists have accepted a place on this campaign. Callers hold the campaign row locked. */
async function countAccepted(tx: Pick<typeof db, "select">, castingId: string): Promise<number> {
  const [row] = await tx.select({ n: sql<number>`count(*)::int` }).from(castingApplicationsTable)
    .where(and(eq(castingApplicationsTable.castingId, castingId), eq(castingApplicationsTable.status, "accepted")));
  return row?.n ?? 0;
}

function artistDetails(call: CallRow) {
  return {
    brandName: call.brandName,
    castingTitle: call.title,
    eventDate: formatLongDate(call.eventDate),
    location: call.location,
    rate: call.ratePerArtist,
  };
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

router.get("/casting", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { specialty, brandId } = req.query as Record<string, string>;
  const owner = isOwnerUser(user);
  let calls = await db.select().from(castingCallsTable).orderBy(desc(castingCallsTable.createdAt), desc(castingCallsTable.id));

  if (specialty) calls = calls.filter((c) => c.specialty.toLowerCase() === specialty.toLowerCase());
  if (brandId && owner) calls = calls.filter((c) => c.brandId === brandId);

  if (!owner) {
    if (user.role === "brand") {
      // A brand sees its own campaigns, not its competitors'.
      calls = calls.filter((c) => c.brandId === user.id);
    } else {
      // Artists and clients see open campaigns from verified brands, plus any campaign they are part of.
      const formatted = await formatCalls(calls, user);
      const visibleIds = new Set(formatted
        .filter((c) => c.myStatus !== "none"
          || (c.status === "open" && c.ratePerArtist > 0 && c.brandVerified && !deadlinePassed(c.deadline)))
        .map((c) => c.id));
      res.json(formatted.filter((c) => visibleIds.has(c.id)));
      return;
    }
  }
  res.json(await formatCalls(calls, user));
});

router.get("/casting/:castingId", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const [call] = await db.select().from(castingCallsTable).where(eq(castingCallsTable.id, param(req.params.castingId)));
  if (!call) { res.status(404).json({ error: "Not found" }); return; }
  const [formatted] = await formatCalls([call], user);
  const mine = call.brandId === user.id || isOwnerUser(user);
  const visible = mine || formatted!.myStatus !== "none"
    || (call.status === "open" && call.ratePerArtist > 0 && formatted!.brandVerified);
  if (!visible) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatted);
});

// ---------------------------------------------------------------------------
// Posting and editing (the brand that owns it)
// ---------------------------------------------------------------------------

router.post("/casting", requireAuth, async (req, res) => {
  const user = (req as any).user;
  if (!(await requireVerifiedBrandUser(user, res))) return;
  const parsed = CreateCastingCallBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Check the campaign details and try again." }); return; }
  const data = parsed.data;
  if (!isValidDate(data.eventDate) || !isValidDate(data.deadline)) { res.status(400).json({ error: "Those dates do not look right." }); return; }
  if (daysUntil(data.eventDate) < 1) { res.status(400).json({ error: "The event date must be at least tomorrow." }); return; }
  if (daysUntil(data.deadline) < 0) { res.status(400).json({ error: "The application deadline has already passed." }); return; }
  if (data.deadline > data.eventDate) { res.status(400).json({ error: "Applications must close on or before the event date." }); return; }

  const profile = await getOrCreateBrandProfile(user);
  const [call] = await db.insert(castingCallsTable).values({
    id: randomUUID(),
    brandId: user.id,
    brandName: profile.companyName || user.businessName || user.name,
    title: data.title.trim(),
    brief: data.brief.trim(),
    budget: budgetText(data.ratePerArtist, data.artistsNeeded),
    deadline: data.deadline,
    specialty: data.specialty,
    artistsNeeded: data.artistsNeeded,
    ratePerArtist: data.ratePerArtist,
    eventDate: data.eventDate,
    eventTime: data.eventTime ?? "09:00",
    location: data.location.trim(),
  }).returning();

  const [formatted] = await formatCalls([call!], user);
  res.status(201).json(formatted);
});

router.patch("/casting/:castingId", requireAuth, async (req, res) => {
  const own = await loadOwnCall(req, res, param(req.params.castingId));
  if (!own) return;
  const parsed = UpdateCastingCallBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Check the campaign details and try again." }); return; }
  const data = parsed.data;

  const result = await db.transaction(async (tx): Promise<Fail | { call: CallRow }> => {
    const [call] = await tx.select().from(castingCallsTable).where(eq(castingCallsTable.id, own.call.id)).for("update");
    if (!call) return { status: 404, error: "Campaign not found" } as const;
    if (call.status !== "open") return { status: 409, error: "This campaign can no longer be edited because it has been paid for or cancelled." } as const;

    const acceptedCount = await countAccepted(tx, call.id);

    const changesMoneyOrDate = (data.ratePerArtist !== undefined && data.ratePerArtist !== call.ratePerArtist)
      || (data.eventDate !== undefined && data.eventDate !== call.eventDate)
      || (data.eventTime !== undefined && data.eventTime !== call.eventTime)
      || (data.location !== undefined && data.location.trim() !== call.location);
    if (acceptedCount > 0 && changesMoneyOrDate) {
      return { status: 409, error: "Artists have already accepted this campaign, so the rate, date, time and place can no longer change. Cancel it and create a new one if you need to." } as const;
    }
    if (data.artistsNeeded !== undefined && data.artistsNeeded < acceptedCount) {
      return { status: 409, error: `${acceptedCount} artists have already accepted, so you cannot ask for fewer than that.` } as const;
    }
    const eventDate = data.eventDate ?? call.eventDate;
    const deadline = data.deadline ?? call.deadline;
    if ((data.eventDate !== undefined && !isValidDate(data.eventDate)) || (data.deadline !== undefined && !isValidDate(data.deadline))) {
      return { status: 400, error: "Those dates do not look right." } as const;
    }
    if (data.eventDate !== undefined && daysUntil(data.eventDate) < 1) return { status: 400, error: "The event date must be at least tomorrow." } as const;
    if (data.deadline !== undefined && daysUntil(data.deadline) < 0) return { status: 400, error: "The application deadline has already passed." } as const;
    if (eventDate && deadline > eventDate) return { status: 400, error: "Applications must close on or before the event date." } as const;

    const rate = data.ratePerArtist ?? call.ratePerArtist;
    const needed = data.artistsNeeded ?? call.artistsNeeded;
    const [updated] = await tx.update(castingCallsTable).set({
      ...(data.title !== undefined ? { title: data.title.trim() } : {}),
      ...(data.brief !== undefined ? { brief: data.brief.trim() } : {}),
      ...(data.specialty !== undefined ? { specialty: data.specialty } : {}),
      ...(data.deadline !== undefined ? { deadline: data.deadline } : {}),
      ...(data.artistsNeeded !== undefined ? { artistsNeeded: data.artistsNeeded } : {}),
      ...(data.ratePerArtist !== undefined ? { ratePerArtist: data.ratePerArtist } : {}),
      ...(data.eventDate !== undefined ? { eventDate: data.eventDate } : {}),
      ...(data.eventTime !== undefined ? { eventTime: data.eventTime } : {}),
      ...(data.location !== undefined ? { location: data.location.trim() } : {}),
      ...(rate > 0 ? { budget: budgetText(rate, needed) } : {}),
    }).where(eq(castingCallsTable.id, call.id)).returning();
    return { call: updated! } as const;
  });

  if ("error" in result) { res.status(result.status).json({ error: result.error }); return; }
  const [formatted] = await formatCalls([result.call], own.user);
  res.json(formatted);
});

async function cancel(req: Request, res: Response) {
  const own = await loadOwnCall(req, res, param(req.params.castingId));
  if (!own) return;
  const result = await cancelCampaignCall(own.call);
  if ("error" in result) { res.status(409).json({ error: result.error }); return; }
  res.json({ message: "Campaign cancelled. The artists have been told." });
}
router.post("/casting/:castingId/cancel", requireAuth, cancel);
router.delete("/casting/:castingId", requireAuth, cancel);

// ---------------------------------------------------------------------------
// Applicants
// ---------------------------------------------------------------------------

router.get("/casting/:castingId/applicants", requireAuth, async (req, res) => {
  const own = await loadOwnCall(req, res, param(req.params.castingId), { allowOwner: true });
  if (!own) return;
  const apps = await db.select().from(castingApplicationsTable)
    .where(eq(castingApplicationsTable.castingId, own.call.id))
    .orderBy(asc(castingApplicationsTable.appliedAt), asc(castingApplicationsTable.id));
  const profiles = apps.length
    ? await db.select().from(stylistProfilesTable).where(inArray(stylistProfilesTable.id, apps.map((a) => a.stylistId)))
    : [];
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const jobs = await artistJobsCompleted(apps.map((a) => a.stylistId));
  const rank: Record<string, number> = { accepted: 0, shortlisted: 1, pending: 2, invited: 3, declined: 4, passed: 5 };
  res.json(apps
    .map((a) => presentApplicant(a, byId.get(a.stylistId), jobs.get(a.stylistId) ?? 0))
    .sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9)));
});

router.post("/casting/:castingId/applicants/:applicationId/decision", requireAuth, async (req, res) => {
  const own = await loadOwnCall(req, res, param(req.params.castingId));
  if (!own) return;
  if (!(await requireVerifiedBrandUser(own.user, res))) return;
  const parsed = DecideCastingApplicantBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Choose shortlist, accept or pass." }); return; }
  const applicationId = param(req.params.applicationId);
  const { decision } = parsed.data;

  const result = await db.transaction(async (tx): Promise<Fail | { app: ApplicationRow; call: CallRow; event: "casting.shortlisted" | "casting.accepted" | "casting.declined" }> => {
    const [call] = await tx.select().from(castingCallsTable).where(eq(castingCallsTable.id, own.call.id)).for("update");
    if (!call) return { status: 404, error: "Campaign not found" } as const;
    if (call.status !== "open") return { status: 409, error: "This campaign has been paid for or cancelled, so the team can no longer change." } as const;
    const [app] = await tx.select().from(castingApplicationsTable)
      .where(and(eq(castingApplicationsTable.id, applicationId), eq(castingApplicationsTable.castingId, call.id)));
    if (!app) return { status: 404, error: "Applicant not found" } as const;

    if (decision === "shortlist") {
      if (app.source !== "applied" || app.status !== "pending") return { status: 409, error: "Only new applicants can be shortlisted." } as const;
      await tx.update(castingApplicationsTable).set({ status: "shortlisted", respondedAt: new Date() }).where(eq(castingApplicationsTable.id, app.id));
      return { app, call, event: "casting.shortlisted" as const } as const;
    }

    if (decision === "accept") {
      if (app.source === "invited") return { status: 409, error: "You invited this artist, so she accepts herself. We will tell you when she does." } as const;
      if (app.status !== "pending" && app.status !== "shortlisted") return { status: 409, error: "This applicant has already been decided." } as const;
      const accepted = await countAccepted(tx, call.id);
      if (accepted >= call.artistsNeeded) return { status: 409, error: "Your team is already full. Pass on someone first, or ask for more artists." } as const;
      const [profile] = await tx.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.id, app.stylistId));
      if (!profile?.verified) return { status: 409, error: "This artist is not verified, so she cannot be booked." } as const;
      const [artistUser] = await tx.select({ status: usersTable.accountStatus }).from(usersTable).where(eq(usersTable.id, profile.userId));
      if (artistUser?.status === "suspended") return { status: 409, error: "This artist's account is suspended." } as const;
      if (call.eventDate && await artistHasConflict(app.stylistId, call.eventDate, call.eventTime, call.id)) {
        return { status: 409, error: "This artist already has another booking at that date and time." } as const;
      }
      await tx.update(castingApplicationsTable).set({ status: "accepted", respondedAt: new Date() }).where(eq(castingApplicationsTable.id, app.id));
      return { app, call, event: "casting.accepted" as const } as const;
    }

    // pass
    if (!["pending", "shortlisted", "accepted", "invited"].includes(app.status)) return { status: 409, error: "This applicant has already been decided." } as const;
    await tx.update(castingApplicationsTable).set({ status: "passed", respondedAt: new Date() }).where(eq(castingApplicationsTable.id, app.id));
    return { app, call, event: "casting.declined" as const } as const;
  });

  if ("error" in result) { res.status(result.status).json({ error: result.error }); return; }
  setImmediate(() => void notifyStylistProfile(result.app.stylistId, result.event, artistDetails(result.call)));
  res.json(await presentApplicantById(applicationId));
});

// ---------------------------------------------------------------------------
// Inviting artists, and artists answering
// ---------------------------------------------------------------------------

router.post("/casting/:castingId/invite", requireAuth, async (req, res) => {
  const own = await loadOwnCall(req, res, param(req.params.castingId));
  if (!own) return;
  if (!(await requireVerifiedBrandUser(own.user, res))) return;
  const parsed = InviteArtistToCastingBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Choose an artist to invite." }); return; }

  const result = await db.transaction(async (tx): Promise<Fail | { app: ApplicationRow; call: CallRow }> => {
    const [call] = await tx.select().from(castingCallsTable).where(eq(castingCallsTable.id, own.call.id)).for("update");
    if (!call) return { status: 404, error: "Campaign not found" } as const;
    if (call.status !== "open") return { status: 409, error: "This campaign has been paid for or cancelled, so you cannot invite more artists." } as const;
    if (call.ratePerArtist <= 0) return { status: 409, error: "Add what each artist is paid before inviting anyone." } as const;
    const [profile] = await tx.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.id, parsed.data.stylistId));
    if (!profile || !profile.verified) return { status: 404, error: "Only verified artists can be invited." } as const;
    const [artistUser] = await tx.select({ status: usersTable.accountStatus }).from(usersTable).where(eq(usersTable.id, profile.userId));
    if (artistUser?.status === "suspended") return { status: 404, error: "Only verified artists can be invited." } as const;

    const [existing] = await tx.select().from(castingApplicationsTable)
      .where(and(eq(castingApplicationsTable.castingId, call.id), eq(castingApplicationsTable.stylistId, profile.id)));
    if (existing) {
      const message = existing.source === "applied" && (existing.status === "pending" || existing.status === "shortlisted")
        ? `${profile.name} has already applied. Accept her application instead.`
        : `${profile.name} is already on this campaign (${existing.status}).`;
      return { status: 409, error: message } as const;
    }
    const [app] = await tx.insert(castingApplicationsTable).values({
      id: randomUUID(),
      castingId: call.id,
      castingTitle: call.title,
      stylistId: profile.id,
      stylistName: profile.name,
      status: "invited",
      source: "invited",
    }).returning();
    await tx.update(castingCallsTable).set({ applicantCount: call.applicantCount + 1 }).where(eq(castingCallsTable.id, call.id));
    return { app: app!, call } as const;
  });

  if ("error" in result) { res.status(result.status).json({ error: result.error }); return; }
  setImmediate(() => void notifyStylistProfile(result.app.stylistId, "casting.invited", artistDetails(result.call)));
  res.json(await presentApplicantById(result.app.id));
});

router.post("/casting/:castingId/invitation", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const [profile] = await db.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.userId, user.id));
  if (!profile) { res.status(403).json({ error: "Only artists can answer an invitation." }); return; }
  if (!profile.verified) { res.status(403).json({ error: "Only verified artists can take campaign jobs." }); return; }
  const parsed = RespondToCastingInvitationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Choose accept or decline." }); return; }
  const castingId = param(req.params.castingId);

  const result = await db.transaction(async (tx): Promise<Fail | { call: CallRow; accepted: boolean }> => {
    const [call] = await tx.select().from(castingCallsTable).where(eq(castingCallsTable.id, castingId)).for("update");
    if (!call) return { status: 404, error: "Campaign not found" } as const;
    const [app] = await tx.select().from(castingApplicationsTable)
      .where(and(eq(castingApplicationsTable.castingId, call.id), eq(castingApplicationsTable.stylistId, profile.id)));
    if (!app || app.source !== "invited" || app.status !== "invited") return { status: 409, error: "There is no open invitation for you on this campaign." } as const;
    if (call.status !== "open") return { status: 409, error: "This campaign is no longer taking changes." } as const;

    if (!parsed.data.accept) {
      await tx.update(castingApplicationsTable).set({ status: "declined", respondedAt: new Date() }).where(eq(castingApplicationsTable.id, app.id));
      return { call, accepted: false } as const;
    }
    const accepted = await countAccepted(tx, call.id);
    if (accepted >= call.artistsNeeded) return { status: 409, error: "Sorry, this team has just filled up." } as const;
    if (call.eventDate && await artistHasConflict(profile.id, call.eventDate, call.eventTime, call.id)) {
      return { status: 409, error: "You already have another booking at that date and time." } as const;
    }
    await tx.update(castingApplicationsTable).set({ status: "accepted", respondedAt: new Date() }).where(eq(castingApplicationsTable.id, app.id));
    return { call, accepted: true } as const;
  });

  if ("error" in result) { res.status(result.status).json({ error: result.error }); return; }
  setImmediate(() => void notifyUserId(
    result.call.brandId,
    result.accepted ? "campaign.artist_accepted" : "campaign.artist_declined",
    { artistName: profile.name, castingTitle: result.call.title },
  ));
  res.json({ message: result.accepted ? "You are on the team. We will confirm your booking once the brand has paid." : "Invitation declined." });
});

// ---------------------------------------------------------------------------
// Applying
// ---------------------------------------------------------------------------

router.post("/casting/:castingId/apply", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const [profile] = await db.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.userId, user.id));
  if (!profile) { res.status(403).json({ error: "Only stylists can apply" }); return; }
  // Verification is a gate: an unverified artist must not apply to casting calls.
  if (!profile.verified) { res.status(403).json({ error: "Only verified artists can apply to casting calls." }); return; }
  const [account] = await db.select({ status: usersTable.accountStatus }).from(usersTable).where(eq(usersTable.id, user.id));
  if (account?.status === "suspended") { res.status(403).json({ error: "Your account is suspended." }); return; }

  const result = await db.transaction(async (tx): Promise<Fail | { already: true } | { call: CallRow }> => {
    const [call] = await tx.select().from(castingCallsTable).where(eq(castingCallsTable.id, param(req.params.castingId))).for("update");
    if (!call) return { status: 404, error: "Not found" } as const;
    if (call.status !== "open" || call.ratePerArtist <= 0) return { status: 409, error: "This campaign is not taking applications." } as const;
    if (!(await isBrandVerified(call.brandId))) return { status: 404, error: "Not found" } as const;
    if (deadlinePassed(call.deadline)) return { status: 409, error: "Applications for this campaign have closed." } as const;

    const [existing] = await tx.select().from(castingApplicationsTable)
      .where(and(eq(castingApplicationsTable.castingId, call.id), eq(castingApplicationsTable.stylistId, profile.id)));
    if (existing) {
      if (existing.source === "invited" && existing.status === "invited") return { status: 409, error: "You were invited to this campaign. Accept or decline the invitation instead." } as const;
      return { already: true } as const;
    }
    const accepted = await countAccepted(tx, call.id);
    if (accepted >= call.artistsNeeded) return { status: 409, error: "This campaign's team is already full." } as const;

    await tx.insert(castingApplicationsTable).values({
      id: randomUUID(),
      castingId: call.id,
      castingTitle: call.title,
      stylistId: profile.id,
      stylistName: profile.name,
      status: "pending",
      source: "applied",
    });
    await tx.update(castingCallsTable).set({ applicantCount: call.applicantCount + 1 }).where(eq(castingCallsTable.id, call.id));
    return { call } as const;
  });

  if ("error" in result) { res.status(result.status).json({ error: result.error }); return; }
  if ("already" in result) { res.json({ message: "Already applied" }); return; }
  res.json({ message: "Applied successfully" });

  // Notify brand AND admin of new application, non-fatal
  setImmediate(async () => {
    const notificationData = {
      applicantName: profile.name,
      castingTitle: result.call.title,
      brandName: result.call.brandName,
    };
    try {
      const [brandUser] = await db.select().from(usersTable).where(eq(usersTable.id, result.call.brandId));
      await sendNotification(brandUser?.phone, "casting.applied", notificationData);
    } catch { /* non-fatal */ }
    try {
      const adminPhone = process.env["ADMIN_WHATSAPP_PHONE"];
      if (adminPhone) await sendNotification(adminPhone, "casting.applied", notificationData);
    } catch { /* non-fatal */ }
  });
});

export default router;
