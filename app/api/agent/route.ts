import { NextRequest, NextResponse } from "next/server";
import { AgentName, AgentTurn, AgentApiResponse } from "@/lib/types";
import { AGENT_SYSTEM_PROMPTS } from "@/lib/agent-prompts";
import { agentLimiter, getIp } from "@/lib/rate-limit";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL    = "llama-3.3-70b-versatile";

interface GroqMessage { role: "system" | "user" | "assistant"; content: string; }
interface GroqResponse { choices: { message: { content: string } }[]; }

const VALID_AGENTS = new Set<AgentName>(["orchestrator", "sales", "product", "general", "b2b"]);
function isAgentName(v: unknown): v is AgentName {
  return typeof v === "string" && VALID_AGENTS.has(v as AgentName);
}

function parseResponse(text: string, fallback: AgentName): AgentApiResponse {
  const clean = text.trim();

  // Best case: entire response is valid JSON
  try {
    const parsed = JSON.parse(clean) as Record<string, unknown>;
    return {
      reply:   typeof parsed.reply   === "string" ? parsed.reply   : clean,
      agent:   isAgentName(parsed.agent)          ? parsed.agent   : fallback,
      handoff: isAgentName(parsed.handoff)        ? parsed.handoff : null,
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
        : clean.replace(jsonMatch[0], "").trim().replace(/[.?\s]+$/, "") || clean;
      return { reply, agent, handoff };
    } catch { /* */ }
  }

  return { reply: clean, agent: fallback, handoff: null };
}

export async function POST(req: NextRequest) {
  const { success } = await agentLimiter.limit(getIp(req));
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const body = (await req.json()) as {
      history?:       AgentTurn[];
      userInput?:     string;
      currentAgent?:  AgentName;
    };

    const history:      AgentTurn[] = Array.isArray(body.history) ? body.history : [];
    const userInput:    string      = typeof body.userInput === "string" ? body.userInput : "";
    const currentAgent: AgentName   = isAgentName(body.currentAgent) ? body.currentAgent : "orchestrator";

    // Build Groq message array from conversation history
    const messages: GroqMessage[] = history.map((t) => ({
      role:    t.role === "agent" ? "assistant" : "user",
      content: t.content,
    }));

    if (userInput) {
      messages.push({ role: "user", content: userInput });
    } else if (history.length > 0) {
      // Empty input with history = handoff takeover. Inject a nudge so the
      // model doesn't continue the transfer context from the previous agent.
      messages.push({ role: "user", content: "[call transferred — please introduce yourself and take over]" });
    }

    const payload = JSON.stringify({
      model:       MODEL,
      temperature: 0.65,
      max_tokens:  120,
      messages: [
        { role: "system", content: AGENT_SYSTEM_PROMPTS[currentAgent] },
        ...messages,
      ],
    });

    let res: Response | undefined;
    const RETRYABLE = new Set([429, 500, 502, 503, 504]);
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, attempt * 500));
      res = await fetch(GROQ_URL, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
        body:    payload,
      });
      if (res.ok || !RETRYABLE.has(res.status)) break;
    }

    if (!res!.ok) {
      const err = await res!.text();
      return NextResponse.json({ error: `Groq ${res!.status}: ${err}` }, { status: 500 });
    }

    const data   = (await res!.json()) as GroqResponse;
    const raw    = data.choices[0].message.content;
    const parsed = parseResponse(raw, currentAgent);

    // If handoff is same as current agent, clear it
    if (parsed.handoff === currentAgent) parsed.handoff = null;

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Agent route error:", error instanceof Error ? error.message : "Unknown");
    return NextResponse.json({ error: "Agent failed" }, { status: 500 });
  }
}
