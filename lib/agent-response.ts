import { z } from "zod";
import { AgentNameSchema } from "@/lib/http/schemas";

// A proposal, not a decision: the orchestrator and the validator have the final say.
// There's no confidence field, because it wouldn't be trusted.
export const AgentResponseSchema = z.object({
  reply:              z.string(),
  proposedAgent:      AgentNameSchema.nullable().catch(null),
  handoffReason:      z.string().max(200).nullable().catch(null),
  requestsEscalation: z.boolean().catch(false),
  citedChunkIds:      z.array(z.string().max(64)).max(8).catch([]),
});

export type AgentResponse = z.output<typeof AgentResponseSchema>;

export interface ParsedAgentResponse extends AgentResponse {
  wellFormed: boolean;
}

const notWellFormed = (reply = ""): ParsedAgentResponse => ({
  reply, proposedAgent: null, handoffReason: null, requestsEscalation: false, citedChunkIds: [],
  wellFormed: false,
});

function fromObject(value: Record<string, unknown>): ParsedAgentResponse | null {
  const parsed = AgentResponseSchema.safeParse({
    proposedAgent: value.handoff ?? null, handoffReason: null, requestsEscalation: false, citedChunkIds: [],
    ...value,
  });
  return parsed.success && parsed.data.reply ? { ...parsed.data, wellFormed: true } : null;
}

// Model output never gets spoken as raw JSON. A reply that can't be understood comes back
// with empty text, and the pipeline replaces it with an approved fallback.
export function parseAgentResponse(text: string): ParsedAgentResponse {
  const clean = text.trim();

  // Best case: entire response is valid JSON
  try {
    const parsed = JSON.parse(clean) as Record<string, unknown>;
    return fromObject(parsed) ?? notWellFormed();
  } catch { /* */ }

  // Fallback: model leaked JSON at the end of a plain-text reply
  const jsonMatch = clean.match(/\{[\s\S]+\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      const fromJson = fromObject(parsed);
      if (fromJson) return fromJson;
      // No usable reply field: keep the text and strip the leaked fragment
      const stripped = clean.replace(jsonMatch[0], "").trim().replace(/[.?\s]+$/, "");
      const parsedRest = AgentResponseSchema.safeParse({
        reply: stripped, proposedAgent: parsed.proposedAgent ?? parsed.handoff ?? null,
        handoffReason: null, requestsEscalation: false, citedChunkIds: [],
      });
      return parsedRest.success && stripped ? { ...parsedRest.data, wellFormed: false } : notWellFormed();
    } catch { /* */ }
  }

  // Truncated JSON (max_tokens cut it off): recover the reply text if there is any
  if (clean.startsWith("{")) {
    const partial = clean.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)+)/)?.[1];
    return notWellFormed(partial ? partial.replace(/\\(["\\/])/g, "$1").replace(/\\n/g, " ") : "");
  }

  return notWellFormed(clean);
}
