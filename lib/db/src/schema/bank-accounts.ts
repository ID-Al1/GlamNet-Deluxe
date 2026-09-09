import { check, index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { stylistProfilesTable } from "./stylists";
import { usersTable } from "./users";

export const bankAccountsTable = pgTable("bank_accounts", {
  id: text("id").primaryKey(),
  stylistProfileId: text("stylist_profile_id").notNull().references(() => stylistProfilesTable.id, { onDelete: "cascade" }),
  bankName: text("bank_name").notNull(),
  accountHolderName: text("account_holder_name").notNull(),
  accountNumber: text("account_number").notNull(),
  accountType: text("account_type").notNull(),
  verificationStatus: text("verification_status").notNull().default("pending"),
  revision: integer("revision").notNull().default(1),
  verifiedAt: timestamp("verified_at"),
  verifiedBy: text("verified_by").references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  artistUnique: uniqueIndex("bank_accounts_stylist_profile_unique").on(table.stylistProfileId),
  accountTypeCheck: check("bank_accounts_account_type_check", sql`${table.accountType} in ('cheque', 'savings', 'other')`),
  verificationStatusCheck: check("bank_accounts_verification_status_check", sql`${table.verificationStatus} in ('pending', 'verified', 'failed')`),
}));

export const bankAccountAccessLogTable = pgTable("bank_account_access_log", {
  id: text("id").primaryKey(),
  bankAccountId: text("bank_account_id").notNull().references(() => bankAccountsTable.id),
  viewedByUserId: text("viewed_by_user_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  bankAccountIndex: index("bank_account_access_log_bank_account_idx").on(table.bankAccountId),
  viewedByIndex: index("bank_account_access_log_viewed_by_idx").on(table.viewedByUserId),
}));