# 12 — Database Design

**Status: Proposed.** ER diagram: [`diagrams/database-er.mmd`](diagrams/database-er.mmd). See [ADR-010](adr/ADR-010-database-access-and-migrations.md).

**Move from one JSON-heavy table with runtime DDL to normalized tables with versioned migrations and least-privilege roles.**

## Current schema

One table, `calls`, created by `ensureSchema()` in `lib/db.ts` on each request: `id TEXT`, `started_at`, `duration`, `agents_used TEXT[]`, `turns JSONB`, `brief JSONB`, `sentiment`, `created_at`. It has no ownership, no retention and no indexes beyond the primary key. Whether any deployed database holds real data is unknown; that must be checked before migrating.

## Tables and justification

Tables are grouped by purpose. They arrive with the phase that needs them, not all at once.

| Table | Why it exists | Phase |
| --- | --- | --- |
| `organizations` | Ownership and future tenancy. One row at first | 1 |
| `users`, `roles`, `user_roles` | RBAC | 1 |
| `sessions` | Revocable staff sessions | 1 |
| `audit_logs` | Tamper-evident record; separate insert-only role | 1 |
| `calls` | Call header and authoritative state | 1 |
| `call_turns` | Per-turn saving survives a closed tab, and enables access control and retention at turn level | 1 |
| `call_summaries` | Keeps generated output apart from source data, with method and version | 1, expanded 5 |
| `safety_policies`, `prompt_versions` | Reproducibility: which policy and prompt produced this reply | 2 |
| `safety_events` | Safety analytics without copying caller text | 2 |
| `evaluation_datasets`, `evaluation_cases`, `evaluation_runs`, `evaluation_results` | Versioned, comparable runs | 3 |
| `knowledge_documents`, `knowledge_versions`, `knowledge_chunks` | Approval and versioning | 4 |
| `turn_citations` | Which version supported which reply; supports recalls | 4 |
| `escalations`, `escalation_events` | Queue and immutable history | 5 |
| `follow_up_tasks` | Action items with owners | 5 |
| `review_items` | Human review, feedback, and path to evaluation cases | 5 |

**Deferred or not created:** `model_versions` (a model ID on the turn and run is enough for now) and a separate `feedback` table (covered by `review_items`).

## Key constraints

- UUID primary keys except `audit_logs` (`bigint`, for ordering) and `evaluation_cases` (readable IDs).
- `UNIQUE (call_id, sequence)` on `call_turns`.
- `CHECK` or enum on state, severity, status and priority.
- `knowledge_versions`: `CHECK (approved_by IS NULL OR approved_by <> uploaded_by)` enforces second-person approval in the database.
- Foreign keys on all relationships. `ON DELETE RESTRICT` by default, with deletion handled by an explicit job so audit evidence is not silently lost.

## Key indexes

| Index | Purpose |
| --- | --- |
| `calls (organization_id, started_at DESC)` | Dashboard |
| `calls (retention_expires_at)` | Retention job |
| `call_turns (call_id, sequence)` | Transcript loading |
| `escalations (organization_id, status, priority, created_at)` | Queue |
| `safety_events (organization_id, created_at, severity)` | Safety analytics |
| `knowledge_chunks` HNSW on `embedding` | Vector search, subject to pgvector verification |
| `knowledge_chunks` GIN on `search_vector` | Keyword search |
| `evaluation_results (run_id, passed)` | Failure views |

## Isolation and access

- Each staff repository function requires `organizationId`, so a query cannot be written without it. Row-level security is proposed as a second layer, subject to testing with Neon's serverless driver.
- Database roles: `app_runtime` (no DDL), `app_migrator` (DDL, CI only), `app_audit_writer` (insert only on `audit_logs`), `app_readonly` (auditor views).
- Contact data is in `escalations.encrypted_contact`, encrypted at the application level with a key stored apart from the database.

## Migrations

Versioned files in the repo, applied by CI with the migrator role. `ensureSchema()` is removed once the first migration takes over. Rules: forward-only in production with expand-then-contract for breaking changes, tested on a Neon branch first.

**Migrating existing data (needs your decision):** existing `calls` rows may have no notice or consent behind them. Safe default: do not carry them into the new schema. Export for review, or delete under your direction. Deleting would be irreversible and will not happen without approval.

## Analytics

The dashboard should use SQL aggregates rather than the current client-side calculation over `LIMIT 100`, so the KPIs reflect all calls and transcripts aren't loaded. Aggregates run over `calls` and `safety_events`.

## Retention

Each table's retention period is in [`19-data-governance.md`](19-data-governance.md). `calls.retention_expires_at` is set at creation, and a scheduled job handles expiry.
