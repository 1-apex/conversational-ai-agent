import { z } from "zod";
import { CallBriefSchema } from "@/lib/http/schemas";
import { generateRuleBrief } from "@/lib/rule-brief";
import { scoreSentiment, Sentiment } from "@/lib/sentiment";
import { CallBriefData, TranscriptTurn } from "@/lib/types";
import { extractEntities } from "@/lib/entity-extractor";
import { Logger } from "@/lib/observability/logger";

export const CALL_INTELLIGENCE_VERSION = "1";

// Every statement says where it came from, so staff can tell facts from guesses.
const StatementSchema = z.object({
  text:       z.string(),
  provenance: z.enum(["caller_stated", "document_retrieved", "model_inferred"]),
});

export const CallIntelligenceSchema = z.object({
  version:            z.string(),
  summary:            z.string(),
  summaryProvenance:  z.enum(["model_inferred", "rule_based"]),
  primaryIntent:      z.string(),
  customerType:       z.enum(["consumer", "business", "unknown"]),
  productsDiscussed:  z.array(z.string()),
  topics:             z.array(z.string()),
  resolutionStatus:   z.enum(["answered", "escalated", "emergency_pathway", "unresolved"]),
  escalationReasons:  z.array(z.string()),
  actionItems:        z.array(StatementSchema),
  safetyFlags:        z.array(z.string()),
  knowledgeVersions:  z.array(z.string()),
  sentiment:          z.enum(["positive", "neutral", "negative"]),
  sentimentMethod:    z.literal("keyword_heuristic"),
  callerStatements:   z.array(StatementSchema),
});

export type CallIntelligence = z.output<typeof CallIntelligenceSchema>;

const PRODUCTS = /\b(one g3|one g4|one g5|g3|g4|g5|rove ?\d?|at home)\b/gi;

export interface CallFacts {
  turns: TranscriptTurn[];
  duration: number;
  categories: string[];    // from recorded safety assessments, never from the LLM
  safetyRuleIds: string[];
  escalationReasons: string[];
  knowledgeVersions: string[];
  emergencyLocked: boolean;
}

function buildIntelligence(facts: CallFacts, brief: CallBriefData, method: "model" | "rule", sentiment: Sentiment): CallIntelligence {
  const text = facts.turns.map((t) => t.text).join(" ");
  const products = [...new Set((text.match(PRODUCTS) ?? []).map((p) => p.toUpperCase().replace(/\s+/g, " ")))];
  const counts = new Map<string, number>();
  for (const c of facts.categories) counts.set(c, (counts.get(c) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);

  return {
    version: CALL_INTELLIGENCE_VERSION,
    summary: brief.summary,
    summaryProvenance: method === "model" ? "model_inferred" : "rule_based",
    primaryIntent: ranked[0] ?? "unknown",
    customerType: facts.categories.includes("business") ? "business" : facts.categories.length ? "consumer" : "unknown",
    productsDiscussed: products,
    topics: ranked,
    resolutionStatus: facts.emergencyLocked ? "emergency_pathway"
      : facts.escalationReasons.length ? "escalated"
      : facts.turns.some((t) => t.speaker === "prospect") ? "answered" : "unresolved",
    escalationReasons: facts.escalationReasons,
    actionItems: brief.actionItems.map((item) => ({ text: item, provenance: "model_inferred" as const })),
    safetyFlags: [...new Set(facts.safetyRuleIds)],
    knowledgeVersions: facts.knowledgeVersions,
    sentiment,
    sentimentMethod: "keyword_heuristic",
    callerStatements: facts.turns.filter((t) => t.speaker === "prospect").slice(0, 20)
      .map((t) => ({ text: t.text, provenance: "caller_stated" as const })),
  };
}

export async function summarizeCall(facts: CallFacts, log: Logger): Promise<{
  brief: CallBriefData; intelligence: CallIntelligence; method: string; modelId: string | null; sentiment: Sentiment;
}> {
  const sentiment = scoreSentiment(facts.turns.filter((t) => t.speaker === "prospect").map((t) => t.text));
  const turns = facts.turns.map((t) => ({ ...t, entities: extractEntities(t.text) }));

  // ── Providers, in order, for each with a key ──────────────────────────
  // The imports are dynamic so the server never crashes on missing keys.
  const providers: { name: string; modelId: string; extract(): Promise<CallBriefData> }[] = [];
  if (process.env.ANTHROPIC_API_KEY) {
    const { extractCallBrief, CLAUDE_MODEL } = await import("@/lib/claude-client");
    providers.push({ name: "anthropic", modelId: CLAUDE_MODEL, extract: () => extractCallBrief(turns, facts.duration) });
  }
  if (process.env.GROQ_API_KEY) {
    const { extractWithGroq, GROQ_BRIEF_MODEL } = await import("@/lib/groq-client");
    providers.push({ name: "groq", modelId: GROQ_BRIEF_MODEL, extract: () => extractWithGroq(turns, facts.duration) });
  }

  for (const provider of providers) {
    try {
      const parsed = CallBriefSchema.safeParse(await provider.extract());
      if (parsed.success) {
        return {
          brief: parsed.data, method: provider.name, modelId: provider.modelId, sentiment,
          intelligence: buildIntelligence(facts, parsed.data, "model", sentiment),
        };
      }
      log.warn("brief.invalid_output", { provider: provider.name });
    } catch (error) {
      log.warn("provider.failed", {
        provider: provider.name,
        errorName: error instanceof Error ? error.name : "Unknown",
      });
    }
  }

  const brief = generateRuleBrief(turns, facts.duration);
  return {
    brief, method: "rule_based", modelId: null, sentiment,
    intelligence: buildIntelligence(facts, brief, "rule", sentiment),
  };
}
