import { createHash, randomBytes } from "node:crypto";

// ── Data mode ─────────────────────────────────────────────────────────────
// This is an independent demo, so real health data is out of scope and there's no way
// to turn it on. See docs/17-implementation-roadmap.md.
export function assertSyntheticMode(): void {
  const mode = process.env.DATA_MODE ?? "synthetic";
  if (mode !== "synthetic") throw new Error(`DATA_MODE=${mode} is not supported by this demo`);
}

// ── Providers ─────────────────────────────────────────────────────────────
export type ProviderPurpose = "generation" | "classification" | "tts" | "extraction" | "embedding" | "judge";

// The only gate to outside AI services, so an outage can't pull in an unreviewed vendor.
const APPROVED: Record<ProviderPurpose, string[]> = {
  generation:     ["groq"],
  classification: ["groq"],
  tts:            ["elevenlabs"],
  extraction:     ["anthropic", "groq"],
  embedding:      ["configured-endpoint"],
  judge:          ["groq"],
};

export function assertProviderAllowed(purpose: ProviderPurpose, provider: string): void {
  assertSyntheticMode();
  if (!APPROVED[purpose].includes(provider)) throw new Error(`${provider} is not approved for ${purpose}`);
}

// ── Secrets ───────────────────────────────────────────────────────────────
const devSecret = randomBytes(32).toString("hex");

// Prefers its own secret. Deriving from the Groq key keeps deployments that don't set it working.
export function getTokenSecret(): string {
  if (process.env.CALL_TOKEN_SECRET) return process.env.CALL_TOKEN_SECRET;
  if (process.env.GROQ_API_KEY) {
    return createHash("sha256").update(`call-token:${process.env.GROQ_API_KEY}`).digest("hex");
  }
  return devSecret; // per process: fine locally, and with no key there's no model to call
}

export function getContactKey(): Buffer {
  return createHash("sha256").update(`contact:${getTokenSecret()}`).digest();
}

// ── Knowledge ─────────────────────────────────────────────────────────────
// "retrieval" answers only from approved documents. "legacy" uses lib/inogen-knowledge.ts.
export function getKnowledgeMode(): "legacy" | "retrieval" {
  return process.env.KNOWLEDGE_MODE === "retrieval" && process.env.DATABASE_URL ? "retrieval" : "legacy";
}

export const RETENTION_DAYS = Number(process.env.RETENTION_DAYS ?? 30);
