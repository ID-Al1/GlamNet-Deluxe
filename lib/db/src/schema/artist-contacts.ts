import { pgTable, text, timestamp, integer, boolean, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { stylistProfilesTable } from "./stylists";

/**
 * One row per real person who might become a Bonisa artist, wherever we met
 * them: the Bonisa app itself, the Vercel waitlist, or added by hand.
 *
 * Email and phone are stored normalised (lower-case email, +27 phone) so the
 * same person arriving from two places merges into one row instead of two.
 */
export const artistContactsTable = pgTable("artist_contacts", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default(""),
  email: text("email"),
  phone: text("phone"),
  specialty: text("specialty"),
  location: text("location"),
  instagram: text("instagram"),
  notes: text("notes"),
  // Where we know her from: "bonisa_app", "vercel_waitlist", "manual", "import".
  sources: text("sources").array().notNull().default([]),
  // Set once she has a Bonisa artist account.
  stylistProfileId: text("stylist_profile_id").references(() => stylistProfilesTable.id, { onDelete: "set null" }),
  // The original waitlist record, kept as-is for reference.
  waitlistData: jsonb("waitlist_data"),
  waitlistJoinedAt: timestamp("waitlist_joined_at"),
  remindersPaused: boolean("reminders_paused").notNull().default(false),
  // Reminders count per stage, so finishing one step starts a fresh, short run for the next.
  reminderStage: text("reminder_stage"),
  stageSince: timestamp("stage_since"),
  remindersSent: integer("reminders_sent").notNull().default(0),
  lastRemindedAt: timestamp("last_reminded_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  emailUnique: uniqueIndex("artist_contacts_email_unique").on(t.email),
  phoneUnique: uniqueIndex("artist_contacts_phone_unique").on(t.phone),
  profileUnique: uniqueIndex("artist_contacts_profile_unique").on(t.stylistProfileId),
}));

/** Every message sent to a contact and why, so the owner always knows what was said. */
export const artistContactMessagesTable = pgTable("artist_contact_messages", {
  id: text("id").primaryKey(),
  contactId: text("contact_id").notNull().references(() => artistContactsTable.id, { onDelete: "cascade" }),
  // "auto_reminder" or "manual_reminder".
  kind: text("kind").notNull(),
  // Why it was sent, in plain words: "Not on Bonisa yet", "Missing: Bio, Portfolio".
  reason: text("reason").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  channels: text("channels").array().notNull().default([]),
  sentByUserId: text("sent_by_user_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  contactIdx: index("artist_contact_messages_contact_idx").on(t.contactId, t.createdAt),
}));

/** Small owner switches, stored as key/value so new ones need no migration. */
export const ownerSettingsTable = pgTable("owner_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type ArtistContact = typeof artistContactsTable.$inferSelect;
export type ArtistContactMessage = typeof artistContactMessagesTable.$inferSelect;
