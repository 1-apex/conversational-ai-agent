import { NextResponse } from "next/server";
import { getDb, ensureSchema } from "@/lib/db";
import { route } from "@/lib/http/route";
import { CallLogRequestSchema } from "@/lib/http/schemas";
import { callLogLimiter } from "@/lib/rate-limit";

export const POST = route({
  name: "calls",
  access: "public", // Open write until staff auth and server-held calls land (T1.4, T1.7)
  limiter: callLogLimiter,
  body: CallLogRequestSchema,
  maxBytes: 2 * 1024 * 1024,
  handler: async ({ body, log }) => {
    const db = getDb();
    if (!db) {
      // No DATABASE_URL — silently skip logging, don't break the call flow
      return NextResponse.json({ ok: false, reason: "no-db" });
    }

    await ensureSchema();
    await db`
      INSERT INTO calls (id, started_at, duration, agents_used, turns, brief, sentiment)
      VALUES (
        ${body.id},
        ${body.startedAt},
        ${body.duration},
        ${body.agentsUsed},
        ${JSON.stringify(body.turns)},
        ${JSON.stringify(body.brief)},
        ${body.sentiment}
      )
      ON CONFLICT (id) DO NOTHING
    `;

    log.info("call.logged", { route: "calls" });
    return NextResponse.json({ ok: true });
  },
});
