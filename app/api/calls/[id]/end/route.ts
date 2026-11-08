import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { verifyCallState } from "@/lib/conversation/call-token";
import { persistCallEnd } from "@/lib/conversation/store";
import { callTurns, escalations, safetyEvents, turnCitations, knowledgeVersions } from "@/lib/db/schema";
import { route } from "@/lib/http/route";
import { EndCallRequestSchema } from "@/lib/http/schemas";
import { summarizeCall } from "@/lib/post-call/intelligence";
import { extractLimiter } from "@/lib/rate-limit";
import { assessDeterministic } from "@/lib/safety/engine";
import { EMPTY_ENTITY_MAP } from "@/lib/entity-extractor";

export const POST = route({
  name: "calls.end",
  access: "call-token",
  limiter: extractLimiter,
  body: EndCallRequestSchema,
  maxBytes: 512 * 1024,
  handler: async ({ body, params, db, fail, log }) => {
    const call = verifyCallState(body.callToken);
    if (!call || call.callId !== params.id) return fail("invalid_call_token", 401);

    const turns = call.turns.map((t, i) => ({
      id: String(i), speaker: t.role === "agent" ? "agent" as const : "prospect" as const,
      text: t.content, timestamp: 0, entities: EMPTY_ENTITY_MAP,
    }));
    const callerAssessments = call.turns.filter((t) => t.role === "user").map((t) => assessDeterministic(t.content));

    // Safety flags and escalations come from what the app recorded, never from the model
    let safetyRuleIds = callerAssessments.filter((a) => a.severity !== "LOW").flatMap((a) => a.ruleIds);
    let escalationReasons: string[] = [];
    let knowledgeVersionIds: string[] = [];
    let duration = 0;
    if (db) {
      const events = await db.select({ ruleIds: safetyEvents.ruleIds }).from(safetyEvents).where(eq(safetyEvents.callId, call.callId));
      safetyRuleIds = [...safetyRuleIds, ...events.flatMap((e) => e.ruleIds)];
      const raised = await db.select({ reason: escalations.reason }).from(escalations).where(eq(escalations.callId, call.callId));
      escalationReasons = raised.map((e) => e.reason);
      const versions = await db.selectDistinct({ id: knowledgeVersions.id }).from(turnCitations)
        .innerJoin(knowledgeVersions, eq(knowledgeVersions.id, turnCitations.versionId))
        .innerJoin(callTurns, eq(callTurns.id, turnCitations.turnId))
        .where(eq(callTurns.callId, call.callId));
      knowledgeVersionIds = versions.map((v) => v.id);
      const [first] = await db.select({ at: callTurns.createdAt }).from(callTurns)
        .where(eq(callTurns.callId, call.callId)).orderBy(callTurns.sequence).limit(1);
      if (first) duration = Math.round((Date.now() - first.at.getTime()) / 1000);
    }

    const outcome = await summarizeCall({
      turns, duration,
      categories: callerAssessments.flatMap((a) => a.categories),
      safetyRuleIds, escalationReasons, knowledgeVersions: knowledgeVersionIds,
      emergencyLocked: call.emergencyLocked,
    }, log);

    await persistCallEnd(db, log, call.callId, {
      sentiment: outcome.sentiment, intelligence: outcome.intelligence, method: outcome.method, modelId: outcome.modelId,
      followUps: outcome.brief.actionItems,
    });

    return NextResponse.json({ brief: outcome.brief, intelligence: outcome.intelligence });
  },
});
