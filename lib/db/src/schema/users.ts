import { pgTable, text, timestamp, pgEnum, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const roleEnum = pgEnum("role", ["client", "stylist", "brand"]);

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull(),
  businessName: text("business_name"),
  avatarUrl: text("avatar_url"),
  phone: text("phone").unique(),
  stripeCustomerId: text("stripe_customer_id"),
  accountStatus: text("account_status").notNull().default("active"),
  referralCode: text("referral_code").unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ accountStatusCheck: check("users_account_status_check", sql`${t.accountStatus} in ('active', 'suspended')`) }));

export const insertUserSchema = createInsertSchema(usersTable).omit({ createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
