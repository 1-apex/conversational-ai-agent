# 05 — Security and Privacy

**Status: Almost all controls are Proposed.** Nothing here establishes HIPAA compliance. Compliance also depends on risk analysis, policies, workforce training, contracts and legal determinations that code cannot provide.

**Default posture: synthetic data only until the owners in [`20-production-readiness-checklist.md`](20-production-readiness-checklist.md) sign off.**

Details: [security architecture](security/security-architecture.md), [risk assessment](security/risk-assessment.md), [vendor assessment](security/vendor-assessment.md). Trust boundaries: [`diagrams/security-boundaries.mmd`](diagrams/security-boundaries.mmd).

## Does HIPAA apply?

**Needs approval.** Counsel must decide this. It depends on who operates the system and in what relationship to a covered entity. A supplier that bills insurers may well be a covered entity, and information a caller shares about their own condition could be PHI in that setting. The design treats call content as potentially PHI so that the answer does not require re-architecture.

## Control status

| Control | Status | Notes |
| --- | --- | --- |
| Staff authentication | Not implemented | [ADR-008](adr/ADR-008-authentication.md) |
| Session expiry and revocation | Not implemented | Database sessions, idle and absolute limits |
| RBAC | Not implemented | Server-side, roles below |
| Audit logging | Not implemented | Append-only, hash-chained |
| Input validation | Not implemented | Zod at every route |
| Rate limits | **Partial** | Three routes only; key can be spoofed on some hosts |
| TLS in transit | **Partial, unverified** | Depends on the host; HSTS not configured in the app |
| Encryption at rest | **Provider-dependent** | Verify on each provider; add field encryption for contact data |
| Security headers | **Partial** | `next.config.ts` has several. No CSP or HSTS |
| Secrets management | **Partial** | Environment variables and `.gitignore`. No rotation procedure |
| Dependency management | **Failing** | 21 advisories including 1 critical |
| Retention and deletion | Not implemented | [`19-data-governance.md`](19-data-governance.md) |
| PII detection | Not implemented | A risk reducer only. **Regex redaction is not de-identification** |
| Tenant isolation | Not implemented | Single organization, with `organization_id` scoping from day one |

## Roles

| Permission | ADMIN | SUPERVISOR | SUPPORT_AGENT | AUDITOR |
| --- | --- | --- | --- | --- |
| View aggregate analytics | Yes | Yes | No | Yes |
| View transcript | Break-glass, logged | Yes | Assigned only | Read-only, logged |
| Work escalations | No | Yes | Assigned only | No |
| Assign escalations | No | Yes | No | No |
| Review and correct calls | No | Yes | No | No |
| Upload documents | Yes | No | No | No |
| Approve documents | Second person only | Yes, not own upload | No | No |
| Manage users and roles | Yes | No | No | No |
| View audit logs | No | No | No | Yes |
| Change evaluation baseline | Yes, logged | No | No | No |

This table is a safe default. Separation of duties (for example, whether admins can see PHI at all) needs review by the operator.

## Audited events

Login and failed login, session revocation, record and transcript access, record change and deletion, document upload, approval and publication, escalation assignment and resolution, evaluation baseline changes, role changes, and all administrative actions. Entries store IDs rather than content. A database role with insert-only rights and hash chaining make tampering evident, though not impossible.

## Provider summary

Verified on 2026-11-04 from public documents. Terms change, and **a public page is not a contract**. Full detail and sources are in the [vendor assessment](security/vendor-assessment.md).

| Provider | Receives today | BAA path found | Key caveat |
| --- | --- | --- | --- |
| Browser speech service | Caller audio | **None known** | Chrome's behaviour needs verification; do not use for PHI |
| Groq | Full transcript each turn | Published addendum | Confirm scope; enable zero retention |
| Anthropic | Full transcript at call end | Yes, for eligible API features | Confirm model and feature coverage |
| ElevenLabs | Reply text | Enterprise only | Public HIPAA page describes Agents, not standalone TTS |
| Vercel | All traffic in memory, logs | Pro add-on | Logs need review |
| Neon | Transcripts, briefs | Scale plan | Enablement is irreversible; Data API excluded |
| Upstash | IP addresses as keys | Enterprise only | Keep PHI out; hash keys |
| Langfuse (if adopted) | Traces | Cloud HIPAA region | Send redacted data only |

## Regulatory items for counsel

These are flagged rather than decided here.

- **AI disclosure.** California SB 1001 prohibits misleading people about a bot's identity to incentivize a sale. AB 3030 sets disclaimer rules for generative AI patient communications by certain California health providers. Applicability to this operator is a legal question. FR-01 discloses regardless.
- **Call recording.** California Penal Code 632 and 632.7 generally require all-party consent for confidential and cellular calls. Saving transcripts of voice calls without notice needs legal review, and other states have their own rules.
- **Medical device boundary.** Whether any feature counts as device software or clinical decision support is for regulatory review. The design avoids clinical function.
- **Marketing and sales.** Use of health information for sales may raise HIPAA marketing rules and state consumer health privacy laws.
- **HIPAA Security Rule update.** HHS proposed changes in January 2025. Its current status needs checking before compliance work is planned.

## Reference frameworks

[HHS HIPAA Security Rule](https://www.hhs.gov/hipaa/for-professionals/security/index.html), [NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework), [NIST AI 600-1 Generative AI Profile](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence), [OWASP Top 10 for LLM Applications](https://genai.owasp.org/llm-top-10/). The mapping to controls is in the [risk assessment](security/risk-assessment.md).
