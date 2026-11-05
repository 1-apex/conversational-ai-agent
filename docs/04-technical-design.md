# 04 — Technical Design

**Status: Proposed.** Names and shapes may change during implementation; update this file when they do.

## Module layout

Existing files move gradually. Nothing moves without tests around it first.

```text
lib/
  config/        Validated environment; fails at startup when required values are missing
  auth/          Staff sessions, RBAC, signed call tokens
  http/          Route wrapper: correlation ID, access rule, validation, error envelope
  db/            Client, migrations, per-table repositories
  audit/         Append-only audit writer
  safety/        engine, policy, types, detectors, response-validator, escalation-manager
  conversation/  pipeline, state-machine, router, call-repository
  agents/        Prompts (from agent-prompts.ts), capabilities, response contract
  knowledge/     retrieval, ingestion, chunking
  providers/     policy gate, llm/, tts/, stt/
  post-call/     Extraction, schema, rule fallback (from rule-brief.ts)
  evaluations/   datasets, runner, scorers, gates, reports
  observability/ logger, tracing, redaction
components/
  call/          CallStudio shell, hooks: useSpeechRecognition, useSpeechPlayback, useCallMachine
```

Dependency rule: `safety` depends on `providers`, `config` and types, never on `agents`. Only `conversation` calls both.

## Route wrapper

Every route uses one wrapper so a missing access rule is a compile error instead of an oversight.

```ts
export const GET = route({
  access: { kind: "staff", permission: "transcript:read" },
  params: CallIdParams,
  handler: async ({ params, user, log }) => { /* query scoped by user.organizationId */ },
});
```

`access` is one of `public-health`, `call-token`, `staff`, or `service`. There is no default. The wrapper supplies the correlation ID, rate limit, Zod parsing, redacting logger, and a uniform error envelope: `{ "error": { "code": "...", "correlationId": "..." } }`. Upstream error text is never returned.

## Agent response contract

Zod validates this. Fields come from the brief, adjusted so the model can only propose.

```ts
const AgentResponse = z.object({
  reply: z.string().min(1).max(600),
  intent: IntentCategory,
  proposedAgent: AgentName.nullable(),   // a proposal, enforced by the handoff matrix
  handoffReason: z.string().max(200).nullable(),
  requestsEscalation: z.boolean(),       // can only add escalation, never remove it
  citedChunkIds: z.array(z.string().uuid()).max(8),
  actionRequest: z.object({ type: z.literal("create_callback_request") }).nullable(),
}).strict();
```

- No model confidence field exists, because it would not be trusted.
- The current `max_tokens: 120` truncates JSON. The limit must rise, a structured output mode must be evaluated, and speaking length must be enforced on `reply`.
- A parse failure never returns raw text. It retries once if the latency budget allows, then uses the approved fallback.

## Safety interface

```ts
interface InputAssessment {
  categories: SafetyCategory[];
  severity: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  pathway: "normal" | "restricted" | "boundary_script" | "emergency_script";
  detectors: { name: string; matched: boolean }[]; // rule IDs, never matched caller text
  policyVersion: string;
}
```

`assess()` combines detectors with a maximum: a later layer can raise severity, never lower it. A test enforces this property across all inputs.

## Provider policy gate

No code calls a provider directly. `providers/policy.ts` takes a purpose (`agent_generation`, `safety_classification`, `tts`, `stt`, `embedding`, `extraction`, `judge`, `trace_export`) and a data class, then returns an approved provider or denies. Configuration:

```text
DATA_MODE=synthetic | phi_approved    default: synthetic
PROVIDER_APPROVALS=<reviewed allowlist by purpose and data class>
```

`phi_approved` refuses to start unless each purpose has an allowlisted provider. That setting is a technical guard and does not, by itself, establish compliance. A BAA still has to exist.

Fallback chains live in the same allowlist, so an outage can never bring in an unreviewed provider.

## Call token

`POST /api/calls` creates the call and returns a short-lived signed token scoped to that call ID. Callers do not log in. The token authorizes turns and speech for that call only, and it never grants read access to any other call or staff data. Abuse protection is rate limiting plus limits on turns and duration per call.

## Browser changes

- Replace `history` and `currentAgent` in requests with `callId` and a transcript string.
- Extract speech code into hooks, moving tested logic without rewriting it.
- Show a visible error for unsupported STT or denied microphone (R-19).
- Add a typed input as a fallback and an accessibility path.
- Use local voices only for browser speech fallback (R-14).
- Bundle the emergency script in the client, so it can display and play with no network.

## Configuration

Secrets stay in environment variables. `.env.example` will gain `DATA_MODE`, `AUTH_SECRET`, `CALL_TOKEN_SECRET`, `PROVIDER_APPROVALS`, and observability settings, and lose the CareLink entries. Real values are never committed.

## Dependencies

Added only when a phase needs them:

| Package | Purpose | Phase |
| --- | --- | --- |
| `zod` (direct, patched version) | Validation | 1 |
| `vitest`, `@playwright/test` | Testing | 1 |
| Auth library, see [ADR-008](adr/ADR-008-authentication.md) | Staff auth | 1 |
| Migration tool, see [ADR-010](adr/ADR-010-database-access-and-migrations.md) | Migrations | 1 |
| OpenTelemetry API and SDK | Tracing | 5 |
| Document text extractor, chosen in Phase 4 | Ingestion | 4 |

Removed: `openai` (zero imports).
