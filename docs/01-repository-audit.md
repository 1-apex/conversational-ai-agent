# 01 — Repository Audit

| | |
| --- | --- |
| **Audited commit** | `ef361c0` (`main`) |
| **Audit date** | 2026-11-04 |
| **Scope** | All tracked source, config and documentation. No application code was changed. |
| **Runtime tested?** | Static inspection plus build tooling only. No live call was run, because no provider keys or database were available. |

**Bottom line.** The app is a working voice demo, not a support system. Its call loop is carefully tuned, but it has no emergency pathway, no authentication, no output validation and no tests. Its knowledge base contains statements that primary sources contradict, and its prompt tells the model to deny being an AI. It must not take calls from real patients in its current state.

## 1. Measured baseline

These results come from commands run during this audit on Windows, Node from the local environment, after `npm ci`.

| Check | Result | Detail |
| --- | --- | --- |
| `npm run typecheck` | **Pass** | No errors |
| `npm run lint` | **Fail** | 1 error, 5 warnings. Error: `<a href="/">` at `app/dashboard/page.tsx:369`. Warnings: `react-hooks/exhaustive-deps` in `components/CallStudio.tsx` at lines 393, 536, 623, 632, 651 |
| `npm run build` | **Pass** | Next.js 16.1.7, Turbopack. `/` and `/dashboard` static, five API routes dynamic |
| Automated tests | **None exist** | No test runner, test files, or CI (`.github/` is absent) |
| `npm audit` | **21 advisories** | 1 critical, 9 high, 10 moderate, 1 low |

Audit detail: the critical advisory is on the direct dependency `next` (range up to 16.4.0, fix `next@16.4.5`). `next` also carries the high findings on `postcss` and `sharp`. The `zod@4.3.6` currently installed is transitive and falls in a flagged range (`<4.6.6`), which matters because the target design adds Zod directly. `npm audit` findings still need triage for actual reachability.

## 2. Existing architecture

A single Next.js app. The browser owns the call: all conversation state lives in one client component, and the server routes are stateless proxies that trust what the client sends.

- **Current-state diagrams:** [`system-context-current.mmd`](diagrams/system-context-current.mmd) and [`sequence-current-turn.mmd`](diagrams/sequence-current-turn.mmd).
- **Technology:** Next.js 16.1.7, React 19.2.3, TypeScript 5, Tailwind 4. Web Speech API (STT), Groq `llama-3.3-70b-versatile` (agents), ElevenLabs `eleven_turbo_v2_5` (TTS), Claude `claude-sonnet-4-6` then Groq then regex (briefs), Neon Postgres, Upstash or in-memory rate limiting.
- **Deployment:** no deployment config is committed. `.vercel` in `.gitignore` and the commit `0ae7bfd` ("…in Vercel environment") suggest Vercel, but this is **not verified**.

## 3. Feature inventory

