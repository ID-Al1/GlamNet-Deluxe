import { pgTable, text, timestamp, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./users";

/**
 * Append-only record of what each person was shown and what they chose.
 * documentType: terms_of_service | client_terms | artist_agreement | privacy_notice | marketing
 * decision: accepted | acknowledged | declined | withdrawn
 * action: the screen or step where the choice was made, e.g. signup_form
 * Nothing here is ever updated or deleted. A changed choice is a new row.
 */
export const consentRecordsTable = pgTable("consent_records", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id),
  documentType: text("document_type").notNull(),
  documentVersion: text("document_version").notNull(),
  decision: text("decision").notNull(),
  action: text("action").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  userIdx: index("consent_records_user_idx").on(t.userId, t.documentType, t.createdAt),
  decisionCheck: check("consent_records_decision_check", sql`${t.decision} in ('accepted', 'acknowledged', 'declined', 'withdrawn')`),
}));

export type ConsentRecord = typeof consentRecordsTable.$inferSelect;
