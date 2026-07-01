import { pgTable, text, real, boolean, pgEnum, timestamp } from "drizzle-orm/pg-core";
import { appointmentsTable } from "./appointments";

export const teamMemberStatusEnum = pgEnum("team_member_status", ["invited", "confirmed", "declined"]);

export const bookingTeamMembersTable = pgTable("booking_team_members", {
  id: text("id").primaryKey(),
  appointmentId: text("appointment_id").notNull().references(() => appointmentsTable.id, { onDelete: "cascade" }),
  stylistId: text("stylist_id").notNull(),
  stylistName: text("stylist_name").notNull(),
  role: text("role").notNull(),
  payoutPercentage: real("payout_percentage").notNull(),
  status: teamMemberStatusEnum("status").notNull().default("invited"),
  isLead: boolean("is_lead").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type BookingTeamMember = typeof bookingTeamMembersTable.$inferSelect;