| Feature | Status | Evidence and notes |
| --- | --- | --- |
| Voice loop (STT, agent, TTS) | Works (by inspection) | `components/CallStudio.tsx` |
| Five agents with LLM handoff | Works, unsafe | LLM alone decides routing; no loop cap (§6, R-07) |
| Barge-in during TTS | Works | Requires 4+ words and ≤50% overlap with agent text, `CallStudio.tsx:166` |
| Silence check-in | **Partial** | One check-in only. The second message at `:227` is unreachable because `:223` returns first |
| TTS streaming and fallback | Works, unsafe | Fallback can pick a non-local voice, `:252` (R-14) |
| ElevenLabs quota meter | **Partial** | Browser-only display; never enforced, and per-browser rather than per-account (`:308`) |
| STT corrections | Works | Regex table, `:48` |
| "Transfer" | **Misleading** | Says a specialist is connecting, then ends the call, `:625` |
| LLM call brief | Works, unvalidated | Cast with `as`; no schema check (`lib/claude-client.ts`, `lib/groq-client.ts`) |
| Provider fallback for briefs | **Partial** | Falls back only when a key is *absent*. A failing Claude call returns 500; it never tries Groq (`app/api/extract/route.ts:31`) |
| Regex entities in fallback brief | **Broken** | The client sends `entities: EMPTY_ENTITY_MAP` (`CallStudio.tsx:588`) and nothing calls `extractEntities`, so fallback briefs always have empty entities |
| Sentiment | **Technically incorrect** | Substring match: "insurance" and "pressure" count as positive ("sure"); "know" and "diagnose" count as negative ("no"). `:658` |
| Call persistence | Works if `DATABASE_URL` set | Single table, runtime DDL |
| Dashboard KPIs | **Partial** | "Total Calls" is `calls.length` of a `LIMIT 100` query (`app/dashboard/page.tsx:375`, `app/api/analytics/route.ts:14`), so it stops at 100. The 7-day chart mixes UTC dates with local weekday labels (`page.tsx:65-67`) |
| Authentication, authorization | **Absent** | No auth code anywhere |
| Emergency handling | **Absent** | A search for emergency terms across `app`, `components`, `lib` finds nothing outside clinical conditions text |
| AI disclosure, recording notice | **Absent** | No consent step; prompt forbids disclosure |
| Tests, CI, migrations, tracing | **Absent** | — |

## 4. File-by-file responsibilities

| File | Lines | Responsibility | Audit notes |
| --- | --- | --- | --- |
| `app/page.tsx` | 16 | Renders `CallStudio` | Fine |
| `app/layout.tsx` | 27 | Root layout, metadata | Fine |
| `app/dashboard/page.tsx` | 489 | Analytics UI | Public; large single file; lint error |
| `app/api/agent/route.ts` | 119 | One agent turn | Trusts client history and agent; leaks upstream errors (`:104`) |
| `app/api/tts/route.ts` | 45 | ElevenLabs proxy | Speaks any text; no length limit; ignores `agent` param |
| `app/api/extract/route.ts` | 57 | Brief generation | Unbounded input; commented-out Gemini stub |
| `app/api/calls/route.ts` | 47 | Insert call | No auth, no rate limit; returns DB error text (`:45`) |
| `app/api/analytics/route.ts` | 18 | Last 100 calls | No auth, no rate limit, no try/catch |
| `components/CallStudio.tsx` | 830 | Entire call loop and UI | Too many responsibilities; refs mirror state |
| `components/AgentTranscript.tsx` | 109 | Transcript | Fine |
| `components/AgentBadge.tsx` | 34 | Agent labels, badge | Fine |
| `components/CallBrief.tsx` | 83 | Brief card | Assumes `entities` exists; malformed LLM JSON can crash it |
| `components/CubePulse.tsx` | 216 | Voice sphere animation | Fine |
| `components/TranscriptPanel.tsx` | 111 | — | **Unused** |
| `lib/agent-prompts.ts` | 84 | System prompts | Sole behavioural control; see R-02, R-04 |
| `lib/inogen-knowledge.ts` | 116 | Knowledge string | Unversioned, unsourced, contains contradicted claims |
| `lib/claude-client.ts` | 54 | Claude brief | Duplicated parser |
| `lib/groq-client.ts` | 62 | Groq brief | Duplicated parser; asks for `sentiment`, `callOutcome` that the type drops |
| `lib/rule-brief.ts` | 100 | Regex brief | Entities always empty |
| `lib/entity-extractor.ts` | 103 | Regex entities | `extractEntities` **unused** |
| `lib/db.ts` | 28 | Neon client, runtime DDL | `ensureSchema()` on every request |
| `lib/rate-limit.ts` | 43 | Per-IP limiters | Map grows unbounded; trusts `x-forwarded-for` (`:41`) |
| `lib/types.ts` | 52 | Types | Some are legacy |
| `lib/validation.ts` | 19 | Email, phone, DOB | **Unused** |
| `next.config.ts` | 26 | Security headers | No CSP or HSTS; `X-XSS-Protection` is legacy |
| `.env.example` | — | Env template | CareLink leftovers (`appointments@carelink.ai`, line 24) |
| `README.md` | — | Docs | **Describes a removed product** (CareLink) |

