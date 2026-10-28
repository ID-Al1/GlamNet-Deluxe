import { pgTable, text, integer, boolean, timestamp, jsonb, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { stylistProfilesTable } from "./stylists";

export const aftercareCategories = ["hair", "braids", "nails", "lashes", "makeup", "other"] as const;

/** One piece of an aftercare page. Plain text only: pages never hold web code. */
export type AftercareBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

/**
 * An aftercare page an artist shares with a client by link. stylistProfilesTable
 * is the artist's profile (the project's legacy name). The public address uses
 * publicToken, a long random value, never the page id.
 */
export const aftercarePagesTable = pgTable("aftercare_pages", {
  id: text("id").primaryKey(),
  artistProfileId: text("artist_profile_id").notNull().references(() => stylistProfilesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  category: text("category").notNull(),
  blocks: jsonb("blocks").$type<AftercareBlock[]>().notNull().default([]),
  // Optional "book again" link. Null means the page links to the artist's Bonisa profile.
  rebookingUrl: text("rebooking_url"),
  publicToken: text("public_token").notNull().unique(),
  published: boolean("published").notNull().default(false),
  // When the artist confirmed she has reviewed the instructions, as required to publish.
  reviewedAt: timestamp("reviewed_at"),
  publishedAt: timestamp("published_at"),
  viewCount: integer("view_count").notNull().default(0),
  lastViewedAt: timestamp("last_viewed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  artistIdx: index("aftercare_pages_artist_idx").on(t.artistProfileId),
  categoryCheck: check("aftercare_pages_category_check", sql`${t.category} in ('hair','braids','nails','lashes','makeup','other')`),
}));

export type AftercarePage = typeof aftercarePagesTable.$inferSelect;
