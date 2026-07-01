import { pgTable, text, real, integer, boolean, pgEnum, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const verificationEnum = pgEnum("verification_status", ["none", "pending", "verified"]);

export const stylistProfilesTable = pgTable("stylist_profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  specialty: text("specialty").notNull().default("Makeup"),
  location: text("location").notNull().default(""),
  area: text("area").notNull().default(""),
  bio: text("bio"),
  rating: real("rating").notNull().default(0),
  reviewCount: integer("review_count").notNull().default(0),
  verified: boolean("verified").notNull().default(false),
  verificationStatus: verificationEnum("verification_status").notNull().default("none"),
  availability: text("availability").array().notNull().default([]),
  tags: text("tags").array().notNull().default([]),
  instagram: text("instagram"),
  website: text("website"),
  accentColor: text("accent_color"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const servicesTable = pgTable("services", {
  id: text("id").primaryKey(),
  stylistId: text("stylist_id").notNull().references(() => stylistProfilesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  price: real("price").notNull(),
  duration: integer("duration").notNull(),
});

export const portfolioItemsTable = pgTable("portfolio_items", {
  id: text("id").primaryKey(),
  stylistId: text("stylist_id").notNull().references(() => stylistProfilesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull(),
  imageUrl: text("image_url"),
});

export type StylistProfile = typeof stylistProfilesTable.$inferSelect;
export type Service = typeof servicesTable.$inferSelect;
export type PortfolioItem = typeof portfolioItemsTable.$inferSelect;
