// Runs in both the browser and the server, so the emergency message still works when the
// API, the model or the database is down. No server imports here.
// It catches listed phrases and will miss indirect wording, so it isn't a safety guarantee.
// Neither the phrases nor the message are clinically reviewed.

export const EMERGENCY_MESSAGE =
  "I can't help with this, because I'm only an AI demo and not an emergency service. If you or someone else may be in danger, call 911 now.";

// Negation is deliberately not handled: "I'm not having chest pain" still matches,
// because an unnecessary message costs far less than a missed emergency.
export const EMERGENCY_RULES: { id: string; pattern: RegExp }[] = [
  { id: "cant_breathe",  pattern: /\b(can ?not|can t|cant|could not|couldn t|unable to|struggling to|hard to|trouble|difficulty|having a hard time|cant even|can barely) (breathe|breath|breathing)\b/ },
  { id: "no_breath",     pattern: /\b(can t|cant|can not|cannot|couldn t) (catch|get) (my|his|her|their) breath\b/ },
  { id: "not_breathing", pattern: /\b(not|stopped|isn t|isnt|wasn t|barely|hardly) (breathing|breathin)\b/ },
  { id: "gasping",       pattern: /\b(gasping|choking|suffocating|struggling for air|fighting for air|can t get air|cant get air|can t get enough air|cant get enough air|no air)\b/ },
  { id: "wont_wake",     pattern: /\b(won t|wont|can t|cant|cannot|not|isn t|isnt) (wake|waking|wake up|responding)( up| him| her| them)?\b/ },
  { id: "chest",         pattern: /\bchest (pain|pains|pressure|tightness|hurts)\b|\bchest (is|feels) tight\b|\bcrushing\b.*\bchest\b/ },
  { id: "heart_attack",  pattern: /\bheart attack\b/ },
  { id: "stroke",        pattern: /\bstroke\b|\bface is drooping\b|\bslurring\b/ },
  { id: "seizure",       pattern: /\bseizure\b/ },
  { id: "passing_out",   pattern: /\b(passed|passing|blacked|blacking) out\b|\babout to (pass out|faint|collapse)\b/ },
  { id: "unresponsive",  pattern: /\b(fainted|fainting|collapsed|unconscious|unresponsive)\b/ },
  { id: "blue",          pattern: /\b(turning|turned|gone|going) blue\b|\b(lips|face|fingers|skin) (are|is|look|looks|turning) (blue|gray|grey)\b/ },
  { id: "overdose",      pattern: /\boverdose\b|\bod ed\b/ },
  { id: "bleeding",      pattern: /\b(bleeding (badly|heavily|a lot)|won t stop bleeding|coughing up blood)\b/ },
  { id: "self_harm",     pattern: /\b(suicide|suicidal|kill myself|killing myself|end my life|ending my life|want to die|don t want to (live|be here)|hurt myself|harm myself)\b/ },
  { id: "dying",         pattern: /\b(i m|i am|he s|he is|she s|she is|they re|they are|my (husband|wife|mom|mother|dad|father|son|daughter|partner|brother|sister|grandmother|grandfather|neighbor|friend) is) dying\b(?! to)|\bgoing to die\b/ },
  { id: "declared",      pattern: /\b(medical emergency|this is an emergency|having an emergency|it s an emergency|its an emergency)\b/ },
  { id: "help_services", pattern: /\b(call|need|get|send|calling) (an ambulance|911|nine one one|paramedics)\b/ },
  { id: "fire",          pattern: /\b(on fire|there s a fire|caught fire|smoke coming|smell(s|ing)? smoke|burning smell)\b/ },
  { id: "anaphylaxis",   pattern: /\bthroat is (closing|swelling)\b/ },
];

export function normalizeForMatching(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isEmergencyStatement(text: unknown): boolean {
  if (typeof text !== "string") return false;
  const normalized = normalizeForMatching(text);
  return EMERGENCY_RULES.some((rule) => rule.pattern.test(normalized));
}
