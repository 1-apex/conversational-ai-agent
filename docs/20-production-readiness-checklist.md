# 20 — Production Readiness Checklist

**Assessed: 2026-11-04, commit `ef361c0`; updated 2026-11-05 for Phase 0 on branch `phase-0-risk-reduction`. Overall status: NOT approved for real callers.** The only status reached is partial Development-ready.

## Readiness statuses

| Status | Meaning | Current |
| --- | --- | --- |
| Development-ready | Builds, lints, tests, documented setup | **Partial:** builds, typechecks and lints with 5 warnings; README rewritten; no tests |
| Feature-complete | Phases 1–5 implemented | No |
| Security-reviewed | Controls implemented and independently tested | No |
| AI-evaluation-ready | Benchmark approved, gates active | No |
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
| Lint passes | **PASS** | `eslint` on 2026-11-05: exit 0, 0 errors, 5 `exhaustive-deps` warnings remain |
| Live end-to-end call works | NOT VERIFIED | Not run; no keys |
| Dashboard figures are correct | FAIL | Total capped at 100; time zone mix; substring sentiment |
| Brief fallbacks work | FAIL | Rule brief entities always empty; provider failure doesn't fall back |

### Automated testing

| Item | Status | Evidence or reason |
| --- | --- | --- |
| Unit and integration tests | FAIL | None exist |
| End-to-end tests | FAIL | None exist |
| CI | FAIL | No `.github/` directory |
| Security tests | FAIL | None exist |

### Critical safety

| Item | Status | Evidence or reason |
| --- | --- | --- |
| Emergency pathway | PARTIAL | Interim phrase check only, `lib/emergency-offramp.ts`; misses indirect wording; not reviewed |
| Medical boundary enforcement | FAIL | Prompt instructions only |
| Output validation | FAIL | Raw model text is spoken |
| AI identity honesty | PARTIAL | Fixed disclosure and banner in code; truthful answers depend on the model and are untested live |
| No false human-connection claims | PARTIAL | Transfer wording fixed; the model could still imply a person, since output isn't validated |
| Approved caller scripts | FAIL | None; no clinical reviewer |
| Knowledge accuracy | FAIL | Four contradicted claims corrected; rest unverified |

### Evaluation thresholds

| Item | Status | Evidence or reason |
| --- | --- | --- |
| Benchmark exists | FAIL | None |
| Thresholds approved | FAIL | Proposed only |
| Regression gates | FAIL | None |
| Clinical review of cases | FAIL | None |

### Authentication and authorization

| Item | Status | Evidence or reason |
| --- | --- | --- |
| Staff authentication | FAIL | Absent |
| Server-side RBAC | FAIL | Absent |
| Session expiry and revocation | FAIL | Absent |
| Record-level and tenant scoping | FAIL | Absent |
| Rate limiting across all routes | PARTIAL | 3 of 5 routes; spoofable key on some hosts |

### Audit logging

| Item | Status | Evidence or reason |
| --- | --- | --- |
| Security events logged | FAIL | Absent |
| Tamper protection | FAIL | Absent |

### Data protection

| Item | Status | Evidence or reason |
| --- | --- | --- |
| No secrets in git history | PARTIAL | On 2026-11-04, no `.env` file ever added, and a pattern scan of history for common key formats found 0 matches. A pattern scan can't prove absence, so run a dedicated scanner in CI |
| Encryption in transit | NOT VERIFIED | Deployment unknown |
| Encryption at rest | NOT VERIFIED | Provider plan unknown |
| Retention and deletion | FAIL | Absent |
| Caller notice | PARTIAL | Demo banner and spoken disclosure; no reviewed consent process |
| PII and PHI minimisation | PARTIAL | Prompts no longer ask for health or contact details; nothing filters what callers say |
| Security headers | PARTIAL | `next.config.ts` sets several; no CSP or HSTS |
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
| Plan and runbooks | PARTIAL | Outline in [`14`](14-deployment-and-operations.md); no runbooks |
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
| Tracing, metrics, alerts | FAIL | Absent |
| Health checks | FAIL | Absent |

### Human escalation

| Item | Status | Evidence or reason |
| --- | --- | --- |
| Escalation queue | FAIL | Absent |
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
