// Keyword heuristic, shown to staff as such. Whole words only: matching substrings made
// "insurance" count as positive (sure) and "know" as negative (no).
const POSITIVE = ["great", "thanks", "thank", "perfect", "yes", "interested", "helpful", "good", "love", "excellent", "sure", "definitely", "absolutely", "appreciate", "wonderful", "happy", "excited"];
const NEGATIVE = ["no", "not interested", "cancel", "disappointed", "frustrated", "expensive", "problem", "issue", "wrong", "bad", "terrible", "refuse", "unhappy", "difficult", "complicated", "too much", "confusing"];

export type Sentiment = "positive" | "neutral" | "negative";

const matcher = (terms: string[]) => new RegExp(`\\b(${terms.join("|")})\\b`, "g");
const positiveRe = matcher(POSITIVE);
const negativeRe = matcher(NEGATIVE);

export function scoreSentiment(texts: string | string[]): Sentiment {
  const joined = (Array.isArray(texts) ? texts : [texts]).join(" . ").toLowerCase();
  const pos = joined.match(positiveRe)?.length ?? 0;
  const neg = joined.match(negativeRe)?.length ?? 0;
  if (pos > neg + 1) return "positive";
  if (neg > pos) return "negative";
  return "neutral";
}
