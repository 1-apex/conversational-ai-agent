import { NextResponse } from "next/server";
import { getDb, ensureSchema } from "@/lib/db";

export async function GET() {
  const db = getDb();
  if (!db) return NextResponse.json({ error: "no-db" }, { status: 503 });

  await ensureSchema();

  const calls = await db`
    SELECT id, started_at, duration, agents_used, sentiment, brief, created_at
    FROM calls
    ORDER BY created_at DESC
    LIMIT 100
  `;

  return NextResponse.json({ calls });
}
