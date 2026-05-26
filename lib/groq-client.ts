import { TranscriptTurn, CallBriefData } from "./types";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL    = "llama-3.3-70b-versatile";

const SYSTEM_PROMPT =
  `You are analyzing a customer service call for Inogen (portable oxygen concentrators). A=Agent, P=Prospect/Customer.\n` +
  `Return ONLY valid JSON, no markdown:\n` +
  `{"summary":"3-4 sentences covering what the caller needed, what was discussed, and the outcome","sentiment":"positive|neutral|negative|frustrated","callOutcome":"resolved|follow_up_needed|interested|not_interested|transferred","entities":{"names":[],"companies":[],"products":[],"contacts":[]},"actionItems":[]}\n` +
  `summary: be specific — mention products discussed, decisions made, next steps agreed.\n` +
  `actionItems: concrete next steps with owner where known (e.g. "Agent: send prescription template", "Caller: check with doctor about flow setting").\n` +
  `Empty arrays when nothing found.`;

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
  // "A:" / "P:" instead of "[Agent]:" / "[Prospect]:" — saves ~10 chars per turn
  const transcript = turns
    .map((t) => `${t.speaker === "agent" ? "A" : "P"}: ${t.text}`)
    .join("\n");

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      max_tokens: 700,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: transcript },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq ${res.status}: ${err}`);
  }

  const data = (await res.json()) as GroqResponse;
  const parsed = parseJSON(data.choices[0].message.content);
  return { ...parsed, duration: durationSeconds };
}
