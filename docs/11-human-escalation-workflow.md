# 11 — Human Escalation Workflow

**Build status (2026-11-05):** built as a practice queue with encrypted callback numbers, in `app/support/`. No on-call alerting, and nobody really calls back. See [implementation status](implementation-status.md).

**Status: Proposed.**

**The old Transfer button told callers a specialist was being connected, then hung up. Since Phase 0, "Ask for a person" says plainly that this demo has no live person, then ends the call.** The target is a demonstrated callback queue. No live transfer will be claimed until real telephony exists.

Sequence: [`diagrams/sequence-escalation.mmd`](diagrams/sequence-escalation.mmd).

## Reasons and default priority

| Reason | Priority | Notes |
| --- | --- | --- |
| Emergency-related conversation | P1 | Queue is secondary. The script comes first and does not depend on the queue |
| Device malfunction | P1 or P2 | Clinical owner to define when reliance on oxygen raises it |
| Medical question | P2 | Route to appropriately qualified staff |
| Explicit human request | P3 | Should always succeed |
| Customer complaint | P3 | |
| Billing issue | P3 | |
| Insurance dispute | P3 | |
| Product support | P3 | |
| Unresolved query | P4 | |

Priorities are rule-based. Response-time targets are a business decision and must not be promised to callers until staffing exists.

## Lifecycle

```text
open → assigned → in_progress → callback_scheduled → resolved → closed
                                                   ↘ unable_to_reach
```

Every change writes an `escalation_events` row and an audit entry. Rows are never edited in place, which preserves history.

## Caller experience

1. The assistant says what it can and can't do.
2. If the caller wants a callback, it collects only a callback number and a preferred time window, confirming the number by reading it back.
3. It confirms that a request was recorded, without inventing a response time.
4. It shows the same information as text on screen.

Contact data goes in a restricted, encrypted field and does not go to the LLM, even though STT will have processed it. In voice mode, sensitive digits are therefore still exposed to the STT provider, so a typed entry option is recommended. This is another reason the STT decision matters.

## Staff interface (`app/support/`)

- **Queue:** filter by priority, status and age; shows no transcript content in the list.
- **Detail:** summary with provenance labels, transcript (access logged), safety events, assignment, status, notes.
- **Actions:** claim, assign, reschedule, resolve with outcome.

Support agents see only items assigned to them or available to claim, and supervisors see all in their organization. The server enforces this on every request.

## Emergency independence

The approved script plays whether or not staff are available, the database is reachable or a provider is up, since it is bundled in the client. Any alert to on-call staff is an extra. Whether humans monitor this at all, and at what hours, is an operational decision that needs an owner. The system must not imply that someone is watching if nobody is.

## Failure handling

| Failure | Behaviour |
| --- | --- |
| Database down when creating an escalation | Caller still hears the approved script and a verified contact route; the failure raises an alert |
| No staff available | The request stays open; ageing alert fires |
| Caller unreachable | Recorded outcome and attempt history |

## Future telephony

Live transfer needs a telephony provider, routing rules, availability checks, a contract review, and its own recording-consent review. It can reuse the same escalation record.