Unused dependency: `openai` has zero imports. Duplication: the JSON parser (2 copies), `GROQ_URL` and `MODEL` (2), duration formatting (3), agent name lists (`types.ts`, `route.ts`).

## 5. Current execution flows

**Caller turn.** Web Speech (audio goes to the browser's speech service) → corrections → 2.5 s debounce → `POST /api/agent` with the full client-held history and the client-claimed agent → Groq with `system prompt + history` → `parseResponse` → client appends reply → `POST /api/tts` → audio plays → listening resumes.

**Handoff.** A reply with `handoff` switches the client's active agent. After playback, `callAgent("")` runs, and the server injects the takeover message (`route.ts`, `lib/agent-prompts.ts:28`).

**End of call.** Stop audio and timers → `POST /api/extract` → keyword sentiment → fire-and-forget `POST /api/calls`, whose failure is ignored. A call abandoned by closing the tab is never saved.

## 6. Prioritized findings

P0 = critical safety, security, privacy or integrity. P1 = essential for production. P2 = reliability and maintainability. P3 = future.

### P0

| ID | Finding | Evidence | Consequence | Recommended change |
| --- | --- | --- | --- | --- |
| R-01 | **No emergency pathway.** Someone reporting that they can't breathe gets an ordinary LLM reply, shaped by a prompt that ends every turn with a soft sales-style question. | No detection code; soft-question rule at `lib/agent-prompts.ts:13` | Delay in seeking help | Deterministic safety engine with reviewed script (Phase 2). Interim: do not expose to real callers |
| R-02 | **The prompt orders the model to deny being an AI** while asserting "you are Inogen". | `lib/agent-prompts.ts:20` | Caller deception; possible exposure under California SB 1001 and, for clinical communications, AB 3030 (counsel to assess) | Remove in the first code change; add spoken disclosure |
| R-03 | **Unauthenticated data access.** `/api/analytics` returns briefs that can hold names and phone numbers to anyone. `/dashboard` is public. `/api/calls` lets anyone write rows. | `app/api/analytics/route.ts:4`, `app/api/calls/route.ts:4` | Disclosure and data poisoning | Server-side auth and RBAC (Phase 1) |
| R-04 | **Knowledge base contains claims primary sources contradict** (table below); the rest is unsourced. The model repeats them as fact. | `lib/inogen-knowledge.ts:35-36, 57, 68` | Coverage, legal and safety misinformation | Correct or remove now; replace with approved documents (Phase 4) |
| R-05 | **Fake transfer.** The caller hears they are being connected to a live specialist; the call then ends. | `CallStudio.tsx:625-632` | A caller may stop seeking help believing someone is coming | Honest wording now; callback queue in Phase 5 |
| R-06 | **Transcripts stored with no notice, consent, retention limit or deletion.** The Sales prompt tells the agent to *ask* for the prescribed flow setting, actively collecting health information. | `lib/agent-prompts.ts:51`, `app/api/calls/route.ts`, `lib/db.ts` | Possible all-party recording consent exposure (California Penal Code 632/632.7, counsel to assess); PHI retained without controls | Notice step, retention job, minimised prompts; `DATA_MODE=synthetic` until cleared |
| R-07 | **Client controls the conversation and the speech.** `history` (including forged "agent" turns) and `currentAgent` are accepted as sent, and `/api/tts` speaks any text. The LLM also chooses routing, with no cap on handoff loops (`CallStudio.tsx:526-527`). | `app/api/agent/route.ts:64-67`, `app/api/tts/route.ts:21-25` | Prompt injection, safety bypass, unbounded spend | Server-held call state; TTS keyed to a validated turn ID |
| R-08 | **No output validation.** Raw model text is spoken. With `max_tokens: 120` and no JSON mode, a truncated reply fails both parses and the raw JSON fragment is returned as speech. | `app/api/agent/route.ts:46, 83` | Unsafe or garbled speech | Zod contract and deterministic validator (Phase 2) |
| R-09 | **Sensitive data reaches third parties with no BAAs or data-flow control.** Web Speech recognition is server-based by default per MDN; transcripts go to Groq, Anthropic and ElevenLabs. | `CallStudio.tsx:399-405`; [`05-security-and-privacy.md`](05-security-and-privacy.md) §5 | Unauthorized PHI disclosure if real patient data flows | Provider policy gate; synthetic only until BAAs are executed |
| R-10 | **Critical dependency advisory** on `next@16.1.7`. | `npm audit` | Depends on reachability; treat as urgent | Upgrade within range to the patched version and retest |

### Knowledge-base claims checked against primary sources (R-04)

This is a spot check of the riskiest claims, not a full verification. **All other content remains unverified.**

| Line | Claim in `lib/inogen-knowledge.ts` | What the source says | Source |
| --- | --- | --- | --- |
| 57 | After 36 months of rental payments, the patient owns the equipment | Suppliers may keep ownership after the 36-month cap and must keep furnishing and servicing equipment through the 5-year useful lifetime | [CMS policy article A52514](https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleId=52514), [Medicare.gov](https://www.medicare.gov/coverage/oxygen-equipment-accessories), [CGS DME manual ch. 5](https://www.cgsmedicare.com/jc/pubs/pdf/chpt5.pdf) |
| 68 | Cash purchase available without prescription | "available by prescription only" | [inogen.com, Rove 6 CPO page](https://www.inogen.com/product/inogen-certified-pre-owned-rove6-system) |
| 35 | Rove 6 weighs 4.0 lbs | 4.8 lbs with standard battery | same page |
| 36 | Rove 6 battery 4.5 h standard, 9 h extended | Up to 6 h 15 min standard, 12 h 45 min extended, at setting 1 | same page |

### P1

| ID | Finding | Evidence | Change |
| --- | --- | --- | --- |
| R-11 | No tests, CI, or evaluations | §1 | Vitest, Playwright, eval runner, gates |
| R-12 | No input validation or size limits on any route; unbounded history sent to Groq each turn | All routes | Zod schemas, turn and size caps |
| R-13 | `/api/calls` and `/api/analytics` have no rate limit; spoofable IP key where the host does not overwrite `x-forwarded-for` | `lib/rate-limit.ts:41` | Limit all routes; derive client IP per platform |
| R-14 | "Fallback" may silently change vendor: the last voice choice accepts non-local voices | `CallStudio.tsx:252` | Local voices only, or fail with a message |
| R-15 | No human escalation system | — | Phase 5 |
| R-16 | No structured logs, correlation IDs or tracing; raw upstream errors returned to clients | `route.ts:104`, `calls/route.ts:45` | Error envelope, redacting logger |
| R-17 | No migrations; `ensureSchema()` runs DDL on every request with the app's credentials | `lib/db.ts` | Migration tool; least-privilege runtime role |
| R-18 | Call data is lost if the tab closes or `/api/calls` fails; `Math.random` 8-char IDs with `ON CONFLICT DO NOTHING` can silently drop a colliding call | `CallStudio.tsx:33`, `calls/route.ts:38` | Server-created UUIDs; persist per turn |
| R-19 | Silent failure modes: without STT support or with mic denied, the call sits on "Listening" or retries every 400 ms with no message | `CallStudio.tsx:400, 452-459` | Explicit error states |
| R-20 | No maximum call length; after one check-in the mic stays open indefinitely | `CallStudio.tsx:223` | Timeout policy |
| R-21 | No CSP or HSTS header | `next.config.ts` | Add and test |

### P2

| ID | Finding | Change |
| --- | --- | --- |
| R-22 | `CallStudio.tsx` mixes STT, TTS, orchestration, sentiment and UI | Extract hooks and an explicit reducer, in small steps |
| R-23 | Keyword sentiment is wrong and feeds a headline KPI | Fix tokenization immediately; label as heuristic; review in Phase 5 |
| R-24 | Dashboard KPIs mislead (see §3) | SQL aggregates with real totals; consistent time zones |
| R-25 | Malformed LLM brief can crash UI; Claude and Groq return different shapes | One Zod schema |
| R-26 | Brief provider fails rather than falls back; transcript injected unfenced into extraction prompts | Approved fallback list; delimit and label as data |
| R-27 | Full knowledge base sent on every turn, inflating latency and cost | Retrieval (Phase 4) |
| R-28 | Dead code, unused `openai`, stale README, CareLink env vars, lint error, Gemini stub | Cleanup PR; explain each removal |
| R-29 | In-memory limiter map never evicts keys | Evict or require Redis in production |
| R-30 | `toSpeakable` regex `[^\x00-\xFFFF]` does not mean what it appears to: it matches everything above U+00FF, including em dashes and curly quotes | Replace with an intentional rule and a test |

### P3

| ID | Finding | Change |
| --- | --- | --- |
| R-31 | Single hard-coded voice for all agents | Configurable voices |
| R-32 | No telephony | Evaluate only after queue workflow proves out |
| R-33 | No accessibility review of the voice-only flow; deaf or hard-of-hearing callers have no typed input | Text mode; WCAG review |
| R-34 | English-only | Language plan, with evals per language |

## 7. Risk summaries

- **Security:** R-03, R-07, R-10, R-12, R-13, R-16, R-17, R-21.
- **Reliability:** R-08, R-14, R-18, R-19, R-20, R-25, R-26.
- **AI-specific:** prompt-only control (R-01, R-02), LLM-controlled routing (R-07), no grounding (R-04), no evals (R-11), injection through client history and transcript (R-07, R-26).
- **Healthcare-specific:** R-01, R-02, R-04, R-05, R-06, R-09. Note also that a product-fit recommendation (`Best for:` in the knowledge base, "Celebrate the right match" at `lib/agent-prompts.ts`) can drift into clinical advice.
- **Identity:** the app speaks as a real company and gives phone numbers that have not been verified. If any public deployment exists, a real patient could mistake it for Inogen. See the open questions in [`17-implementation-roadmap.md`](17-implementation-roadmap.md).

## 8. What works and should be preserved

Barge-in with echo rejection, 2.5 s turn debounce, STT product-name corrections, streaming TTS, the handoff takeover mechanism, graceful operation with missing keys, and the voice-style tuning (apart from R-02). These represent real tuning effort and should be moved, not rewritten.

## 9. Remediation since this audit

Findings above describe commit `ef361c0` and aren't rewritten. Line numbers refer to that commit.

**Phase 0, 2026-11-05 (merged and deployed, PR #1):**

| Finding | Status | What changed |
| --- | --- | --- |
| R-01 | **Partial** | Interim phrase check, `lib/emergency-offramp.ts`. Stays on for the call and skips the LLM. Known to miss indirect wording. Not clinically reviewed |
| R-02 | **Mitigated** | Denial removed. Disclosure is added in code at the start of the call, and prompts state the demo's identity. Live model behaviour untested |
| R-04 | **Partial** | The four contradicted claims are corrected from sources. Everything else stays unverified. Real phone numbers and email removed |
| R-05 | **Mitigated** | Button is now "Ask for a person" and states there is no live person. No real escalation exists yet (R-15) |
| R-06 | **Partial** | Banner gives notice, and Sales and B2B prompts no longer ask for health or contact details. Retention is still absent |
| R-10 | **Fixed** | `next` and `eslint-config-next` at 16.4.5. Critical and high advisories cleared. 8 moderate remain, all in the dev-only ESLint chain; `npm audit --omit=dev` reports 0. The only automatic fix downgrades to the Next 15 config, so it wasn't applied |
| R-28 | **Mostly fixed** | Removed `TranscriptPanel.tsx`, `lib/validation.ts`, `openai`, the Gemini stub and unused env vars. README rewritten. Lint error fixed |
| R-03, R-07, R-08, R-09 | **Open** | Phases 1 and 2 |

**Found during Phase 0:**

| ID | Priority | Finding | Status |
| --- | --- | --- | --- |
| R-35 | P2 | Interrupting speech fires its end callback, which resumes listening and can restart the silence watcher. This cut the transfer message off. A reply still in flight could also speak after the call had ended | **Fixed** for transfer and in-flight replies |
| R-36 | P2 | A call can end with zero recorded turns, because fallback messages aren't saved as turns. `/api/extract` then rejects it, and the raw JSON error appears on screen | Open |
| R-37 | P2 | The upgraded lint config flagged a state update in an effect for the quota meter | **Fixed** with `useSyncExternalStore` |

R-30 was confirmed in testing: spoken text loses its em dashes, as in "didn't catch that could you say".

**Phase 1, part 1, 2026-11-05 (branch `phase-1-foundations`). The parts that need no database:**

| Finding | Status | What changed |
| --- | --- | --- |
| R-08 | **Partial** | Truncated or malformed model output is never spoken as raw JSON. Replies still aren't checked for safety or accuracy (Phase 2) |
| R-11 | **Partial** | 103 Vitest tests and a CI workflow. CI hasn't run yet, and there are no end-to-end browser tests |
| R-12 | **Fixed** | Zod validation and size limits on every route; history sent to the model is capped at 40 turns |
| R-13 | **Fixed in code** | All routes are rate limited; the client-forged `x-forwarded-for` entry is ignored and keys are hashed. Vercel's header behaviour hasn't been verified on the live deployment |
| R-14 | **Fixed** | Browser speech fallback uses local voices only |
| R-16 | **Partial** | Uniform error envelope, correlation IDs and an allowlisting logger. No tracing yet |
| R-19 | **Fixed** | Clear messages for unsupported browsers and blocked or missing mics, plus typed input |
| R-21 | **Partial** | CSP and HSTS added. The CSP needs `'unsafe-inline'` for scripts because the pages are static |
| R-25 | **Fixed** | One schema for all brief providers, with missing fields filled in |
| R-26 | **Partial** | A failing provider now falls through to the next. Transcripts are still not delimited as data |
| R-29 | **Fixed** | The in-memory limiter evicts old keys |
| R-36 | **Fixed** | Fallback messages are saved as turns, and brief errors show a plain message |
| R-03, R-07 | **Open: blocked** | Staff auth and server-held call state need a database |

**Phases 1 to 6, 2026-11-05 (branch `platform-phases`, not deployed).** R-03, R-07, R-15, R-17, R-18, R-23, R-24, R-26 and most others are addressed in code. Each is tracked in [implementation status](implementation-status.md), which also lists what's open. New findings from the benchmark, all fixed: injection text using punctuation escaped normalization; numbers were checked without their units; a false-promise wording was missed; complaints mentioning orders were routed to Sales.

**Deployment, checked 2026-11-05:** production is live on Vercel at `conversational-ai-agent-ten.vercel.app`, deployed from `main`. It ran `ef361c0` until Phase 0 was merged and deployed the same day (`d3d5f8a`); the new title, banner and emergency response were confirmed on the live site. Phase 1 isn't deployed yet. `/api/analytics` returned `503 no-db`, so that deployment isn't logging calls. The repository is public.

## 10. Limits of this audit

- No live call, database, or provider was exercised; behaviour above comes from reading code.
- Deployment state, real data in any database, and existing contracts are unknown.
- No penetration test was performed. Legal references are flagged for counsel and are not legal advice.
