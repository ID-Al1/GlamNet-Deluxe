import { pgTable, text, integer, boolean, timestamp, jsonb, date, index, uniqueIndex, primaryKey, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./users";

/**
 * Model portal. Public and private data are kept in separate tables on purpose:
 * `model_profiles` holds what a model may publish (each field gated by `visibility`),
 * photos and social links carry their own `is_public` flag, and nothing here stores
 * ID documents or bank details. Public DTOs are built field by field in the API.
 */
export const modelProfilesTable = pgTable("model_profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  professionalName: text("professional_name").notNull(),
  category: text("category").notNull().default(""),
  // Coarse location only (city / province). Never a street address.
  area: text("area").notNull().default(""),
  bio: text("bio"),
  skills: text("skills").array().notNull().default([]),
  serviceCategories: text("service_categories").array().notNull().default([]),
  availability: text("availability").notNull().default("unavailable"),
  acceptsEnquiries: boolean("accepts_enquiries").notNull().default(true),
  startingRateCents: integer("starting_rate_cents"),
  rateNote: text("rate_note"),
  creativeIdentity: text("creative_identity"),
  collaborationPreferences: text("collaboration_preferences"),
  careerGoals: text("career_goals"),
  // Per-field publish switches, e.g. { bio: true, skills: true, rates: false }. Missing key = private.
  visibility: jsonb("visibility").$type<Record<string, boolean>>().notNull().default({}),
  isPublished: boolean("is_published").notNull().default(false),
  publishedAt: timestamp("published_at"),
  verificationStatus: text("verification_status").notNull().default("none"),
  verificationRequestedAt: timestamp("verification_requested_at"),
  verifiedAt: timestamp("verified_at"),
  verificationRejectionReason: text("verification_rejection_reason"),
  // Assigned by Bonisa when verification is granted (e.g. BM-0042). Never reused.
  registryNumber: text("registry_number").unique(),
  // Editorial pick by the owner. Not a ranking and not computed from anything.
  spotlightAt: timestamp("spotlight_at"),
  spotlightNote: text("spotlight_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  verificationCheck: check("model_profiles_verification_check", sql`${t.verificationStatus} in ('none', 'pending', 'verified', 'rejected')`),
  availabilityCheck: check("model_profiles_availability_check", sql`${t.availability} in ('available', 'limited', 'unavailable')`),
}));

export const modelPhotosTable = pgTable("model_photos", {
  id: text("id").primaryKey(),
  modelProfileId: text("model_profile_id").notNull().references(() => modelProfilesTable.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  objectPath: text("object_path").notNull(),
  mimeType: text("mime_type").notNull(),
  isPublic: boolean("is_public").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  kindCheck: check("model_photos_kind_check", sql`${t.kind} in ('front', 'left', 'right', 'full_length', 'editorial')`),
  // One of each standard digital; editorial portraits can be many.
  oneDigitalPerKind: uniqueIndex("model_photos_one_digital_per_kind").on(t.modelProfileId, t.kind).where(sql`${t.kind} <> 'editorial'`),
}));

export const modelSocialLinksTable = pgTable("model_social_links", {
  id: text("id").primaryKey(),
  modelProfileId: text("model_profile_id").notNull().references(() => modelProfilesTable.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(),
  url: text("url").notNull(),
  handle: text("handle"),
  followerCount: integer("follower_count"),
  // Audience numbers are typed in by the model. Source and date are always shown with them.
  statSource: text("stat_source").notNull().default("self_reported"),
  statUpdatedAt: timestamp("stat_updated_at"),
  isPublic: boolean("is_public").notNull().default(false),
});

export const modelEnquiriesTable = pgTable("model_enquiries", {
  id: text("id").primaryKey(),
  modelProfileId: text("model_profile_id").notNull().references(() => modelProfilesTable.id, { onDelete: "cascade" }),
  fromUserId: text("from_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const opportunitiesTable = pgTable("opportunities", {
  id: text("id").primaryKey(),
  organiserUserId: text("organiser_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  organiserName: text("organiser_name").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  brief: text("brief").notNull(),
  deliverables: text("deliverables").notNull(),
  eligibility: text("eligibility"),
  startDate: date("start_date", { mode: "string" }),
  endDate: date("end_date", { mode: "string" }),
  location: text("location").notNull().default(""),
  isRemote: boolean("is_remote").notNull().default(false),
  compensationCents: integer("compensation_cents"),
  compensationNote: text("compensation_note").notNull().default(""),
  expensesNote: text("expenses_note").notNull().default(""),
  usageRights: text("usage_rights").notNull(),
  exclusivity: text("exclusivity").notNull().default("None"),
  paymentTerms: text("payment_terms").notNull(),
  applicationDeadline: date("application_deadline", { mode: "string" }).notNull(),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  statusCheck: check("opportunities_status_check", sql`${t.status} in ('open', 'closed')`),
  statusIdx: index("opportunities_status_idx").on(t.status),
}));

export const opportunityApplicationsTable = pgTable("opportunity_applications", {
  id: text("id").primaryKey(),
  opportunityId: text("opportunity_id").notNull().references(() => opportunitiesTable.id, { onDelete: "cascade" }),
  modelProfileId: text("model_profile_id").notNull().references(() => modelProfilesTable.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  proposedFeeCents: integer("proposed_fee_cents"),
  status: text("status").notNull().default("applied"),
  statusNote: text("status_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  statusCheck: check("opportunity_applications_status_check", sql`${t.status} in ('applied', 'shortlisted', 'accepted', 'passed', 'withdrawn')`),
  onePerModel: uniqueIndex("opportunity_applications_one_per_model").on(t.opportunityId, t.modelProfileId),
}));

export const savedOpportunitiesTable = pgTable("saved_opportunities", {
  modelProfileId: text("model_profile_id").notNull().references(() => modelProfilesTable.id, { onDelete: "cascade" }),
  opportunityId: text("opportunity_id").notNull().references(() => opportunitiesTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ pk: primaryKey({ columns: [t.modelProfileId, t.opportunityId] }) }));

export const opportunityReportsTable = pgTable("opportunity_reports", {
  id: text("id").primaryKey(),
  opportunityId: text("opportunity_id").notNull().references(() => opportunitiesTable.id, { onDelete: "cascade" }),
  reporterUserId: text("reporter_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  onePerReporter: uniqueIndex("opportunity_reports_one_per_reporter").on(t.opportunityId, t.reporterUserId),
}));

/** Append-only. Rows are never updated or deleted by application code. */
export const auditEventsTable = pgTable("audit_events", {
  id: text("id").primaryKey(),
  actorUserId: text("actor_user_id"),
  actorRole: text("actor_role").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ createdIdx: index("audit_events_created_idx").on(t.createdAt) }));

export type ModelProfile = typeof modelProfilesTable.$inferSelect;
export type ModelPhoto = typeof modelPhotosTable.$inferSelect;
export type ModelSocialLink = typeof modelSocialLinksTable.$inferSelect;
export type Opportunity = typeof opportunitiesTable.$inferSelect;
export type OpportunityApplication = typeof opportunityApplicationsTable.$inferSelect;
