# ADR-002: Deterministic safety engine with raise-only LLM

**Status:** Proposed. Policy content requires clinical approval.
**Date:** 2026-11-04

## Context

Behaviour is controlled only by prompts. No emergency handling exists, and a prompt instruction can be ignored, or overridden by injection.

## Problem

How can safety decisions be made predictable and testable when generation is not?

## Decision

Create `lib/safety/`, independent of agents. Deterministic detectors run first. An LLM classifier may raise severity only, and severity combines by maximum. CRITICAL and HIGH use approved scripts with no generated text. Every reply passes a separate output validator. Policy is versioned data with an approval status. Classifier failure defaults to caution.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Stronger prompts | Not enforceable, not testable as a control |
| LLM classifier alone | Non-deterministic; can fail silently; provider outage removes the control |
| Keywords alone | Misses indirect language and STT errors |
| Vendor guardrail product | Could supplement this later; doesn't replace policy ownership, and adds a data processor |
| Second LLM as sole output judge | Same failure modes as the first |

## Benefits

Rules are testable offline on every PR. The emergency path survives provider failure. Decisions can be explained by rule ID and policy version.

## Trade-offs

Lexicons need upkeep and will still miss things. Conservative rules cause false positives, which frustrate callers. A classifier adds latency, and if it runs in parallel, replies must wait for its result anyway.

## Security implications

Removes the ability of injection to unlock pathways. The classifier itself can still be attacked, which is acceptable only because it can't lower severity.

## Privacy implications

Classification sends caller text to a provider, so it goes through the policy gate. Safety events store rule IDs instead of caller words.

## Consequences

Clinical review becomes a dependency. Scripts can't reach production unapproved. All agent calls go through the engine, with no direct path.

## Future reconsideration conditions

Evaluation showing that an alternative has better recall, or a clinically validated third-party component. The raise-only rule should be changed only through clinical and safety review.
