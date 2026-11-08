import { and, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { writeAudit } from "@/lib/audit";
import type { Db } from "@/lib/db";
import { calls, escalations } from "@/lib/db/schema";

const IDLE_CALL_MS          = 60 * 60 * 1000;
const CONTACT_RETENTION_MS  = 30 * 24 * 60 * 60 * 1000;
const OPEN_STATUSES         = ["open", "assigned", "in_progress", "callback_scheduled"];

// Periods are provisional. See docs/19-data-governance.md.
export async function runRetention(db: Db, now = new Date()) {
  // 1. Close calls nobody ended, such as when a tab was closed
  const closed = await db.update(calls).set({ state: "CALL_COMPLETED", endedAt: now }).where(and(
    isNull(calls.endedAt), lt(calls.lastActivityAt, new Date(now.getTime() - IDLE_CALL_MS)),
  )).returning({ id: calls.id });

  // 2. Delete expired calls, except any with an open escalation. Turns, summaries
  //    and safety events go with them through ON DELETE CASCADE.
  const expired = await db.select({ id: calls.id }).from(calls).where(lt(calls.retentionExpiresAt, now));
  const expiredIds = expired.map((c) => c.id);
  let deleted = 0;
  if (expiredIds.length > 0) {
    const held = await db.selectDistinct({ id: escalations.callId }).from(escalations)
      .where(and(inArray(escalations.callId, expiredIds), inArray(escalations.status, OPEN_STATUSES)));
    const heldIds = new Set(held.map((h) => h.id));
    const toDelete = expiredIds.filter((id) => !heldIds.has(id));
    if (toDelete.length > 0) {
      deleted = (await db.delete(calls).where(inArray(calls.id, toDelete)).returning({ id: calls.id })).length;
    }
  }

  // 3. Clear callback numbers once they're no longer needed
  const cleared = await db.update(escalations).set({ encryptedContact: null }).where(and(
    or(eq(escalations.status, "resolved"), eq(escalations.status, "closed"), eq(escalations.status, "unable_to_reach")),
    lt(escalations.updatedAt, new Date(now.getTime() - CONTACT_RETENTION_MS)),
  )).returning({ id: escalations.id });

  const outcome = { idleCallsClosed: closed.length, callsDeleted: deleted, contactsCleared: cleared.length };
  await writeAudit(db, { action: "retention.run", metadata: outcome }); // counts only
  return outcome;
}
