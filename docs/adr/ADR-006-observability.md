# ADR-006: OpenTelemetry with redacted export

**Status:** Partly implemented: allowlisted logs and stored timings. OpenTelemetry not added, and no backend chosen.
**Date:** 2026-11-04

## Context

The app has only a few `console.error` calls. Turn latency, provider errors and safety outcomes are invisible.

## Problem

How can AI-specific and general telemetry be gathered without creating a new PHI leak?

## Decision

Instrument with OpenTelemetry, using allowlisted attributes (IDs, timings, versions, rule IDs) and no content. Build staff views of safety and escalation data from Postgres. Treat any external backend as replaceable. Langfuse is the leading candidate, since its JS tracing is built on OpenTelemetry, but it isn't required.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Langfuse SDK throughout | Stronger AI features, but ties code to a vendor. Default content capture is risky here |
| Self-hosted Langfuse | Adds infrastructure and shifts HIPAA responsibility to the operator. Reasonable later |
| Vendor APM only | Weak on AI specifics, and needs its own contract review |
| Logs only | No end-to-end timing |

## Benefits

Portable, standard, and safe by default. Fast diagnosis with IDs.

## Trade-offs

Content-free traces can't show what the model said, so debugging needs audited access to the database. This is deliberate. Serverless span export can lose data if not flushed. Some setup effort.

## Security implications

Allowlist blocks accidental secret export. The backend gains metadata about usage, so credentials and access need managing.

## Privacy implications

Redaction is a defense in depth, not a guarantee. Tests use canary values. IDs may still be personal data in some contexts, so hash staff identifiers and retain for short periods.

## Consequences

Each new span attribute needs allowlisting. Exporting content later would need a contract and privacy review.

## Future reconsideration conditions

An executed BAA plus a clear need for content-level traces; a backend gap; or a large cost change.
