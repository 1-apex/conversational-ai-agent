# 06 — Healthcare Safety Framework

**Build status (2026-11-05):** the engine, severity pathways and output validator are built in `lib/safety/`. Every script is still unapproved, and no clinician has reviewed anything. See [implementation status](implementation-status.md).

**Status: Proposed. All caller-facing scripts and clinical boundaries need approval from a qualified clinical reviewer and counsel before any real caller hears them.** This document defines the engineering structure, not the clinical policy.

**Principle: deterministic rules decide, and an LLM can only make the system more cautious.** No model output can lower a severity, unlock a blocked pathway, or suppress an escalation.

## Current state

No safety engine exists. Medical boundaries are prompt instructions only. Since Phase 0, `lib/emergency-offramp.ts` adds an interim phrase check that returns a fixed message with no LLM call and stays on for the rest of the call. It is a stopgap: it misses indirect wording, neither its phrases nor its message are clinically reviewed, and passing its checks is no evidence of safety. See R-01 in the [audit](01-repository-audit.md).

## Categories

| Category | Default severity | Default pathway |
| --- | --- | --- |
| General product inquiry | LOW | Normal |
| Pricing inquiry | LOW | Normal, approved prices only |
| Warranty inquiry | LOW | Normal |
| Insurance inquiry | MODERATE | Restricted: general information only, no individual determinations |
| Product troubleshooting | MODERATE | Restricted: approved manual content; a device fault on someone dependent on oxygen goes to HIGH |
| Complaint | MODERATE | Restricted, offer human support |
| Personal health information | MODERATE | Restricted: do not repeat or solicit; minimise |
| Unknown or ambiguous | MODERATE | One clarifying question, then offer a person |
| Prompt injection | MODERATE | Ignore the instruction, normal scope, log |
| Human support request | MODERATE | Create escalation, honest message |
| Medical question | HIGH | Boundary script and escalation |
| Emergency-related statement | CRITICAL | Emergency script |

A device fault raises a special concern: "my concentrator stopped working" can be a safety event for a person who depends on it. The clinical reviewer should define how this is handled.

## Severity behaviour

| Severity | LLM agent reply | Sales allowed | Escalation | Log |
| --- | --- | --- | --- | --- |
| LOW | Yes | Yes | No | Metadata |
| MODERATE | Yes, restricted capabilities | Only if the category permits | If policy says so | Safety event |
| HIGH | No, approved script | No, this turn | Yes | Safety event |
| CRITICAL | No, approved script | No, locked for the rest of the call | Priority, alert | Safety event, alert |

## Medical boundaries

The system must not diagnose, prescribe, recommend personalized oxygen or flow changes, recommend changing clinician instructions, or invent emergency procedures. The product-fit logic in the current prompts ("Best for", "That's actually perfect for you") needs clinical review, because matching a person to a device can imply clinical suitability.

## Emergency detection

Keyword matching alone is not sufficient, and neither is an LLM alone. Layers:

1. **Normalize:** lowercase, expand contractions, apply STT corrections. Speech recognition errors are a known cause of misses.
2. **Deterministic lexicon and patterns:** reviewed phrases, including indirect and colloquial forms, and third-party statements such as "my husband can't breathe". Terms must come from clinical review.
3. **LLM classifier as an additional net:** only raises severity. A short timeout applies.
4. **Conservative ambiguity handling:** an unclear statement gets one direct check using approved wording. A failed classifier yields at least MODERATE.
5. **Sticky state:** once triggered, normal agents stay locked for the rest of the call.

Negation handling ("I'm not having chest pain") must be conservative. The benchmark tracks misses separately from over-triggering. **A missed emergency is the worst failure. An extra check-in is an acceptable cost, and thresholds should be set accordingly.**

No detector can guarantee recognition of every emergency. Callers must never be told that this system monitors for emergencies, and a clear statement that it is not an emergency service belongs in the approved opening notice.

## Approved scripts

Scripts live in a versioned policy file, each with an owner, approver and date. The LLM cannot alter them.

| Script | Status | Placeholder for development only |
| --- | --- | --- |
| Opening notice | **NOT APPROVED** | "You're speaking with an AI assistant. This isn't an emergency service. This call is transcribed." |
| Emergency | **NOT APPROVED** | "If this is a medical emergency, call 911 now." |
| Medical boundary | **NOT APPROVED** | "I can't give medical advice. Your doctor or care team is the right person for that. I can arrange a callback from our support team." |
| Human request | **NOT APPROVED** | "I can't transfer you live, but I can arrange a callback." |

These placeholders exist so that engineering can test the mechanism. In `DATA_MODE=phi_approved`, startup fails if any script is still marked unapproved.

## Output validation

Deterministic checks run first, and critical rules cannot be overridden by an LLM:

| Check | Method | On failure |
| --- | --- | --- |
| Schema | Zod | Fallback |
| Dosing or flow instructions | Patterns such as "increase your setting", "turn it up to" | Block, boundary script |
| Diagnosis or prognosis language | Patterns | Block, boundary script |
| Numeric claims | Each number, unit and price must appear in cited chunks | Block, limitation message |
| Claimed connection to a person | Patterns such as "connecting you" with no live channel | Block |
| Denial of being an AI | Patterns | Block |
| System prompt or other callers' data | Canary strings, PII comparison | Block, alert |
| Non-numeric grounding | Citation presence plus an entailment check | Block or flag, per evaluation results |

The last row may use a second LLM as an added signal, never as the only control for a critical rule. Spoken-number formatting ("around three thousand dollars") complicates numeric matching, so the validator should check structured values before they are converted for speech.

## Safety events

Each records category, severity, rule IDs, policy version, action taken, and call and turn IDs. Caller text is not copied into the event; it stays in the access-controlled turn record.

## Governance

Changes to the policy require review, a new version, and a passing critical evaluation run. Production feedback never changes policy automatically. Named clinical, privacy and operations owners are required; none exist yet.
