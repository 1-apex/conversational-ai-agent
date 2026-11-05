# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

**Inogen AI Call Agent** — a Next.js 16 / React 19 voice agent that simulates an Inogen (portable oxygen concentrator) customer-service phone line. The browser listens via the Web Speech API, a Groq-hosted Llama 3.3 70B model answers as one of five specialist agents, ElevenLabs speaks the reply, and on hang-up the call is summarized into a brief and logged to Neon Postgres. `/dashboard` shows analytics over logged calls.

> **Project status:** independent demo, not affiliated with or authorized by Inogen. Synthetic data only; real callers and PHI are out of scope. Don't make the app present itself as Inogen or give real contact details.
>
> **Safety status:** not approved for real callers. `docs/` holds the audit, target architecture, ADRs and roadmap; most of it is **proposed, not implemented**, so check labels and verify against code. `docs/01-repository-audit.md` lists known P0 issues, including contradicted claims in `lib/inogen-knowledge.ts`. Never add product, coverage or medical facts from memory or a model. Update affected docs and diagrams in the same change as the code.

## Commands

```bash
npm install
npm run dev        # http://localhost:3000
npm run build
npm run lint       # eslint (next core-web-vitals + typescript)
npm run typecheck  # tsc --noEmit
npm test           # vitest run; no keys or database needed
```

Run `lint`, `typecheck` and `test` for every change, and make a manual call in Chrome/Edge for voice changes (mic permission required). CI runs these on pull requests. Never add a `Co-Authored-By` line to commits.

## Environment (`.env`, see `.env.example`)

| Var | Used by | If missing |
| --- | --- | --- |
| `GROQ_API_KEY` | `/api/agent`, Groq brief extraction | Agent replies fail (client speaks a "didn't catch that" fallback) |
| `ELEVENLABS_API_KEY` | `/api/tts` | Returns 501; client falls back to browser `speechSynthesis` |
| `ANTHROPIC_API_KEY` | `/api/extract` (preferred brief provider) | Falls through to Groq, then rule-based; a provider that fails or returns bad output falls through too |
| `DATABASE_URL` | `/api/calls`, `/api/analytics` (Neon) | Call logging silently skipped; dashboard shows 503 / no-db |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | `lib/rate-limit.ts` | In-memory per-instance limiter |

## Layout

```
app/
  page.tsx              renders <CallStudio/>
  dashboard/page.tsx    analytics UI (client component, fetches /api/analytics)
  api/agent/route.ts    one agent turn → Groq; parses {reply, agent, handoff}; 3 retries on 429/5xx
  api/tts/route.ts      ElevenLabs streaming proxy (eleven_turbo_v2_5, fixed VOICE_ID)
  api/extract/route.ts  call brief: Claude → Groq → lib/rule-brief.ts
  api/calls/route.ts    INSERT call row into Neon
  api/analytics/route.ts last 100 calls
components/
  CallStudio.tsx        ~830 lines; the whole call loop (STT, agent calls, TTS, interrupts, silence, sentiment)
  AgentTranscript.tsx, AgentBadge.tsx (AGENT_META labels/colors), CallBrief.tsx, CubePulse.tsx (voice sphere)
  DemoNotice.tsx        visible non-affiliation and safety banner
  TypedInput.tsx        typed fallback when voice isn't available
tests/                  vitest; providers and database are mocked
lib/
  demo-notice.ts        fixed disclosure, banner and no-live-staff wording (not model-generated)
  emergency-offramp.ts  INTERIM phrase check and fixed message; runs before the LLM; not a safety guarantee
  agent-prompts.ts      AGENT_SYSTEM_PROMPTS: shared VOICE_STYLE + TAKEOVER + JSON_FORMAT + per-agent role/routing
  inogen-knowledge.ts   product/pricing/insurance knowledge injected into every prompt
  claude-client.ts, groq-client.ts   brief extraction
  rule-brief.ts, entity-extractor.ts  regex-based fallback brief (extractEntities is unused, so fallback entities are always empty)
  db.ts                 lazy Neon client + idempotent ensureSchema()
  rate-limit.ts         per hashed IP, per minute: agent 30, tts 30, extract 5, calls 10, analytics 30
  http/route.ts, http/schemas.ts   route wrapper and request/response validation
  agent-response.ts     parses model output; never lets raw JSON be spoken
  limits.ts             size limits shared with the browser (no zod import, to keep it out of the client bundle)
  observability/logger.ts  allowlisting logger
  types.ts              AgentName, AgentTurn, AgentApiResponse, CallBriefData, …
```

