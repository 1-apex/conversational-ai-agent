# Diagrams

Mermaid source, with one concern per diagram. **The first line of each file states its status, including any part that wasn't built.** The two `current` diagrams describe the code before this work, and are kept as a record. Update diagrams when the implementation changes.

All files were checked with the Mermaid 11 parser on 2026-11-04. Parsing confirms valid syntax; it doesn't confirm visual layout, so check large diagrams when rendering. GitHub renders Mermaid only inside fenced blocks, so to preview a `.mmd` file use a Mermaid editor extension or [mermaid.live](https://mermaid.live).

## Current state

| File | Shows |
| --- | --- |
| [system-context-current](system-context-current.mmd) | Today's system. Note the open routes and audio leaving through browser speech |
| [sequence-current-turn](sequence-current-turn.mmd) | One turn today, with no validation between the model and speech |

## Structure

| File | Shows |
| --- | --- |
| [system-context](system-context.mmd) | People and outside systems. C4 context level |
| [system-architecture](system-architecture.mmd) | All logical layers. Everything passes through one conversation core |
| [component-diagram](component-diagram.mmd) | Proposed modules and dependencies. Note that `safety` doesn't depend on `agents` |
| [deployment-architecture](deployment-architecture.mmd) | Development, staging and production, assuming Vercel |
| [database-er](database-er.mmd) | Proposed tables, keys and cardinalities |
| [security-boundaries](security-boundaries.mmd) | Trust zones, and what enforces each crossing |
| [data-flow](data-flow.mmd) | Where sensitive data enters, leaves, persists and gets deleted |

## Behaviour

| File | Shows |
| --- | --- |
| [conversation-flow](conversation-flow.mmd) | A full call with error paths |
| [agent-orchestration](agent-orchestration.mmd) | Server call state machine; the same table as `09-agent-orchestration.md` |
| [safety-pipeline](safety-pipeline.mmd) | Safety decisions before and after generation |
| [document-ingestion](document-ingestion.mmd) | Upload through approval and retirement |
| [post-call-processing](post-call-processing.mmd) | Extraction, provenance and review |
| [evaluation-pipeline](evaluation-pipeline.mmd) | Datasets, scoring, baselines, gates, dashboard |
| [ci-cd-pipeline](ci-cd-pipeline.mmd) | Checks from PR to production |
| [incident-response](incident-response.mmd) | Detection through closure |

## Sequences

| File | Scenario |
| --- | --- |
| [sequence-call-lifecycle](sequence-call-lifecycle.mmd) | Normal customer inquiry |
| [sequence-rag-retrieval](sequence-rag-retrieval.mmd) | Product question using retrieval, including insufficient evidence |
| [sequence-medical-question](sequence-medical-question.mmd) | Medical question handled with a script, no LLM reply |
| [sequence-emergency-handling](sequence-emergency-handling.mmd) | Possible emergency; script is independent of the queue |
| [sequence-agent-handoff](sequence-agent-handoff.mmd) | LLM proposes, policy decides |
| [sequence-escalation](sequence-escalation.mmd) | Callback queue. No live transfer |
| [sequence-end-of-call](sequence-end-of-call.mmd) | Normal hang-up, closed tab, and idle sweep |
| [sequence-post-call-summary](sequence-post-call-summary.mmd) | Extraction with provider gate and fallback |
| [sequence-evaluation-run](sequence-evaluation-run.mmd) | A run through to its gate decision |
| [sequence-document-ingestion](sequence-document-ingestion.mmd) | Upload and second-person approval |
| [sequence-provider-failure](sequence-provider-failure.mmd) | LLM outage, without unapproved providers |
| [sequence-unauthorized-request](sequence-unauthorized-request.mmd) | 401, 403, 404 and 429 outcomes |
