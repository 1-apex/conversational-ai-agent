export type CallStateName =
  | "IDLE" | "GREETING" | "LISTENING" | "SAFETY_CHECK" | "INTENT_DETECTION" | "ROUTING"
  | "AGENT_PROCESSING" | "RESPONSE_VALIDATION" | "SPEAKING" | "HUMAN_ESCALATION" | "ERROR" | "CALL_COMPLETED";

// The table in docs/09-agent-orchestration.md. Anything not listed is rejected.
export const TRANSITIONS: Record<CallStateName, CallStateName[]> = {
  IDLE:                ["GREETING"],
  GREETING:            ["SPEAKING"],
  LISTENING:           ["SAFETY_CHECK", "CALL_COMPLETED"],
  SAFETY_CHECK:        ["INTENT_DETECTION", "HUMAN_ESCALATION", "SPEAKING"], // SPEAKING: scripted refusal
  INTENT_DETECTION:    ["ROUTING"],
  ROUTING:             ["AGENT_PROCESSING"],
  AGENT_PROCESSING:    ["RESPONSE_VALIDATION", "ERROR"],
  RESPONSE_VALIDATION: ["SPEAKING", "HUMAN_ESCALATION"],
  SPEAKING:            ["LISTENING", "SAFETY_CHECK", "CALL_COMPLETED"],
  HUMAN_ESCALATION:    ["SPEAKING"],
  ERROR:               ["SPEAKING", "CALL_COMPLETED"],
  CALL_COMPLETED:      [],
};

export class InvalidTransitionError extends Error {
  constructor(from: CallStateName, to: CallStateName) {
    super(`Invalid call state transition: ${from} -> ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export function transition(from: CallStateName, to: CallStateName): CallStateName {
  if (!TRANSITIONS[from].includes(to)) throw new InvalidTransitionError(from, to);
  return to;
}

// Walks a path of transitions, recording it, and fails on the first illegal step.
export class CallStateTracker {
  readonly path: CallStateName[];
  constructor(public current: CallStateName) {
    this.path = [current];
  }
  to(next: CallStateName): void {
    this.current = transition(this.current, next);
    this.path.push(next);
  }
}
