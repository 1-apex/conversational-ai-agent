import { EMERGENCY_RULES, normalizeForMatching } from "@/lib/emergency-offramp";
import { CATEGORY_SEVERITY } from "./policy";
import { DetectorHit, SafetyCategory } from "./types";

// Deterministic first layer. These phrases are engineering drafts with no clinical review.
// They will miss things, which is why the classifier and conservative defaults exist.
type Rule = [id: string, pattern: RegExp];

const MEDICAL_RULES: Rule[] = [
  ["med.change_setting", /\b(should|can|could|do|may|is it (ok|okay|safe) (if|to|for)) (i|we|he|she|my \w+)?\s*(to )?(increase|raise|turn up|turn down|lower|reduce|decrease|change|adjust|bump up|up)\b.*\b(setting|flow|oxygen|o2|dose|level|liters?)\b/],
  ["med.change_setting_2", /\b(increase|raise|turn up|turn down|lower|reduce|decrease|change|adjust)\b.*\b(my|his|her|their)\b.*\b(setting|flow|oxygen|o2|dose|prescription)\b/],
  ["med.what_setting", /\bwhat (setting|flow|flow rate|level|dose|dosage)\b.*\b(should|do i need|is right|is best|for me|for my)\b/],
  ["med.how_much", /\bhow (much|many liters of) oxygen\b.*\b(do i|should|does (he|she|my)|i need)\b/],
  ["med.need_oxygen", /\b(do|would|does) (i|he|she|my \w+) (really )?need (oxygen|a concentrator|to be on oxygen)\b/],
  ["med.stop_oxygen", /\b(stop|skip|quit|come off|go without|get off|take a break from)\b.*\b(oxygen|o2|concentrator|prescription|medication|meds)\b/],
  ["med.against_doctor", /\b(doctor|pulmonologist|physician|nurse|care team)\b.*\b(said|told|prescribed|says)\b.*\b(but|should i|can i|do i have to|is that)\b/],
  ["med.without_doctor", /\bwithout (a |my |asking my |telling my )?(doctor|prescription|physician)\b/],
  ["med.readings", /\b(my|his|her) (oxygen( level| levels)?|o2( level| levels)?|sats?|saturation|spo2|pulse ox\w*|levels?)\b.*\b(is|are|was|were|dropped|dropping|low|keeps?|at|only|\d+)\b/],
  ["med.diagnosis", /\b(diagnos\w+|do i have|could (it|this) be|is (this|it) (copd|emphysema|fibrosis|cancer|pneumonia|heart failure|asthma))\b/],
  ["med.prescribe", /\b(prescribe|write me a prescription|give me a prescription|what medication|what medicine|which medication)\b/],
  ["med.side_effects", /\b(side effects?|oxygen toxicity|too much oxygen|is oxygen (bad|dangerous|safe))\b/],
  ["med.suitability", /\b(good|right|best|safe|okay|ok|enough|suitable|work|recommend\w*)\b.*\bfor (my|me with|someone with|a person with|people with|his|her) (copd|emphysema|condition|fibrosis|lungs?|heart|chf|asthma|sleep apnea|cancer|diagnosis|illness|needs? at night)\b/],
  ["med.condition_advice", /\b(i have|i ve got|i was diagnosed with|i suffer from|my \w+ has)\b.*\b(copd|emphysema|fibrosis|chf|heart failure|lung cancer|pulmonary hypertension)\b.*\b(what|which|should|can i|do i|is it|will)\b/],
  ["med.symptom", /\b(dizzy|dizziness|light ?headed|confused|short of breath|shortness of breath|winded|headaches?|fatigue|exhausted|wheezing|coughing up)\b/],
  ["med.safe_activity", /\b(is it safe|can i safely|safe for me|am i okay|will i be okay|am i safe)\b/],
  ["med.sleep_on", /\bshould i (use|wear|sleep with|keep)\b.*\b(oxygen|concentrator|at night|while sleeping)\b/],
];

