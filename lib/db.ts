import { neon } from "@neondatabase/serverless";

let _sql: ReturnType<typeof neon> | null = null;

export function getDb() {
  if (!process.env.DATABASE_URL) return null;
  if (!_sql) _sql = neon(process.env.DATABASE_URL);
  return _sql;
}

// Run once on first connection to ensure the table exists.
// Safe to call on every cold start — CREATE TABLE IF NOT EXISTS is idempotent.
export async function ensureSchema() {
  const sql = getDb();
  if (!sql) return;
  await sql`
    CREATE TABLE IF NOT EXISTS calls (
      id           TEXT        PRIMARY KEY,
      started_at   TIMESTAMPTZ NOT NULL,
      duration     INTEGER,
      agents_used  TEXT[],
      turns        JSONB,
      brief        JSONB,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE calls ADD COLUMN IF NOT EXISTS sentiment TEXT`;
}
