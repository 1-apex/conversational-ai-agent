import { desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { calls, callSummaries, callTurns, safetyEvents } from "@/lib/db/schema";
import { route } from "@/lib/http/route";
import { analyticsLimiter } from "@/lib/rate-limit";

const rowsOf = <T,>(result: unknown) => (result as { rows: T[] }).rows;

export const GET = route({
  name: "analytics",
  access: { staff: "analytics:read" },
  limiter: analyticsLimiter,
  handler: async ({ db, user }) => {
    const org = user.organizationId;

    // Totals come from SQL, so they aren't capped by the list of recent calls below
    const [totals] = rowsOf<{ total: number; avg_duration: number | null; positive: number }>(await db.execute(sql`
      SELECT count(*)::int AS total,
        avg(extract(epoch FROM ended_at - started_at))::int AS avg_duration,
        count(*) FILTER (WHERE sentiment = 'positive')::int AS positive
      FROM calls WHERE organization_id = ${org}
    `));

    const perDay = rowsOf<{ day: string; count: number }>(await db.execute(sql`
      SELECT to_char(started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, count(*)::int AS count
      FROM calls WHERE organization_id = ${org} AND started_at > now() - interval '7 days'
      GROUP BY 1 ORDER BY 1
    `));

    const latency = rowsOf<Record<string, number | null>>(await db.execute(sql`
      SELECT
        percentile_cont(0.5)  WITHIN GROUP (ORDER BY (t.timings->>'totalMs')::float)::int AS total_p50,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY (t.timings->>'totalMs')::float)::int AS total_p95,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY (t.timings->>'generationMs')::float)::int AS generation_p95,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY (t.timings->>'safetyMs')::float)::int AS safety_p95
      FROM call_turns t JOIN calls c ON c.id = t.call_id
      WHERE c.organization_id = ${org} AND t.timings IS NOT NULL
    `))[0];

    const safety = await db.select({
      severity: safetyEvents.severity, stage: safetyEvents.stage, count: sql<number>`count(*)::int`,
    }).from(safetyEvents).where(eq(safetyEvents.organizationId, org))
      .groupBy(safetyEvents.severity, safetyEvents.stage);

    const models = rowsOf<{ model_id: string; turns: number }>(await db.execute(sql`
      SELECT t.model_id, count(*)::int AS turns FROM call_turns t JOIN calls c ON c.id = t.call_id
      WHERE c.organization_id = ${org} AND t.model_id IS NOT NULL GROUP BY 1
    `));

    const recent = await db.select({
      id: calls.id, started_at: calls.startedAt, ended_at: calls.endedAt, agents_used: calls.agentsUsed,
      sentiment: calls.sentiment, emergency_locked: calls.emergencyLocked,
      intelligence: callSummaries.intelligence, turn_count: sql<number>`(SELECT count(*)::int FROM ${callTurns} WHERE ${callTurns.callId} = ${calls.id})`,
    }).from(calls).leftJoin(callSummaries, eq(callSummaries.callId, calls.id))
      .where(eq(calls.organizationId, org)).orderBy(desc(calls.startedAt)).limit(100);

    return NextResponse.json({ totals, perDay, latency, safety, models, calls: recent });
  },
});
