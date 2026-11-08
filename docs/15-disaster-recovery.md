# 15 — Disaster Recovery

**Build status (2026-11-05):** still entirely unexercised. No restore has been attempted. See [implementation status](implementation-status.md).

**Status: Proposed and untested. No backup, restore or failover procedure has ever been exercised for this project.** A backup that has never been restored doesn't count as verified.

## Objectives

These are starting points that the service owner must approve, and they should reflect the plan limits of the chosen database tier.

| Data or service | Proposed RPO | Proposed RTO |
| --- | --- | --- |
| Transcripts, escalations, audit logs | 15 minutes or better, if the Neon plan's restore window permits | 4 hours |
| Knowledge base | 24 hours; source documents kept separately | 8 hours |
| Evaluation data | 24 hours | Next business day |
| Application | Not applicable, stateless | 1 hour |
| Emergency script | Not applicable | Available with no backend, bundled in the client |

## Scenarios

| Scenario | Response |
| --- | --- |
| Database outage | Calls take the approved limited path. Restore or wait; verify integrity |
| Data corruption or a bad migration | Point-in-time restore into a new branch, verify, then promote |
| Accidental deletion | Same; the audit log helps establish scope |
| Region outage | Depends on provider options; verify availability on the chosen plan |
| Host outage | Service unavailable; publish the verified alternate contact route. Redeploy elsewhere only with a reviewed configuration and a BAA where needed |
| LLM provider outage | See [`sequence-provider-failure.mmd`](diagrams/sequence-provider-failure.mmd) |
| Credentials compromised | Rotate, revoke sessions, check the audit log, follow the incident process |
| Ransomware or account takeover | Lock accounts, restore from protected backups, involve security and legal owners |
| Bad knowledge published | Retire the version immediately; list affected calls using `turn_citations` |

## Backups

- Use database point-in-time recovery, with retention confirmed for the chosen plan.
- Scheduled logical exports should be encrypted, stored in a separate account, and access-limited.
- PHI in backups counts: retention and deletion policies must address backups, and the storage provider needs review.
- Source documents and evaluation datasets are versioned outside the database.
- Restore keeps the audit hash chain verifiable; verify it after each restore.

## Restore drills

Run before a pilot, then quarterly. Steps: restore to an isolated branch, run the migration check and integrity checks, verify the audit chain, confirm the application works against it, record the actual time achieved, then destroy the restored copy. Each drill records evidence in the readiness checklist.

## Deleted data after restore

A restore can bring back data that had been deleted under the retention policy. Deletion records must be re-applied after any restore, and the retention job should run before reopening access.

## Dependencies

| Dependency | Recovery depends on |
| --- | --- |
| Neon | Plan's restore window and availability |
| Host | Redeployment from the git repository |
| Secrets | A documented, access-controlled inventory, not stored in the repo |
| Staff | Contact list and on-call plan, which do not exist yet |
