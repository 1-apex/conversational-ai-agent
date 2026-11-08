import { normalizeForMatching } from "@/lib/emergency-offramp";
import { redactPii } from "./detectors";
import { ValidationResult } from "./types";

export const PROMPT_CANARY = "ZX-CANARY-7741";

export interface ValidationInput {
  reply: string;
  agent: string;
  evidence: string;          // text the reply is allowed to draw facts from
  retrievedChunkIds?: string[];
  citedChunkIds?: string[];
  requireCitations: boolean; // true when answering from retrieved documents
}

type Rule = [id: string, pattern: RegExp, fallback: ValidationResult["fallback"], escalate: boolean];

// Deterministic and final for critical rules. Nothing here depends on a second LLM.
const RULES: Rule[] = [
  ["out.dosing", /\b(increase|raise|turn up|turn down|lower|reduce|decrease|adjust|bump|change) (your|the|it to|his|her) (flow|setting|oxygen|o2|dose|liters?)\b|\b(set|turn) (it|your \w+|the \w+) (up )?to (setting )?\d\b|\byou should (be on|use|stay on|try) (setting|\d)\b|\btry (setting|a setting of|\d (liters?|lpm))\b/, "medical_boundary", true],
  ["out.stop_therapy", /\b(you can|it s okay to|it s fine to|safe to|feel free to|you should|you could) (stop|skip|come off|go without|take a break from|quit)\b.*\b(oxygen|concentrator|medication|prescription|therapy)\b/, "medical_boundary", true],
  ["out.diagnosis", /\b(you (probably |likely |may |might |could )?have|sounds like you have|it sounds like|this (is|could be|sounds like)|that s (likely|probably)) (copd|emphysema|asthma|pneumonia|fibrosis|heart failure|hypoxia|a heart|an infection)\b/, "medical_boundary", true],
  ["out.no_need_doctor", /\b(you don t need|no need|don t need) (to (see|ask|call|talk to) )?(a |your )?(doctor|prescription|physician)\b|\bdon t worry about (your|the) doctor\b/, "medical_boundary", true],
  ["out.clinical_suitability", /\b(perfect|ideal|right|best|great|safe|suitable) for (you|your) (copd|condition|lungs?|diagnosis|health|illness|oxygen needs)\b|\bwill (treat|cure|improve|help) your\b/, "medical_boundary", false],
  ["out.false_connection", /\b(connecting you|transferring you to a|i ll connect you|let me connect you|let me transfer you to a (person|human|representative)|a (person|human|representative|specialist|agent) will (call|contact|follow|reach)|someone will (call|contact|follow|reach)|please hold)\b/, "unsupported_claim", false],
  ["out.false_action", /\b(i ve|i have|we ve|we have) (placed|processed|submitted|booked|scheduled|verified|ordered|refunded|shipped)\b|\byour order (is|has been)\b|\b(i ll|we ll|i will|we will) (send|email|text|mail|ship|schedule|call|order|book)\b/, "unsupported_claim", false],
  ["out.ai_denial", /\b(i m|i am) (not an ai|a real person|a human|human|not a bot|not a robot|a real agent)\b|\byou re (talking|speaking) (to|with) a (real )?(person|human)\b/, "generic", false],
  ["out.affiliation", /\b(i work (for|at) inogen|we at inogen|here at inogen|as an inogen|i m (from|with) inogen|i am (from|with) inogen|this is inogen|inogen s (official|customer service)|welcome to inogen)\b/, "generic", false],
  ["out.coverage_decision", /\b(you (are|re|will be|ll be) (covered|eligible|approved)|you qualify|medicare will (pay|cover) (for )?(you|your))\b/, "unsupported_claim", false],
];

// Digits in the reply, ignoring formatting, so "$3,495" matches "3495".
const NUMBER = /\d[\d,]*(?:\.\d+)?/g;
const SPELLED_LARGE_NUMBER = /\b(hundred|thousand|million)\b/;
const ALWAYS_ALLOWED_NUMBERS = new Set(["911"]);

