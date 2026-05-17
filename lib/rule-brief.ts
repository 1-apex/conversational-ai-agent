import { TranscriptTurn, CallBriefData, EntityMap } from "./types";
import { mergeEntities, EMPTY_ENTITY_MAP } from "./entity-extractor";

const ACTION_PATTERNS = [
  /\bi(?:'ll| will)\s+(?:send|call|email|follow|schedule|set up|look|check|share|get|prepare|connect|reach)/i,
  /\bwe(?:'ll| will)\s+(?:send|call|email|follow|schedule|set up|share|prepare|connect)/i,
  /\blet me\s+(?:send|check|look|get|share|prepare|pull|find|confirm)/i,
  /\bplease\s+(?:send|call|email|follow|share|check|confirm|review|provide)/i,
  /\bneed to\s+(?:send|call|email|follow|schedule|discuss|review|check|finalize)/i,
  /\bwill\s+(?:follow up|send|schedule|connect|reach out|set up|arrange|share|loop)/i,
  /\bgoing to\s+(?:send|call|email|follow|schedule|set up|share|prepare|review)/i,
];

function fmtDuration(s: number): string {
  const m = Math.floor(s / 60);
  return m === 0 ? `${s}s` : `${m}m ${s % 60}s`;
}

function list(arr: string[], max = 3): string {
  const items = arr.slice(0, max);
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function generateRuleBrief(turns: TranscriptTurn[], duration: number): CallBriefData {
  // Merge all entity maps from every turn
  const all: EntityMap = turns.reduce(
    (acc, t) => mergeEntities(acc, t.entities),
    EMPTY_ENTITY_MAP
  );

  const agentCount    = turns.filter((t) => t.speaker === "agent").length;
  const prospectCount = turns.filter((t) => t.speaker === "prospect").length;

  // ── Summary ─────────────────────────────────────────────────────────────
  const parts: string[] = [];

  const whoClause =
    all.names.length > 0 && all.companies.length > 0
      ? `${list(all.names, 2)} (${list(all.companies, 2)})`
      : all.names.length > 0
      ? list(all.names, 2)
      : all.companies.length > 0
      ? list(all.companies, 2)
      : null;

  parts.push(
    `${fmtDuration(duration)} call — ${agentCount} agent turn${agentCount !== 1 ? "s" : ""}, ` +
    `${prospectCount} prospect turn${prospectCount !== 1 ? "s" : ""}` +
    (whoClause ? ` with ${whoClause}` : "") + "."
  );

  if (all.products.length > 0) {
    parts.push(
      `Topics covered: ${list(all.products, 4)}` +
      (all.prices.length > 0 ? ` — pricing discussed around ${list(all.prices, 2)}` : "") + "."
    );
  } else if (all.prices.length > 0) {
    parts.push(`Pricing discussed: ${list(all.prices, 2)}.`);
  }

  if (all.dates.length > 0) {
    parts.push(`Key dates mentioned: ${list(all.dates, 2)}.`);
  }

  // ── Action items ─────────────────────────────────────────────────────────
  const seen = new Set<string>();
  const actionItems: string[] = [];

  for (const turn of turns) {
    const sentences = turn.text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 8);

    for (const sentence of sentences) {
      if (!ACTION_PATTERNS.some((p) => p.test(sentence))) continue;
      const clean = sentence.replace(/[.!?]+$/, "").trim();
      const label = turn.speaker === "agent" ? "Agent" : "Prospect";
      const item  = `[${label}] ${clean.charAt(0).toUpperCase()}${clean.slice(1)}`;
      if (!seen.has(item.toLowerCase())) {
        seen.add(item.toLowerCase());
        actionItems.push(item);
      }
    }
  }

  return {
    summary: parts.join(" "),
    entities: {
      names:     all.names,
      companies: all.companies,
      products:  all.products,
      contacts:  [...all.emails, ...all.phones],
    },
    actionItems: actionItems.slice(0, 6),
    duration,
  };
}
