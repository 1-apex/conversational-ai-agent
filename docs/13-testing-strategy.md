# 13 — Testing Strategy

**Status: Proposed. The repository has no tests today.**

**Test the safety rules hardest, and test them without network access, so they can run on every pull request.** Tools: Vitest for unit and integration, Playwright for end-to-end, and the [evaluation system](07-ai-evaluation-framework.md) for AI behaviour.

## Layers

| Layer | Tool | Needs keys? | Runs |
| --- | --- | --- | --- |
| Unit | Vitest | No | Every PR |
| Integration | Vitest, Neon branch or local Postgres, mocked providers | No provider keys | Every PR |
| Offline safety suite | Vitest over benchmark inputs | No | Every PR |
| End-to-end | Playwright with mocked speech and providers | No | Every PR |
| Live AI evaluation | Evaluation runner | Yes | Staging, on demand |
| Security | Vitest, Playwright, scanners | No | Every PR, plus scheduled |
| Load | To be selected | Staging only | Before pilot |

## Unit tests

| Area | Examples |
| --- | --- |
| Safety classification | Severity per category; maximum-severity combination |
| Emergency rules | Lexicon matches, STT-garbled variants, third-party statements, conservative negation handling |
| Severity monotonicity | Property test: no layer ever lowers severity |
| PII detection | Phones, emails, DOB in spoken forms; known limitations documented with tests |
| Routing | Each rule; handoff matrix; handoff cap; emergency lock |
| State transitions | Every allowed pair passes, and every other pair is rejected |
| Output validation | Each forbidden pattern; numeric grounding; AI-denial; false connection claims |
| Retrieval filters | Unapproved, expired and retired chunks are excluded |
| Data validation | All route schemas, including oversized input |
| Rate limiting | Limits, window reset, eviction, key derivation |
| Regression tests for audit findings | Substring sentiment ("insurance"), truncated JSON never spoken, rule brief entities, `toSpeakable` |

## Integration tests

Agent turn API, speech API (rejects unvalidated or foreign turn IDs), extraction, database repositories and migrations, authentication, authorization, escalation workflow, RAG retrieval, and the evaluation runner. Mocked providers cover timeouts, 429s, 5xx, malformed JSON and truncated JSON.

## AI evaluations

Product hallucinations, medical boundaries, emergency scenarios, prompt injection, wrong agent selection, unsupported knowledge and refusal consistency. These live in the evaluation system, not in unit tests, because live model results vary.

## Security tests

| Threat | Test |
| --- | --- |
| Unauthorized API access | Every staff route returns 401 with no session. A test enumerates routes, so a new route without an access rule fails CI |
| Cross-user access | Support agent cannot read an unassigned transcript |
| Cross-tenant access | A second organization's fixtures return 404 |
| Call token misuse | Token for call A rejected on call B and on staff routes |
| Privilege escalation | Role changes blocked; own-upload approval blocked |
| Input abuse | Oversized bodies, deep JSON, unicode tricks, forged history fields ignored |
| Prompt injection | Direct, through history, and through documents |
| Sensitive data leakage | Canary values never reach logs, traces or error responses |
| Rate limit bypass | Forged `x-forwarded-for` values |
| Document ingestion attacks | Wrong type, oversized, hidden instructions, malformed PDFs |
| Dependencies and secrets | `npm audit` policy, secret scan |

## End-to-end journeys

Mocked STT and TTS, synthetic data:

- Product question answered with citation
- Handoff to a specialist
- Medical question leading to boundary script and escalation
- Emergency phrase leading to script and locked agents, including with the network down
- Human request leading to callback, and support staff resolving it
- STT unsupported or mic denied, showing a clear message and typed input
- Staff login, role limits, and audit trail
- Document upload, second-person approval, and retrieval

Real browser speech cannot run reliably in CI, so manual voice checks remain on a release checklist: barge-in, echo, noisy room, and product names.

## Test data

**Synthetic only.** No real patient data. Canary values are obviously fake. Any later use of production-derived examples needs de-identification, approval and a separate review.

## Coverage expectations

Use coverage as a gap-finder and not as a goal. `lib/safety`, `lib/auth` and `lib/conversation/state-machine` should reach near-complete branch coverage, enforced in CI. Everything else has no fixed target.

## Migration approach

Before moving code out of `CallStudio.tsx` or changing a route, write characterization tests around current behaviour. Then extract. This protects the tuned voice behaviour.

## Reporting rule

Phase reports list commands run and real results. A failing test is reported, never skipped silently. Any skip needs a linked reason and owner.
