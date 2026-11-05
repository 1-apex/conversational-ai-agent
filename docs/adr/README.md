# Architecture Decision Records

Each ADR records one significant decision and why it was made. **All are Proposed, because none has been reviewed or validated in running code.** Change status to Accepted only after review, and supersede rather than rewrite an accepted ADR.

| ADR | Decision | Status | Blocking question |
| --- | --- | --- | --- |
| [001](ADR-001-architecture-overview.md) | Modular monolith on the existing stack | Proposed | — |
| [002](ADR-002-safety-engine.md) | Deterministic safety engine; LLM can only raise severity | Proposed | Clinical reviewer |
| [003](ADR-003-agent-orchestration.md) | Server-side state machine; LLM proposes, policy decides | Proposed | — |
| [004](ADR-004-rag-architecture.md) | Hybrid retrieval with pgvector over approved documents | Proposed | Documents, pgvector check |
| [005](ADR-005-evaluation-framework.md) | Custom evaluation runner with critical regression gates | Proposed | — |
| [006](ADR-006-observability.md) | OpenTelemetry with redacted export | Proposed | Backend choice |
| [007](ADR-007-data-protection.md) | Synthetic by default, provider policy gate, no stored audio | Proposed | Legal and privacy owners |
| [008](ADR-008-authentication.md) | Staff sessions with Auth.js; signed tokens for callers | Proposed | Your approval |
| [009](ADR-009-voice-pipeline.md) | Keep Web Speech for synthetic mode only; server STT for PHI | Proposed | Provider review |
| [010](ADR-010-database-access-and-migrations.md) | Versioned migrations with Drizzle; least-privilege roles | Proposed | Your approval |
