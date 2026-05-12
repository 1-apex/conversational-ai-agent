import Anthropic from "@anthropic-ai/sdk";
import { TranscriptTurn, CallBriefData } from "./types";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

const SYSTEM_PROMPT = `You are a call intelligence assistant. Analyze business call transcripts and extract structured information.

Given a transcript with [Agent] and [Prospect] labels, return ONLY a valid JSON object — no markdown, no explanation — with this exact shape:

{
  "summary": "2-3 sentence summary of what was discussed and the outcome",
  "entities": {
    "names": ["person names mentioned"],
    "companies": ["company or organization names"],
    "products": ["products, services, tools, or platforms mentioned"],
    "contacts": ["email addresses or phone numbers"]
  },
  "actionItems": ["each next step or follow-up as a single clear sentence"]
}

If a field has no data, return an empty array. Never add extra keys.`;

function parseClaudeJSON(text: string): Omit<CallBriefData, "duration"> {
  const attempt = (s: string) => JSON.parse(s) as Omit<CallBriefData, "duration">;
  try { return attempt(text.trim()); } catch { /* */ }
  const block = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (block) { try { return attempt(block[1]); } catch { /* */ } }
  const obj = text.match(/\{[\s\S]+\}/);
  if (obj) { try { return attempt(obj[0]); } catch { /* */ } }
  throw new Error("Could not parse JSON from Claude response");
}

export async function extractCallBrief(
  turns: TranscriptTurn[],
  durationSeconds: number
): Promise<CallBriefData> {
  const transcript = turns
    .map((t) => `[${t.speaker === "agent" ? "Agent" : "Prospect"}]: ${t.text}`)
    .join("\n");

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    temperature: 0,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: `Transcript:\n\n${transcript}` }],
  });

  const block = message.content[0];
  if (block.type !== "text") throw new Error("Unexpected response type from Claude");

  const parsed = parseClaudeJSON(block.text);
  return { ...parsed, duration: durationSeconds };
}
