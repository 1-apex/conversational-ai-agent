import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { PROMPT_VERSION } from "@/lib/agent-prompts";
import { getKnowledgeMode } from "@/lib/config";
import { route } from "@/lib/http/route";
import { staffLimiter } from "@/lib/rate-limit";
import { SAFETY_POLICY_VERSION } from "@/lib/safety/policy";

export const GET = route({
  name: "health.details",
  access: { staff: "ops:read" },
  limiter: staffLimiter,
  handler: async ({ db }) => {
    let database = "ok";
    try {
      await db.execute(sql`SELECT 1`);
    } catch {
      database = "failing";
    }
    return NextResponse.json({
      database,
      providersConfigured: {
        groq: Boolean(process.env.GROQ_API_KEY),
        elevenlabs: Boolean(process.env.ELEVENLABS_API_KEY),
        anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
        redis: Boolean(process.env.UPSTASH_REDIS_REST_URL),
        embeddings: Boolean(process.env.EMBEDDING_API_URL),
      },
      knowledgeMode: getKnowledgeMode(),
      promptVersion: PROMPT_VERSION,
      policyVersion: SAFETY_POLICY_VERSION,
    });
  },
});
