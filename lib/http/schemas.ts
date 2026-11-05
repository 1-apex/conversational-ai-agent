import { z } from "zod";
import { MAX_CALLER_TEXT, MAX_HISTORY, MAX_SPEECH_TEXT, MAX_TURN_TEXT } from "@/lib/limits";

// Limits bound spend and memory. Unknown fields are stripped, not trusted.
const MAX_LOGGED_TURNS = 500;
const MAX_CALL_SECONDS = 24 * 60 * 60;

export const AgentNameSchema = z.enum(["orchestrator", "sales", "product", "general", "b2b"]);

const AgentTurnSchema = z.object({
  id:        z.string().max(64).optional(),
  role:      z.enum(["agent", "user"]),
  content:   z.string().max(MAX_TURN_TEXT),
  agent:     AgentNameSchema.optional(),
  timestamp: z.number().optional(),
});

export const AgentRequestSchema = z.object({
  history:      z.array(AgentTurnSchema).max(MAX_HISTORY).default([]),
  userInput:    z.string().max(MAX_CALLER_TEXT).default(""),
  currentAgent: AgentNameSchema.default("orchestrator"),
});

export const SpeechRequestSchema = z.object({
  text: z.string().min(1).max(MAX_SPEECH_TEXT),
});

export const ExtractRequestSchema = z.object({
  turns: z.array(z.object({
    id:        z.string().max(64),
    speaker:   z.enum(["agent", "prospect"]),
    text:      z.string().max(MAX_TURN_TEXT),
    timestamp: z.number(),
  })).min(1).max(MAX_LOGGED_TURNS),
  duration: z.number().int().min(0).max(MAX_CALL_SECONDS).default(0),
});

const stringList = z.array(z.string()).default([]);

// Also applied to LLM output, because a model can return any shape at all.
export const CallBriefSchema = z.object({
  summary: z.string(),
  entities: z.object({
    names:     stringList,
    companies: stringList,
    products:  stringList,
    contacts:  stringList,
  }).default({ names: [], companies: [], products: [], contacts: [] }),
  actionItems: stringList,
  duration:    z.number(),
});

export const CallLogRequestSchema = z.object({
  id:         z.string().min(1).max(64),
  startedAt:  z.iso.datetime(),
  duration:   z.number().int().min(0).max(MAX_CALL_SECONDS).nullable().default(null),
  agentsUsed: z.array(AgentNameSchema).max(5).default([]),
  turns:      z.array(AgentTurnSchema).max(MAX_LOGGED_TURNS).default([]),
  brief:      CallBriefSchema.nullable().default(null),
  sentiment:  z.enum(["positive", "neutral", "negative"]).default("neutral"),
});
