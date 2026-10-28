import { Router } from "express";
import { randomUUID } from "crypto";
import { desc, eq } from "drizzle-orm";
import { accountDeletionRequestsTable, db, usersTable } from "@workspace/db";
import { requireAuth, requireOwner } from "../lib/auth";
import { param } from "../lib/params";
import { logger } from "../lib/logger";
import { ObjectStorageService } from "../lib/objectStorage";
import { anonymiseUser, deletionBlockers, hasBlockers } from "../lib/accountDeletion";

const router = Router();
const objectStorage = new ObjectStorageService();

type RequestRow = typeof accountDeletionRequestsTable.$inferSelect;
const serialize = (r: RequestRow) => ({
  id: r.id, status: r.status, userNote: r.userNote ?? null, ownerNote: r.ownerNote ?? null,
  requestedAt: r.requestedAt.toISOString(), handledAt: r.handledAt?.toISOString() ?? null,
});

// ── The person's side ────────────────────────────────────────────────────────

router.get("/account/deletion-request", requireAuth, async (req, res) => {
  const [latest] = await db.select().from(accountDeletionRequestsTable)
    .where(eq(accountDeletionRequestsTable.userId, (req as any).user.id))
    .orderBy(desc(accountDeletionRequestsTable.requestedAt)).limit(1);
  res.setHeader("Cache-Control", "no-store, private");
  res.json({ request: latest ? serialize(latest) : null });
});

router.post("/account/deletion-request", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const blockers = await deletionBlockers(user.id);
  if (blockers.isOwnerAccount) { res.status(403).json({ error: "The owner account cannot be deleted this way." }); return; }
  const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 500) : "";
  try {
    const [created] = await db.insert(accountDeletionRequestsTable).values({
      id: randomUUID(), userId: user.id, role: user.role, userNote: note || null,
    }).returning();
    res.status(201).json({ request: serialize(created) });
  } catch (error: any) {
    // The one-pending-per-person index.
    if (error?.code === "23505" || error?.cause?.code === "23505") { res.status(409).json({ error: "You already have a request waiting for review." }); return; }
    throw error;
  }
});

router.delete("/account/deletion-request", requireAuth, async (req, res) => {
  const [pending] = await db.select().from(accountDeletionRequestsTable)
    .where(eq(accountDeletionRequestsTable.userId, (req as any).user.id)).orderBy(desc(accountDeletionRequestsTable.requestedAt)).limit(1);
  if (!pending || pending.status !== "pending") { res.status(404).json({ error: "You have no request to withdraw." }); return; }
  const [updated] = await db.update(accountDeletionRequestsTable).set({ status: "withdrawn", handledAt: new Date() })
    .where(eq(accountDeletionRequestsTable.id, pending.id)).returning();
  res.json({ request: serialize(updated) });
});

// ── The owner's side ─────────────────────────────────────────────────────────

router.get("/owner/deletion-requests", requireOwner, async (_req, res) => {
  const rows = await db.select({ r: accountDeletionRequestsTable, name: usersTable.name, email: usersTable.email })
    .from(accountDeletionRequestsTable).innerJoin(usersTable, eq(usersTable.id, accountDeletionRequestsTable.userId))
    .orderBy(desc(accountDeletionRequestsTable.requestedAt)).limit(200);
  const result = await Promise.all(rows.map(async ({ r, name, email }) => ({
    ...serialize(r), userId: r.userId, role: r.role, name, email,
    // What would stop it today. Only worked out for requests still waiting.
    blockers: r.status === "pending" ? await deletionBlockers(r.userId) : null,
  })));
  res.json(result);
});

router.post("/owner/deletion-requests/:requestId/reject", requireOwner, async (req, res) => {
  const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 500) : "";
  if (!note) { res.status(400).json({ error: "Write the reason. The person will read it." }); return; }
  const [request] = await db.select().from(accountDeletionRequestsTable).where(eq(accountDeletionRequestsTable.id, param(req.params.requestId)));
  if (!request) { res.status(404).json({ error: "Request not found" }); return; }
  if (request.status !== "pending") { res.status(409).json({ error: "This request has already been handled." }); return; }
  const [updated] = await db.update(accountDeletionRequestsTable)
    .set({ status: "rejected", ownerNote: note, handledAt: new Date(), handledBy: (req as any).user.id })
    .where(eq(accountDeletionRequestsTable.id, request.id)).returning();
  res.json({ request: serialize(updated) });
});

router.post("/owner/deletion-requests/:requestId/approve", requireOwner, async (req, res) => {
  const [request] = await db.select().from(accountDeletionRequestsTable).where(eq(accountDeletionRequestsTable.id, param(req.params.requestId)));
  if (!request) { res.status(404).json({ error: "Request not found" }); return; }
  if (request.status !== "pending") { res.status(409).json({ error: "This request has already been handled." }); return; }

  const outcome = await db.transaction(async (tx) => {
    // Checked inside the transaction, right before anything is removed.
    const blockers = await deletionBlockers(request.userId, tx);
    if (hasBlockers(blockers)) return { blockers } as const;
    const { idDocumentPath } = await anonymiseUser(tx, request.userId);
    await tx.update(accountDeletionRequestsTable)
      .set({ status: "completed", handledAt: new Date(), handledBy: (req as any).user.id })
      .where(eq(accountDeletionRequestsTable.id, request.id));
    return { idDocumentPath } as const;
  });

  if ("blockers" in outcome) {
    res.status(409).json({ error: "This account cannot be deleted yet. Settle the items below first, or reject the request with a reason.", blockers: outcome.blockers });
    return;
  }
  // The identity document lives in file storage, outside the database.
  let idDocumentDeleted = true;
  if (outcome.idDocumentPath) {
    try { await objectStorage.deleteObjectEntity(outcome.idDocumentPath); }
    catch (err) { idDocumentDeleted = false; logger.error({ err, requestId: request.id }, "Could not delete the identity document file"); }
  }
  res.json({ ok: true, idDocumentDeleted });
});

export default router;
