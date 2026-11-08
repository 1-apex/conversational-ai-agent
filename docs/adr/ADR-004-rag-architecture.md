# ADR-004: Hybrid retrieval with pgvector over approved documents

**Status:** Implemented for text documents. Not yet validated: pgvector on Neon, an embedding provider, voice-turn latency with real retrieval.
**Date:** 2026-11-04

## Context

Facts come from one unversioned string sent on every turn. A spot check found claims that CMS and Inogen's own site contradict.

## Problem

How can factual answers be limited to approved, versioned sources without adding unnecessary infrastructure?

## Decision

Use Postgres: pgvector plus full-text search, merged by reciprocal rank fusion. Filter by approval and effective date in SQL. Require second-person approval. Require citations, and verify numbers against cited text. Below the relevance threshold, decline rather than generate.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Pinecone or other vector database | Another data processor and sync problem; volume is small |
| Vector search only | Weak on exact model names and part numbers |
| Keyword search only | Weak on paraphrase |
| Curated FAQ with no embeddings | **A serious option**, given a small corpus. Simple and deterministic. Compare in the Phase 4 spike |
| Keep the string with corrections | Remains unversioned and can't record which version supported an answer |
| Vendor RAG service | Less control over approval filtering; new contract |

## Benefits

One database and backup. Reproducible answers through version IDs. Recalled content can be traced to the calls that used it.

## Trade-offs

Embedding and search add latency to voice turns, though a small corpus may keep this low. Approval adds human process. Strict grounding will sometimes decline correct answers. Spec tables are hard to chunk.

## Security implications

Documents are an injection route. Text is treated as data, and retrieval never grants capabilities. Upload handling is new attack surface.

## Privacy implications

Queries are redacted before embedding. Documents must contain no PHI, and ingestion checks for it. The embedding provider needs review.

## Consequences

Official documents become a hard dependency for Phase 4. `lib/inogen-knowledge.ts` retires only after evaluation passes.

## Future reconsideration conditions

Large corpus, poor retrieval metrics, or a Neon plan limitation.
