# 02 — Product Requirements

**Status: Proposed.** This is an independent demo, not authorized by Inogen, and it uses synthetic data only. See [the effect of that decision](17-implementation-roadmap.md#effect-of-the-independent-demo-decision). The requirements describe the behaviour being demonstrated.

**The product is a voice support assistant that answers routine questions from approved documents and hands everything else to a person, safely and honestly.** It is not a clinical tool, and it does not replace emergency services or a clinician.

## Users

| User | Need |
| --- | --- |
| Consumer caller | Accurate product, order, warranty and coverage information; a route to a person |
| Business caller (DME, clinic, hospital) | Lead capture and a human follow-up |
| Support representative | A prioritized queue with context |
| Supervisor | Oversight, assignment, quality review |
| Knowledge editor and approver | Controlled publication of source material |
| Auditor | Read-only evidence of access and changes |
| AI engineer | Evaluation results and traces to diagnose failures |

## In scope

Product information, specifications, batteries, accessories, published pricing, general insurance and Medicare information, warranty, shipping, support routing, business lead capture, callback requests, post-call summaries, evaluation, and quality review.

## Out of scope

- Diagnosis, prescribing, personalized oxygen or flow advice, or changes to a clinician's instructions.
- Eligibility or coverage determinations for an individual.
- Taking payments or accessing customer records.
- Live phone transfer, until a telephony integration exists.
- Autonomous changes to prompts or knowledge from production feedback.

## Functional requirements

| ID | Requirement | Priority | Addresses |
| --- | --- | --- | --- |
| FR-01 | Disclose at the start that the caller is talking to an AI, and give the approved recording notice | P0 | R-02, R-06 |
| FR-02 | Answer truthfully when asked whether it is an AI | P0 | R-02 |
| FR-03 | Route possible emergencies to an approved script before any agent runs, and keep sales routing locked for the rest of the call | P0 | R-01 |
| FR-04 | Refuse clinical advice with approved language and offer human support | P0 | R-01 |
| FR-05 | Never tell a caller they are being connected to a person unless a person is actually connected | P0 | R-05 |
| FR-06 | Validate every generated reply before it is spoken | P0 | R-08 |
| FR-07 | Answer factual questions only from approved, versioned documents, and record which versions were used | P0 | R-04 |
| FR-08 | State the limit and offer support when evidence is insufficient | P0 | R-04 |
| FR-09 | Require staff login and role checks for all call data | P0 | R-03 |
| FR-10 | Hold conversation state on the server; speak only validated turns | P0 | R-07 |
| FR-11 | Create and track escalations and callbacks | P1 | R-15 |
| FR-12 | Produce structured summaries that separate caller statements, document facts and inferences | P1 | R-25 |
| FR-13 | Let reviewers correct summaries, flag failures and propose evaluation cases | P1 | — |
| FR-14 | Tell the caller clearly when voice features fail, and offer a non-voice path | P1 | R-19 |
| FR-15 | Retain and delete data according to an approved schedule | P0 | R-06 |
| FR-16 | Preserve barge-in, echo rejection, turn debounce and STT corrections | P1 | Existing |

## Non-functional requirements

Targets are proposed starting points and need baseline measurement. No current latency data exists.

| ID | Requirement | Proposed target |
| --- | --- | --- |
| NFR-01 | Added safety latency, deterministic checks | p95 under 50 ms |
| NFR-02 | Caller finished speaking to first audio | Measure first, then set. Provisional p95 under 3 s, excluding the 2.5 s debounce |
| NFR-03 | Emergency script availability | Must not depend on any LLM, TTS or queue being up |
| NFR-04 | Failure behaviour | Fail to an approved message; never to unvalidated text |
| NFR-05 | Sensitive data in logs and traces | None, verified by automated tests and sampling |
| NFR-06 | Accessibility | WCAG 2.2 AA for staff UI and a text alternative for callers |

## Success measures

Measured by the [evaluation framework](07-ai-evaluation-framework.md): zero critical emergency false negatives on the benchmark, unsupported-claim rate, routing accuracy, escalation resolution time, and reviewer-confirmed error rate. Sales conversion is deliberately not a primary measure for this system.
