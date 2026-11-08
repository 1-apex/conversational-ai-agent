import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getTokenSecret } from "@/lib/config";
import { AgentNameSchema } from "@/lib/http/schemas";
import { CallStateName } from "./state-machine";

// Call state lives in a signed token, so the browser carries it but can't change it. This
// also works with no database. With a database, the turns route checks the stored row too,
// which stops an old token being replayed to get back behind an emergency lock.
const CALL_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;
export const MAX_TURNS_IN_TOKEN = 40;

const CallStateSchema = z.object({
  kind:            z.literal("call"),
  callId:          z.string(),
  state:           z.string() as unknown as z.ZodType<CallStateName>,
  agent:           AgentNameSchema,
  sequence:        z.number(),
  handoffs:        z.number(),
  checkins:        z.number(),
  emergencyLocked: z.boolean(),
  pendingTakeover: z.boolean(),
  turns: z.array(z.object({
    role:    z.enum(["agent", "user"]),
    content: z.string(),
    agent:   AgentNameSchema.optional(),
  })),
  exp: z.number(),
});

export type CallState = z.output<typeof CallStateSchema>;

const SpeechClaimSchema = z.object({
  kind:   z.literal("speech"),
  callId: z.string(),
  text:   z.string(),
  exp:    z.number(),
});

const sign = (payload: string) => createHmac("sha256", getTokenSecret()).update(payload).digest();

function encode(claims: object): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${sign(payload).toString("base64url")}`;
}

function decode(token: string): unknown {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const given    = Buffer.from(signature, "base64url");
  const expected = sign(payload);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export function newCallState(callId: string, now = Date.now()): CallState {
  return {
    kind: "call", callId, state: "IDLE", agent: "orchestrator", sequence: 0, handoffs: 0, checkins: 0,
    emergencyLocked: false, pendingTakeover: false, turns: [], exp: now + CALL_TOKEN_TTL_MS,
  };
}

export function signCallState(state: CallState): string {
  return encode({ ...state, turns: state.turns.slice(-MAX_TURNS_IN_TOKEN) });
}

export function verifyCallState(token: string, now = Date.now()): CallState | null {
  const parsed = CallStateSchema.safeParse(decode(token));
  return parsed.success && parsed.data.exp > now ? parsed.data : null;
}

// Speech is only produced for text the server signed after validating it.
export function signSpeech(callId: string, text: string, now = Date.now()): string {
  return encode({ kind: "speech", callId, text, exp: now + 10 * 60 * 1000 });
}

export function verifySpeech(token: string, now = Date.now()): { callId: string; text: string } | null {
  const parsed = SpeechClaimSchema.safeParse(decode(token));
  return parsed.success && parsed.data.exp > now ? { callId: parsed.data.callId, text: parsed.data.text } : null;
}
