import { NextResponse } from "next/server";
import { route } from "@/lib/http/route";
import { runRetention } from "@/lib/retention";
import { analyticsLimiter } from "@/lib/rate-limit";

// Daily, from Vercel Cron, which sends CRON_SECRET as a bearer token (see vercel.json).
export const GET = route({
  name: "internal.retention",
  access: "service",
  limiter: analyticsLimiter,
  handler: async ({ db, log }) => {
    if (!db) return NextResponse.json({ skipped: "no-db" });
    const outcome = await runRetention(db);
    log.info("retention.completed", { route: "internal.retention" });
    return NextResponse.json(outcome);
  },
});
