import { randomUUID } from "crypto";
import { sql } from "drizzle-orm";
import { db, complaintsTable, complaintActivityTable } from "@workspace/db";

export async function recordComplaintActivity(complaintId: string, actorUserId: string, action: string, details?: string, tx: any = db) {
  await tx.insert(complaintActivityTable).values({ id: randomUUID(), complaintId, actorUserId, action, details: details ?? null });
}

/** Opens a new case with the next case number. Throws if a number cannot be allocated. */
export async function createComplaintCase(input: {
  appointmentId: string | null;
  complainantUserId: string;
  subjectUserId: string | null;
  complainantRole: "client" | "stylist";
  category: string;
  description: string;
}) {
  const seqRows = await db.execute(sql`select nextval('complaint_case_number_seq') as n`);
  const sequenceNumber = Number((seqRows.rows[0] as any)?.n);
  if (!Number.isFinite(sequenceNumber)) throw new Error("Could not allocate case number");
  const caseNumber = `BN-${new Date().getFullYear()}-${String(sequenceNumber).padStart(6, "0")}`;
  const [created] = await db.insert(complaintsTable).values({
    id: randomUUID(), caseNumber, status: "new", ...input,
  }).returning();
  await recordComplaintActivity(created.id, input.complainantUserId, "created");
  return created;
}