## API routes

Every route uses `route()` from `lib/http/route.ts`, which handles the access declaration, rate limit, size limit, Zod validation, correlation ID and error envelope: `{ "error": { "code", "correlationId" } }`. A test fails if a route skips it. Never return upstream or database error text. Log with the allowlisting logger in `lib/observability/logger.ts`, and add a field to its allowlist only if it can't contain caller content. Next.js route files can't export helpers, so shared logic goes in `lib/`.

## How a call works (key invariants)

- **Agents:** `orchestrator | sales | product | general | b2b`. Adding one means updating `AgentName` in `lib/types.ts`, `VALID_AGENTS` in `app/api/agent/route.ts`, `AGENT_SYSTEM_PROMPTS`, `AGENT_META` in `AgentBadge.tsx`, and the routing lines in the other agents' prompts.
- **Model output contract:** every agent must return exactly `{"reply","agent","handoff"}` JSON. `parseResponse` in the agent route tolerates leaked JSON; keep both sides in sync when changing the format.
- **Handoff:** when `handoff` is set, the client switches `activeAgent`, speaks the reply, then calls `/api/agent` with empty `userInput`; the server injects `"[call transferred — please introduce yourself and take over]"`, which the `TAKEOVER` prompt block keys on. Don't change one string without the other.
- **Empty `userInput` with no history** = opening greeting. The route prepends `DEMO_DISCLOSURE` in code, so the model can't skip it.
- **Emergency off-ramp:** `/api/agent` checks the new input and all earlier caller turns first. A match returns `EMERGENCY_MESSAGE` with no LLM call, for the rest of the call. The client uses the same check when the API fails.
- **"Ask for a person"** speaks `NO_LIVE_STAFF_MESSAGE`, then ends the call. It sets `isActiveRef` false before `mute()`, because cancelling speech fires its end callback, which would otherwise resume listening.
- **CallStudio state** is mirrored into refs (`agentStateRef`, `turnsRef`, `activeAgentRef`, `isActiveRef`) because speech/timer callbacks close over stale state. Read refs inside callbacks; update both state and ref together.
- **Turn-taking timers:** STT restarts continuously; text is accumulated and sent after 2.5 s of silence. Silence watcher checks in once after 8 s; the second message in the code is unreachable because `checkinCountRef >= 2` returns first. While the agent speaks, a separate interrupt recognizer listens; it ignores < 4 words or > 50% word overlap with the agent's own text (echo).
- **TTS:** `/api/tts` fetch has a 4 s timeout → falls back to Web Speech, using local voices only (a remote voice would send the text to another vendor). Streams through `MediaSource` when supported, else buffers. ElevenLabs character usage is tracked per month in `localStorage` key `inogen_el_quota_YYYY-MM` (warn at 8k, limit 10k).
- **STT fixes:** `TRANSCRIPT_CORRECTIONS` in `CallStudio.tsx` rewrites common misrecognitions ("ocean grove" → "Inogen Rove", "g five" → "G5"). Add new product names there.
- **Sentiment** is keyword-based on the client (`SENT_POS` / `SENT_NEG`); live per-turn badge + aggregated final value sent to `/api/calls`.
- **DB schema** lives only in `ensureSchema()` (`calls` table: id, started_at, duration, agents_used TEXT[], turns JSONB, brief JSONB, sentiment, created_at). Schema changes = `ALTER TABLE … IF NOT EXISTS` lines there.
- All DB/brief failures are non-fatal to the call flow — keep it that way.

## Conventions

- TypeScript strict, `@/` path alias, Tailwind v4 utility classes, glassmorphism teal/cyan look.
- Code style: aligned `=` / `:` columns, `// ── Section ──` dividers, short comments explaining *why*.
- Commit messages: conventional prefixes (`feat:`, `fix:`, `chore:`).
- Security headers are set in `next.config.ts` (`microphone=(self)` is required for STT).
- Prompts are tuned for very short spoken replies (`max_tokens: 120`, 1–2 sentences). Keep that when editing prompts.