// A number has to match with its unit, so "18 decibels" isn't excused by "18 hours".
const UNIT_SYNONYMS: Record<string, string> = {
  lb: "lb", lbs: "lb", pound: "lb", pounds: "lb",
  hr: "hour", hrs: "hour", hour: "hour", hours: "hour",
  min: "minute", mins: "minute", minute: "minute", minutes: "minute",
  db: "db", decibel: "db", decibels: "db",
  inch: "inch", inches: "inch", foot: "foot", feet: "foot",
  liter: "liter", liters: "liter", lpm: "liter",
  ml: "ml", year: "year", years: "year", month: "month", months: "month", day: "day", days: "day",
  percent: "percent", dollars: "dollar", dollar: "dollar",
};
const UNIT_WORDS = Object.keys(UNIT_SYNONYMS).sort((a, b) => b.length - a.length).join("|");
const NUMBER_WITH_UNIT = new RegExp(`(\\d[\\d,]*(?:\\.\\d+)?)(?:\\s*[–-]\\s*(\\d[\\d,]*(?:\\.\\d+)?))?[\\s-]*(${UNIT_WORDS})\\b`, "gi");

const cleanNumber = (n: string) => n.replace(/,/g, "").replace(/\.0+$/, "");

function measurementsIn(text: string): Set<string> {
  const found = new Set<string>();
  for (const m of text.matchAll(NUMBER_WITH_UNIT)) {
    const unit = UNIT_SYNONYMS[m[3].toLowerCase()];
    found.add(`${cleanNumber(m[1])} ${unit}`);
    if (m[2]) found.add(`${cleanNumber(m[2])} ${unit}`); // a range such as 6-9 hrs covers both ends
  }
  return found;
}

function numbersIn(text: string): Set<string> {
  return new Set((text.match(NUMBER) ?? []).map((n) => n.replace(/,/g, "").replace(/\.0+$/, "")));
}

export function validateResponse(input: ValidationInput): ValidationResult {
  const failedRules: string[] = [];
  let fallback: ValidationResult["fallback"] = "none";
  let escalate = false;

  const record = (id: string, f: ValidationResult["fallback"], esc = false) => {
    failedRules.push(id);
    // The first failure picks the fallback, except that medical beats everything
    if (fallback === "none" || f === "medical_boundary") fallback = f;
    escalate ||= esc;
  };

  const reply      = input.reply;
  const normalized = normalizeForMatching(reply);

  if (!reply.trim() || reply.length > 600) record("out.length", "generic");
  if (/[{}]|"reply"|"handoff"/.test(reply)) record("out.raw_json", "generic");

  for (const [id, pattern, f, esc] of RULES) {
    if (pattern.test(normalized)) record(id, f, esc);
  }

  // ── Leakage ───────────────────────────────────────────────────────────
  if (reply.includes(PROMPT_CANARY) || /\b(demo rules|output format|handoff takeover|voice style)\b/.test(normalized)) {
    record("out.prompt_leak", "generic");
  }
  const evidencePii = redactPii(input.evidence).text;
  if (redactPii(reply).text !== reply && evidencePii === input.evidence) record("out.pii", "generic");

  // ── Numeric grounding ─────────────────────────────────────────────────
  const allowed = numbersIn(input.evidence);
  for (const n of numbersIn(reply)) {
    if (!allowed.has(n) && !ALWAYS_ALLOWED_NUMBERS.has(n)) {
      record("out.unsupported_number", "unsupported_claim");
      break;
    }
  }
  const allowedMeasurements = measurementsIn(input.evidence);
  for (const measurement of measurementsIn(reply)) {
    if (!allowedMeasurements.has(measurement)) {
      record("out.unsupported_measurement", "unsupported_claim");
      break;
    }
  }
  if (SPELLED_LARGE_NUMBER.test(normalized)) record("out.spelled_number", "unsupported_claim");

  // ── Capabilities ──────────────────────────────────────────────────────
  if (input.agent !== "sales" && /\$\s?\d|\b\d+ dollars\b/.test(reply)) record("out.price_capability", "unsupported_claim");

  // ── Citations ─────────────────────────────────────────────────────────
  if (input.requireCitations) {
    const cited     = input.citedChunkIds ?? [];
    const retrieved = new Set(input.retrievedChunkIds ?? []);
    if (cited.some((id) => !retrieved.has(id))) record("out.invented_citation", "unsupported_claim");
    if (numbersIn(reply).size > 0 && cited.length === 0) record("out.uncited_fact", "unsupported_claim");
  }

  return { passed: failedRules.length === 0, failedRules, fallback, escalate };
}
