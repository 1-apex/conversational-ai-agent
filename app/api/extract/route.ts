import { NextResponse } from "next/server";
import { CallBriefData, TranscriptTurn } from "@/lib/types";
import { EMPTY_ENTITY_MAP } from "@/lib/entity-extractor";
import { route } from "@/lib/http/route";
import { CallBriefSchema, ExtractRequestSchema } from "@/lib/http/schemas";
import { extractLimiter } from "@/lib/rate-limit";
import { generateRuleBrief } from "@/lib/rule-brief";

export const POST = route({
  name: "extract",
  access: "public",
  limiter: extractLimiter,
  body: ExtractRequestSchema,
  maxBytes: 2 * 1024 * 1024,
  handler: async ({ body, log }) => {
    const turns: TranscriptTurn[] = body.turns.map((t) => ({ ...t, entities: EMPTY_ENTITY_MAP }));
    const secs = body.duration;

    // ── AI extraction, in order, for each provider with a key ────────────
    // The imports are dynamic so the server never crashes on missing keys.
    const providers: { name: string; extract(): Promise<CallBriefData> }[] = [];
    if (process.env.ANTHROPIC_API_KEY) {
      providers.push({
        name: "anthropic",
        extract: async () => (await import("@/lib/claude-client")).extractCallBrief(turns, secs),
      });
    }
    if (process.env.GROQ_API_KEY) {
      providers.push({
        name: "groq",
        extract: async () => (await import("@/lib/groq-client")).extractWithGroq(turns, secs),
      });
    }

    for (const provider of providers) {
      try {
        const brief = CallBriefSchema.safeParse(await provider.extract());
        if (brief.success) return NextResponse.json(brief.data);
        log.warn("brief.invalid_output", { provider: provider.name });
      } catch (error) {
        log.warn("provider.failed", {
          provider: provider.name,
          errorName: error instanceof Error ? error.name : "Unknown",
        });
      }
    }

    // ── Rule-based fallback (no API key required) ─────────────────────────
    return NextResponse.json(generateRuleBrief(turns, secs));
  },
});
