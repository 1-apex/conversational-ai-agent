# Engineering Documentation

**Status: blueprint for review (2026-11-04). Apart from the audit of current behaviour, these documents describe a proposed target. Almost none of it is implemented yet.**

This is an independent demo, not affiliated with or authorized by Inogen, and it is built on synthetic data. The application at commit `ef361c0` is not production-ready and is not HIPAA compliant. No document here claims otherwise. [`20-production-readiness-checklist.md`](20-production-readiness-checklist.md) records the current status.

## How to read this

Use these labels when you read any document or diagram:

| Label | Meaning |
| --- | --- |
| **Current** | Verified in the code at the audited commit |
| **Proposed** | Design intent, not implemented, not validated |
| **Needs approval** | Requires a clinical, legal, security or business owner. Code alone cannot satisfy it |

## Where to start

1. [Repository audit](01-repository-audit.md): what exists and what is wrong with it.
2. [System architecture](03-system-architecture.md): the proposed target.
3. [Implementation roadmap](17-implementation-roadmap.md): the order of work and the decisions needed from you.

## Documents

| # | Document | Purpose |
| --- | --- | --- |
| 01 | [Repository audit](01-repository-audit.md) | Findings, priorities and measured baseline |
| 02 | [Product requirements](02-product-requirements.md) | Users, scope, requirements, non-goals |
| 03 | [System architecture](03-system-architecture.md) | Layers, boundaries, key flows |
| 04 | [Technical design](04-technical-design.md) | Modules, contracts, configuration |
| 05 | [Security and privacy](05-security-and-privacy.md) | Controls and provider assessment |
| 06 | [Healthcare safety framework](06-healthcare-safety-framework.md) | Categories, severities, policy |
| 07 | [AI evaluation framework](07-ai-evaluation-framework.md) | Benchmark, metrics, gates |
| 08 | [RAG and knowledge management](08-rag-and-knowledge-management.md) | Ingestion, retrieval, approval |
| 09 | [Agent orchestration](09-agent-orchestration.md) | State machine, capabilities, contract |
| 10 | [Observability and monitoring](10-observability-and-monitoring.md) | Traces, metrics, redaction |
| 11 | [Human escalation workflow](11-human-escalation-workflow.md) | Queue, callback, audit |
| 12 | [Database design](12-database-design.md) | Schema, migrations, retention |
| 13 | [Testing strategy](13-testing-strategy.md) | Test layers and coverage |
| 14 | [Deployment and operations](14-deployment-and-operations.md) | Environments, voice reliability, runbooks |
| 15 | [Disaster recovery](15-disaster-recovery.md) | Backup, restore, provider outage |
| 16 | [Risk register](16-risk-register.md) | Risks, owners, mitigations |
| 17 | [Implementation roadmap](17-implementation-roadmap.md) | Phases, tasks, decisions |
| 18 | [API reference](18-api-reference.md) | Current and proposed endpoints |
| 19 | [Data governance](19-data-governance.md) | Classification, retention, deletion |
| 20 | [Production readiness checklist](20-production-readiness-checklist.md) | Status with evidence |

Also: [ADRs](adr/README.md), [diagrams](diagrams/README.md), and [`security/`](security/README.md).

## Maintenance rules

- A change to architecture updates the affected document and diagram in the same pull request.
- Diagrams are Mermaid source. Validate them before merging.
- When a proposed item ships, change its label to Current and cite the code.
