import { pgTable, text, real, integer, boolean, pgEnum, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { stylistProfilesTable } from "./stylists";

export const appointmentStatusEnum = pgEnum("appointment_status", [
  "pending",    // awaiting artist acceptance
  "confirmed",  // artist accepted
  "completed",  // work done
  "cancelled",  // client cancelled a confirmed booking
  "declined",   // artist declined a pending request — distinct from client cancellation
]);

// payoutStatus values: 'held' | 'released' | 'disputed'
// 'held'     — payment collected, awaiting dual work confirmation
// 'released' — both parties confirmed work done; 82/18 split recorded
// 'disputed' — one or both parties raised a dispute; frozen for manual review

export const appointmentsTable = pgTable("appointments", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull().references(() => usersTable.id),
  clientName: text("client_name").notNull(),
  stylistId: text("stylist_id").notNull().references(() => stylistProfilesTable.id, { onDelete: "cascade" }),
  stylistName: text("stylist_name").notNull(),
  serviceId: text("service_id").notNull(),
  serviceName: text("service_name").notNull(),
  date: text("date").notNull(),
  time: text("time").notNull(),
  status: appointmentStatusEnum("status").notNull().default("pending"),
  price: real("price").notNull(),
  duration: integer("duration").notNull(),
  notes: text("notes"),
  stripeSessionId: text("stripe_session_id").unique(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  paymentMode: text("payment_mode").notNull().default("full"),
  depositAmount: real("deposit_amount").notNull().default(0),
  tipAmount: real("tip_amount").notNull().default(0),
  balanceDue: real("balance_due").notNull().default(0),
  isTeamBooking: boolean("is_team_booking").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  // ── Dual work-confirmation + payout split ──────────────────────────────────
  workConfirmedByClient: boolean("work_confirmed_by_client").notNull().default(false),
  workConfirmedByClientAt: timestamp("work_confirmed_by_client_at"),
  workConfirmedByArtist: boolean("work_confirmed_by_artist").notNull().default(false),
  workConfirmedByArtistAt: timestamp("work_confirmed_by_artist_at"),
  payoutStatus: text("payout_status").notNull().default("held"),
  artistPayoutAmount: real("artist_payout_amount").notNull().default(0),
  platformFeeAmount: real("platform_fee_amount").notNull().default(0),
  // ── Brand campaigns ────────────────────────────────────────────────────────
  // commission:   the usual booking, Bonisa keeps 18% of what the client pays.
  // brand_on_top: a campaign job, the artist keeps her full rate and the brand paid 18% more.
  campaignId: text("campaign_id"),
  feeMode: text("fee_mode").notNull().default("commission"),
  // A campaign job whose artist withdrew. The job is cancelled, but the money paid for the seat
  // stays held here until a replacement takes it over or the brand gives the seat up.
  seatOpen: boolean("seat_open").notNull().default(false),
  // When the brand gives a seat up, this is what Bonisa owes back to it.
  refundDueAmount: real("refund_due_amount").notNull().default(0),
  refundedAt: timestamp("refunded_at"),
  refundReference: text("refund_reference"),
});

export type Appointment = typeof appointmentsTable.$inferSelect;
