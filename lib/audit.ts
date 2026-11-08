import { sql } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";

export interface AuditEntry {
  action: string;
  actorId?: string | null;
  organizationId?: string | null;
  targetType?: string;
  targetId?: string;
  correlationId?: string;
  // IDs and counts only: never transcript text, contact details or passwords
  metadata?: Record<string, string | number | boolean | null>;
}

// An audit failure never reaches the caller, but it is logged as an error for alerting.
export async function writeAudit(db: Db, entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLogs).values(entry);
  } catch (error) {
    console.error(JSON.stringify({
      level: "error", event: "audit.write_failed", action: entry.action,
      errorName: error instanceof Error ? error.name : "Unknown",
    }));
  }
}

// Recomputes the hash chain in SQL, with the same formula as the insert trigger.
// Returns the ID of the first broken row, or null if the chain is intact.
export async function verifyAuditChain(db: Db): Promise<number | null> {
  const result = await db.execute(sql`
    SELECT id FROM (
      SELECT id, prev_hash, entry_hash,
        lag(entry_hash) OVER (ORDER BY id) AS previous,
        encode(sha256(convert_to(
          concat_ws('|', coalesce(prev_hash, ''), action, coalesce(actor_id::text, ''),
            coalesce(target_type, ''), coalesce(target_id, ''),
            coalesce(metadata::text, ''), created_at::text),
          'UTF8')), 'hex') AS recomputed
      FROM audit_logs
    ) chain
    WHERE entry_hash IS DISTINCT FROM recomputed OR prev_hash IS DISTINCT FROM previous
    ORDER BY id LIMIT 1
  `);
  const rows = (result as unknown as { rows: { id: number | string }[] }).rows;
  return rows.length > 0 ? Number(rows[0].id) : null;
}
