# ADR-009: Keep Web Speech for synthetic mode; server STT for PHI

**Status:** Proposed. The provider is unselected, and none has been verified.
**Date:** 2026-11-04

## Context

STT uses the browser's Web Speech API. MDN states that recognition is server-based by default, with audio sent to a web service, and that on-device recognition is possible through `processLocally` where supported. The app doesn't set it. The operator has no contract covering that service.

## Problem

How should voice work so that development stays cheap, while no sensitive speech reaches an uncontracted party?

## Decision

- Keep Web Speech in `DATA_MODE=synthetic`. It works today, costs nothing, and the barge-in logic is tuned to it.
- Put STT behind an interface so a server-side provider can be added.
- `phi_approved` requires an allowlisted STT provider. There is no silent fallback to browser speech.
- Evaluate `processLocally` separately, checking browser support, accuracy and whether it satisfies review.
- Restrict browser TTS fallback to local voices, as the current fallback may select a remote one.
- ElevenLabs standalone TTS needs its BAA scope confirmed; its public HIPAA page describes Agents only.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Web Speech for everything | Uncontracted processor; browser-limited |
| Server STT now | Costs, new streaming work and vendor review, before the safety work that matters most |
| Hosted voice-agent platform | Could replace much of the pipeline, but with a large redesign and reduced control over safety. Evaluate if voice becomes the main problem |
| On-device only | Promising for privacy, but support and accuracy are unverified |

Server STT candidates such as Deepgram, AssemblyAI, Azure and AWS have **not** been reviewed here. Their current terms and BAA availability must be checked at selection.

## Benefits

No disruption to the working voice loop now, with a clear gate later.

## Trade-offs

Synthetic-mode testing doesn't predict accuracy on another provider, so voice evaluations must be rerun. Server STT adds streaming complexity and may change barge-in behaviour. Chrome and Edge remain the practical browsers.

## Security implications

Server STT adds an audio endpoint and streaming surface. Browser STT avoids this, but gives no control or audit.

## Privacy implications

The central issue. Spoken callback numbers and health details reach the STT provider before any app-level check can run, so a redaction step can't help here. Provider choice is the only control.

## Consequences

Real-patient use is blocked until the STT decision is made. Voice metrics must be captured before any provider change, as a baseline.

## Future reconsideration conditions

BAA-covered STT chosen, broad on-device support verified, telephony introduced, or a requirement for accuracy improvements on breathless or impaired speech.
