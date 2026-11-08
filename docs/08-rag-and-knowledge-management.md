# 08 — RAG and Knowledge Management

**Build status (2026-11-05):** ingestion, approval and hybrid retrieval are built and tested on PGlite, for text documents only. The legacy string is still the default, and no embedding provider is chosen. See [implementation status](implementation-status.md).

**Status: Proposed.** See [ADR-004](adr/ADR-004-rag-architecture.md).

**Only approved, versioned documents can support a customer-facing fact. When evidence is missing, the assistant says so and offers a person.**

## Why replace `lib/inogen-knowledge.ts`

It has no source, version, owner or approval, and it goes into every prompt regardless of the question. A spot check found contradicted claims (see the [audit](01-repository-audit.md#knowledge-base-claims-checked-against-primary-sources-r-04)). Those lines must be corrected or removed immediately, as an interim step before retrieval exists.

## Ingestion

Flow: [`diagrams/document-ingestion.mmd`](diagrams/document-ingestion.mmd). Sequence: [`diagrams/sequence-document-ingestion.mmd`](diagrams/sequence-document-ingestion.mmd).

| Step | Detail |
| --- | --- |
| Upload | Staff with permission only; records source and owner |
| Validation | Allowlisted file types, size limits, content sniffing; no execution of embedded content |
| Extraction | Text only. PDFs may need manual checking, since tables of specs often extract badly |
| Scanning | Flag instruction-like text, hidden text and unexpected PHI |
| Normalization | Unicode normalization, whitespace, boilerplate removal |
| Chunking | By document section; keep spec tables whole; keep the source location |
| Metadata | Assigned per chunk, see below |
| Embedding | Through the provider policy gate. Documents contain no PHI |
| Indexing | pgvector and Postgres full-text search |
| Approval | A second person reviews. The uploader cannot approve their own upload |
| Publication | Sets effective date and supersedes the previous version |

## Chunk metadata

Document ID, title, version, product, source type, section, approval status, effective date, expiry date, content hash, source location, and audience (consumer or business).

## Retrieval

Retrieval runs on a redacted query, so caller health details are not sent to the embedding provider.

1. **Filter first, in SQL:** `status = approved`, within effective dates, matching product and audience. An application filter is not enough, since a bug there would surface unapproved text.
2. **Hybrid search:** pgvector similarity plus Postgres full-text search. Exact terms such as "G5", "Rove 6" and part numbers often work better with keywords.
3. **Merge** by reciprocal rank fusion, with a relevance threshold tuned by evaluation.
4. **Sufficiency decision:** below threshold, use the limitation message. No generation attempt.

A reranker is not planned at first. Add one only if evaluation shows a need.

## Prompt injection handling

Retrieved text is untrusted, even after approval:

- Delimit it as data and instruct the model that it contains no instructions.
- Capabilities are decided by policy, so retrieved text cannot grant an action.
- Output validation still applies, whatever the retrieved text says.
- Ingestion scanning catches obvious cases early, but it is not relied on.

## Grounding and attribution

The agent returns `citedChunkIds`. The validator confirms that each cited ID was actually retrieved for this turn, that numbers match cited text, and that citations are stored in `turn_citations` with document versions. Spoken replies do not read out citations; reviewers see them.

## Outdated content

Retired or expired versions are excluded at query time. A nightly check flags documents nearing expiry. When a document is recalled, a query over `turn_citations` shows which calls used it, which supports corrective follow-up.

## Source policy

**Needs approval.** Content must come from official material, supplied or authorized by the operator. Public web pages may disagree with each other and with current internal policy, and insurance content changes, so each document needs an owner. Nothing is written into the knowledge base from memory or from a model.

## Evaluation

Retrieval precision and recall at k on labelled queries, groundedness, a "no answer" set where the correct behaviour is declining, version-pinned runs, and tests that unapproved chunks never return. See [`07`](07-ai-evaluation-framework.md).

## Open questions

- Embedding provider and its data terms, to be selected in Phase 4 through the provider policy.
- Whether pgvector is available and suitable on the chosen Neon plan; verify before committing. The HIPAA-enabled plan needs the same check.
- The latency cost of embedding plus retrieval inside a voice turn; measure before setting a budget.
