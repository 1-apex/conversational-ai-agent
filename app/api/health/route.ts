import { NextResponse } from "next/server";
import { route } from "@/lib/http/route";
import { analyticsLimiter } from "@/lib/rate-limit";

export const GET = route({
  name: "health",
  access: "public",
  limiter: analyticsLimiter,
  handler: async () => NextResponse.json({ status: "ok" }), // nothing about dependencies is revealed here
});
