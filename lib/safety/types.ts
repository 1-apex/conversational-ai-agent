export type Severity = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

export const SEVERITY_ORDER: Severity[] = ["LOW", "MODERATE", "HIGH", "CRITICAL"];

export type SafetyCategory =
  | "general_product" | "pricing" | "warranty" | "insurance" | "product_troubleshooting"
  | "device_malfunction" | "complaint" | "personal_health_information" | "unknown"
  | "prompt_injection" | "human_request" | "medical_question" | "emergency" | "business";

export type Pathway =
  | "normal"            // agent replies with its usual capabilities
  | "restricted"        // agent replies, with tighter instructions
  | "boundary_script"   // approved script, no LLM reply, escalation created
  | "emergency_script"  // approved script, no LLM reply, locked for the rest of the call
  | "human_request"     // honest message that no person is available, escalation created
  | "injection_script"; // approved refusal, no LLM reply

export interface DetectorHit {
  ruleId: string;
  category: SafetyCategory;
  severity: Severity;
}

export interface InputAssessment {
  categories: SafetyCategory[];
  severity: Severity;
  pathway: Pathway;
  ruleIds: string[]; // never the matched caller words
  policyVersion: string;
  classifierUsed: boolean;
}

export interface ValidationResult {
  passed: boolean;
  failedRules: string[];
  fallback: "none" | "medical_boundary" | "unsupported_claim" | "generic";
  escalate: boolean;
}
