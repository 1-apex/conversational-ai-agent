# Architecture Decision Records

Each ADR records one significant decision and why it was made. **Most are now implemented, as each one states. None has had independent review.** Supersede rather than rewrite an accepted ADR.

| ADR | Decision | Status | Blocking question |
| --- | --- | --- | --- |
| [001](ADR-001-architecture-overview.md) | Modular monolith on the existing stack | See ADR | — |
| [002](ADR-002-safety-engine.md) | Deterministic safety engine; LLM can only raise severity | See ADR | Clinical reviewer |
| [003](ADR-003-agent-orchestration.md) | Server-side state machine; LLM proposes, policy decides | See ADR | — |
| [004](ADR-004-rag-architecture.md) | Hybrid retrieval with pgvector over approved documents | See ADR | Documents, pgvector check |
| [005](ADR-005-evaluation-framework.md) | Custom evaluation runner with critical regression gates | See ADR | — |
| [006](ADR-006-observability.md) | OpenTelemetry with redacted export | See ADR | Backend choice |
| [007](ADR-007-data-protection.md) | Synthetic by default, provider policy gate, no stored audio | See ADR | Legal and privacy owners |
| [008](ADR-008-authentication.md) | Custom staff sessions; signed tokens for callers | See ADR | Independent review |
| [009](ADR-009-voice-pipeline.md) | Keep Web Speech for synthetic mode only; server STT for PHI | See ADR | Provider review |
| [010](ADR-010-database-access-and-migrations.md) | Versioned migrations with Drizzle; least-privilege roles | See ADR | Neon test |
