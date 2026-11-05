# Risk Assessment and Framework Mapping

**Assessed 2026-11-04 against commit `ef361c0`. Engineering assessment, not a HIPAA risk analysis.** Risks and owners are in the [risk register](../16-risk-register.md).

## OWASP Top 10 for LLM Applications (2025)

| ID | Risk | Exposure today | Planned control | Status |
| --- | --- | --- | --- | --- |
| LLM01 | Prompt injection | High: client history, transcripts, no delimiting | Server state, capabilities, validator, delimiting, evaluations | Planned |
| LLM02 | Sensitive information disclosure | High: open analytics; transcripts to providers | Auth, policy gate, minimisation, leakage checks | Planned |
| LLM03 | Supply chain | Moderate: dependency advisories, unreviewed providers | Audit gate, vendor reviews, pinned models | Planned, Organizational |
| LLM04 | Data and model poisoning | Low to moderate: knowledge is in code today; open write to calls | Second-person approval, no automatic learning | Planned |
| LLM05 | Improper output handling | High: model text spoken unvalidated; malformed brief can crash UI | Zod, validator, React escaping | Planned |
| LLM06 | Excessive agency | Moderate: LLM controls routing; no tools yet | Handoff policy, capabilities | Planned |
| LLM07 | System prompt leakage | Moderate: prompt holds the full knowledge base; no real secrets | Canary checks; no secrets in prompts | Planned |
| LLM08 | Vector and embedding weaknesses | Not applicable yet | SQL filters, approval, organization scoping | Planned |
| LLM09 | Misinformation | High: contradicted claims in knowledge | RAG, grounding, approved documents, evaluations | Planned |
| LLM10 | Unbounded consumption | High: unbounded history, open TTS text | Limits, tokens, spend alerts | Planned |

## NIST AI RMF

| Function | Current | Plan |
| --- | --- | --- |
| Govern | No owners or policies | Named owners, ADRs, approval gates; **Organizational** |
| Map | Partially addressed by this audit | Use context, data flows, risk register |
| Measure | Nothing measured | Evaluation system, false-negative tracking, observability |
| Manage | No process | Gates, incident process, review loop, kill switches |

## NIST AI 600-1 Generative AI Profile

| Risk area | Relevance | Planned response |
| --- | --- | --- |
| Confabulation | Inventing specifications or coverage | Grounding, decline behaviour |
| Dangerous or violent content (here, unsafe medical guidance) | Clinical harm | Safety engine, approved scripts |
| Data privacy | Transcripts | ADR-007 |
| Human-AI configuration | AI-denial prompt; over-trust in summaries | Disclosure, provenance labels, review |
| Information integrity | Unverified facts stated as Inogen's | Approved sources, citations |
| Information security | Injection, open routes | Security architecture |
| Value chain and component integration | Several AI vendors | Vendor assessment, policy gate |
| Harmful bias | Speech recognition on varied or breathless speech | Equity testing (K-25) |

## HIPAA Security Rule safeguards

An orientation map, not a compliance assessment.

| Safeguard area | Engineering contribution | Must come from the organization |
| --- | --- | --- |
| Administrative | Risk register, logs that support review, incident outline | Security officer, risk analysis, sanctions, training, BAAs, contingency plan approval |
| Physical | Inherited from cloud providers | Provider contracts, workstation policies |
| Technical: access control | Unique staff IDs, RBAC, session expiry | Access approval process |
| Technical: audit controls | Audit log | Regular review |
| Technical: integrity | Hash chain, constraints | Policy |
| Technical: authentication | Sessions, MFA through identity provider | Identity governance |
| Technical: transmission security | TLS, HSTS | Verification of deployment |

HHS published a proposed update to the Security Rule in January 2025. I couldn't confirm its current status, so check the [Federal Register](https://www.federalregister.gov) or HHS before relying on this table.

## Top residual risks even after full implementation

1. A missed emergency, because no detector is complete and speech recognition can fail for people in distress.
2. Prompt injection, since it can be reduced but not eliminated.
3. Non-numeric hallucinations that pass validation.
4. Organizational controls not being carried out, however good the code is.

These limits are why human review, conservative defaults and a controlled pilot remain part of the plan.

## Sources

[OWASP LLM Top 10](https://genai.owasp.org/llm-top-10/), [NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework), [NIST AI 600-1](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence), [HHS Security Rule](https://www.hhs.gov/hipaa/for-professionals/security/index.html). Framework wording here is summarized from memory and secondary pages, so check the originals before formal use.
