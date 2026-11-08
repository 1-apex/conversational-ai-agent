# 19 — Data Governance

**Build status (2026-11-05):** retention and deletion are built with the provisional periods here. Notice wording and periods still need owner approval. See [implementation status](implementation-status.md).

**Status: Proposed. Retention periods and legal basis need approval by privacy and legal owners.** Today nothing is deleted, and callers receive no notice.

**Principle: collect less, send less, keep less.** Voice data flows are shown in [`diagrams/data-flow.mmd`](diagrams/data-flow.mmd), which marks where PHI could enter and leave.

## Classification

| Class | Definition | Examples | Handling |
| --- | --- | --- | --- |
| D0 Public | Approved public material | Published product documents | Normal |
| D1 Internal | Non-sensitive operational data | Aggregates, rule IDs, latency | Staff access |
| D2 Confidential | Business or staff data | User accounts, audit logs, business leads | Least privilege |
| D3 Sensitive | Could identify a person or reveal health information | Audio, transcripts, summaries, callback numbers | Treated as PHI: restricted, audited, encrypted, approved providers only |

## Where PHI could enter and leave

| Point | Direction | Control |
| --- | --- | --- |
| Caller speech or typed input | In | Notice; don't solicit health details |
| STT provider | Out | Web Speech in synthetic mode only; BAA-covered provider otherwise |
| Transcript stored | Stored | Access control, retention |
| LLM generation | Out | Provider gate, minimisation, bounded history |
| Safety classifier | Out | Same gate |
| TTS | Out | Reply text; avoid repeating caller details |
| Post-call extraction | Out | Same gate; rule-based if denied |
| Embedding query | Out | Redacted query; no PHI |
| Logs and traces | Out | Allowlisted attributes; canary tests |
| Staff UI | Out | RBAC, audit |
| Backups | Stored | Encryption, retention, restore replay |

Detection and redaction reduce risk, but they don't de-identify. HIPAA de-identification is a defined standard that regex doesn't meet.

## Inventory and retention

Proposed starting points only. Legal and business requirements may set longer or shorter periods, and they can vary by state and by purpose.

| Data | Class | Stored in | Proposed retention | Disposal |
| --- | --- | --- | --- | --- |
| Raw audio | D3 | **Not stored** | None | — |
| Transcript turns | D3 | `call_turns` | 90 days, unless linked to an open escalation | Hard delete |
| Summaries | D3 | `call_summaries` | 90 days | Hard delete |
| Callback number | D3 | `escalations` | Remove 30 days after resolution | Clear field |
| Safety events | D1 | `safety_events` | 1 year, after clinical and legal review | Delete |
| Escalation events | D2 | `escalation_events` | Same as related escalation, or per policy | Delete |
| Audit logs | D2 | `audit_logs` | HIPAA documentation retention is commonly cited as 6 years; counsel to confirm | Controlled |
| Rate-limit keys | D1 | Redis | Minutes, hashed | Expiry |
| Traces | D1 | Backend | 30 days | Expiry |
| Knowledge versions | D0 | Postgres | While cited, plus policy period | Retire, then delete |
| Evaluation data | D0 | Postgres, git | Long-term; synthetic | — |
| Backups | D3 | Provider | Per plan, with shortest workable window | Expiry |

## Deletion

- Daily retention job deletes expired records and writes an audit entry containing counts and IDs, not content.
- Staff deletion requests need permission and are audited.
- Legal holds pause deletion for specific records and need a defined owner.
- Deleted records are re-deleted after any restore.
- Provider-side data is covered by each provider's retention setting, which must be confirmed.

Caller rights (access, deletion, and others under HIPAA or state privacy laws) need a process. Calls are anonymous, so verifying who may request what is an open design question.

## Data minimisation rules

1. Don't ask for health information unless an approved process needs it.
2. Don't repeat sensitive details back in speech.
3. Send a bounded history to the LLM and exclude callback numbers.
4. Store rule IDs in safety events, not caller words.
5. Log no content.
6. Keep raw audio out of the system entirely.
7. Don't use caller data to train models. Confirm each provider's terms.

## Consent and notice

**Needs approval.** The opening notice must cover AI use, transcription, what happens to data, and the fact that this isn't an emergency service. Web-based voice should also link to a privacy notice. The current app has neither.

## Data quality

Knowledge is owned and versioned ([`08`](08-rag-and-knowledge-management.md)). Summaries label caller statements, document facts and inferences. Reviewer corrections are stored alongside the original, so errors can be measured.

## AI data use

| Use | Allowed? |
| --- | --- |
| Real transcripts in evaluation datasets | Only with de-identification and approval |
| Sending real data to a judge LLM | No, unless the provider and purpose are approved |
| Fine-tuning on caller data | No |
| Automatic prompt or knowledge change from feedback | No |

## Ownership

A data owner, privacy lead and retention approver are all required, and none has been assigned.
