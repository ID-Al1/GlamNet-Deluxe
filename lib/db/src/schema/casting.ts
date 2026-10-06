import { pgTable, text, integer, real, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { stylistProfilesTable } from "./stylists";

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
  // ── Campaign money (brand pays the artist's full rate plus Bonisa's fee on top) ──
  // Calls made before campaigns had real numbers keep ratePerArtist = 0 and cannot be funded.
  artistsNeeded: integer("artists_needed").notNull().default(1),
  ratePerArtist: real("rate_per_artist").notNull().default(0),
  eventDate: text("event_date"),
  eventTime: text("event_time").notNull().default("09:00"),
  eventDurationMinutes: integer("event_duration_minutes").notNull().default(480),
  location: text("location").notNull().default(""),
  // open -> deposit_paid -> fully_paid, or cancelled. "Completed" is derived from the artist jobs.
  status: text("status").notNull().default("open"),
  balanceReminderSentAt: timestamp("balance_reminder_sent_at"),
  // ── Seats: the artists the brand paid for, and what happens when one cannot make it ──
  seatsFunded: integer("seats_funded").notNull().default(0),
  // Replacement offers go out in waves; this is which wave, and when the last one went.
  seatWave: integer("seat_wave").notNull().default(0),
  seatWaveAt: timestamp("seat_wave_at"),
  seatDecisionNotifiedAt: timestamp("seat_decision_notified_at"),
  cancellationRequestedAt: timestamp("cancellation_requested_at"),
  cancellationReason: text("cancellation_reason"),
});

export const castingApplicationsTable = pgTable("casting_applications", {
  id: text("id").primaryKey(),
  castingId: text("casting_id").notNull().references(() => castingCallsTable.id, { onDelete: "cascade" }),
  castingTitle: text("casting_title").notNull(),
  stylistId: text("stylist_id").notNull().references(() => stylistProfilesTable.id, { onDelete: "cascade" }),
  stylistName: text("stylist_name").notNull(),
  // applied: pending | shortlisted | accepted | passed
  // invited: invited | accepted | declined
  // withdrawn: she was in the team and pulled out
  status: text("status").notNull().default("pending"),
  // applied | invited | seat_offer (offered a seat that opened up after someone withdrew)
  source: text("source").notNull().default("applied"),
  appliedAt: timestamp("applied_at").notNull().defaultNow(),
  respondedAt: timestamp("responded_at"),
});

export type CastingCall = typeof castingCallsTable.$inferSelect;
export type CastingApplication = typeof castingApplicationsTable.$inferSelect;