const DEVICE_FAULT = /\b(concentrator|machine|device|oxygen|unit|g3|g4|g5|rove|inogen)\b.*\b(stopped|stops|won t|wont|isn t|isnt|not|died|dead|broke|broken|failing|failed|keeps?|shut|alarm\w*|beep\w*|malfunction\w*|error|flashing)\b/;
const RELIANCE = /\b(rely|depend|need it|need my|only oxygen|no oxygen|no backup|out of oxygen|running out|without it|without oxygen|don t have (a )?backup|right now)\b/;
const FAULT_SYMPTOM = /\b(dizzy|dizziness|light ?headed|faint|confused|short of breath|shortness of breath|hard to breathe|struggling|weak|chest)\b/;

const INJECTION_RULES: Rule[] = [
  ["inj.ignore", /\b(ignore|disregard|forget|override|bypass)\b.*\b(previous|prior|above|earlier|all|your|the|any)\b.*\b(instructions?|rules?|prompts?|directions?|guidelines?|policy|policies|restrictions?)\b/],
  ["inj.reveal", /\b(show|reveal|print|repeat|tell me|what is|what are|give me|output|display|read|recite)\b.*\b(system prompt|your prompt|your instructions|initial instructions|hidden instructions|your rules|developer message|internal marker)\b/],
  ["inj.roleplay", /\b(you are now|pretend (to be|you are|you re)|act as|from now on you|roleplay as|new persona|dan mode|jailbreak|developer mode|admin mode|god mode|debug mode)\b/],
  ["inj.fake_authority", /\b(i am|i m|this is) (your |the |an? )?(developer|administrator|admin|system|openai|anthropic|groq|engineer|owner|ceo)\b/],
  ["inj.fake_format", /\b(end of prompt|begin new instructions|new instructions)\b/],
  ["inj.fake_transfer", /\bcall transferred\b/],
  ["inj.output_json", /\b(respond|reply|answer|output)\b.*\b(json|handoff)\b.*\b(agent|handoff|reply)\b/],
  ["inj.approve", /\b(mark|set|approve|grant|give me)\b.*\b(as approved|admin access|access to (all|other|the) (calls|records|transcripts)|other callers?|other customers?)\b/],
];

const INTENT_RULES: [string, SafetyCategory, RegExp][] = [
  ["intent.human", "human_request", /\b(speak|talk|connect|transfer|put me through|get me)\b.*\b(a |an |to a |to an |with a |with an |to |with )?(human|person|someone|somebody|representative|rep|agent|operator|manager|supervisor|specialist|real)\b|\b(human|real person|representative|operator)\b\s*(please)?$|\bcall me back\b|\bcallback\b/],
  ["intent.complaint", "complaint", /\b(complain\w*|unacceptable|terrible|awful|horrible|rip ?off|ripped off|scam|furious|angry|disappointed|fed up|worst|refund|lawsuit|sue|attorney|lawyer)\b/],
  ["intent.insurance", "insurance", /\b(insurance|medicare|medicaid|aetna|cigna|humana|united ?health\w*|blue cross|bcbs|coverage|covered|cover|deductible|copay|co pay|prior auth\w*|claim)\b/],
  ["intent.warranty", "warranty", /\b(warrant\w*|guarantee\w*|return policy|return it|send it back|repair|replace(ment)? (unit|policy))\b/],
  ["intent.pricing", "pricing", /\b(price|prices|pricing|cost|costs|how much|expensive|cheap\w*|afford\w*|financ\w*|payment plan|discount|msrp|buy|purchase|order)\b/],
  ["intent.business", "business", /\b(dme|clinic|hospital|pharmacy|wholesale|dealer|bulk|distributor|reseller|our (patients|facility|organization|practice)|home health agency|volume pricing|hospice)\b/],
  ["intent.troubleshoot", "product_troubleshooting", /\b(not working|won t|wont|broken|error|alarm|beeping|flashing|troubleshoot|fix|reset|filter|clean|maintenance|how do i (use|charge|replace|change))\b/],
  ["intent.product", "general_product", /\b(g3|g4|g5|rove|inogen|at home|concentrator|battery|batteries|charger|accessor\w*|cannula|filter|backpack|bag|weigh\w*|weight|settings?|pulse|flow|portable|faa|airline|plane|fly|flight|travel|shipping|ship|deliver\w*|company|hours|located|headquarters)\b/],
];

