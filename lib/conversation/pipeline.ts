import { randomUUID } from "node:crypto";
import { parseAgentResponse } from "@/lib/agent-response";
import { buildSystemPrompt, PROMPT_VERSION } from "@/lib/agent-prompts";
import { redactPii } from "@/lib/safety/detectors";
import { applyClassifier, assessDeterministic, Classifier, lockedAssessment } from "@/lib/safety/engine";
import { pathwayFor, SAFETY_POLICY_VERSION, ScriptId, SCRIPTS } from "@/lib/safety/policy";
import { validateResponse } from "@/lib/safety/response-validator";
import { InputAssessment, Pathway, ValidationResult } from "@/lib/safety/types";
import { AgentName } from "@/lib/types";
import { CallState } from "./call-token";
import { canHandoff, routeDeterministically } from "./router";
import { CallStateName, CallStateTracker } from "./state-machine";

export const TAKEOVER_MESSAGE = "[call transferred — please introduce yourself and take over]";
const MAX_TURNS_TO_MODEL = 40;

// ── Dependencies, injected so tests and evaluations run the same code ─────
export interface RetrievedChunk {
  id: string;
  versionId: string;
  content: string;
  section: string;
}

export interface PipelineDeps {
  generate(request: {
    system: string;
    messages: { role: "user" | "assistant"; content: string }[];
  }): Promise<{ raw: string; modelId: string }>;
  classify?: Classifier;
  // Legacy mode: fixed reference text. Retrieval mode: approved chunks for this query.
  knowledge: {
    mode: "legacy" | "retrieval";
    legacyText: string;
    retrieve(query: string): Promise<RetrievedChunk[]>;
  };
}

export type TurnEvent = "message" | "takeover" | "silence" | "human_request";

export interface EscalationRequest {
  reason: string;
}

export interface TurnResult {
  call: CallState;
  turnId: string;
  callerTurnId: string | null;
  callerText: string | null; // redacted
  text: string;
  agent: AgentName;
  pathway: Pathway;
  scriptId: ScriptId | null;
  handoff: boolean;
  assessment: InputAssessment;
  validation: ValidationResult | null;
  escalation: EscalationRequest | null;
  citedChunks: RetrievedChunk[];
  modelId: string | null;
  statePath: CallStateName[];
  timings: Record<string, number>;
}

const FACTUAL_CATEGORIES = ["general_product", "pricing", "warranty", "insurance", "product_troubleshooting"];

function scriptFor(assessment: InputAssessment): ScriptId {
  if (assessment.pathway === "emergency_script") return "emergency";
  if (assessment.pathway === "injection_script") return "injection";
  if (assessment.pathway === "human_request") return "human_request";
  return assessment.categories.includes("device_malfunction") && !assessment.categories.includes("medical_question")
    ? "device_malfunction" : "medical_boundary";
}

function escalationReason(assessment: InputAssessment): string | null {
  if (assessment.pathway === "emergency_script") return "emergency";
  if (assessment.pathway === "human_request") return "human_request";
  if (assessment.pathway === "boundary_script") {
    return assessment.categories.includes("device_malfunction") ? "device_malfunction" : "medical_question";
  }
  if (assessment.categories.includes("complaint")) return "complaint";
  return null;
}

const SCRIPTED: Pathway[] = ["boundary_script", "emergency_script", "human_request", "injection_script"];

