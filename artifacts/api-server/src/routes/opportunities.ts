import { Router } from "express";
import { randomUUID } from "crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  db, usersTable, modelProfilesTable, opportunitiesTable, opportunityApplicationsTable,
  savedOpportunitiesTable, opportunityReportsTable,
} from "@workspace/db";
import {
  ListOpportunitiesQueryParams, ApplyToOpportunityBody, ReportOpportunityBody, CreateOpportunityBody,
  SetOpportunityStatusBody, DecideApplicationBody,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { requireBrand, requireModel, optionalUser } from "../lib/modelAuth";
import { recordAudit } from "../lib/audit";
import { param } from "../lib/params";
import { shows } from "../lib/modelDto";

const router = Router();

type Opp = typeof opportunitiesTable.$inferSelect;
type App = typeof opportunityApplicationsTable.$inferSelect;

/** Today in South Africa, as YYYY-MM-DD, so deadlines close at local midnight. */
function todaySA(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });
}

/** A listing past its deadline is closed even if the organiser never closed it. */
function effectiveStatus(o: Opp): "open" | "closed" {
  return o.status === "open" && o.applicationDeadline >= todaySA() ? "open" : "closed";
}

function opportunityDto(o: Opp, extra: { applicantCount?: number; reportCount?: number; isSaved?: boolean; myApplicationStatus?: string | null } = {}) {
  return {
    id: o.id,
    organiserName: o.organiserName,
    type: o.type,
    title: o.title,
    brief: o.brief,
    deliverables: o.deliverables,
    eligibility: o.eligibility,
    startDate: o.startDate,
    endDate: o.endDate,
    location: o.location,
    isRemote: o.isRemote,
    compensationCents: o.compensationCents,
    compensationNote: o.compensationNote,
    expensesNote: o.expensesNote,
    usageRights: o.usageRights,
    exclusivity: o.exclusivity,
    paymentTerms: o.paymentTerms,
    applicationDeadline: o.applicationDeadline,
    status: effectiveStatus(o),
    createdAt: o.createdAt.toISOString(),
    applicantCount: extra.applicantCount ?? null,
    reportCount: extra.reportCount ?? null,
    isSaved: extra.isSaved ?? null,
    myApplicationStatus: extra.myApplicationStatus ?? null,
  };
}

export function myApplicationDto(a: App, o: Opp) {
  return {
    id: a.id,
    status: a.status as "applied" | "shortlisted" | "accepted" | "passed" | "withdrawn",
    statusNote: a.statusNote,
    message: a.message,
    proposedFeeCents: a.proposedFeeCents,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    opportunity: { id: o.id, title: o.title, organiserName: o.organiserName, type: o.type, status: effectiveStatus(o), applicationDeadline: o.applicationDeadline },
  };
}

/** Adds saved / applied state when the viewer is a signed-in model. */
async function withModelState(rows: Opp[], viewer: any) {
  if (!rows.length || viewer?.role !== "model") return rows.map((o) => opportunityDto(o));
  const [profile] = await db.select().from(modelProfilesTable).where(eq(modelProfilesTable.userId, viewer.id));
  if (!profile) return rows.map((o) => opportunityDto(o));
  const ids = rows.map((o) => o.id);
  const [saved, apps] = await Promise.all([
    db.select().from(savedOpportunitiesTable).where(and(eq(savedOpportunitiesTable.modelProfileId, profile.id), inArray(savedOpportunitiesTable.opportunityId, ids))),
    db.select().from(opportunityApplicationsTable).where(and(eq(opportunityApplicationsTable.modelProfileId, profile.id), inArray(opportunityApplicationsTable.opportunityId, ids))),
  ]);
  return rows.map((o) => opportunityDto(o, {
    isSaved: saved.some((s) => s.opportunityId === o.id),
    myApplicationStatus: apps.find((a) => a.opportunityId === o.id)?.status ?? null,
  }));
}

// ── Public ──────────────────────────────────────────────────────────────────

router.get("/opportunities", optionalUser, async (req, res) => {
  const q = ListOpportunitiesQueryParams.safeParse(req.query);
  if (!q.success) { res.status(400).json({ error: "Validation error" }); return; }
  const rows = await db.select().from(opportunitiesTable)
    .where(and(eq(opportunitiesTable.status, "open"), sql`${opportunitiesTable.applicationDeadline} >= ${todaySA()}`))
    .orderBy(opportunitiesTable.applicationDeadline);
  const filtered = q.data.type ? rows.filter((o) => o.type === q.data.type) : rows;
  res.json(await withModelState(filtered, (req as any).user));
});

