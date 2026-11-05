# 03 — System Architecture

**Status: Proposed. Nothing in the target section is implemented.**

**The core change is moving control from the browser and prompts to one server-side turn pipeline.** It stays a single Next.js application on the existing stack: no microservices, no new datastore.

## Current versus target

| Concern | Current | Target |
| --- | --- | --- |
| Conversation state | Browser; server trusts it | Server-held; browser holds only a call token |
| Behavioural control | System prompts | Deterministic policy, with prompts for language only |
| Routing | LLM decides freely | Deterministic router; LLM may propose, policy decides |
| Speech | TTS speaks any text | TTS speaks only a validated turn ID |
| Knowledge | Unsourced string in every prompt | Approved, versioned documents, retrieved per turn |
| Staff access | None required | Sessions, RBAC, audit log |
| Human handoff | Spoken message, then hang-up | Escalation record, queue, callback |

Current-state diagrams: [context](diagrams/system-context-current.mmd), [turn sequence](diagrams/sequence-current-turn.mmd).

## System context

[`diagrams/system-context.mmd`](diagrams/system-context.mmd) shows who and what interact with the app. Each outside processor is a separate compliance review, which is why they are drawn individually.

## Logical layers

[`diagrams/system-architecture.mmd`](diagrams/system-architecture.mmd) shows the layers. [`diagrams/component-diagram.mmd`](diagrams/component-diagram.mmd) shows the modules and their dependencies.

| Layer | Responsibility | Boundary rule |
| --- | --- | --- |
| Voice interface | STT, playback, barge-in, silence, transcript capture | Holds no authority. Sends text, plays validated turns |
| API and auth | Sessions, call tokens, RBAC, validation, rate limits, correlation IDs | Every route declares its access rule |
| Safety engine | Input classification, severity, pathways | Independent of agents. Agents cannot call around it |
| Orchestration | State machine, routing, handoff policy, capabilities | The only module that changes call state |
| Agents | Language generation within granted capabilities | Output is a proposal until validated |
| Knowledge (RAG) | Retrieval from approved documents | Content is data, never instructions |
| Response validation | Schema, safety, grounding, leakage checks | Deterministic checks are final for critical rules |
| Post-call | Structured intelligence with provenance | Runs after the call; failures never affect the caller |
| Escalation | Queue, assignment, callback | Emergency script never waits on it |
| Evaluation | Benchmarks, scoring, gates | Runs the real pipeline, not a copy |
| Observability | Traces, metrics, logs | Receives redacted data only |

## Turn pipeline

Every generated reply follows this path. [`diagrams/conversation-flow.mmd`](diagrams/conversation-flow.mmd) includes the alternative and error paths, and [`diagrams/safety-pipeline.mmd`](diagrams/safety-pipeline.mmd) shows the checks before and after generation.

1. Verify the call token, rate limit, and validate the input.
2. Persist the caller turn.
3. Run input safety. CRITICAL and HIGH exit here with approved scripts and no agent reply.
4. Route deterministically using server-held state.
5. Retrieve approved evidence when the intent needs facts.
6. Generate with the selected agent and granted capabilities.
7. Validate. A failure blocks the text and substitutes an approved fallback.
8. Persist the validated turn and return its ID.
9. The browser requests speech for that ID. The server loads the stored text and sends it to TTS.

Step 9 closes the gap in `app/api/tts/route.ts`, where any client-supplied text is spoken. It also stops quota abuse.

## Two state machines, not one

The states in the brief mix two concerns, so they are separated:

- **Server call state** (authoritative, persisted): safety, routing, processing, escalation, completion. See [`09-agent-orchestration.md`](09-agent-orchestration.md).
- **Browser voice state** (a reducer, not persisted): listening, playing, interrupted. It replaces the scattered refs in `CallStudio.tsx`.

The browser can suggest events such as "playback complete" or "barge-in". The server decides what they mean.

## Key sequences

| Scenario | Diagram |
| --- | --- |
| Normal inquiry and full lifecycle | [`sequence-call-lifecycle.mmd`](diagrams/sequence-call-lifecycle.mmd) |
| Product question using RAG | [`sequence-rag-retrieval.mmd`](diagrams/sequence-rag-retrieval.mmd) |
| Medical question | [`sequence-medical-question.mmd`](diagrams/sequence-medical-question.mmd) |
| Possible emergency | [`sequence-emergency-handling.mmd`](diagrams/sequence-emergency-handling.mmd) |
| Agent handoff | [`sequence-agent-handoff.mmd`](diagrams/sequence-agent-handoff.mmd) |
| Human escalation | [`sequence-escalation.mmd`](diagrams/sequence-escalation.mmd) |
| End of call | [`sequence-end-of-call.mmd`](diagrams/sequence-end-of-call.mmd) |
| Post-call summary | [`sequence-post-call-summary.mmd`](diagrams/sequence-post-call-summary.mmd) |
| Evaluation run | [`sequence-evaluation-run.mmd`](diagrams/sequence-evaluation-run.mmd) |
| Document ingestion | [`sequence-document-ingestion.mmd`](diagrams/sequence-document-ingestion.mmd) |
| Failed LLM provider | [`sequence-provider-failure.mmd`](diagrams/sequence-provider-failure.mmd) |
| Unauthorized request | [`sequence-unauthorized-request.mmd`](diagrams/sequence-unauthorized-request.mmd) |

## Known trade-offs

- **Latency.** Added checks, database writes and retrieval run within a voice turn. Deterministic checks are cheap, but an LLM safety classifier and retrieval are not. Both need measurement, and the classifier may run in parallel with generation, as long as nothing is spoken until it finishes.
- **Serverless limits.** Post-call work must not depend on an open browser. Scheduled sweeps and the host's background execution limits need verification once the host is confirmed.
- **Voice in a browser.** This remains a browser application. Real phone calls would need a telephony integration and a separate review.
