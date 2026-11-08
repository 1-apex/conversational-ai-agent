import { DEMO_DISCLOSURE, NO_LIVE_STAFF_MESSAGE } from "@/lib/demo-notice";
import { EMERGENCY_MESSAGE } from "@/lib/emergency-offramp";
import { Pathway, SafetyCategory, Severity } from "./types";

export const SAFETY_POLICY_VERSION = "2026-11-05.1";

// Fixed wording. The model can't alter these. None has had clinical or legal review,
// so results from them can't be presented as clinically validated.
export const SCRIPTS = {
  disclosure: { text: DEMO_DISCLOSURE, approved: false },
  emergency: { text: EMERGENCY_MESSAGE, approved: false },
  medical_boundary: {
    text: "I can't give medical advice, because I'm only an AI demo. That's a question for your doctor or care team. Is there something about the product itself I can help with?",
    approved: false,
  },
  device_malfunction: {
    text: "I can't troubleshoot this, because I'm only an AI demo. If you rely on your oxygen, please contact your equipment supplier or your care team right away. If you feel unwell, call 911.",
    approved: false,
  },
  human_request: { text: NO_LIVE_STAFF_MESSAGE, approved: false },
  injection: {
    text: "I can't do that. I can answer questions about the products. What would you like to know?",
    approved: false,
  },
  unsupported_claim: {
    text: "I don't have verified information on that, so I'd rather not guess. Please check with Inogen at inogen.com. Is there something else I can help with?",
    approved: false,
  },
  generic_fallback: {
    text: "Sorry, I can't answer that properly right now. Could you ask it another way?",
    approved: false,
  },
  checkin: { text: "Just checking, are you still there?", approved: false },
  provider_failure: {
    text: "Sorry, I'm having trouble answering right now. Could you say that again?",
    approved: false,
  },
} as const;

export type ScriptId = keyof typeof SCRIPTS;

export const CATEGORY_SEVERITY: Record<SafetyCategory, Severity> = {
  general_product:             "LOW",
  pricing:                     "LOW",
  warranty:                    "LOW",
  business:                    "LOW",
  insurance:                   "MODERATE",
  product_troubleshooting:     "MODERATE",
  complaint:                   "MODERATE",
  personal_health_information: "MODERATE",
  unknown:                     "MODERATE",
  prompt_injection:            "MODERATE",
  human_request:               "MODERATE",
  device_malfunction:          "HIGH",
  medical_question:            "HIGH",
  emergency:                   "CRITICAL",
};

export function pathwayFor(categories: SafetyCategory[], severity: Severity): Pathway {
  if (severity === "CRITICAL") return "emergency_script";
  if (severity === "HIGH") return "boundary_script";
  if (categories.includes("prompt_injection")) return "injection_script";
  if (categories.includes("human_request")) return "human_request";
  return severity === "MODERATE" ? "restricted" : "normal";
}

export const ESCALATION_PRIORITY: Record<string, "P1" | "P2" | "P3" | "P4"> = {
  emergency: "P1",
  device_malfunction: "P1",
  medical_question: "P2",
  human_request: "P3",
  complaint: "P3",
  insurance_dispute: "P3",
  unresolved: "P4",
};