router.get("/opportunities/:opportunityId", optionalUser, async (req, res) => {
  const [o] = await db.select().from(opportunitiesTable).where(eq(opportunitiesTable.id, param(req.params.opportunityId)));
  if (!o) { res.status(404).json({ error: "Not found" }); return; }
  const viewer = (req as any).user;
  if (viewer?.id === o.organiserUserId) {
    const [apps, reports] = await Promise.all([
      db.select({ n: sql<number>`count(*)::int` }).from(opportunityApplicationsTable).where(eq(opportunityApplicationsTable.opportunityId, o.id)),
      db.select({ n: sql<number>`count(*)::int` }).from(opportunityReportsTable).where(eq(opportunityReportsTable.opportunityId, o.id)),
    ]);
    res.json(opportunityDto(o, { applicantCount: apps[0].n, reportCount: reports[0].n }));
    return;
  }
  res.json((await withModelState([o], viewer))[0]);
});

router.post("/opportunities/:opportunityId/report", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const parsed = ReportOpportunityBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation error" }); return; }
  const id = param(req.params.opportunityId);
  const [o] = await db.select().from(opportunitiesTable).where(eq(opportunitiesTable.id, id));
  if (!o) { res.status(404).json({ error: "Not found" }); return; }
  if (o.organiserUserId === user.id) { res.status(400).json({ error: "You cannot report your own listing." }); return; }
  await db.insert(opportunityReportsTable).values({ id: randomUUID(), opportunityId: id, reporterUserId: user.id, reason: parsed.data.reason.trim() }).onConflictDoNothing();
  await recordAudit({ id: user.id, role: user.role }, "opportunity.reported", "opportunity", id);
  res.status(201).json({ message: "Thank you. Bonisa will review this listing." });
});

// ── Model actions ───────────────────────────────────────────────────────────

router.post("/opportunities/:opportunityId/apply", requireModel, async (req, res) => {
  const profile = (req as any).modelProfile as typeof modelProfilesTable.$inferSelect;
  const user = (req as any).user;
  // Verification is a gate, enforced here and not only in the screen.
  if (profile.verificationStatus !== "verified") { res.status(403).json({ error: "Only verified models can apply. Complete verification first." }); return; }
  const parsed = ApplyToOpportunityBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation error" }); return; }
  const [o] = await db.select().from(opportunitiesTable).where(eq(opportunitiesTable.id, param(req.params.opportunityId)));
  if (!o) { res.status(404).json({ error: "Not found" }); return; }
  if (effectiveStatus(o) !== "open") { res.status(409).json({ error: "This opportunity is closed." }); return; }

  const values = { message: parsed.data.message.trim(), proposedFeeCents: parsed.data.proposedFeeCents ?? null };
  const [existing] = await db.select().from(opportunityApplicationsTable)
    .where(and(eq(opportunityApplicationsTable.opportunityId, o.id), eq(opportunityApplicationsTable.modelProfileId, profile.id)));
  let saved: App;
  if (!existing) {
    const [row] = await db.insert(opportunityApplicationsTable).values({ id: randomUUID(), opportunityId: o.id, modelProfileId: profile.id, ...values }).onConflictDoNothing().returning();
    if (!row) { res.status(409).json({ error: "You have already applied." }); return; }
    saved = row;
  } else if (existing.status === "withdrawn") {
    // Re-applying after a withdrawal reopens the same application. A pass is final.
    const [row] = await db.update(opportunityApplicationsTable).set({ ...values, status: "applied", statusNote: null, updatedAt: new Date() })
      .where(and(eq(opportunityApplicationsTable.id, existing.id), eq(opportunityApplicationsTable.status, "withdrawn"))).returning();
    if (!row) { res.status(409).json({ error: "You have already applied." }); return; }
    saved = row;
  } else {
    res.status(409).json({ error: "You have already applied." }); return;
  }
  await recordAudit({ id: user.id, role: "model" }, "application.submitted", "application", saved.id, { opportunityId: o.id });
  res.status(201).json(myApplicationDto(saved, o));
});

