import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { appointmentsTable } from "./appointments";
import { stylistProfilesTable } from "./stylists";

export const reviewsTable = pgTable("reviews", {
  id: text("id").primaryKey(),
  appointmentId: text("appointment_id").notNull().references(() => appointmentsTable.id, { onDelete: "cascade" }),
  reviewerId: text("reviewer_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  revieweeId: text("reviewee_id").notNull().references(() => stylistProfilesTable.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(),
  text: text("text"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Review = typeof reviewsTable.$inferSelect;
