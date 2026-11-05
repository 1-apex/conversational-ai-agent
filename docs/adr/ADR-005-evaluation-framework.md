# ADR-005: Custom evaluation runner with critical regression gates

**Status:** Proposed
**Date:** 2026-11-04

## Context

No tests or evaluations exist, so behaviour changes can't be measured.

## Problem

How should AI behaviour be evaluated so that a safety regression can't ship unnoticed, including when overall scores look good?

## Decision

Build a small TypeScript runner in `lib/evaluations/` that calls the real pipeline over a versioned YAML dataset, with deterministic scorers first and an LLM judge only for subjective qualities. Store results in Postgres. Any critical regression blocks deployment. Two tiers: an offline deterministic suite on PRs, and a live model suite on staging.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Promptfoo | Good for prompt comparison. Harder to exercise the whole pipeline with state and validators. Could supplement this later |
| Hosted evaluation (Langfuse, Braintrust and others) | Useful dashboards, but scoring safety logic should stay in-repo; adds a vendor. May be added for reporting |
| Ragas or similar | Useful retrieval metrics, but LLM-judged; could inform non-critical metrics |
| Unit tests only | Can't capture model behaviour |
| LLM judge for everything | Unacceptable for safety-critical checks |

## Benefits

Uses the code that actually ships. No lock-in. Gates can be exact. Safety cases sit next to the code.

## Trade-offs

Building and maintaining a runner and dashboard takes effort. Live runs cost money. Results vary, so repeated runs are needed. Writing 235 good cases is the largest piece of work, and clinical review may be slow.

## Security implications

CI needs provider keys, limited to staging. Datasets must never contain secrets. Baseline changes are audited, since weakening a gate would be a serious change.

## Privacy implications

Synthetic data only. Production cases need de-identification and approval.

## Consequences

Each prompt, policy, model or knowledge change must pass a run. A small benchmark can't prove real-world safety, and reports must say so.

## Future reconsideration conditions

If runner upkeep exceeds value, or an external tool can exercise the full pipeline and fits the data rules.
