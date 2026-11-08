# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

An independent demo of an AI voice support line about Inogen portable oxygen concentrators, built with Next.js 16 and React 19. It isn't affiliated with or authorized by Inogen. Synthetic data only; real callers and PHI are out of scope. Don't make the app present itself as Inogen or give real contact details.

**Not approved for real callers.** `docs/implementation-status.md` says what's built and what differs from the design documents, so read it before trusting another doc. Never add product, coverage or medical facts from memory or a model. Update affected docs and diagrams in the same change as the code. Never add a `Co-Authored-By` line to commits.

## Commands

```bash
npm install
npm run dev            # http://localhost:3000
npm run build
npm run lint
npm run typecheck
npm test               # vitest; no keys needed; integration tests use in-memory Postgres
npm run test:e2e       # playwright, after a build
npm run eval:offline   # 235 cases, scripted model replies, runs in CI
npm run eval:live      # real model; costs money; never yet run
npm run db:migrate
npm run db:seed        # local test accounts; needs SEED_PASSWORD
npx drizzle-kit generate --name=<name>   # after changing lib/db/schema.ts
```

Run `lint`, `typecheck`, `test` and `eval:offline` for every change. `docs/testing-guide.md` has setup and the manual checklist. Local database: `DATABASE_URL=pglite://.data/dev`. Only one process can open it, so stop the dev server before running scripts against it.

## How a turn works

`POST /api/calls/:id/turns` calls `processTurn` in `lib/conversation/pipeline.ts`, which everything else follows. Tests and evaluations run the same function with injected dependencies, so keep providers behind `PipelineDeps`.

1. Input safety (`lib/safety/`). Deterministic detectors first. CRITICAL and HIGH use fixed scripts with no model reply. Emergency locks the call.
2. Deterministic routing (`lib/conversation/router.ts`), then evidence.
3. Model generation, with an LLM classifier alongside that **can only raise severity**. Nothing is spoken until both finish.
4. Output validation (`lib/safety/response-validator.ts`). A failure replaces the reply with an approved script.
5. A model handoff proposal is checked against the matrix and cap.

## Rules that must hold

- **The LLM never decides safety or permissions.** Don't add a path around the engine or validator. No fallback may skip them or add an unreviewed provider: use `assertProviderAllowed`.
- **The browser holds no authority.** Call state is an HMAC-signed token (`lib/conversation/call-token.ts`), and `/api/tts` speaks only signed text. With a database, the stored row also overrides old tokens.
- **Every API route uses `route()`** from `lib/http/route.ts`, declaring its access. `tests/route-guards.test.ts` fails anything that doesn't. Never return upstream or database error text. Next.js route files can't export helpers, so shared logic goes in `lib/`.
- **Staff queries are always scoped by `organizationId`.** Another organization's record returns 404.
- **Log with `lib/observability/logger.ts`.** Add to its allowlist only a field that can't hold caller content. Safety events and audit entries hold IDs and rule IDs, never caller words.
- **Scripts in `lib/safety/policy.ts` are fixed wording** and all unapproved. Evaluation results can't be presented as clinically validated.
- **`audit_logs` is append-only**, enforced by triggers in the first migration. Migrations are forward-only.
- **Persistence failures never break a call** (`lib/conversation/store.ts`).
- **Critical evaluation cases can't be excused as known gaps.** A failing case gets fixed, or a reviewed note. Baselines move only by hand.

## Voice client

`components/CallStudio.tsx` holds the call loop. Its state is mirrored into refs (`agentStateRef`, `turnsRef`, `activeAgentRef`, `isActiveRef`) because speech and timer callbacks close over stale state, so read refs in callbacks and update both together. Cancelling speech fires its end callback, which resumes listening unless `isActiveRef` is already false.

Tuned behaviour, measured by nothing yet, so change with care: 2.5 s debounce after speech; one check-in after 8 s of silence; the interrupt recognizer ignores under 4 words or over 50% overlap with the agent's own words. `TRANSCRIPT_CORRECTIONS` fixes misheard product names. The browser voice fallback uses device voices only. `lib/emergency-offramp.ts` has no server imports, because the browser uses it when the API is down.

## Conventions

- TypeScript strict, `@/` path alias, Tailwind v4 utilities, teal look.
- Aligned `=` and `:` columns, `// ── Section ──` dividers, short comments explaining why.
- Conventional commit prefixes (`feat:`, `fix:`, `chore:`).
- `lib/limits.ts` holds values shared with the browser, to keep Zod out of the client bundle.
- Scripts in `scripts/` are `.mts` and run with `tsx`.
- Prompts are tuned for very short spoken replies, and numbers must be digits so the validator can check them.
