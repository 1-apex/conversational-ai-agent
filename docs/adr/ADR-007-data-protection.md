# ADR-007: Synthetic by default, provider policy gate, no stored audio

**Status:** Proposed. Legal and privacy review required.
**Date:** 2026-11-04

## Context

Transcripts may contain health information. They go to several providers with no contracts in place, are stored indefinitely, and are served by an open endpoint.

## Problem

How can real sensitive data be prevented from flowing until the organizational conditions are actually met?

## Decision

- `DATA_MODE` defaults to `synthetic`. `phi_approved` refuses to start without an allowlisted provider per purpose and approved scripts.
- All provider calls go through one policy gate.
- Raw audio is never stored by this application.
- Transcripts have enforced retention. Contact data has field-level encryption.
- No content in logs or traces.
- Regex redaction is treated as risk reduction, never de-identification.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Treat call content as non-PHI | Risky and legally unsupported until counsel decides |
| Redact everything before sending to the LLM | Unreliable, and reduces answer quality. A helpful layer, but not sufficient |
| Self-host all models | Adds major infrastructure; premature |
| Store audio for quality review | More risk and consent complexity; transcripts suffice for now |
| Rely on policy documents alone | Nothing prevents an accidental flow |

## Benefits

Failing safe becomes the default. An outage fallback can't introduce a new vendor. Data flows are visible in one place.

## Trade-offs

A configuration flag can be set wrongly, and it can't verify that a contract exists, so this guard needs procedural checks too. BAA-eligible tiers cost more: for example, Vercel's add-on, Neon's Scale plan, and enterprise tiers at ElevenLabs and Upstash. Encryption complicates search. Without audio, some STT errors can't be investigated.

## Security implications

Central enforcement point and reduced data at rest. Key management for field encryption is new work.

## Privacy implications

Direct support for minimum-necessary handling. Doesn't replace risk analysis, notice, patient rights processes or workforce training.

## Consequences

Real patient use is blocked by design until the [checklist](../20-production-readiness-checklist.md) owners approve it.

## Future reconsideration conditions

Counsel's determination, changes in provider terms, or a validated need for audio.
