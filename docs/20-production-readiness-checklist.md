# 20 — Production Readiness Checklist

**Assessed: 2026-11-04, commit `ef361c0`; updated 2026-11-05 for the work on branch `platform-phases` (not deployed). Overall status: NOT approved for real callers.** Development-ready for local use; nothing beyond that.

## Readiness statuses

| Status | Meaning | Current |
| --- | --- | --- |
| Development-ready | Builds, lints, tests, documented setup | **Yes, for local use:** builds, lints, 244 tests and 12 browser journeys pass, and setup is documented |
| Feature-complete | Phases 1–5 implemented | **Mostly:** see [implementation status](implementation-status.md). Legacy knowledge isn't retired |
| Security-reviewed | Controls implemented and independently tested | No |
| AI-evaluation-ready | Benchmark approved, gates active | **Partial:** benchmark and gates exist. No live run, and nothing clinically reviewed |
| Operationally-ready | Owners, on-call, restore and incident drills | No |
| Pilot-ready | All of the above, plus limited-pilot approval | No |
| Production-approved | Signed off by named owners | No |

Each status requires the one before it. Passing a build doesn't advance any status beyond Development-ready.

**Scope note (2026-11-05):** this is an independent demo, so Pilot-ready and Production-approved are out of scope. Organizational and contractual items below stay FAIL or NOT VERIFIED, as a record of what a real operator would need.

## Checklist

Allowed values: PASS, FAIL, PARTIAL, NOT VERIFIED, NOT APPLICABLE. Every PASS cites evidence.

### Functional correctness

| Item | Status | Evidence or reason |
| --- | --- | --- |
| Production build succeeds | **PASS** | `next build` on 2026-11-05 compiled with Next.js 16.4.5 |
| TypeScript passes | **PASS** | `tsc --noEmit` on 2026-11-05: no errors |
| Lint passes | **PASS** | `eslint` on 2026-11-05: exit 0, 0 errors, 10 warnings |
| Live end-to-end call works | NOT VERIFIED | Not run; no keys |
| Dashboard figures are correct | PARTIAL | SQL totals and UTC dates, tested by integration tests. Sentiment is still a labelled heuristic |
| Brief fallbacks work | PARTIAL | Provider failure now falls through, tested with mocks; rule brief entities are still always empty |

### Automated testing

| Item | Status | Evidence or reason |
| --- | --- | --- |
| Unit and integration tests | PARTIAL | 244 tests pass, on real Postgres via PGlite. Not run against Neon |
| End-to-end tests | PARTIAL | 12 Playwright journeys pass on the production build. Real speech and models are stubbed |
| CI | PARTIAL | `.github/workflows/ci.yml` added, but hasn't run yet |
| Security tests | PARTIAL | Unauthorized, cross-tenant, privilege, token forgery, input abuse and leakage tests pass. No independent test |

### Critical safety

| Item | Status | Evidence or reason |
| --- | --- | --- |
| Emergency pathway | PARTIAL | Engine, lock, offline message and tests. Phrase-based, unreviewed, classifier untested live |
| Medical boundary enforcement | PARTIAL | Input and output rules with tests. Unreviewed, and untested on a real model |
| Output validation | PARTIAL | Deterministic validator on every reply. Non-numeric claims aren't checked |
| AI identity honesty | PARTIAL | Fixed disclosure and banner in code; truthful answers depend on the model and are untested live |
| No false human-connection claims | PARTIAL | Transfer wording fixed, and a validator rule blocks such claims. Untested on a real model |
| Approved caller scripts | FAIL | None; no clinical reviewer |
| Knowledge accuracy | FAIL | Four contradicted claims corrected; rest unverified |

### Evaluation thresholds

| Item | Status | Evidence or reason |
| --- | --- | --- |
| Benchmark exists | **PASS** | 235 cases in `lib/evaluations/dataset.ts`; count enforced by a test. All are drafts, unreviewed |
| Thresholds approved | FAIL | Proposed only |
| Regression gates | PARTIAL | Critical failures block, and a test proves it. Not yet run in CI |
| Clinical review of cases | FAIL | None |

### Authentication and authorization

