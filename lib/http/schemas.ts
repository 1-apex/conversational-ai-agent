import { z } from "zod";
import { MAX_CALLER_TEXT } from "@/lib/limits";

// Limits bound spend and memory. Unknown fields are stripped, not trusted.

export const AgentNameSchema = z.enum(["orchestrator", "sales", "product", "general", "b2b"]);

const callToken = z.string().min(1).max(256 * 1024);

export const TurnRequestSchema = z.object({
  callToken,
  event: z.enum(["message", "takeover", "silence", "human_request"]).default("message"),
  text:  z.string().max(MAX_CALLER_TEXT).optional(),
});

export const EndCallRequestSchema = z.object({ callToken });

export const CallbackRequestSchema = z.object({
  callToken,
  // A demo: the form says to use a made-up number
  phone:  z.string().regex(/^[0-9+() -]{7,20}$/),
  window: z.string().max(60).optional(),
});

export const SpeechRequestSchema = z.object({
  speechToken: z.string().min(1).max(8 * 1024),
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
