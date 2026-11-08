import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { writeAudit } from "@/lib/audit";
import { getContactKey, RETENTION_DAYS } from "@/lib/config";
import type { Db } from "@/lib/db";
import {
  callSummaries, calls, callTurns, escalationEvents, escalations, followUpTasks, organizations, safetyEvents, turnCitations,
} from "@/lib/db/schema";
import { Logger } from "@/lib/observability/logger";
import { PROMPT_VERSION, SAFETY_VERSION, TurnFacts } from "./store-types";
import { ESCALATION_PRIORITY } from "@/lib/safety/policy";

const cache = globalThis as unknown as { __orgId?: { db: Db; id: string } };

// Single-organization for now: every call belongs to this one row.
export async function getDefaultOrganizationId(db: Db): Promise<string> {
  if (cache.__orgId?.db === db) return cache.__orgId.id;
  const [existing] = await db.select({ id: organizations.id }).from(organizations).limit(1);
  const id = existing?.id ?? (await db.insert(organizations).values({ name: "Demo Organization" }).returning())[0].id;
  cache.__orgId = { db, id };
  return id;
}

// Persistence never breaks a call: a failure is logged and the caller carries on.
async function safely(log: Logger, event: string, work: () => Promise<void>): Promise<void> {
  try {
    await work();
  } catch (error) {
    log.error(event, { errorName: error instanceof Error ? error.name : "Unknown" });
  }
}

export async function persistCallStart(
  db: Db | null, log: Logger, callId: string, greeting: { turnId: string; text: string },
): Promise<void> {
  if (!db) return;
  await safely(log, "store.call_start_failed", async () => {
    const organizationId = await getDefaultOrganizationId(db);
    await db.insert(calls).values({
      id: callId, organizationId, state: "SPEAKING", activeAgent: "orchestrator",
      retentionExpiresAt: new Date(Date.now() + RETENTION_DAYS * 24 * 60 * 60 * 1000),
    });
    await db.insert(callTurns).values({
      id: greeting.turnId, callId, sequence: 1, speaker: "agent", agent: "orchestrator",
      textContent: greeting.text, pathway: "normal", validationStatus: "scripted",
      promptVersion: PROMPT_VERSION, policyVersion: SAFETY_VERSION,
    });
  });
}

// Returns the row needed to enforce a lock or a finished call, even if an old token is replayed.
export async function loadCallGuard(db: Db | null, callId: string) {
  if (!db) return null;
  const [row] = await db.select({ endedAt: calls.endedAt, emergencyLocked: calls.emergencyLocked })
    .from(calls).where(eq(calls.id, callId)).limit(1);
  return row ?? null;
}

export async function persistTurn(db: Db | null, log: Logger, facts: TurnFacts): Promise<{ escalationId: string | null }> {
  let escalationId: string | null = null;
  if (!db) return { escalationId };

  await safely(log, "store.turn_failed", async () => {
    const organizationId = await getDefaultOrganizationId(db);
    const { result } = facts;
    const { call } = result;
    const agentSequence  = call.sequence;
    const callerSequence = agentSequence - 1;

    await db.update(calls).set({
      state: call.state, activeAgent: call.agent, emergencyLocked: call.emergencyLocked,
      lastActivityAt: new Date(),
      agentsUsed: sql`(SELECT array_agg(DISTINCT a) FROM unnest(array_append(${calls.agentsUsed}, ${result.agent})) AS a)`,
    }).where(eq(calls.id, call.callId));

    if (result.callerTurnId && result.callerText !== null) {
      await db.insert(callTurns).values({
        id: result.callerTurnId, callId: call.callId, sequence: callerSequence, speaker: "caller",
        textContent: result.callerText,
      });
    }
    await db.insert(callTurns).values({
      id: result.turnId, callId: call.callId, sequence: agentSequence, speaker: "agent", agent: result.agent,
      textContent: result.text, pathway: result.pathway,
      validationStatus: result.scriptId ? "scripted" : result.validation?.passed ? "passed" : "blocked",
      promptVersion: PROMPT_VERSION, policyVersion: result.assessment.policyVersion,
      modelId: result.modelId, timings: result.timings,
    });

    if (result.citedChunks.length > 0) {
      await db.insert(turnCitations).values(result.citedChunks.map((c) => ({
        turnId: result.turnId, chunkId: c.id, versionId: c.versionId,
      })));
    }

    const assessed = result.assessment;
    const failed = result.validation && !result.validation.passed ? result.validation.failedRules : [];
    if (assessed.severity !== "LOW" && assessed.ruleIds.length > 0) {
      await db.insert(safetyEvents).values({
        organizationId, callId: call.callId, turnId: result.callerTurnId, stage: "input",
        categories: assessed.categories, severity: assessed.severity, ruleIds: assessed.ruleIds,
        actionTaken: result.pathway, policyVersion: assessed.policyVersion,
      });
    }
    if (failed.length > 0) {
      await db.insert(safetyEvents).values({
        organizationId, callId: call.callId, turnId: result.turnId, stage: "output",
        categories: assessed.categories, severity: "HIGH", ruleIds: failed,
        actionTaken: `blocked:${result.scriptId ?? "fallback"}`, policyVersion: assessed.policyVersion,
      });
    }

    if (result.escalation) {
      escalationId = await createEscalation(db, organizationId, call.callId, result.escalation.reason);
    }
  });
  return { escalationId };
}

// One open escalation per reason per call, so repeating a request doesn't flood the queue.
export async function createEscalation(db: Db, organizationId: string, callId: string, reason: string): Promise<string> {
  const [existing] = await db.select({ id: escalations.id }).from(escalations)
    .where(and(eq(escalations.callId, callId), eq(escalations.reason, reason), eq(escalations.status, "open"))).limit(1);
  if (existing) return existing.id;

  const [row] = await db.insert(escalations).values({
    organizationId, callId, reason, priority: ESCALATION_PRIORITY[reason] ?? "P4",
  }).returning({ id: escalations.id });
  await db.insert(escalationEvents).values({ escalationId: row.id, eventType: "created", detail: reason });
  await writeAudit(db, {
    action: "escalation.created", organizationId, targetType: "escalation", targetId: row.id,
    metadata: { reason, priority: ESCALATION_PRIORITY[reason] ?? "P4" },
  });
  return row.id;
}

export async function persistCallEnd(
  db: Db | null, log: Logger, callId: string,
  outcome: { sentiment: string; intelligence: unknown; method: string; modelId: string | null; followUps: string[] },
): Promise<void> {
  if (!db) return;
  await safely(log, "store.call_end_failed", async () => {
    await db.update(calls).set({ state: "CALL_COMPLETED", endedAt: new Date(), sentiment: outcome.sentiment })
      .where(eq(calls.id, callId));
    await db.insert(callSummaries).values({
      callId, intelligence: outcome.intelligence, method: outcome.method, modelId: outcome.modelId,
    }).onConflictDoNothing();
    if (outcome.followUps.length > 0) {
      await db.insert(followUpTasks).values(outcome.followUps.map((description) => ({ callId, description })));
    }
  });
}

// ── Contact details: encrypted at the application level ───────────────────
export function encryptContact(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getContactKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

export function decryptContact(stored: string): string {
  const [iv, tag, data] = stored.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", getContactKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
