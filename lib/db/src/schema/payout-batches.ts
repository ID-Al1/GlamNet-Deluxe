import { pgTable, text, real, integer, timestamp } from "drizzle-orm/pg-core";
import { stylistProfilesTable } from "./stylists";
import { usersTable } from "./users";

export const payoutBatchesTable = pgTable("payout_batches", {
  id: text("id").primaryKey(),
  artistProfileId: text("artist_profile_id").notNull().references(() => stylistProfilesTable.id),
  totalAmount: real("total_amount").notNull(),
  lineCount: integer("line_count").notNull(),
  reference: text("reference").notNull(),
  paidBy: text("paid_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type PayoutBatch = typeof payoutBatchesTable.$inferSelect;