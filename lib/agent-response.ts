import { AgentApiResponse, AgentName } from "./types";
import { AgentNameSchema } from "@/lib/http/schemas";

// Spoken when the model's output can't be understood, so raw JSON is never read aloud
export const UNPARSEABLE_REPLY = "Sorry, I didn't catch that. Could you say that again?";

function isAgentName(v: unknown): v is AgentName {
  return AgentNameSchema.safeParse(v).success;
}

export function parseAgentResponse(text: string, fallback: AgentName): AgentApiResponse {
  const clean = text.trim();

  // Best case: entire response is valid JSON
  try {
    const parsed = JSON.parse(clean) as Record<string, unknown>;
    return {
      reply:   typeof parsed.reply === "string" && parsed.reply ? parsed.reply : UNPARSEABLE_REPLY,
      agent:   isAgentName(parsed.agent)   ? parsed.agent   : fallback,
      handoff: isAgentName(parsed.handoff) ? parsed.handoff : null,
    };
  } catch { /* */ }

  // Fallback: model leaked JSON at the end of a plain-text reply
  const jsonMatch = clean.match(/\{[\s\S]+\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      const handoff = isAgentName(parsed.handoff) ? parsed.handoff : null;
      const agent   = isAgentName(parsed.agent)   ? parsed.agent   : fallback;
      // If the JSON had a proper reply field, use it; otherwise strip the
      // leaked JSON fragment from the raw text so it never reaches the caller
      const reply = typeof parsed.reply === "string" && parsed.reply
        ? parsed.reply
        : clean.replace(jsonMatch[0], "").trim().replace(/[.?\s]+$/, "") || UNPARSEABLE_REPLY;
      return { reply, agent, handoff };
    } catch { /* */ }
  }

  // Truncated JSON (max_tokens cut it off): recover the reply text if there is any
  if (clean.startsWith("{")) {
    const partial = clean.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)+)/)?.[1];
    return {
      reply: partial ? partial.replace(/\\(["\\/])/g, "$1").replace(/\\n/g, " ") : UNPARSEABLE_REPLY,
      agent: fallback,
      handoff: null,
    };
  }

  return { reply: clean, agent: fallback, handoff: null };
}
