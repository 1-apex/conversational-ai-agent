# 10 — Observability and Monitoring

**Status: Proposed. Today the app has only scattered `console.error` calls.** See [ADR-006](adr/ADR-006-observability.md).

**Recommendation: instrument with OpenTelemetry and export redacted spans. Langfuse is an optional backend, not a code dependency.** Spans carry IDs, timings and versions, with no transcript content by default.

## Identifiers

| ID | Scope |
| --- | --- |
| `call_id` | One call; database key |
| `trace_id` | One turn or job |
| `correlation_id` | One HTTP request; returned in errors |
| `session_id` | Staff session, hashed in telemetry |

## Spans

| Span | Key attributes |
| --- | --- |
| `turn` | Total latency, final state |
| `stt.client` (reported by browser) | Duration, correction applied, failure type |
| `safety.input` | Duration, severity, rule IDs, policy version |
| `routing` | Selected agent, method, handoff decision |
| `retrieval` | Duration, chunk and version IDs, top score |
| `llm.generate` | Model, prompt version, tokens, retries, finish reason |
| `validation.output` | Result, failed rule IDs |
| `tts` | Time to first byte, duration, characters |
| `escalation.created` | Reason, priority |
| `post_call` | Method, model, success |

## What must never be exported

Transcript text, prompts containing caller content, contact details, tokens, secrets and raw IP addresses. Enforcement:

- An allowlist of attributes, so an unknown field is dropped rather than exported.
- A redacting logger with an automated test using canary values.
- Regex redaction is a backstop only. The main control is to avoid putting content into telemetry in the first place.

Debugging a specific bad reply uses the access-controlled transcript in the database, with an audit entry, and not a trace.

## Metrics and dashboard

| Group | Metrics |
| --- | --- |
| Latency | p50 and p95 per span; caller end of speech to first audio |
| Reliability | Error rate by route and provider, retries, fallback use |
| Usage | Tokens and TTS characters by model; estimated cost |
| Safety | Events by severity, blocked replies, emergency pathway activations |
| Escalation | Created, open, age, resolution time |
| Voice | STT failure rate, barge-in rate, false-interruption rate from review samples |
| Evaluation | Latest pass rates and trend, linked to [`07`](07-ai-evaluation-framework.md) |

Staff-only aggregate views can start in the app, computed with SQL, which adds no vendor. A hosted backend can come later.

## Voice quality metrics

STT latency, TTS latency, first-audio latency, interruption detection accuracy, false interruption rate, transcription correction rate, recognition failure rate and average turn duration. Web Speech gives limited timing information, so some are estimates and should be labelled as such. Interruption accuracy requires human-labelled samples.

## Alerts

Proposed, with thresholds set after baseline measurement. All need a named on-call owner.

| Alert | Severity |
| --- | --- |
| Emergency pathway activated | Page, per the approved policy |
| Output validator disabled, or any bypass | Page |
| Spike in blocked replies | High |
| Provider error rate above threshold | High |
| PII canary found in telemetry | Page, treat as an incident |
| Audit write failure | High |
| Escalation P1 unclaimed past target | High |
| Daily TTS or LLM spend above limit | Medium |

## Vendor check

Langfuse documents a HIPAA-ready cloud region and a BAA for eligible plans, while self-hosting moves the responsibility to the operator. Sources disagree on BAA mechanics, so verify with the vendor. Any backend receives redacted data only, unless a contract and review say otherwise. See the [vendor assessment](security/vendor-assessment.md).
