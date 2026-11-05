# 17 — Implementation Roadmap

**Status: Proposed, awaiting your review. No application code has been changed.** There are no dates, because scope depends on the decisions below. Complexity is relative: S, M, L, XL.

**Recommended order: first stop callers from being misled and data from being exposed (Phase 0), then build foundations, then safety.** Phase 0 is added to your six phases because several P0 fixes are small and shouldn't wait for the larger work.

## Decisions needed

Ordered by how much they block.

| # | Decision | Why it matters | Safe default if unanswered |
| --- | --- | --- | --- |
| D1 | **Resolved 2026-11-05: independent demo, not authorized by Inogen.** See [effect of this decision](#effect-of-the-independent-demo-decision) | Sets clinical and legal ownership, sources, BAAs, and how the app may present itself | — |
| D2 | **Is any deployment live or public, and does any database hold real caller data?** | If so, R-03 is an active exposure | Assume yes until checked; you confirm, since I have no access |
| D3 | Existing `calls` data: migrate, export or delete? | Deletion is irreversible | Leave untouched; do not migrate |
| D4 | Who are the clinical, privacy and operational owners? | Scripts and policies can't be approved without them | Scripts stay marked NOT APPROVED, so `phi_approved` can't be turned on |
| D5 | Staff authentication approach | [ADR-008](adr/ADR-008-authentication.md) | Auth.js with database sessions |
| D6 | Single-organization or multi-tenant? | Scope | Single organization, with `organization_id` scoping |
| D7 | Migration tool | [ADR-010](adr/ADR-010-database-access-and-migrations.md) | Drizzle |
| D8 | STT for PHI | [ADR-009](adr/ADR-009-voice-pipeline.md) | Web Speech in synthetic mode only; decide later |
| D9 | Retention periods | [`19`](19-data-governance.md) | Short provisional period in non-production |
| D10 | Observability backend | [ADR-006](adr/ADR-006-observability.md) | App-level SQL views and redacted logs; no external backend |

### Effect of the independent-demo decision

The goal is now to demonstrate production-grade engineering on synthetic data. It is not to prepare for real patients.

| Area | Effect |
| --- | --- |
| Identity | The app must not present itself as Inogen. It says it is an unaffiliated demo, and prompts drop "you are Inogen" and "we" and "our" |
| Real contact details | Phone numbers and email addresses are removed from the knowledge base, so nobody is sent to a real line by a demo |
| Real callers | Out of scope. `DATA_MODE` stays `synthetic`, and `phi_approved` is not part of this project |
| Readiness | Target is AI-evaluation-ready, with the operational items demonstrated. Pilot-ready and Production-approved are out of scope |
| BAAs and vendor contracts | Not pursued. The vendor assessment stays as a record of what a real operator would need |
| Clinical and legal review | No reviewer exists, so all scripts stay marked NOT APPROVED and safety results can't be presented as clinically validated |
| Knowledge sources | Public pages may be used, each recorded with its URL and retrieval date and labelled as unverified by the manufacturer |
| Phase 6 | T6.3 and T6.7 are dropped. Adversarial, load, restore and incident exercises stay, as engineering demonstrations |
| Name and trademark | The project name is kept for now. Before any public demo or publication, reconsider a fictional brand and take advice if needed |

## Credentials and external needs

| Need | Required for | Phase |
| --- | --- | --- |
| Neon database (dev branch and staging) | Migrations, integration tests | 1 |
| `GROQ_API_KEY`, `ELEVENLABS_API_KEY` (non-production) | Live evaluation, manual voice checks | 1–3 |
| `ANTHROPIC_API_KEY` (optional) | Brief extraction, judge | 3, 5 |
| Upstash (optional) | Shared rate limits | 1 |
| GitHub Actions access and secrets | CI gates | 1, 3 |
| Host project access | Staging, environment separation | 1 |
| Official documents | Knowledge base and product evaluations | 4 |
| Clinical reviewer | Scripts, emergency lexicon, medical cases | 2, 3 |
| Legal and privacy counsel | HIPAA applicability, consent, disclosure | Before any real caller |
| BAAs and vendor reviews | Any PHI | 6 |
| Support staff | Queue pilot | 5, 6 |

## P0 order

| Order | Fix | Why first | Phase task |
| --- | --- | --- | --- |
| 1 | Confirm and restrict any live deployment | An active exposure outranks everything | D2 |
| 2 | Remove AI denial; correct contradicted knowledge lines; honest transfer wording; emergency placeholder off-ramp | Small changes that stop active misleading | T0.1–T0.4 |
| 3 | Patch `next` | Known critical advisory | T0.5 |
| 4 | Authenticate staff routes | Stops data exposure | T1.4–T1.5 |
| 5 | Validation, server-held state, turn-ID speech | Removes client control | T1.3, T1.7 |
| 6 | Notice, retention, synthetic mode | Stops unmanaged data accumulation | T0.6, T1.8 |
| 7 | Safety engine and output validation | Needs server-side state in place first | T2.1–T2.5 |
| 8 | RAG replaces the knowledge string | Needs documents and an evaluation harness | Phase 4 |

## Phase 0: Immediate risk reduction

Small and easily reviewed, with no new architecture.

**Status: implemented 2026-11-05 on branch `phase-0-risk-reduction`, not yet merged. Not tested with a live model or a real microphone, because no provider keys were available and the test browser blocks the mic.** Results are in the [audit](01-repository-audit.md#9-remediation-since-this-audit). T0.4 was checked with a throwaway script, not a committed test, because the test runner arrives in T1.1.

| Task | Priority | Depends on | Files | Implementation | Acceptance | Tests | Security note | Size |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T0.1 Remove AI denial and Inogen identity; add disclosure | P0 | — | `lib/agent-prompts.ts` | Delete line 20 and "you are Inogen"; greeting states it's an AI demo, not affiliated with Inogen | Asked "are you a robot?" or "is this Inogen?", it answers truthfully | Manual, then evaluation | Honesty | S |
| T0.2 Correct contradicted knowledge lines; remove real contact details | P0 | — | `lib/inogen-knowledge.ts` | Lines 35, 36, 57, 68; lines with phone numbers and email; add an "unverified" comment | No contradicted claim or real contact detail remains | Review | Accuracy | S |
| T0.3 Honest transfer | P0 | — | `components/CallStudio.tsx` | States that this demo has no live staff; promises no connection | No false claim | Manual | Honesty | S |
| T0.4 Interim emergency off-ramp | P0 | No reviewer available; wording stays NOT APPROVED | `app/api/agent/route.ts`, new small module | Minimal reviewed phrase check returning a fixed message, marked interim | Listed phrases skip the LLM | Unit | Not a safety guarantee | S |
| T0.5 Dependency patch | P0 | — | `package.json`, lockfile | Patched `next` and config; triage the rest | Audit critical cleared; build passes | Build, typecheck, lint | Reduces exposure | S |
| T0.6 Synthetic-data notice and non-affiliation banner | P0 | — | `components/CallStudio.tsx`, `app/layout.tsx` | Visible notice: demo, not for real health information, not an emergency service | Shown before calls | Manual | Reduces harm | S |
| T0.7 Cleanup with explanation | P2 | — | Dead files, README, `.env.example`, lint error | Remove unused code; rewrite README | Lint passes | Lint, build | — | S |

T0.4 is deliberately modest and may never be enough by itself. It's a stopgap until Phase 2.

## Phase 1: Engineering foundations

| Task | Priority | Depends on | Files | Implementation | Acceptance | Tests | Security note | Size |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T1.1 Test harness and CI | P1 | — | `vitest.config.ts`, `.github/workflows/` | Vitest, Playwright, lint, types, audit | CI runs on PRs | Self-check | Secret scan included | M |
| T1.2 Migrations and config | P1 | D7 | `lib/db/`, `lib/config/`, `db/migrations/` | Migrator; validated env; remove `ensureSchema` | Clean DB builds from migrations | Integration | Least-privilege roles | M |
| T1.3 Route wrapper | P0 | T1.1 | `lib/http/`, all routes | Validation, envelope, correlation ID | No route handles raw input; no upstream text leaks | Unit, integration | R-12, R-16 | M |
| T1.4 Staff auth and sessions | P0 | D5, T1.2 | `lib/auth/`, `app/login/` | Sessions, expiry, revocation | Unauthenticated returns 401 | Integration, E2E | R-03 | L |
| T1.5 RBAC and scoped queries | P0 | T1.4 | `lib/auth/`, repositories, `app/api/analytics`, `app/dashboard` | Permission map; org scope | Role matrix tests pass | Security | R-03 | M |
| T1.6 Audit log | P1 | T1.2 | `lib/audit/` | Append-only, hash chain | Events recorded, tamper detected | Integration | Protected role | M |
| T1.7 Server-held call state | P0 | T1.2, T1.3 | `app/api/calls/**`, `lib/conversation/`, `components/CallStudio.tsx` | Tokens, per-turn persistence, turn-ID speech; remove client history | Forged fields ignored; existing voice behaviour preserved | Integration, characterization | R-07, R-18 | L |
| T1.8 Retention and data mode | P0 | T1.2, D9 | `lib/config/`, job route | `DATA_MODE`, expiry job, deletion | Expired rows removed, logged | Integration | R-06 | M |
| T1.9 Logging and rate limits | P1 | T1.3 | `lib/observability/logger.ts`, `lib/rate-limit.ts` | Redacting logger; limits everywhere | Canary test passes | Unit, security | R-13, R-16 | M |
| T1.10 Security headers | P1 | — | `next.config.ts` | CSP, HSTS, testing with mic and streaming | Headers verified; call still works | E2E | R-21 | S |
| T1.11 Voice failure states | P1 | T1.1 | `components/` | Clear messages, typed input, local voices only | Unsupported browser shows message | E2E | R-14, R-19 | M |

## Phase 2: Safety infrastructure

| Task | Priority | Depends on | Files | Implementation | Acceptance | Tests | Security note | Size |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T2.1 Policy and types | P0 | D4 | `lib/safety/safety-policy.ts`, `safety-types.ts` | Versioned, with approval status | Refuses `phi_approved` if unapproved | Unit | LLM can't alter | M |
| T2.2 Input detectors | P0 | T2.1 | `lib/safety/*-detector.ts`, `intent-classifier.ts` | Deterministic plus raise-only classifier | Severity property test passes | Unit, offline suite | R-01 | L |
| T2.3 Engine and pipeline integration | P0 | T1.7, T2.2 | `lib/safety/safety-engine.ts`, `lib/conversation/pipeline.ts` | Before agents, sticky lock | CRITICAL never reaches an agent | Integration, E2E | No bypass path | M |
| T2.4 Agent contract and state machine | P0 | T2.3 | `lib/agents/`, `lib/conversation/state-machine.ts`, `router.ts` | Zod contract, matrix, cap, capabilities | Illegal transitions rejected; no raw text spoken | Unit, integration | R-07, R-08 | L |
| T2.5 Response validator | P0 | T2.4 | `lib/safety/response-validator.ts` | Deterministic rules, fallbacks | Each forbidden pattern blocked | Unit, offline suite | R-08 | M |
| T2.6 PII handling and safety events | P1 | T1.2 | `lib/safety/pii-detector.ts`, migrations | Minimise before providers; events without text | Canary values absent | Security | Not de-identification | M |
| T2.7 Prompt revision | P0 | T2.4 | `lib/agents/` | Versioned; changes per [`09`](09-agent-orchestration.md) | Solicitation removed | Offline | Reduces collection | S |

## Phase 3: AI evaluations

| Task | Priority | Depends on | Files | Implementation | Acceptance | Tests | Security note | Size |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T3.1 Schema and dataset | P1 | T2.x | `lib/evaluations/datasets/` | Versioned, hashed, 235 cases | Validates; clinical cases marked until reviewed | Schema test | Synthetic only | XL |
| T3.2 Runner and scorers | P1 | T3.1 | `lib/evaluations/` | Real pipeline; deterministic first | Run recorded with versions | Unit | Keys in CI secrets | L |
| T3.3 Judge | P2 | T3.2 | `lib/evaluations/judge.ts` | Quality only, calibrated | Not used for safety | Unit | Provider policy applies | M |
| T3.4 Gates | P0 | T3.2 | `.github/workflows/`, `lib/evaluations/gates.ts` | Critical regression blocks | Seeded failure blocks a PR | Integration | Baseline change audited | M |
| T3.5 Dashboard | P2 | T3.2, T1.5 | `app/evaluations/` | Real data only | Each metric explains itself | E2E | Staff only | M |

## Phase 4: Knowledge

| Task | Priority | Depends on | Files | Implementation | Acceptance | Tests | Security note | Size |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T4.1 Verify pgvector and embedding provider | P1 | D1 | ADR-004 | Spike, measure latency | Decision recorded | Spike | Data terms | S |
| T4.2 Schema and ingestion | P1 | T4.1, T1.5 | `lib/knowledge/`, migrations, `app/knowledge/` | Pipeline and approval | Second-person approval enforced | Integration | Upload attacks | L |
| T4.3 Hybrid retrieval | P1 | T4.2 | `lib/knowledge/retrieval.ts` | SQL filter, fusion, threshold | Unapproved chunks never returned | Unit, evaluation | Filter in SQL | M |
| T4.4 Grounding | P0 | T4.3, T2.5 | `lib/safety/response-validator.ts`, pipeline | Citations, numeric checks, limitation message | Unsupported facts blocked | Evaluation | R-04 | L |
| T4.5 Retire `inogen-knowledge.ts` | P0 | T4.4, documents | `lib/` | Remove after evaluations pass | No prompt embeds the string | Evaluation | — | S |

## Phase 5: Operations

| Task | Priority | Depends on | Files | Implementation | Acceptance | Tests | Security note | Size |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T5.1 Escalation and callback | P1 | T1.5, T2.3 | `lib/safety/escalation-manager.ts`, `app/support/`, `app/api/escalations/` | Queue per [`11`](11-human-escalation-workflow.md) | Lifecycle complete and audited | Integration, E2E | Contact encrypted | L |
| T5.2 Post-call intelligence | P1 | T2.4 | `lib/post-call/` | Schema, provenance, approved fallback | Inferences labelled | Unit, evaluation | R-25, R-26 | M |
| T5.3 Quality review | P1 | T5.2, T3.1 | `app/reviews/` | Correct, flag, propose case | No automatic production change | E2E | Access logged | M |
| T5.4 Tracing and dashboards | P1 | D10 | `lib/observability/` | OpenTelemetry, allowlist | Canary test; metrics live | Security | R-16 | M |
| T5.5 Analytics rebuild | P2 | T1.5 | `app/dashboard/` | SQL aggregates; fix KPIs and sentiment | Correct totals | Integration | R-23, R-24 | M |

## Phase 6: Production hardening

| Task | Priority | Depends on | Implementation | Acceptance | Size |
| --- | --- | --- | --- | --- | --- |
| T6.1 Adversarial testing | P1 | Phases 2–4 | Internal red team, plus external test if a pilot is approved | Findings tracked to closure | L |
| T6.2 Load and latency | P1 | Phases 1–5 | Staging runs | Budgets met or revised | M |
| T6.3 Provider and contract review | P0 | D1, D4 | BAAs signed, terms verified | Evidence on file | Organizational |
| T6.4 Backup and restore drills | P1 | T1.2 | Per [`15`](15-disaster-recovery.md) | Measured RTO and RPO | M |
| T6.5 Incident process and on-call | P1 | D4 | Runbooks, tabletop exercise | Exercise completed | M |
| T6.6 Accessibility and speech equity testing | P1 | T1.11 | Includes breathless speech (K-25) | Results reviewed by clinical owner | M |
| T6.7 Controlled pilot | P0 | All above | Limited group, human review of all calls | Go or no-go by named owners | Organizational |

## Working rules for each phase

Explain changes, list files, implement, add tests, update docs and diagrams, run lint, types and tests, and report actual results.
