import { NextRequest, NextResponse } from "next/server";
import { AgentName, AgentTurn, AgentApiResponse } from "@/lib/types";
import { AGENT_SYSTEM_PROMPTS } from "@/lib/agent-prompts";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL    = "llama-3.3-70b-versatile";

interface GroqMessage { role: "system" | "user" | "assistant"; content: string; }
interface GroqResponse { choices: { message: { content: string } }[]; }

const VALID_AGENTS = new Set<AgentName>(["orchestrator", "sales", "product", "general", "b2b"]);
function isAgentName(v: unknown): v is AgentName {
  return typeof v === "string" && VALID_AGENTS.has(v as AgentName);
}

function parseResponse(text: string, fallback: AgentName): AgentApiResponse {
  const tryParse = (s: string): AgentApiResponse => {
    const parsed = JSON.parse(s) as Record<string, unknown>;
    return {
      reply:   typeof parsed.reply   === "string" ? parsed.reply   : text,
      agent:   isAgentName(parsed.agent)          ? parsed.agent   : fallback,
      handoff: isAgentName(parsed.handoff)        ? parsed.handoff : null,
    };
  };
  try { return tryParse(text.trim()); } catch { /* */ }
  const obj = text.match(/\{[\s\S]+\}/);
  if (obj) { try { return tryParse(obj[0]); } catch { /* */ } }
  return { reply: text, agent: fallback, handoff: null };
}

export async function POST(req: NextRequest) {
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

    // Add current user input if present (empty = trigger greeting)
    if (userInput) messages.push({ role: "user", content: userInput });

    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model:       MODEL,
        temperature: 0.65,
        max_tokens:  280,  // concise phone-call responses
        messages: [
          { role: "system", content: AGENT_SYSTEM_PROMPTS[currentAgent] },
          ...messages,
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Groq ${res.status}: ${err}` }, { status: 500 });
    }

    const data   = (await res.json()) as GroqResponse;
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
