import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { evaluationRuns } from "@/lib/db/schema";
import { route } from "@/lib/http/route";
import { staffLimiter } from "@/lib/rate-limit";

export const GET = route({
  name: "evaluations.runs",
  access: { staff: "evaluations:read" },
  limiter: staffLimiter,
  handler: async ({ db }) => {
    const runs = await db.select().from(evaluationRuns).orderBy(desc(evaluationRuns.createdAt)).limit(50);
    return NextResponse.json({ runs });
  },
});