router.get("/models/me/saved-opportunities", requireModel, async (req, res) => {
  const profile = (req as any).modelProfile as typeof modelProfilesTable.$inferSelect;
  const rows = await db.select({ o: opportunitiesTable }).from(savedOpportunitiesTable)
    .innerJoin(opportunitiesTable, eq(opportunitiesTable.id, savedOpportunitiesTable.opportunityId))
    .where(eq(savedOpportunitiesTable.modelProfileId, profile.id)).orderBy(desc(savedOpportunitiesTable.createdAt));
  res.json(await withModelState(rows.map((r) => r.o), (req as any).user));
});

router.put("/models/me/saved-opportunities/:opportunityId", requireModel, async (req, res) => {
  const profile = (req as any).modelProfile as typeof modelProfilesTable.$inferSelect;
  const id = param(req.params.opportunityId);
  const [o] = await db.select().from(opportunitiesTable).where(eq(opportunitiesTable.id, id));
  if (!o) { res.status(404).json({ error: "Not found" }); return; }
  await db.insert(savedOpportunitiesTable).values({ modelProfileId: profile.id, opportunityId: id }).onConflictDoNothing();
  res.json({ message: "Saved" });
});

router.delete("/models/me/saved-opportunities/:opportunityId", requireModel, async (req, res) => {
  const profile = (req as any).modelProfile as typeof modelProfilesTable.$inferSelect;
  await db.delete(savedOpportunitiesTable).where(and(eq(savedOpportunitiesTable.modelProfileId, profile.id), eq(savedOpportunitiesTable.opportunityId, param(req.params.opportunityId))));
  res.json({ message: "Removed" });
});

// ── Brand side ──────────────────────────────────────────────────────────────

router.get("/brand/opportunities", requireBrand, async (req, res) => {
  const user = (req as any).user;
  const rows = await db.select().from(opportunitiesTable).where(eq(opportunitiesTable.organiserUserId, user.id)).orderBy(desc(opportunitiesTable.createdAt));
  const out = [];
  for (const o of rows) {
    const [apps] = await db.select({ n: sql<number>`count(*)::int` }).from(opportunityApplicationsTable).where(eq(opportunityApplicationsTable.opportunityId, o.id));
    const [reports] = await db.select({ n: sql<number>`count(*)::int` }).from(opportunityReportsTable).where(eq(opportunityReportsTable.opportunityId, o.id));
    out.push(opportunityDto(o, { applicantCount: apps.n, reportCount: reports.n }));
  }
  res.json(out);
});

router.post("/brand/opportunities", requireBrand, async (req, res) => {
  const user = (req as any).user;
  const parsed = CreateOpportunityBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Please complete every required term of the opportunity." }); return; }
  const d = parsed.data;
  const deadline = String(d.applicationDeadline).slice(0, 10);
  const start = d.startDate ? String(d.startDate).slice(0, 10) : null;
  const end = d.endDate ? String(d.endDate).slice(0, 10) : null;
  if (deadline < todaySA()) { res.status(400).json({ error: "The application deadline cannot be in the past." }); return; }
  if (start && end && end < start) { res.status(400).json({ error: "The end date cannot be before the start date." }); return; }
  if (!d.isRemote && !d.location?.trim()) { res.status(400).json({ error: "Give a location, or mark the work as remote." }); return; }

  const [o] = await db.insert(opportunitiesTable).values({
    id: randomUUID(),
    organiserUserId: user.id,
    organiserName: user.businessName || user.name,
    type: d.type,
    title: d.title.trim(),
    brief: d.brief.trim(),
    deliverables: d.deliverables.trim(),
    eligibility: d.eligibility?.trim() || null,
    startDate: start,
    endDate: end,
    location: d.location?.trim() ?? "",
    isRemote: d.isRemote === true,
    compensationCents: d.compensationCents ?? null,
    compensationNote: d.compensationNote?.trim() ?? "",
    expensesNote: d.expensesNote?.trim() ?? "",
    usageRights: d.usageRights.trim(),
    exclusivity: d.exclusivity?.trim() || "None",
    paymentTerms: d.paymentTerms.trim(),
    applicationDeadline: deadline,
  }).returning();
  await recordAudit({ id: user.id, role: "brand" }, "opportunity.created", "opportunity", o.id);
  res.status(201).json(opportunityDto(o, { applicantCount: 0, reportCount: 0 }));
});

