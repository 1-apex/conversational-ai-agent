# 14 — Deployment and Operations

**Status: Proposed. Vercel is confirmed as the host:** production deploys from `main` to `conversational-ai-agent-ten.vercel.app`, and pull requests get preview deployments. This plan adds no new infrastructure.

Diagrams: [`deployment-architecture.mmd`](diagrams/deployment-architecture.mmd), [`ci-cd-pipeline.mmd`](diagrams/ci-cd-pipeline.mmd), [`incident-response.mmd`](diagrams/incident-response.mmd).

## Environments

| | Development | Staging | Production |
| --- | --- | --- | --- |
| Data | Synthetic | Synthetic | Pilot only after approval |
| `DATA_MODE` | `synthetic` | `synthetic` | `synthetic` until sign-off |
| Database | Neon branch | Separate Neon project | Separate Neon project |
| Provider keys | Developer, low limits | Staging | Production, contract-checked |
| Access | Developer | Team, behind login | Public caller page plus staff login |
| Secrets | `.env` (ignored by git) | Host environment store | Host environment store, restricted |

Credentials are never shared between environments.

## Standing rule

The production deployment is public and has no database, so no call data is exposed. Don't set `DATABASE_URL` on a public deployment until staff auth exists, because `/dashboard` and the call APIs have no login. See the [decisions](17-implementation-roadmap.md#decisions-needed).

## Release flow

1. PR: lint, types, unit, integration, offline safety, build, end-to-end.
2. Merge, deploy to staging, run migrations, run live evaluations.
3. Gates pass: a person approves.
4. Production deployment behind feature flags.
5. Smoke tests and health checks; roll back on failure.

## Feature flags

Environment-based at first, to avoid a new vendor. Required kill switches:

`CALLS_ENABLED`, `AGENT_GENERATION_ENABLED` (off means scripts only), `TTS_ENABLED`, `POST_CALL_LLM_ENABLED`, `TRACE_EXPORT_ENABLED`.

No flag can disable input safety or output validation. Flags change behaviour only in the safer direction.

## Health checks

`GET /api/health` is public and returns only an overall status. `GET /api/health/details` requires staff access and covers database, Redis, migration version, and last provider success times. It doesn't call paid providers on each request.

## Provider strategy

| Provider down | Behaviour |
| --- | --- |
| LLM | Retry within latency budget, approved secondary if allowlisted, otherwise approved fallback and callback offer |
| TTS | Show text; local browser voice only |
| STT | Tell the caller; offer typed input. No switch to an unreviewed service |
| Database | New calls are refused with an approved message and a verified contact route; the emergency script still works |
| Redis | Fall back to an in-memory limiter with conservative limits; alert |
| Observability | Calls continue; export is dropped |

Fallback never skips safety and never introduces an unapproved provider. See [`sequence-provider-failure.mmd`](diagrams/sequence-provider-failure.mmd).

## Voice reliability

| Topic | Current | Proposed |
| --- | --- | --- |
| STT provider | Web Speech, Chrome and Edge in practice | Keep for synthetic mode; choose a BAA-covered server STT for PHI ([ADR-009](adr/ADR-009-voice-pipeline.md)) |
| Unsupported browser | Silent failure | Detect and show a message and typed input |
| Mic permission denied | Retries every 400 ms silently | Explicit state with instructions |
| Echo | Word-overlap filter | Keep; measure false interruptions; consider echo cancellation settings |
| Silence | One check-in | Keep; add a max-duration closing script |
| Product names | Regex corrections | Keep, test and track correction rate; provider keyword hints if a server STT supports them |
| Numbers | No special handling | **High-risk figures need structured values from documents, validated before formatting for speech** |
| TTS timeout | 4 s, then browser voice | Keep timeout; restrict to local voices |

A safety-relevant number should come from an approved document field and be validated before it is converted for speech. Pronunciation of numbers should be tested for each voice.

## Load testing

Before a pilot: concurrent calls on staging with mocked providers, then a small run with real ones within their limits. Check connection limits, provider rate limits and turn latency. Targets depend on the expected call volume, which is an open question.

## Operational requirements

These need named people, and code cannot supply them:

| Role | Responsibility | Assigned? |
| --- | --- | --- |
| Service owner | Overall accountability | No |
| Clinical safety owner | Scripts, boundaries, emergency policy | No |
| Privacy or security officer | Risk analysis, contracts, breach process | No |
| On-call engineer | Alerts and incidents | No |
| Support operations lead | Queue staffing and hours | No |
| Knowledge owner | Document accuracy and approval | No |

## Incident response

Severity levels:

- **SEV1:** possible patient harm, PHI exposure, or a safety bypass.
- **SEV2:** major outage or a widespread wrong answer.
- **SEV3:** partial degradation.

Process: detect, triage, contain (flags off, revoke keys), investigate, notify owners where a breach or harm is possible, remediate, validate with the evaluation suite, add a regression case, and hold a blameless review. Whether something counts as a reportable breach, and any notification deadlines, are decided by privacy and legal owners. Runbooks are needed for: unsafe reply reported, PHI in logs, key leak, provider outage, and bad knowledge document.

## Rollback

Application: redeploy the previous build. Database: forward-fix with expand-then-contract, so an old build still works with the new schema. Knowledge: restore the previous version status. Prompt and policy: pin the previous version, then re-evaluate.

## Cost controls

Per-call turn and duration limits, provider spending alerts, and server-side tracking of TTS characters to replace the browser-only quota display.
