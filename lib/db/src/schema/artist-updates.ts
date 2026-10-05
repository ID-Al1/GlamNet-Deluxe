import { pgTable, text, timestamp, integer, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { stylistProfilesTable } from "./stylists";

/**
 * Updates the owner sends to artists.
 *
 * One row per send. `body` keeps the template exactly as the owner wrote it,
 * placeholders included, so the history shows what was actually composed.
 */
export const artistUpdatesTable = pgTable("artist_updates", {
  id: text("id").primaryKey(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  audienceSummary: text("audience_summary").notNull(),
  sendExternally: boolean("send_externally").notNull().default(true),
  recipientCount: integer("recipient_count").notNull().default(0),
  sentByUserId: text("sent_by_user_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * One row per artist who received an update. Subject and body are stored
 * already personalised, so the artist always sees the exact words she was
 * sent, even if her profile changes later.
 */
export const artistUpdateRecipientsTable = pgTable("artist_update_recipients", {
  id: text("id").primaryKey(),
  updateId: text("update_id").notNull().references(() => artistUpdatesTable.id, { onDelete: "cascade" }),
  stylistProfileId: text("stylist_profile_id").notNull().references(() => stylistProfilesTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  userIdx: index("artist_update_recipients_user_idx").on(t.userId, t.createdAt),
  updateProfileUnique: uniqueIndex("artist_update_recipients_update_profile_unique").on(t.updateId, t.stylistProfileId),
}));

export type ArtistUpdate = typeof artistUpdatesTable.$inferSelect;
export type ArtistUpdateRecipient = typeof artistUpdateRecipientsTable.$inferSelect;
