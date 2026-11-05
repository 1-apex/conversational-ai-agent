# Security Architecture

**Status: Proposed.** Diagram: [`../diagrams/security-boundaries.mmd`](../diagrams/security-boundaries.mmd). Current state: every route is public, and the browser is trusted for state.

## Trust zones

| Zone | Contents | Trust | Key rule |
| --- | --- | --- | --- |
| Public internet | Caller browsers, any client | None | Everything is validated and rate limited |
| Staff browsers | Authenticated staff | Partial | Session and permission checked on every request |
| Application | Route handlers, safety engine, pipeline | Trusted code | Each route declares its access rule |
| Sensitive data | Postgres, audit log | Restricted | Least-privilege roles; scoped queries |
| External processors | LLM, STT, TTS, observability | Contract-dependent | Reached only through the policy gate |
| Untrusted content | Transcripts, documents, model output | None | Treated as data, even after approval |

## Threat model highlights

| Threat | Current | Control after the plan |
| --- | --- | --- |
| Reading others' call data | Open endpoint | Sessions, RBAC, scoping, audit |
| Forged call state | Accepted | Server-held state |
| Using `/api/tts` as a free TTS service | Possible | Validated turn IDs |
| Spend attack on LLM routes | Rate limit by IP only | Tokens, per-call limits, spend alerts |
| Direct or indirect prompt injection | Unmitigated | Capabilities, validator, delimiting, tests |
| Malicious upload | Not applicable yet | Allowlist, size limits, no execution, scanning, review |
| XSS leading to data theft | React escaping; no CSP | Add CSP; never render model HTML |
| Stolen staff session | Not applicable yet | HttpOnly cookies, expiry, revocation, MFA |
| Insider misuse | Not applicable yet | Assignment limits, audit review |
| Supply chain | 21 advisories | Patch, audit gate, lockfile, secret scanning |
| Audit tampering | No audit | Insert-only role, hash chain |

## Request authorization

Unauthorized flow: [`../diagrams/sequence-unauthorized-request.mmd`](../diagrams/sequence-unauthorized-request.mmd). Next.js route protection isn't relied on by itself, and page-level redirects are only for convenience. The data-returning handler always authorizes. A CI test enumerates routes and fails on any route without an access rule.

## Secrets

Environment variables by environment, restricted access, a rotation procedure, and CI secret scanning. Provider keys are never sent to the browser, and logs never include them. `NEXT_PUBLIC_` variables hold no secrets.

## Encryption

| Layer | Approach | Status |
| --- | --- | --- |
| Browser to app | TLS and HSTS | Partial: depends on host |
| App to providers and database | TLS | Partial: verify configuration |
| At rest | Provider encryption; confirm per plan | Organizational |
| Callback numbers | Application-level field encryption | Planned |
| Backups | Encrypted, separate access | Planned |

## HTTP headers

Keep: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`. Add: a CSP compatible with blob and media-source audio, and HSTS. `X-XSS-Protection` is obsolete, and modern guidance is to remove it. Test header changes against a real voice call, because a strict CSP can break streaming playback.

## Verification

Security test suite ([`../13-testing-strategy.md`](../13-testing-strategy.md)) on every PR, an independent penetration test before a pilot, and quarterly access reviews.
