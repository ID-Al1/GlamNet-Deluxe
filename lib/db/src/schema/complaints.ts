import { pgTable, text, timestamp, integer, uniqueIndex, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { appointmentsTable } from "./appointments";
import { usersTable } from "./users";

export const complaintCategories = [
  "didnt_arrive", "poor_service", "payment_issue", "refund_request",
  "behaviour", "safety_concern", "false_review", "harassment", "other",
] as const;
export const complaintStatuses = [
  "new", "under_review", "waiting_for_client", "waiting_for_artist",
  "resolved", "escalated", "closed",
] as const;

export const complaintsTable = pgTable("complaints", {
  id: text("id").primaryKey(),
  caseNumber: text("case_number").notNull().unique(),
  appointmentId: text("appointment_id").references(() => appointmentsTable.id),
  complainantUserId: text("complainant_user_id").notNull().references(() => usersTable.id),
  subjectUserId: text("subject_user_id").references(() => usersTable.id),
  complainantRole: text("complainant_role").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("new"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
}, (t) => ({
  roleCheck: check("complaints_role_check", sql`${t.complainantRole} in ('client', 'stylist')`),
  categoryCheck: check("complaints_category_check", sql`${t.category} in ('didnt_arrive','poor_service','payment_issue','refund_request','behaviour','safety_concern','false_review','harassment','other')`),
  statusCheck: check("complaints_status_check", sql`${t.status} in ('new','under_review','waiting_for_client','waiting_for_artist','resolved','escalated','closed')`),
}));

export const complaintEvidenceTable = pgTable("complaint_evidence", {
  id: text("id").primaryKey(),
  complaintId: text("complaint_id").notNull().references(() => complaintsTable.id, { onDelete: "cascade" }),
  uploadedByUserId: text("uploaded_by_user_id").notNull().references(() => usersTable.id),
  objectPath: text("object_path").notNull(),
  url: text("url").notNull(),
  mimeType: text("mime_type").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ complaintUploaderPath: uniqueIndex("complaint_evidence_path_unique").on(t.complaintId, t.objectPath) }));

export const complaintOwnerNotesTable = pgTable("complaint_owner_notes", {
  id: text("id").primaryKey(),
  complaintId: text("complaint_id").notNull().references(() => complaintsTable.id, { onDelete: "cascade" }),
  ownerId: text("owner_id").notNull().references(() => usersTable.id),
  note: text("note").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const complaintActivityTable = pgTable("complaint_activity", {
  id: text("id").primaryKey(),
  complaintId: text("complaint_id").notNull().references(() => complaintsTable.id, { onDelete: "cascade" }),
  actorUserId: text("actor_user_id").references(() => usersTable.id),
  action: text("action").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});