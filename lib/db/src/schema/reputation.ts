import { pgTable, text, real, integer, boolean, timestamp, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { stylistProfilesTable } from "./stylists";
import { appointmentsTable } from "./appointments";

/**
 * Every fact that moves an artist's reputation, one row each. A fact is counted once
 * (the idempotency key is unique), and a wrong one is reversed, never deleted.
 *
 * type: completed | late_cancel | last_minute_cancel | no_show | review | conduct_minor |
 *       conduct_serious | referral_credit
 * status: active (counts) | under_review (an artist disputed it, not counted yet) | reversed (found invalid)
 */
export const reputationEventsTable = pgTable("reputation_events", {
  id: text("id").primaryKey(),
  stylistId: text("stylist_id").notNull().references(() => stylistProfilesTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  sourceType: text("source_type").notNull(),
  sourceId: text("source_id").notNull(),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
  status: text("status").notNull().default("active"),
  eventAt: timestamp("event_at").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  reversedAt: timestamp("reversed_at"),
  reversalReason: text("reversal_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  keyUnique: uniqueIndex("reputation_events_key_unique").on(t.idempotencyKey),
  byStylist: index("reputation_events_stylist_idx").on(t.stylistId, t.status),
}));

/** The latest worked-out standing of each artist. Always recomputed on the server. */
export const reputationSummaryTable = pgTable("reputation_summary", {
  stylistId: text("stylist_id").primaryKey().references(() => stylistProfilesTable.id, { onDelete: "cascade" }),
  reliability: real("reliability").notNull().default(0),
  satisfaction: real("satisfaction").notNull().default(0),
  professionalism: real("professionalism").notNull().default(0),
  consistency: real("consistency").notNull().default(0),
  community: real("community").notNull().default(0),
  overall: real("overall").notNull().default(0),
  displayedScore: integer("displayed_score").notNull().default(0),
  tier: text("tier").notNull().default("new_talent"),
  evidenceSufficient: boolean("evidence_sufficient").notNull().default(false),
  completedBookings: integer("completed_bookings").notNull().default(0),
  reviewCount: integer("review_count").notNull().default(0),
  activeMonths: integer("active_months").notNull().default(0),
  // How many monthly reviews in a row she has qualified for a lower tier than she holds.
  belowTierMonths: integer("below_tier_months").notNull().default(0),
  lastReviewMonth: text("last_review_month"),
  calcVersion: integer("calc_version").notNull().default(1),
  calculatedAt: timestamp("calculated_at").notNull().defaultNow(),
});

export const reputationTierHistoryTable = pgTable("reputation_tier_history", {
  id: text("id").primaryKey(),
  stylistId: text("stylist_id").notNull().references(() => stylistProfilesTable.id, { onDelete: "cascade" }),
  fromTier: text("from_tier"),
  toTier: text("to_tier").notNull(),
  reason: text("reason").notNull(),
  score: real("score").notNull(),
  calcVersion: integer("calc_version").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** An artist asking for a record to be looked at again, and the owner's decision. */
export const reputationDisputesTable = pgTable("reputation_disputes", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => reputationEventsTable.id, { onDelete: "cascade" }),
  stylistId: text("stylist_id").notNull().references(() => stylistProfilesTable.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  // open | upheld (the artist was right, event reversed) | rejected (event stands)
  status: text("status").notNull().default("open"),
  decisionNote: text("decision_note"),
  decidedBy: text("decided_by"),
  decidedAt: timestamp("decided_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Who changed what, why and when. Owner actions on reputation are never silent. */
export const reputationAuditLogTable = pgTable("reputation_audit_log", {
  id: text("id").primaryKey(),
  stylistId: text("stylist_id").references(() => stylistProfilesTable.id, { onDelete: "cascade" }),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  reason: text("reason").notNull(),
  eventId: text("event_id"),
  before: jsonb("before").$type<Record<string, unknown>>(),
  after: jsonb("after").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** An artist confirming, after a job, that she is safe. Photo and code are for Bonisa only. */
export const safetyCheckinsTable = pgTable("safety_checkins", {
  id: text("id").primaryKey(),
  appointmentId: text("appointment_id").notNull().references(() => appointmentsTable.id, { onDelete: "cascade" }),
  stylistId: text("stylist_id").notNull().references(() => stylistProfilesTable.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  photoPath: text("photo_path").notNull(),
  // safe | needs_help
  status: text("status").notNull(),
  isLastBooking: boolean("is_last_booking").notNull().default(false),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  appointmentUnique: uniqueIndex("safety_checkins_appointment_unique").on(t.appointmentId),
  codeUnique: uniqueIndex("safety_checkins_code_unique").on(t.code),
}));

export type ReputationEvent = typeof reputationEventsTable.$inferSelect;
export type ReputationSummary = typeof reputationSummaryTable.$inferSelect;
