import { pgTable, text, boolean, pgEnum, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const referredTypeEnum = pgEnum("referred_type", ["artist", "client"]);
export const referralStatusEnum = pgEnum("referral_status", ["pending", "completed"]);

export const referralsTable = pgTable("referrals", {
  id: text("id").primaryKey(),
  referrerId: text("referrer_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  referredId: text("referred_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  referredType: referredTypeEnum("referred_type").notNull(),
  status: referralStatusEnum("status").notNull().default("pending"),
  bonusPaid: boolean("bonus_paid").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Referral = typeof referralsTable.$inferSelect;
