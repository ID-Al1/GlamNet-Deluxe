import { pgTable, text, timestamp, check, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./users";

export const deletionRequestStatuses = ["pending", "completed", "rejected", "withdrawn"] as const;

/**
 * A person's request to have their account and personal information deleted
 * (POPIA). The owner reviews each one. The row keeps no personal details, only
 * who (by id) and when, so it can prove the request was handled.
 */
export const accountDeletionRequestsTable = pgTable("account_deletion_requests", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id),
  role: text("role").notNull(),
  status: text("status").notNull().default("pending"),
  userNote: text("user_note"),
  ownerNote: text("owner_note"),
  requestedAt: timestamp("requested_at").notNull().defaultNow(),
  handledAt: timestamp("handled_at"),
  handledBy: text("handled_by").references(() => usersTable.id),
}, (t) => ({
  userIdx: index("account_deletion_requests_user_idx").on(t.userId),
  statusCheck: check("account_deletion_requests_status_check", sql`${t.status} in ('pending','completed','rejected','withdrawn')`),
}));

export type AccountDeletionRequest = typeof accountDeletionRequestsTable.$inferSelect;
