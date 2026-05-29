import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureSchema } from "@/lib/db";

export async function POST(req: NextRequest) {
  const db = getDb();
  if (!db) {
    // No DATABASE_URL — silently skip logging, don't break the call flow
    return NextResponse.json({ ok: false, reason: "no-db" });
  }

  try {
    const body = (await req.json()) as {
      id?:         string;
      startedAt?:  string;
      duration?:   number;
      agentsUsed?: string[];
      turns?:      unknown;
      brief?:      unknown;
    };

    if (!body.id || !body.startedAt) {
      return NextResponse.json({ error: "id and startedAt required" }, { status: 400 });
    }

    await ensureSchema();
    await db`
      INSERT INTO calls (id, started_at, duration, agents_used, turns, brief)
      VALUES (
        ${body.id},
        ${body.startedAt},
        ${body.duration ?? null},
        ${body.agentsUsed ?? []},
        ${JSON.stringify(body.turns ?? [])},
        ${JSON.stringify(body.brief ?? null)}
      )
      ON CONFLICT (id) DO NOTHING
    `;

    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[calls] DB error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
