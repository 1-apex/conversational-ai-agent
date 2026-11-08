# 09 — Agent Orchestration

**Build status (2026-11-05):** built in `lib/conversation/`. One transition was added: SAFETY_CHECK to SPEAKING, for the scripted injection refusal. See [implementation status](implementation-status.md).

**Status: Proposed.** See [ADR-003](adr/ADR-003-agent-orchestration.md).

**The five agents stay, but they lose control of the application.** Agents generate language. The orchestrator decides state, routing and capabilities.

## Current behaviour

The model returns `handoff`, and the client follows it after checking only that the name is valid and differs from the current agent (`app/api/agent/route.ts`, `components/CallStudio.tsx:526`). Nothing prevents handoff loops, and the client supplies the current agent. The takeover message (`lib/agent-prompts.ts:28`) works well and is kept.

## State machine

Diagram: [`diagrams/agent-orchestration.mmd`](diagrams/agent-orchestration.mmd). States are stored on the call, and transitions go through a single function that rejects any pair not listed.

| From | Allowed to |
| --- | --- |
| IDLE | GREETING |
| GREETING | SPEAKING |
| LISTENING | SAFETY_CHECK, CALL_COMPLETED |
| SAFETY_CHECK | INTENT_DETECTION, HUMAN_ESCALATION, SPEAKING (scripted refusal) |
| INTENT_DETECTION | ROUTING |
| ROUTING | AGENT_PROCESSING |
| AGENT_PROCESSING | RESPONSE_VALIDATION, ERROR |
| RESPONSE_VALIDATION | SPEAKING, HUMAN_ESCALATION |
| SPEAKING | LISTENING, SAFETY_CHECK, CALL_COMPLETED |
| HUMAN_ESCALATION | SPEAKING |
| ERROR | SPEAKING, CALL_COMPLETED |
| CALL_COMPLETED | none |

An `emergencyLocked` flag on the call restricts the path: while it is set, SAFETY_CHECK can only go to HUMAN_ESCALATION. Concurrent requests use an optimistic version check, so a late request cannot rewind state. Barge-in cancels the unspoken turn and records it as interrupted.

## Routing

1. **Deterministic first.** Rules over the safety category, detected product terms and business-caller signals choose the agent.
2. **LLM proposal second.** When rules don't settle it, the current agent's `proposedAgent` is checked against the handoff matrix.
3. **Limits.** A proposed cap of 3 handoffs per call; after that, stay put and offer a person. This prevents the current loop risk.

| From ↓ / To → | Sales | Product | General | B2B | Main |
| --- | --- | --- | --- | --- | --- |
| Main | Yes | Yes | Yes | Yes | — |
| Sales | — | Yes | Yes | No | No |
| Product | Yes | — | Yes | No | No |
| General | Yes | Yes | — | Yes | No |
| B2B | Yes | Yes | Yes | — | No |

This matches the routes in the current prompts. Safety pathways sit outside the matrix, and no agent can reach or skip them.

## Capabilities

Enforced in code when building the request and validating the result, not just requested in prompts.

| Capability | Main | Sales | Product | General | B2B |
| --- | --- | --- | --- | --- | --- |
| Answer from product documents | Yes | Yes | Yes | Yes | Yes |
| Quote published prices | No | Yes | No | No | No |
| General coverage information | No | Yes | No | Yes | No |
| Clinical recommendation | No | No | No | No | No |
| Change medical instructions | No | No | No | No | No |
| Customer record access | No | No | No | No | No |
| Wholesale prices | No | No | No | No | No |
| Create callback request | Yes | Yes | Yes | Yes | Yes |
| Capture business lead | No | No | No | No | Yes |

No agent has record access, so the brief's concerns about General and B2B reaching records are met by granting nothing. If record access is ever added, it needs application-level authorization that the model cannot influence.

## Prompts

Prompts become versioned files with a content hash. Required changes:

| Change | Reason |
| --- | --- |
| Remove "NEVER say you're an AI" (`:20`) | R-02 |
| Remove "Always discover: what flow setting…" (`:51`) | Solicits health information; review with clinical owner |
| Remove blanket "End every reply with a soft question" | Inappropriate in distress situations |
| Replace embedded knowledge with retrieved evidence | R-04 |
| Replace the medical line in General with engine-level enforcement | Prompt text is not a control |
| Delimit caller content and evidence as data | Injection resistance |

## History handling

The server loads a bounded window of validated turns plus a running summary. Blocked model output never enters history. Client-supplied history is removed.

## Not doing

No agent framework: the logic is a small state machine, and a framework would add dependencies without adding safety. No additional agents until the evaluation system shows that the existing five work well.