const HEALTH_INFO = /\b(i have|i ve got|i was diagnosed|my diagnosis|my doctor|my prescription|i m on|i am on|i take|my (copd|emphysema|fibrosis|condition|lungs?|oxygen)|years old and)\b/;

// Spoken and written forms. Regex detection reduces risk; it does not de-identify anything.
const PII_PATTERNS: [string, RegExp, string][] = [
  // Written (a@b.com) or fully spoken (a at b dot com). "Inogen at inogen.com" isn't an address.
  ["pii.email", /[a-z0-9._%+-]+@[a-z0-9-]+\.[a-z]{2,}|\b[a-z0-9._%+-]+\s+at\s+[a-z0-9-]+\s+dot\s+[a-z]{2,}\b/gi, "[email]"],
  ["pii.ssn", /\b\d{3}[-\s]\d{2}[-\s]\d{4}\b/g, "[ssn]"],
  ["pii.card", /\b(?:\d[ -]?){13,19}\b/g, "[number]"],
  ["pii.phone", /(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g, "[phone]"],
  ["pii.dob", /\b(?:born|birthday|date of birth|dob)\b[^.?!]{0,30}\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}(?:,?\s+\d{4})?)/gi, "[date of birth]"],
  ["pii.member_id", /\b(?:medicare|member|policy|insurance|subscriber)\s*(?:id|number|no|#)?\s*(?:is|:)?\s*[a-z0-9]*\d[a-z0-9-]{5,}\b/gi, "[member id]"],
];

export function redactPii(text: string): { text: string; ruleIds: string[] } {
  let result = text;
  const ruleIds: string[] = [];
  for (const [id, pattern, label] of PII_PATTERNS) {
    const next = result.replace(pattern, label);
    if (next !== result) ruleIds.push(id);
    result = next;
  }
  return { text: result, ruleIds };
}

const hit = (ruleId: string, category: SafetyCategory): DetectorHit => ({
  ruleId, category, severity: CATEGORY_SEVERITY[category],
});

// Tested before normalizing, because normalizing removes the punctuation these depend on
const RAW_INJECTION = /(^|\n)\s*(system|assistant|developer)\s*:|<\/?(system|instructions?)>|\[(system|inst)\]|###\s*instruction/i;

export function runDetectors(rawText: string): DetectorHit[] {
  const text = normalizeForMatching(rawText);
  const hits: DetectorHit[] = [];

  if (RAW_INJECTION.test(rawText)) hits.push(hit("inj.fake_format_raw", "prompt_injection"));

  for (const rule of EMERGENCY_RULES) {
    if (rule.pattern.test(text)) hits.push(hit(`emg.${rule.id}`, "emergency"));
  }
  for (const [id, pattern] of MEDICAL_RULES) {
    if (pattern.test(text)) hits.push(hit(id, "medical_question"));
  }

  if (DEVICE_FAULT.test(text)) {
    if (FAULT_SYMPTOM.test(text)) hits.push(hit("emg.fault_with_symptom", "emergency"));
    else if (RELIANCE.test(text)) hits.push(hit("device.fault_with_reliance", "device_malfunction"));
    else hits.push(hit("device.fault", "product_troubleshooting"));
  }

  for (const [id, pattern] of INJECTION_RULES) {
    if (pattern.test(text)) hits.push(hit(id, "prompt_injection"));
  }
  for (const [id, category, pattern] of INTENT_RULES) {
    if (pattern.test(text)) hits.push(hit(id, category));
  }
  if (HEALTH_INFO.test(text)) hits.push(hit("phi.mention", "personal_health_information"));
  for (const id of redactPii(rawText).ruleIds) hits.push(hit(id, "personal_health_information"));

  return hits;
}