router.patch("/brand/opportunities/:opportunityId", requireBrand, async (req, res) => {
  const user = (req as any).user;
  const parsed = SetOpportunityStatusBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation error" }); return; }
  const [o] = await db.select().from(opportunitiesTable)
    .where(and(eq(opportunitiesTable.id, param(req.params.opportunityId)), eq(opportunitiesTable.organiserUserId, user.id)));
  if (!o) { res.status(404).json({ error: "Not found" }); return; }
  if (parsed.data.status === "open" && o.applicationDeadline < todaySA()) { res.status(400).json({ error: "The deadline has passed, so this cannot be reopened." }); return; }
  const [row] = await db.update(opportunitiesTable).set({ status: parsed.data.status }).where(eq(opportunitiesTable.id, o.id)).returning();
  await recordAudit({ id: user.id, role: "brand" }, parsed.data.status === "open" ? "opportunity.reopened" : "opportunity.closed", "opportunity", o.id);
  res.json(opportunityDto(row));
});

async function applicantDtos(apps: { a: App; p: typeof modelProfilesTable.$inferSelect }[]) {
  return apps.map(({ a, p }) => ({
    id: a.id,
    status: a.status as "applied" | "shortlisted" | "accepted" | "passed" | "withdrawn",
    statusNote: a.statusNote,
    message: a.message,
    proposedFeeCents: a.proposedFeeCents,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    model: {
      id: p.id,
      professionalName: p.professionalName,
      category: p.category,
      area: shows(p, "area") && p.area ? p.area : null,
      verified: p.verificationStatus === "verified",
    },
  }));
}

router.get("/brand/opportunities/:opportunityId/applications", requireBrand, async (req, res) => {
  const user = (req as any).user;
  const [o] = await db.select().from(opportunitiesTable)
    .where(and(eq(opportunitiesTable.id, param(req.params.opportunityId)), eq(opportunitiesTable.organiserUserId, user.id)));
  if (!o) { res.status(404).json({ error: "Not found" }); return; }
  const rows = await db.select({ a: opportunityApplicationsTable, p: modelProfilesTable }).from(opportunityApplicationsTable)
    .innerJoin(modelProfilesTable, eq(modelProfilesTable.id, opportunityApplicationsTable.modelProfileId))
    .where(eq(opportunityApplicationsTable.opportunityId, o.id)).orderBy(opportunityApplicationsTable.createdAt);
  res.json(await applicantDtos(rows));
});

router.patch("/brand/applications/:applicationId", requireBrand, async (req, res) => {
  const user = (req as any).user;
  const parsed = DecideApplicationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation error" }); return; }
  const id = param(req.params.applicationId);
  const [row] = await db.select({ a: opportunityApplicationsTable, o: opportunitiesTable }).from(opportunityApplicationsTable)
    .innerJoin(opportunitiesTable, eq(opportunitiesTable.id, opportunityApplicationsTable.opportunityId))
    .where(eq(opportunityApplicationsTable.id, id));
  // Someone else's applicant looks exactly like one that does not exist.
  if (!row || row.o.organiserUserId !== user.id) { res.status(404).json({ error: "Not found" }); return; }

  const to = parsed.data.status;
  const from = to === "shortlisted" ? ["applied"] : ["applied", "shortlisted"];
  // Atomic: accepted, passed and withdrawn are final, and two organisers' clicks cannot both win.
  const [updated] = await db.update(opportunityApplicationsTable)
    .set({ status: to, statusNote: parsed.data.note?.trim() || null, updatedAt: new Date() })
    .where(and(eq(opportunityApplicationsTable.id, id), inArray(opportunityApplicationsTable.status, from))).returning();
  if (!updated) { res.status(409).json({ error: "This application can no longer be changed." }); return; }
  await recordAudit({ id: user.id, role: "brand" }, `application.${to}`, "application", id, { opportunityId: row.o.id });
  const [profile] = await db.select().from(modelProfilesTable).where(eq(modelProfilesTable.id, updated.modelProfileId));
  res.json((await applicantDtos([{ a: updated, p: profile }]))[0]);
});

export default router;
