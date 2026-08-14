import { pgTable, text, real, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { appointmentsTable } from "./appointments";

export const paymentStatusEnum = pgEnum("payment_status", [
  "succeeded",
  "refunded",
  "partial_refunded",
  "failed",
  "pending",
]);

export const paymentsTable = pgTable("payments", {
  id: text("id").primaryKey(),
  appointmentId: text("appointment_id").references(() => appointmentsTable.id),
  stripeSessionId: text("stripe_session_id").unique(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  amount: real("amount").notNull(),
  tipAmount: real("tip_amount").notNull().default(0),
  depositAmount: real("deposit_amount").notNull().default(0),
  discountAmount: real("discount_amount").notNull().default(0),
  couponCode: text("coupon_code"),
  refundedAmount: real("refunded_amount").notNull().default(0),
  status: paymentStatusEnum("status").notNull().default("succeeded"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Payment = typeof paymentsTable.$inferSelect;
