import { CATEGORY_SEVERITY, pathwayFor, SAFETY_POLICY_VERSION } from "./policy";
import { runDetectors } from "./detectors";
import { InputAssessment, SafetyCategory, SEVERITY_ORDER, Severity } from "./types";

export interface ClassifierResult {
  categories: SafetyCategory[];
}
export type Classifier = (text: string) => Promise<ClassifierResult>;

const maxSeverity = (a: Severity, b: Severity): Severity =>
  SEVERITY_ORDER.indexOf(a) >= SEVERITY_ORDER.indexOf(b) ? a : b;

// Deterministic assessment. Severity combines by maximum, so adding a signal can't lower it.
export function assessDeterministic(text: string): InputAssessment {
  const hits       = runDetectors(text);
  const categories = [...new Set(hits.map((h) => h.category))];
  let severity: Severity = "LOW";
  for (const h of hits) severity = maxSeverity(severity, h.severity);

  if (categories.length === 0) {
    categories.push("unknown");
    severity = CATEGORY_SEVERITY.unknown;
  }
  return {
    categories, severity,
    pathway: pathwayFor(categories, severity),
    ruleIds: hits.map((h) => h.ruleId),
    policyVersion: SAFETY_POLICY_VERSION,
    classifierUsed: false,
  };
}

// Applies an LLM classifier result. It can only raise severity. If the classifier failed,
// the floor is MODERATE, so a provider outage makes the system more cautious, not less.
export function applyClassifier(base: InputAssessment, result: ClassifierResult | "failed"): InputAssessment {
  if (result === "failed") {
    const severity = maxSeverity(base.severity, "MODERATE");
    return {
      ...base, severity,
      pathway: pathwayFor(base.categories, severity),
      ruleIds: [...base.ruleIds, "classifier.failed"],
    };
  }
  const raised = result.categories.filter((c) => c === "emergency" || c === "medical_question" || c === "prompt_injection");
  if (raised.length === 0) return { ...base, classifierUsed: true };

  const categories = [...new Set([...base.categories, ...raised])];
  let severity = base.severity;
  for (const c of raised) severity = maxSeverity(severity, CATEGORY_SEVERITY[c]);
  return {
    ...base, categories, severity,
    pathway: pathwayFor(categories, severity),
    ruleIds: [...base.ruleIds, ...raised.map((c) => `classifier.${c}`)],
    classifierUsed: true,
  };
}

// Once a call has triggered the emergency pathway, every later turn stays on it.
export function lockedAssessment(): InputAssessment {
  return {
    categories: ["emergency"], severity: "CRITICAL", pathway: "emergency_script",
    ruleIds: ["emg.locked"], policyVersion: SAFETY_POLICY_VERSION, classifierUsed: false,
  };
}
