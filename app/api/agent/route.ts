import { NextResponse } from "next/server";
import { AgentApiResponse } from "@/lib/types";
import { AGENT_SYSTEM_PROMPTS } from "@/lib/agent-prompts";
import { parseAgentResponse } from "@/lib/agent-response";
import { DEMO_DISCLOSURE } from "@/lib/demo-notice";
import { EMERGENCY_MESSAGE, isEmergencyStatement } from "@/lib/emergency-offramp";
import { route } from "@/lib/http/route";
import { AgentRequestSchema } from "@/lib/http/schemas";
import { agentLimiter } from "@/lib/rate-limit";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL    = "llama-3.3-70b-versatile";

// The model sees recent turns only. The emergency check below still sees all of them.
const MAX_TURNS_TO_MODEL = 40;
const GROQ_TIMEOUT_MS    = 15_000;

interface GroqMessage { role: "system" | "user" | "assistant"; content: string; }
interface GroqResponse { choices: { message: { content: string } }[]; }

export const POST = route({
  name: "agent",
  access: "public",
  limiter: agentLimiter,
  body: AgentRequestSchema,
  maxBytes: 1024 * 1024,
  handler: async ({ body, fail, log }) => {
    const { history, userInput, currentAgent } = body;

    // Interim emergency off-ramp: no LLM reply, and it stays on for the rest of the
    // call, so a later question can't drop back into a normal sales conversation.
    const callerTexts = [userInput, ...history.filter((t) => t.role === "user").map((t) => t.content)];
    if (callerTexts.some(isEmergencyStatement)) {
      const reply: AgentApiResponse = { reply: EMERGENCY_MESSAGE, agent: currentAgent, handoff: null };
      return NextResponse.json(reply);
    }

    // Build Groq message array from conversation history
    const messages: GroqMessage[] = history.slice(-MAX_TURNS_TO_MODEL).map((t) => ({
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
        signal:  AbortSignal.timeout(GROQ_TIMEOUT_MS),
      });
      if (res.ok || !RETRYABLE.has(res.status)) break;
      log.warn("provider.retryable_error", { provider: "groq", status: res.status, attempt });
    }

    if (!res!.ok) {
      log.error("provider.failed", { provider: "groq", status: res!.status });
      return fail("upstream_error", 502);
    }

    const data   = (await res!.json()) as GroqResponse;
    const raw    = data.choices[0].message.content;
    const parsed = parseAgentResponse(raw, currentAgent);

    // If handoff is same as current agent, clear it
    if (parsed.handoff === currentAgent) parsed.handoff = null;

    // Added here rather than in the prompt, so the opening disclosure can't be skipped by the model
    if (!userInput && history.length === 0) parsed.reply = `${DEMO_DISCLOSURE} ${parsed.reply}`;

    return NextResponse.json(parsed);
  },
});