| Item | Status | Evidence or reason |
| --- | --- | --- |
| Staff authentication | PARTIAL | Custom sessions, tested. No MFA, no independent review, not enabled in production |
| Server-side RBAC | **PASS** | `tests/db-integration.test.ts`: 401 and 403 per role; `tests/route-guards.test.ts` fails any unguarded route |
| Session expiry and revocation | **PASS** | `tests/db-integration.test.ts`: idle and absolute expiry, logout and admin revocation |
| Record-level and tenant scoping | PARTIAL | Application-level with cross-organization tests. No row-level security |
| Rate limiting across all routes | PARTIAL | All 5 routes, enforced by a test. In-memory unless Upstash is set, so limits are per instance on Vercel |

### Audit logging

| Item | Status | Evidence or reason |
| --- | --- | --- |
| Security events logged | **PASS** | `tests/db-integration.test.ts`: logins, denied access, transcript reads, approvals |
| Tamper protection | PARTIAL | Triggers block changes and a hash chain detects them, both tested. A database owner could still bypass them |

### Data protection

| Item | Status | Evidence or reason |
| --- | --- | --- |
| No secrets in git history | PARTIAL | On 2026-11-04, no `.env` file ever added, and a pattern scan of history for common key formats found 0 matches. A pattern scan can't prove absence, so run a dedicated scanner in CI |
| Encryption in transit | NOT VERIFIED | Deployment unknown |
| Encryption at rest | NOT VERIFIED | Provider plan unknown |
| Retention and deletion | PARTIAL | Job tested; periods provisional; backups not covered |
| Caller notice | PARTIAL | Demo banner and spoken disclosure; no reviewed consent process |
| PII and PHI minimisation | PARTIAL | Prompts no longer ask for health or contact details; nothing filters what callers say |
| Security headers | PARTIAL | CSP and HSTS added and verified on a local production build; the CSP allows inline scripts |
| Dependency vulnerabilities | PARTIAL | 2026-11-05: 0 critical or high; `--omit=dev` reports 0; 8 moderate in dev-only lint tooling. No CI policy yet |

### Vendor and contractual

**Code cannot satisfy any of these.**

| Item | Status | Evidence or reason |
| --- | --- | --- |
| BAA with each PHI processor | FAIL | None known. Availability noted in the [vendor assessment](security/vendor-assessment.md) |
| Provider retention settings confirmed | NOT VERIFIED | No account access |
| STT provider approved | FAIL | Web Speech unsuitable for PHI by default |
| Data residency reviewed | NOT VERIFIED | |

### Incident response

| Item | Status | Evidence or reason |
| --- | --- | --- |
| Plan and runbooks | PARTIAL | [Runbooks](runbooks.md) written, never exercised |
| On-call owner | FAIL | None |
| Tabletop exercise | FAIL | Not done |

### Backup and recovery

| Item | Status | Evidence or reason |
| --- | --- | --- |
| Backup configured | NOT VERIFIED | No account access |
| Restore tested | FAIL | Never done |

### Monitoring

| Item | Status | Evidence or reason |
| --- | --- | --- |
| Tracing, metrics, alerts | PARTIAL | Allowlisted logs and an Operations panel. No tracing or alerts |
| Health checks | **PASS** | `/api/health` and `/api/health/details`, in the route guard test |

### Human escalation

| Item | Status | Evidence or reason |
| --- | --- | --- |
| Escalation queue | PARTIAL | Built and tested end to end, as a practice queue |
| Staffed support path | FAIL | Absent |
| Live telephony | NOT APPLICABLE | Out of scope until an integration exists |

### Operational ownership

| Item | Status | Evidence or reason |
| --- | --- | --- |
| Service, clinical, privacy, knowledge and support owners | FAIL | None named |

### Regulatory and privacy review

**Legal and organizational determinations. Code cannot mark these PASS.**

| Item | Status | Evidence or reason |
| --- | --- | --- |
| HIPAA applicability determined | NOT VERIFIED | Counsel needed |
| HIPAA risk analysis | FAIL | Not performed by the responsible entity. [Risk assessment](security/risk-assessment.md) is engineering input |
| Recording and AI disclosure review | NOT VERIFIED | Counsel needed |
| Medical device regulatory review | NOT VERIFIED | Regulatory review needed |
| Authorization to represent the company | FAIL | None: independent demo, per [decision D1](17-implementation-roadmap.md#decisions-needed). The app must not present itself as Inogen. T0.1 and T0.6 address this in code, and a real company's name is still used |

## Sign-off

Nothing below has been signed. A person must sign each one, and engineering cannot sign on their behalf.

| Role | Name | Decision | Date |
| --- | --- | --- | --- |
| Service owner | | | |
| Clinical safety | | | |
| Privacy and security | | | |
| Legal | | | |
| Operations | | | |
