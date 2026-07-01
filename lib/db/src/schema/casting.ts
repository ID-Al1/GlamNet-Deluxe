import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const castingCallsTable = pgTable("casting_calls", {
  id: text("id").primaryKey(),
  brandId: text("brand_id").notNull().references(() => usersTable.id),
  brandName: text("brand_name").notNull(),
  title: text("title").notNull(),
  brief: text("brief").notNull(),
  budget: text("budget").notNull(),
  deadline: text("deadline").notNull(),
  specialty: text("specialty").notNull(),
  applicantCount: integer("applicant_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const castingApplicationsTable = pgTable("casting_applications", {
  id: text("id").primaryKey(),
  castingId: text("casting_id").notNull().references(() => castingCallsTable.id, { onDelete: "cascade" }),
  castingTitle: text("casting_title").notNull(),
  stylistId: text("stylist_id").notNull(),
  stylistName: text("stylist_name").notNull(),
  status: text("status").notNull().default("pending"),
  appliedAt: timestamp("applied_at").notNull().defaultNow(),
});

export type CastingCall = typeof castingCallsTable.$inferSelect;
export type CastingApplication = typeof castingApplicationsTable.$inferSelect;
