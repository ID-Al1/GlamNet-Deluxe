import { Router } from "express";
import {
  db, reviewsTable, appointmentsTable, stylistProfilesTable, usersTable,
  bookingTeamMembersTable, reviewHelpfulVotesTable,
} from "@workspace/db";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth } from "../lib/auth";
import { maybeCompleteReferral } from "./referrals";
import { wasUploadedBy } from "../lib/upload-registry";

/**
 * Returns true if `objectPath` is referenced in any review's media_items.
 * Used by the storage layer to grant public access to review attachments.
 */
export async function canAccessReviewMedia(objectPath: string): Promise<boolean> {
  const matches = await db
    .select({ id: reviewsTable.id })
    .from(reviewsTable)
    .where(sql`${reviewsTable.mediaItems} @> ${JSON.stringify([{ path: objectPath }])}::jsonb`)
    .limit(1);
  return matches.length > 0;
}

const router = Router();

// Client submits a review after a completed appointment
router.post("/reviews", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { appointmentId, stylistId, rating, text, mediaItems } = req.body;

  if (!appointmentId || !stylistId || !rating) {
    res.status(400).json({ error: "appointmentId, stylistId, and rating are required" });
    return;
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    res.status(400).json({ error: "rating must be an integer between 1 and 5" });
    return;
  }

  // Validate and verify ownership of each media item
  const rawItems: unknown[] = Array.isArray(mediaItems) ? mediaItems : [];
  if (rawItems.length > 10) {
    res.status(400).json({ error: "Maximum 10 media items per review" });
    return;
  }
  const sanitizedItems: { path: string; mimeType: string }[] = [];
  for (const item of rawItems) {
    if (
      typeof item !== "object" || item === null ||
      typeof (item as any).path !== "string" ||
      typeof (item as any).mimeType !== "string"
    ) {
      res.status(400).json({ error: "Each media item must have path and mimeType strings" });
      return;
    }
    const { path, mimeType } = item as { path: string; mimeType: string };
    // Verify the client actually uploaded this object (ownership check)
    if (!wasUploadedBy(path, user.id)) {
      res.status(403).json({ error: "Media item not owned by you or upload window expired" });
      return;
    }
    sanitizedItems.push({ path, mimeType: mimeType.slice(0, 100) });
  }

  // Verify the appointment exists, belongs to this client, and is completed
  const [appt] = await db.select().from(appointmentsTable)
    .where(and(eq(appointmentsTable.id, appointmentId), eq(appointmentsTable.clientId, user.id)));
  if (!appt) { res.status(404).json({ error: "Appointment not found" }); return; }
  if (appt.status !== "completed") {
    res.status(400).json({ error: "Can only review completed appointments" });
    return;
  }

  // Verify the stylist profile exists
  const [profile] = await db.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.id, stylistId));
  if (!profile) { res.status(404).json({ error: "Stylist profile not found" }); return; }

  // Verify the stylist is actually tied to this appointment
  const isLeadStylist = appt.stylistId === stylistId;
  let isTeamMember = false;
  if (!isLeadStylist) {
    const [member] = await db.select().from(bookingTeamMembersTable)
      .where(and(
        eq(bookingTeamMembersTable.appointmentId, appointmentId),
        eq(bookingTeamMembersTable.stylistId, stylistId),
        eq(bookingTeamMembersTable.status, "confirmed"),
      ));
    isTeamMember = !!member;
  }
  if (!isLeadStylist && !isTeamMember) {
    res.status(403).json({ error: "This stylist is not part of this appointment" });
    return;
  }

  // Prevent duplicate reviews for the same appointment + stylist
  const existing = await db.select().from(reviewsTable)
    .where(and(eq(reviewsTable.appointmentId, appointmentId), eq(reviewsTable.revieweeId, stylistId)));
  if (existing.length > 0) {
    res.status(409).json({ error: "You already reviewed this appointment" });
    return;
  }

  const [review] = await db.insert(reviewsTable).values({
    id: randomUUID(),
    appointmentId,
    reviewerId: user.id,
    revieweeId: stylistId,
    rating,
    text: text?.trim() || null,
    mediaItems: sanitizedItems,
  }).returning();

  // Recompute stylist's average rating and review count from actual data
  const allReviews = await db.select().from(reviewsTable).where(eq(reviewsTable.revieweeId, stylistId));
  const avg = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
  await db.update(stylistProfilesTable)
    .set({ rating: Math.round(avg * 10) / 10, reviewCount: allReviews.length })
    .where(eq(stylistProfilesTable.id, stylistId));

  await maybeCompleteReferral(user.id);

  res.status(201).json({ ...review, createdAt: review.createdAt.toISOString() });
});

