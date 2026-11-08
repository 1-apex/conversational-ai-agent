import { SafetyCategory } from "@/lib/safety/types";
import { AgentName } from "@/lib/types";

export const MAX_HANDOFFS = 3;

// Matches the routes in docs/09-agent-orchestration.md.
const HANDOFF_MATRIX: Record<AgentName, AgentName[]> = {
  orchestrator: ["sales", "product", "general", "b2b"],
  sales:        ["product", "general"],
  product:      ["sales", "general"],
  general:      ["sales", "product", "b2b"],
  b2b:          ["sales", "product", "general"],
};

const CATEGORY_ROUTE: Partial<Record<SafetyCategory, AgentName>> = {
  business:                "b2b",
  pricing:                 "sales",
  insurance:               "sales",
  warranty:                "general",
  complaint:               "general",
  product_troubleshooting: "product",
  general_product:         "product",
};

// More specific signals win when a turn matches several categories.
const ROUTE_PRIORITY: SafetyCategory[] = [
  "business", "complaint", "pricing", "insurance", "warranty", "product_troubleshooting", "general_product",
];

export function canHandoff(from: AgentName, to: AgentName, handoffsSoFar: number): boolean {
  return from !== to && handoffsSoFar < MAX_HANDOFFS && HANDOFF_MATRIX[from].includes(to);
}

export function routeDeterministically(categories: SafetyCategory[], current: AgentName): AgentName | null {
  const category = ROUTE_PRIORITY.find((c) => categories.includes(c));
  if (!category) return null;
  const target = CATEGORY_ROUTE[category]!;
  // general_product is broad, and a Sales or General agent can answer simple product questions
  if (category === "general_product" && current !== "orchestrator") return null;
  return target;
}
