import { pgTable, text, real, timestamp, uniqueIndex, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./users";
import { castingCallsTable } from "./casting";
import { appointmentsTable } from "./appointments";

/**
 * A brand's business profile. Like an artist, a brand has to be verified by the
 * owner before it can post a campaign or fund one: artists should only ever
 * be shown real companies.
 */
export const brandProfilesTable = pgTable("brand_profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  companyName: text("company_name").notNull().default(""),
  registrationNumber: text("registration_number"),
  vatNumber: text("vat_number"),
  website: text("website"),
  billingAddress: text("billing_address"),
  // none | pending | verified
  verificationStatus: text("verification_status").notNull().default("none"),
  submittedAt: timestamp("submitted_at"),
  verifiedAt: timestamp("verified_at"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  userUnique: uniqueIndex("brand_profiles_user_unique").on(t.userId),
  statusCheck: check("brand_profiles_status_check", sql`${t.verificationStatus} in ('none','pending','verified')`),
}));

/**
 * One row per Stripe payment a brand makes towards a campaign: the 50% deposit,
 * the balance, or the full amount at once.
 */
export const campaignPaymentsTable = pgTable("campaign_payments", {
  id: text("id").primaryKey(),
  castingId: text("casting_id").notNull().references(() => castingCallsTable.id),
  kind: text("kind").notNull(),
  amount: real("amount").notNull(),
  // pending | paid | failed | expired
  status: text("status").notNull().default("pending"),
  stripeSessionId: text("stripe_session_id").unique(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  paidAt: timestamp("paid_at"),
}, (t) => ({
  kindCheck: check("campaign_payments_kind_check", sql`${t.kind} in ('deposit','balance','full')`),
  statusCheck: check("campaign_payments_status_check", sql`${t.status} in ('pending','paid','failed','expired')`),
}));

/** How one campaign payment is shared between the artists' jobs. Fixed when the session is created. */
export const campaignPaymentLinesTable = pgTable("campaign_payment_lines", {
  id: text("id").primaryKey(),
  campaignPaymentId: text("campaign_payment_id").notNull().references(() => campaignPaymentsTable.id, { onDelete: "cascade" }),
  appointmentId: text("appointment_id").notNull().references(() => appointmentsTable.id),
  amount: real("amount").notNull(),
}, (t) => ({
  paymentAppointmentUnique: uniqueIndex("campaign_payment_lines_unique").on(t.campaignPaymentId, t.appointmentId),
}));

/**
 * Everything that happens to a seat on a funded campaign: an artist withdrawing, a
 * replacement joining, a seat given up. It is the brand's story of what changed and
 * Bonisa's record of how reliable each artist is: withdrawals carry a severity, and
 * last-minute ones count as strikes.
 */
export const campaignSeatEventsTable = pgTable("campaign_seat_events", {
  id: text("id").primaryKey(),
  castingId: text("casting_id").notNull().references(() => castingCallsTable.id),
  // withdrew | filled | given_up
  kind: text("kind").notNull(),
  stylistProfileId: text("stylist_profile_id"),
  stylistName: text("stylist_name").notNull().default(""),
  // For "filled": who she replaced.
  otherName: text("other_name"),
  // For "withdrew": early | late | last_minute
  severity: text("severity"),
  hoursBefore: real("hours_before"),
  reason: text("reason"),
  amount: real("amount"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  kindCheck: check("campaign_seat_events_kind_check", sql`${t.kind} in ('withdrew','filled','given_up')`),
}));

export type BrandProfile = typeof brandProfilesTable.$inferSelect;
export type CampaignSeatEvent = typeof campaignSeatEventsTable.$inferSelect;
export type CampaignPayment = typeof campaignPaymentsTable.$inferSelect;
