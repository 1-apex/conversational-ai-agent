# 16 — Risk Register

**Status: Initial, 2026-11-04.** Likelihood and impact are engineering judgments that the named owners must review. No owners are assigned yet, so the Owner column shows the role needed.

Scale: Likelihood L/M/H if real callers used the system as it stands. Impact: Low, Moderate, High, Severe.

| ID | Risk | L | Impact | Current control | Planned mitigation | Residual, if mitigations work | Owner role | Audit ref |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| K-01 | Emergency statement gets an ordinary reply | M | Severe | None | Layered detection, approved script, sticky lock, benchmark | Moderate: no detector is complete | Clinical safety | R-01 |
| K-02 | Clinical advice or a personalized flow suggestion is spoken | M | Severe | One prompt line | Input pathway, output rules, evaluation | Moderate | Clinical safety | R-01, R-08 |
| K-03 | False coverage, prescription or specification claim | H | High | None | Immediate KB correction, RAG, numeric grounding, approval | Moderate | Knowledge owner | R-04 |
| K-04 | Caller misled about talking to a person, or about a transfer | H | High | None | Remove prompt line, disclosure, honest wording, validator rule | Low | Service owner | R-02, R-05 |
| K-05 | Public access to call data | H | Severe | None | Auth, RBAC, audit, scoped queries | Low | Security | R-03 |
| K-06 | PHI sent to providers without contracts | H | High | None | `DATA_MODE=synthetic`, policy gate, BAAs | Low to moderate | Privacy | R-09 |
| K-07 | Recording or transcribing without required notice | H | High | None | Notice, legal review | Low | Legal | R-06 |
| K-08 | Indefinite retention of sensitive data | H | High | None | Schedule, deletion job | Low | Privacy | R-06 |
| K-09 | Prompt injection alters behaviour or extracts data | M | Moderate | None | Server state, capabilities, validator, tests | Moderate: not fully solvable | AI engineering | R-07 |
| K-10 | Client forges history or speech | H | Moderate | None | Server state, turn-ID speech | Low | Engineering | R-07 |
| K-11 | Spend abuse through open endpoints | H | Moderate | Partial rate limits | Tokens, limits, spending alerts | Low | Engineering | R-07, R-13 |
| K-12 | Known dependency vulnerabilities | M | High | None | Upgrade, audit policy in CI | Low | Engineering | R-10 |
| K-13 | Regression ships unnoticed | H | High | None | Tests, evaluations, gates | Moderate | AI engineering | R-11 |
| K-14 | Speech recognition misses or mangles critical words | M | High | Regex corrections | Garbled-input evaluations, on-screen text, conservative checks | Moderate | AI engineering | — |
| K-15 | Evaluation gives false confidence: small sets, synthetic bias | M | High | None | Larger sets, clinical review, production review loop, honest reporting | Moderate | AI engineering | — |
| K-16 | Over-triggering wears out trust or hides real needs | M | Moderate | None | Track false positives, tune with clinical review | Low | Clinical safety | — |
| K-17 | Added checks slow down voice turns enough to harm usability | M | Moderate | None | Measure, budget, parallel where safe | Low to moderate | Engineering | — |
| K-18 | Provider outage with no safe fallback | M | Moderate | Partial | Approved fallback scripts, verified contact route | Low | Operations | R-14 |
| K-19 | Data lost when a tab closes or logging fails | H | Moderate | None | Per-turn saving, sweeps | Low | Engineering | R-18 |
| K-20 | Staff misuse of transcript access | L | High | None | Least privilege, audit, review | Low | Privacy | — |
| K-21 | Real patients mistake the app for the real company | M | High | None | Check deployment, access gate, authorization decision | Low | Service owner | §7 of audit |
| K-22 | Automation bias: staff over-trust summaries | M | Moderate | None | Provenance labels, uncertainty, review sampling | Low to moderate | Support operations | — |
| K-23 | No operational ownership, so alerts go nowhere | H | High | None | Named owners before pilot | Low | Service owner | — |
| K-24 | Backups can't be restored or retain deleted data | M | High | None | Drills, deletion replay | Low | Operations | — |
| K-25 | Inequitable performance across accents, speech conditions, or low oxygen affecting speech | M | High | None | Test across voices and speech patterns, text alternative, human route | Moderate | AI engineering, Clinical | R-33 |

K-25 deserves emphasis. People with respiratory conditions may speak in short, breathless phrases. That can defeat STT, the 4-word barge-in rule and the 2.5 s silence debounce at the moment accurate handling matters most. This should be tested directly, and so far nothing tests it.

## Review cadence

Review at each phase end and after any incident. Add a linked evaluation case or test when a risk is mitigated by code.
