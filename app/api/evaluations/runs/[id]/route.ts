import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { evaluationResults, evaluationRuns } from "@/lib/db/schema";
import { route } from "@/lib/http/route";
import { staffLimiter } from "@/lib/rate-limit";

export const GET = route({
  name: "evaluations.run",
  access: { staff: "evaluations:read" },
  limiter: staffLimiter,
  handler: async ({ params, db, fail }) => {
    if (!z.uuid().safeParse(params.id).success) return fail("not_found", 404);
    const [run] = await db.select().from(evaluationRuns).where(eq(evaluationRuns.id, params.id)).limit(1);
    if (!run) return fail("not_found", 404);
    const failed = await db.select().from(evaluationResults)
      .where(and(eq(evaluationResults.runId, run.id), eq(evaluationResults.passed, false)));
    return NextResponse.json({ run, failed });
  },
});
