import { TranscriptTurn, CallBriefData } from "./types";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL    = "llama-3.3-70b-versatile";

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

interface GroqResponse {
  choices: { message: { content: string } }[];
}

function parseJSON(text: string): Omit<CallBriefData, "duration"> {
  const attempt = (s: string) => JSON.parse(s) as Omit<CallBriefData, "duration">;
  try { return attempt(text.trim()); } catch { /* */ }
  const block = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (block) { try { return attempt(block[1]); } catch { /* */ } }
  const obj = text.match(/\{[\s\S]+\}/);
  if (obj)   { try { return attempt(obj[0]);   } catch { /* */ } }
  throw new Error("Could not parse JSON from Groq response");
}

export async function extractWithGroq(
  turns: TranscriptTurn[],
  durationSeconds: number
): Promise<CallBriefData> {
  const transcript = turns
    .map((t) => `[${t.speaker === "agent" ? "Agent" : "Prospect"}]: ${t.text}`)
    .join("\n");

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Accept both spellings — .env has GROK_API, standard is GROQ_API_KEY
      Authorization: `Bearer ${process.env.GROQ_API_KEY ?? process.env.GROK_API}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: `Transcript:\n\n${transcript}` },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq ${res.status}: ${err}`);
  }

  const data = (await res.json()) as GroqResponse;
  const text = data.choices[0].message.content;
  const parsed = parseJSON(text);
  return { ...parsed, duration: durationSeconds };
}
