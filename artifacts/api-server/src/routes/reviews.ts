import { Router } from "express";
import {
  db, reviewsTable, appointmentsTable, stylistProfilesTable, usersTable, bookingTeamMembersTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth } from "../lib/auth";
import { sql } from "drizzle-orm";
import { maybeCompleteReferral } from "./referrals";

const router = Router();

// Client submits a review after a completed appointment
router.post("/reviews", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { appointmentId, stylistId, rating, text } = req.body;

  if (!appointmentId || !stylistId || !rating) {
    res.status(400).json({ error: "appointmentId, stylistId, and rating are required" });
    return;
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    res.status(400).json({ error: "rating must be an integer between 1 and 5" });
    return;
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

  // Verify the stylist is actually tied to this appointment — either the lead
  // stylist or a confirmed team member. Prevents reviewing arbitrary profiles.
  const isLeadStylist = appt.stylistId === stylistId;
  let isTeamMember = false;
  if (!isLeadStylist) {
    const [member] = await db.select().from(bookingTeamMembersTable)
      .where(and(
        eq(bookingTeamMembersTable.appointmentId, appointmentId),
        eq(bookingTeamMembersTable.stylistId, stylistId),
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
  }).returning();

  // Recompute stylist's average rating and review count from actual data
  const allReviews = await db.select().from(reviewsTable).where(eq(reviewsTable.revieweeId, stylistId));
  const avg = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
  await db.update(stylistProfilesTable)
    .set({ rating: Math.round(avg * 10) / 10, reviewCount: allReviews.length })
    .where(eq(stylistProfilesTable.id, stylistId));

  // Check if this completed booking triggers a referral completion
  await maybeCompleteReferral(user.id);

  res.status(201).json({ ...review, createdAt: review.createdAt.toISOString() });
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

  // Completing a booking is the trigger for referral completion — not the review.
  await maybeCompleteReferral(user.id);

  res.json({ ...updated, createdAt: updated.createdAt.toISOString() });
});

// Get reviews for a stylist profile (public)
router.get("/reviews", async (req, res) => {
  const { stylistId } = req.query as { stylistId?: string };
  if (!stylistId) { res.status(400).json({ error: "stylistId query param required" }); return; }

  const reviews = await db
    .select({
      id: reviewsTable.id,
      rating: reviewsTable.rating,
      text: reviewsTable.text,
      createdAt: reviewsTable.createdAt,
      reviewerName: usersTable.name,
    })
    .from(reviewsTable)
    .leftJoin(usersTable, eq(reviewsTable.reviewerId, usersTable.id))
    .where(eq(reviewsTable.revieweeId, stylistId))
    .orderBy(sql`${reviewsTable.createdAt} DESC`);

  res.json(reviews.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

export default router;
