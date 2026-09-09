import { pgTable, text, real, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { appointmentsTable } from "./appointments";
import { stylistProfilesTable } from "./stylists";
import { payoutBatchesTable } from "./payout-batches";

export const payoutLedgerTable = pgTable("payout_ledger", {
  id: text("id").primaryKey(),
  appointmentId: text("appointment_id").notNull().references(() => appointmentsTable.id, { onDelete: "cascade" }),
  artistProfileId: text("artist_profile_id").notNull().references(() => stylistProfilesTable.id),
  sharePercent: real("share_percent").notNull(),
  // Artist's slice of the 82% artist pool; netAmount is always equal to this.
  grossAmount: real("gross_amount").notNull(),
  platformFeeAmount: real("platform_fee_amount").notNull(),
  netAmount: real("net_amount").notNull(),
  status: text("status").notNull().default("due"),
  dueAt: timestamp("due_at").notNull(),
  paidAt: timestamp("paid_at"),
  paidBatchId: text("paid_batch_id").references(() => payoutBatchesTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  appointmentArtistUnique: uniqueIndex("payout_ledger_appointment_artist_unique")
    .on(table.appointmentId, table.artistProfileId),
}));

export type PayoutLedger = typeof payoutLedgerTable.$inferSelect;