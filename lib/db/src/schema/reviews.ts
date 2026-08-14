import { pgTable, text, integer, timestamp, jsonb, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { appointmentsTable } from "./appointments";
import { stylistProfilesTable } from "./stylists";

export const reviewsTable = pgTable("reviews", {
  id: text("id").primaryKey(),
  appointmentId: text("appointment_id").notNull().references(() => appointmentsTable.id, { onDelete: "cascade" }),
  reviewerId: text("reviewer_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  revieweeId: text("reviewee_id").notNull().references(() => stylistProfilesTable.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(),
  text: text("text"),
  mediaItems: jsonb("media_items").$type<{ path: string; mimeType: string }[]>().default([]),
  replyText: text("reply_text"),
  replyCreatedAt: timestamp("reply_created_at"),
  helpfulCount: integer("helpful_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const reviewHelpfulVotesTable = pgTable("review_helpful_votes", {
  id: text("id").primaryKey(),
  reviewId: text("review_id").notNull().references(() => reviewsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  uniq: unique().on(t.reviewId, t.userId),
}));

export type Review = typeof reviewsTable.$inferSelect;
export type ReviewHelpfulVote = typeof reviewHelpfulVotesTable.$inferSelect;
