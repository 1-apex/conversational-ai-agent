# Implementation Status

**As of 2026-11-05, on branch `platform-phases`, uncommitted, stacked on PR #2.** This is the single place that says what's real. Where another document describes something as a design, this file says whether it was built.

**This is still an independent demo on synthetic data. It isn't production-ready, HIPAA compliant or clinically validated, and nothing here changes that.**

## Verified results

Commands run on 2026-11-05 on Windows with Node 22.

| Check | Result |
| --- | --- |
| `npm test` | 244 of 244 pass, using a real Postgres (PGlite) for integration tests |
| `npm run test:e2e` | 12 of 12 pass, in Chromium against the production build |
| `npm run eval:offline` | 234 of 235, gate passes. **Model replies are scripted, so this tests the code, not a model** |
| `npm run typecheck`, `npm run build` | Pass |
| `npm run lint` | 0 errors, 10 warnings |
| `npm audit --omit=dev` | 0 vulnerabilities. The full audit lists 12 moderate, all in dev-only tooling |
| Load check, local | 50 calls, 250 requests, no errors. p95 166 ms. Scripted paths on an in-process database, so no provider latency is included |

**Never exercised:** a real model reply through the new pipeline, Groq's JSON mode, ElevenLabs audio under the new CSP, a real microphone, Neon, Upstash, Vercel Cron, the new CI jobs. [`testing-guide.md`](testing-guide.md) covers each.

## Status by phase

| Task | Status | Notes |
| --- | --- | --- |
| **Phase 0** | Deployed | PR #1 |
| T1.1 Tests and CI | Done | CI's `eval:offline` and Playwright steps haven't run yet |
| T1.2 Migrations | Done | Drizzle. Tested on PGlite only |
| T1.3 Route wrapper | Done | |
| T1.4 Staff auth | Done, differs | See deviation 1 |
| T1.5 RBAC and scoped queries | Done | All staff queries are organization-scoped. No row-level security |
| T1.6 Audit log | Done | Triggers block changes; hash chain verified |
| T1.7 Server-controlled call state | Done, differs | See deviation 2 |
| T1.8 Retention | Done | Provisional periods. Daily cron configured, not exercised |
| T1.9, T1.10, T1.11 | Done | |
| T2.1 Policy | Done | No script is approved, because no reviewer exists |
| T2.2 Detectors and classifier | Done | Classifier untested against the real API |
| T2.3 Engine in pipeline | Done | |
| T2.4 Contract, state machine | Done | |
| T2.5 Response validator | Done | Known gap: a real figure from the wrong product passes |
| T2.6 PII handling, safety events | Done | Regex only; doesn't catch names or spoken digits |
| T2.7 Prompt revision | Done | Versioned by hash |
| T3.1 Benchmark | Done | 235 cases, all marked draft. Product cases use an invented corpus |
| T3.2 Runner | Done | Live tier never run |
| T3.3 Judge | Built, not run | Scores are labelled uncalibrated |
| T3.4 Gates | Done | Critical failures block. Baseline promotion is manual |
| T3.5 Dashboard | Done | Real runs only, no sample data |
| T4.1 pgvector check | Partial | Works on PGlite. Not verified on Neon. No embedding provider chosen |
| T4.2 Ingestion and approval | Done, text only | No PDF. Second-person approval is also a database constraint |
| T4.3 Hybrid retrieval | Done | Vector search tested with a fake embedder |
| T4.4 Grounding | Done | Numbers with units and citations. Non-numeric claims aren't checked |
| T4.5 Retire legacy knowledge | **Not done** | Default is still `legacy`. Needs real documents and a live evaluation |
| T5.1 Escalation and callback | Done | Practice queue. No on-call alerting |
| T5.2 Post-call intelligence | Done | Provenance labels on fields |
| T5.3 Quality review | Done | Proposed cases wait for a person; nothing changes automatically |
| T5.4 Observability | Partial | See deviation 4 |
| T5.5 Analytics rebuild | Done | SQL totals; UTC dates; sentiment labelled a heuristic |
| T6.1 Adversarial testing | Partial | Security tests and a benchmark. No independent review |
| T6.2 Load | Partial | Local check only |
| T6.3, T6.7 | Dropped | Out of scope for a demo |
| T6.4 Backup and restore | **Not done** | Needs Neon |
| T6.5 Incident process | Partial | [Runbooks](runbooks.md) written. No on-call, no exercise |
| T6.6 Accessibility, speech equity | Partial | Typed input added. No audit, and breathless speech is untested |

## Where the build differs from the design

Earlier documents describe the original proposal. These are the changes, and why.

1. **Custom sessions instead of Auth.js.** Auth.js's password provider doesn't support revocable database sessions, and no identity provider or email service exists here. So [`lib/auth/sessions.ts`](../lib/auth/sessions.ts) uses `node:crypto` scrypt and hashed random tokens. It's small and tested, but it hasn't had an independent review, it has no MFA, and hand-written auth is a known risk. Use a real identity provider for anything beyond this demo. [ADR-008](adr/ADR-008-authentication.md) is updated.
2. **Signed call state instead of database-only.** The call state travels in an HMAC-signed token, with the database as a second check when one exists. This keeps the live site working with no database. The limit: without a database, replaying an old token can get back behind an emergency lock, because there's nothing to compare against.
3. **Speech tokens instead of turn IDs.** `/api/tts` takes a signed token holding the validated text. The effect is the same: only validated text can be spoken.
4. **Lighter observability.** Structured allowlisted logs, correlation IDs, per-turn timings in the database, and an Operations panel on the dashboard. **OpenTelemetry and external tracing weren't added**, in line with the no-external-tracing default.
5. **Fewer tables.** Prompts and policies are versioned in code, with their version stored on each turn. Datasets are versioned in git. So `agent_prompts`, `safety_policies`, `evaluation_datasets` and `evaluation_cases` don't exist, and `roles` is a code constant.
6. **No real-data mode.** `DATA_MODE` can only be `synthetic`, following the independent-demo decision.

## Not built

- Feature flags and kill switches from [`14`](14-deployment-and-operations.md)
- Least-privilege database roles and row-level security. One credential is used
- Encryption keys in a key manager. The callback key is derived from an app secret
- Refactoring `CallStudio.tsx` into hooks. It works, but it's still large
- On-call alerting. Emergency and P1 items only appear in the queue
- A staging environment, beyond Vercel previews
- Live telephony, on purpose

## Limits worth remembering

- **Safety detection is phrase matching plus an untested classifier.** It will miss things. The benchmark's 25 emergency cases can't show otherwise, and I wrote both the rules and the tests, so they share blind spots.
- **Every caller-facing script is unapproved.** No clinician or lawyer has seen them.
- **Passing the gate means the code does what I intended.** It doesn't mean a real caller would be safe.
