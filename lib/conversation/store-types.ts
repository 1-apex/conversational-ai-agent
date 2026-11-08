import { PROMPT_VERSION } from "@/lib/agent-prompts";
import { SAFETY_POLICY_VERSION } from "@/lib/safety/policy";
import type { TurnResult } from "./pipeline";

export { PROMPT_VERSION };
export const SAFETY_VERSION = SAFETY_POLICY_VERSION;

export interface TurnFacts {
  result: TurnResult;
}
