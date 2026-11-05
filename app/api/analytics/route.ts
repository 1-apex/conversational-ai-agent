import { NextResponse } from "next/server";
import { getDb, ensureSchema } from "@/lib/db";
import { route } from "@/lib/http/route";
import { analyticsLimiter } from "@/lib/rate-limit";

export const GET = route({
  name: "analytics",
  access: "public", // Open read until staff auth lands (T1.4). Don't enable logging on a public deployment
  limiter: analyticsLimiter,
  handler: async ({ fail }) => {
    const db = getDb();
    if (!db) return fail("no-db", 503);

    await ensureSchema();

    const calls = await db`
      SELECT id, started_at, duration, agents_used, sentiment, brief, created_at
      FROM calls
      ORDER BY created_at DESC
      LIMIT 100
    `;

    return NextResponse.json({ calls });
  },
});