// Stylist replies to a review
router.patch("/reviews/:id/reply", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;
  const { replyText } = req.body;

  if (!replyText?.trim()) {
    res.status(400).json({ error: "replyText is required" });
    return;
  }

  const [review] = await db.select().from(reviewsTable).where(eq(reviewsTable.id, id));
  if (!review) { res.status(404).json({ error: "Review not found" }); return; }

  // Only the stylist who was reviewed can reply
  const [profile] = await db.select().from(stylistProfilesTable)
    .where(and(eq(stylistProfilesTable.id, review.revieweeId), eq(stylistProfilesTable.userId, user.id)));
  if (!profile) {
    res.status(403).json({ error: "Only the reviewed professional can reply" });
    return;
  }

  const [updated] = await db.update(reviewsTable)
    .set({ replyText: replyText.trim(), replyCreatedAt: new Date() })
    .where(eq(reviewsTable.id, id))
    .returning();

  res.json({ ...updated, createdAt: updated.createdAt.toISOString(), replyCreatedAt: updated.replyCreatedAt?.toISOString() ?? null });
});

// Toggle helpful vote on a review
router.post("/reviews/:id/helpful", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;

  const [review] = await db.select().from(reviewsTable).where(eq(reviewsTable.id, id));
  if (!review) { res.status(404).json({ error: "Review not found" }); return; }

  // Check if already voted
  const [existing] = await db.select().from(reviewHelpfulVotesTable)
    .where(and(eq(reviewHelpfulVotesTable.reviewId, id), eq(reviewHelpfulVotesTable.userId, user.id)));

  let voted: boolean;
  if (existing) {
    // Remove vote
    await db.delete(reviewHelpfulVotesTable)
      .where(and(eq(reviewHelpfulVotesTable.reviewId, id), eq(reviewHelpfulVotesTable.userId, user.id)));
    await db.update(reviewsTable)
      .set({ helpfulCount: Math.max(0, review.helpfulCount - 1) })
      .where(eq(reviewsTable.id, id));
    voted = false;
  } else {
    // Add vote
    await db.insert(reviewHelpfulVotesTable).values({
      id: randomUUID(),
      reviewId: id,
      userId: user.id,
    });
    await db.update(reviewsTable)
      .set({ helpfulCount: review.helpfulCount + 1 })
      .where(eq(reviewsTable.id, id));
    voted = true;
  }

  const [updated] = await db.select().from(reviewsTable).where(eq(reviewsTable.id, id));
  res.json({ helpfulCount: updated.helpfulCount, voted });
});

// Mark an appointment as completed (client confirms service received)
router.patch("/appointments/:appointmentId/complete", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { appointmentId } = req.params;

  const [appt] = await db.select().from(appointmentsTable)
    .where(and(eq(appointmentsTable.id, appointmentId), eq(appointmentsTable.clientId, user.id)));
  if (!appt) { res.status(404).json({ error: "Appointment not found" }); return; }
  if (appt.status !== "confirmed") {
    res.status(400).json({ error: "Only confirmed appointments can be marked complete" });
    return;
  }

  const [updated] = await db.update(appointmentsTable)
    .set({ status: "completed" })
    .where(eq(appointmentsTable.id, appointmentId))
    .returning();

  await maybeCompleteReferral(user.id);

  res.json({ ...updated, createdAt: updated.createdAt.toISOString() });
});

// Get reviews for a stylist profile (public)
router.get("/reviews", async (req, res) => {
  const { stylistId, sort, minRating, withPhotos } = req.query as {
    stylistId?: string;
    sort?: string;
    minRating?: string;
    withPhotos?: string;
  };
  if (!stylistId) { res.status(400).json({ error: "stylistId query param required" }); return; }

  // Build order clause
  let orderClause;
  switch (sort) {
    case "highest":
      orderClause = desc(reviewsTable.rating);
      break;
    case "lowest":
      orderClause = asc(reviewsTable.rating);
      break;
    case "helpful":
      orderClause = desc(reviewsTable.helpfulCount);
      break;
    default:
      orderClause = desc(reviewsTable.createdAt);
  }

  const conditions = [eq(reviewsTable.revieweeId, stylistId)];
  if (minRating) {
    const min = parseInt(minRating, 10);
    if (!isNaN(min) && min >= 1 && min <= 5) {
      conditions.push(sql`${reviewsTable.rating} >= ${min}`);
    }
  }
  if (withPhotos === "true") {
    conditions.push(sql`jsonb_array_length(${reviewsTable.mediaItems}) > 0`);
  }

  const reviews = await db
    .select({
      id: reviewsTable.id,
      rating: reviewsTable.rating,
      text: reviewsTable.text,
      mediaItems: reviewsTable.mediaItems,
      replyText: reviewsTable.replyText,
      replyCreatedAt: reviewsTable.replyCreatedAt,
      helpfulCount: reviewsTable.helpfulCount,
      createdAt: reviewsTable.createdAt,
      reviewerName: usersTable.name,
    })
    .from(reviewsTable)
    .leftJoin(usersTable, eq(reviewsTable.reviewerId, usersTable.id))
    .where(and(...conditions))
    .orderBy(orderClause);

  res.json(reviews.map(r => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    replyCreatedAt: r.replyCreatedAt?.toISOString() ?? null,
  })));
});

export default router;