export async function processTurn(
  callIn: CallState,
  input: { event: TurnEvent; text?: string },
  deps: PipelineDeps,
): Promise<TurnResult> {
  const startedAt = Date.now();
  const timings: Record<string, number> = {};
  const tracker = new CallStateTracker(callIn.state);
  const call: CallState = { ...callIn, turns: [...callIn.turns], pendingTakeover: false };

  const raw = input.text ?? "";
  const { text: safeText } = redactPii(raw);
  const isMessage = input.event === "message";

  // ── 1. Input safety, before any agent ─────────────────────────────────
  const safetyStart = Date.now();
  tracker.to("SAFETY_CHECK");
  let assessment: InputAssessment;
  if (call.emergencyLocked) {
    assessment = lockedAssessment();
  } else if (input.event === "human_request") {
    assessment = {
      categories: ["human_request"], severity: "MODERATE", pathway: "human_request",
      ruleIds: ["event.human_request"], policyVersion: SAFETY_POLICY_VERSION, classifierUsed: false,
    };
  } else if (isMessage) {
    assessment = assessDeterministic(raw);
  } else {
    assessment = {
      categories: ["general_product"], severity: "LOW", pathway: "normal",
      ruleIds: [`event.${input.event}`], policyVersion: SAFETY_POLICY_VERSION, classifierUsed: false,
    };
  }
  timings.safetyMs = Date.now() - safetyStart;

  let callerTurnId: string | null = null;
  if (isMessage) {
    callerTurnId = randomUUID();
    call.turns.push({ role: "user", content: safeText });
    call.sequence += 1;
    call.checkins = 0;
  }

  const finish = (
    text: string,
    extra: { pathway: Pathway; scriptId?: ScriptId; validation?: ValidationResult; citedChunks?: RetrievedChunk[];
             modelId?: string | null; handoff?: boolean; escalationOverride?: string | null },
  ): TurnResult => {
    tracker.to("SPEAKING");
    if (assessment.pathway === "emergency_script") call.emergencyLocked = true;
    call.state = "SPEAKING";
    call.sequence += 1;
    call.turns.push({ role: "agent", content: text, agent: call.agent });
    timings.totalMs = Date.now() - startedAt;
    const reason = extra.escalationOverride !== undefined ? extra.escalationOverride : escalationReason(assessment);
    return {
      call, callerTurnId, callerText: isMessage ? safeText : null, text, agent: call.agent,
      turnId: randomUUID(), pathway: extra.pathway, scriptId: extra.scriptId ?? null,
      handoff: extra.handoff ?? false, assessment, validation: extra.validation ?? null,
      escalation: reason ? { reason } : null, citedChunks: extra.citedChunks ?? [],
      modelId: extra.modelId ?? null, statePath: tracker.path, timings,
    };
  };

  // ── 2. Scripted pathways: no LLM reply ────────────────────────────────
  if (SCRIPTED.includes(assessment.pathway)) {
    const scriptId = scriptFor(assessment);
    if (assessment.pathway !== "injection_script") tracker.to("HUMAN_ESCALATION");
    return finish(SCRIPTS[scriptId].text, { pathway: assessment.pathway, scriptId });
  }

  if (input.event === "silence") {
    call.checkins += 1;
    return finish(SCRIPTS.checkin.text, { pathway: "normal", scriptId: "checkin", escalationOverride: null });
  }

  // ── 3. Routing ────────────────────────────────────────────────────────
  tracker.to("INTENT_DETECTION");
  tracker.to("ROUTING");
  if (isMessage) {
    const routed = routeDeterministically(assessment.categories, call.agent);
    if (routed && canHandoff(call.agent, routed, call.handoffs)) {
      call.agent = routed;
      call.handoffs += 1;
    }
  }
  tracker.to("AGENT_PROCESSING");

  // ── 4. Evidence ───────────────────────────────────────────────────────
  const retrievalStart = Date.now();
  let chunks: RetrievedChunk[] = [];
  let evidence = deps.knowledge.legacyText;
  const retrievalMode = deps.knowledge.mode === "retrieval";
  if (retrievalMode) {
    chunks = isMessage ? await deps.knowledge.retrieve(safeText).catch(() => []) : [];
    evidence = chunks.map((c) => `[id:${c.id}] (${c.section})\n${c.content}`).join("\n\n");
  }
  timings.retrievalMs = Date.now() - retrievalStart;

  const needsFacts = assessment.categories.some((c) => FACTUAL_CATEGORIES.includes(c));
  if (retrievalMode && isMessage && needsFacts && chunks.length === 0) {
    tracker.to("RESPONSE_VALIDATION");
    return finish(SCRIPTS.unsupported_claim.text, { pathway: "restricted", scriptId: "unsupported_claim" });
  }

  // ── 5. Generation, with the classifier alongside. Nothing is spoken until both finish ──
  const messages = call.turns.slice(-MAX_TURNS_TO_MODEL).map((t) => ({
    role: t.role === "agent" ? "assistant" as const : "user" as const,
    content: t.content,
  }));
  if (input.event === "takeover") messages.push({ role: "user", content: TAKEOVER_MESSAGE });

  const generationStart = Date.now();
  const [generated, classified] = await Promise.all([
    deps.generate({
      system: buildSystemPrompt(call.agent, { evidence, restricted: assessment.pathway === "restricted" }),
      messages,
    }).catch(() => null),
    isMessage && deps.classify
      ? deps.classify(raw).catch(() => "failed" as const)
      : Promise.resolve(null),
  ]);
  timings.generationMs = Date.now() - generationStart;

  if (classified) {
    assessment = applyClassifier(assessment, classified);
    assessment = { ...assessment, pathway: pathwayFor(assessment.categories, assessment.severity) };
  }

  if (!generated) {
    tracker.to("ERROR");
    return finish(SCRIPTS.provider_failure.text, { pathway: "restricted", scriptId: "provider_failure" });
  }

  // ── 6. Output validation, before any speech ───────────────────────────
  tracker.to("RESPONSE_VALIDATION");

  if (SCRIPTED.includes(assessment.pathway)) {
    const scriptId = scriptFor(assessment);
    if (assessment.pathway !== "injection_script") tracker.to("HUMAN_ESCALATION");
    return finish(SCRIPTS[scriptId].text, { pathway: assessment.pathway, scriptId, modelId: generated.modelId });
  }

  const parsed = parseAgentResponse(generated.raw);
  const validation = validateResponse({
    reply: parsed.reply,
    agent: call.agent,
    evidence,
    retrievedChunkIds: chunks.map((c) => c.id),
    citedChunkIds: parsed.citedChunkIds,
    requireCitations: retrievalMode,
  });

  if (!validation.passed) {
    const scriptId: ScriptId =
      validation.fallback === "medical_boundary" ? "medical_boundary"
      : validation.fallback === "unsupported_claim" ? "unsupported_claim"
      : "generic_fallback";
    if (validation.escalate) {
      tracker.to("HUMAN_ESCALATION");
      return finish(SCRIPTS[scriptId].text, {
        pathway: "boundary_script", scriptId, validation, modelId: generated.modelId, escalationOverride: "medical_question",
      });
    }
    return finish(SCRIPTS[scriptId].text, { pathway: assessment.pathway, scriptId, validation, modelId: generated.modelId });
  }

  // ── 7. Handoff: the model may propose, policy decides ─────────────────
  let handoff = false;
  const speakingAgent = call.agent;
  if (parsed.proposedAgent && canHandoff(call.agent, parsed.proposedAgent, call.handoffs)) {
    handoff = true;
    call.pendingTakeover = true;
    call.handoffs += 1;
  }

  const cited = chunks.filter((c) => parsed.citedChunkIds.includes(c.id));
  const result = finish(parsed.reply, {
    pathway: assessment.pathway, validation, citedChunks: cited, modelId: generated.modelId, handoff,
    escalationOverride: parsed.requestsEscalation ? "unresolved" : undefined,
  });
  result.agent = speakingAgent;
  if (handoff) result.call.agent = parsed.proposedAgent!;
  return result;
}

export function startCall(call: CallState): { call: CallState; text: string; statePath: CallStateName[]; turnId: string } {
  const tracker = new CallStateTracker(call.state);
  tracker.to("GREETING");
  tracker.to("SPEAKING");
  const text = `${SCRIPTS.disclosure.text} What brought you in today?`;
  return {
    call: {
      ...call, state: "SPEAKING", sequence: 1,
      turns: [{ role: "agent", content: text, agent: "orchestrator" }],
    },
    text, statePath: tracker.path, turnId: randomUUID(),
  };
}

export { PROMPT_VERSION };
