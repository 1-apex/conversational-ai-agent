// INTERIM stopgap until the safety engine in docs/06-healthcare-safety-framework.md
// exists. It catches obvious phrases only and will miss indirect wording, so it is
// not a safety guarantee. Neither the phrases nor the message are clinically reviewed.
// No Node or server imports: the client also uses this when the API is unreachable.

export const EMERGENCY_MESSAGE =
  "I can't help with this, because I'm only an AI demo and not an emergency service. If you or someone else may be in danger, call 911 now.";

// Negation is deliberately not handled: "I'm not having chest pain" still matches,
// because an unnecessary message costs far less than a missed emergency.
const EMERGENCY_PATTERNS: RegExp[] = [
  /\b(can ?not|can t|cant|could not|couldn t|unable to|struggling to|hard to|trouble) (breathe|breathing)\b/,
  /\b(can t|cant|can not|cannot) (catch|get) (my|his|her|their) breath\b/,
  /\b(not|stopped|isn t|isnt|wasn t) breathing\b/,
  /\b(gasping|choking|suffocating|struggling for air)\b/,
  /\b(won t|wont|can t|cant|cannot) wake (up|him|her|them)\b/,
  /\bchest (pain|pains|pressure|tightness)\b/,
  /\bheart attack\b/,
  /\bstroke\b/,
  /\bseizure\b/,
  /\b(passed|passing|blacked|blacking) out\b/,
  /\b(fainted|fainting|collapsed|unconscious|unresponsive)\b/,
  /\b(turning|turned|gone|going) blue\b/,
  /\b(lips|face|fingers) (are|is|look|looks) blue\b/,
  /\boverdose\b/,
  /\b(bleeding (badly|heavily)|won t stop bleeding)\b/,
  /\b(suicide|suicidal|kill myself|end my life|want to die)\b/,
  /\b(i m|i am|he s|he is|she s|she is|they re|they are) dying\b/,
  /\b(medical emergency|this is an emergency|having an emergency)\b/,
  /\b(call|need|get|send) (an ambulance|911|nine one one)\b/,
  /\b(on fire|there s a fire|caught fire)\b/,
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isEmergencyStatement(text: unknown): boolean {
  if (typeof text !== "string") return false;
  const normalized = normalize(text);
  return EMERGENCY_PATTERNS.some((pattern) => pattern.test(normalized));
}
