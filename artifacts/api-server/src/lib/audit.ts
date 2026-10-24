import { randomUUID } from "crypto";
import { db, auditEventsTable } from "@workspace/db";

export type AuditActor = { id: string | null; role: string };

/**
 * Append one row to the audit trail. Awaited by callers on purpose: for sensitive
 * reads and admin changes the action must not complete if its audit row cannot
 * be written. Never store personal details in `details`, only ids and field names.
 */
export async function recordAudit(
  actor: AuditActor,
  action: string,
  targetType: string,
  targetId: string,
  details: Record<string, unknown> = {},
): Promise<void> {
  await db.insert(auditEventsTable).values({
    id: randomUUID(),
    actorUserId: actor.id,
    actorRole: actor.role,
    action,
    targetType,
    targetId,
    details,
  });
}
