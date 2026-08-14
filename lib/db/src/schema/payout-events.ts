import { pgTable, text, real, timestamp } from "drizzle-orm/pg-core";
import { appointmentsTable } from "./appointments";

/**
 * Append-only audit trail for everything payout-related.
 * Types: held | client_confirmed | artist_confirmed | released | disputed | escalated
 * Nothing here is ever updated or deleted.
 */
export const payoutEventsTable = pgTable("payout_events", {
  id: text("id").primaryKey(),
  appointmentId: text("appointment_id").notNull().references(() => appointmentsTable.id),
  type: text("type").notNull(),
  actorUserId: text("actor_user_id"),
  amount: real("amount").notNull().default(0),
  artistShare: real("artist_share").notNull().default(0),
  platformShare: real("platform_share").notNull().default(0),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type PayoutEvent = typeof payoutEventsTable.$inferSelect;
