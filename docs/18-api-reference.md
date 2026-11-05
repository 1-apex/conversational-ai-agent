# 18 — API Reference

**Current endpoints are verified against the working tree on 2026-11-05. Proposed endpoints are not implemented and may change.**

## Current endpoints

All are unauthenticated. `/api/agent` returns a fixed emergency message without calling the LLM if the input or any earlier caller turn matches the interim phrase check, and it prepends the demo disclosure to the opening greeting.

All use the route wrapper. Errors are `{ "error": { "code", "correlationId" } }`, and every response has an `X-Correlation-Id` header. Common errors: `400 invalid_json`, `400 invalid_request`, `413 payload_too_large`, `429 rate_limited`, `500 internal_error`.

| Method and path | Rate limit (per min) | Body limit | Request | Response | Issues |
| --- | --- | --- | --- | --- | --- |
| `POST /api/agent` | 30 | 1 MB | `{ history?: up to 200 turns, userInput?: up to 2,000 chars, currentAgent?: AgentName }` | `{ reply, agent, handoff }`; `502 upstream_error` | Client still controls state |
| `POST /api/tts` | 30 | 8 KB | `{ text: 1 to 1,000 chars }` | `audio/mpeg` stream; `501 tts_not_configured`; `502 upstream_error` | Speaks any text |
| `POST /api/extract` | 5 | 2 MB | `{ turns: 1 to 500, duration?: number }` | `CallBriefData` | Open to anyone |
| `POST /api/calls` | 10 | 2 MB | `{ id, startedAt: ISO date, duration?, agentsUsed?, turns?, brief?, sentiment? }` | `{ ok: true }`; `{ ok: false, reason: "no-db" }` | Open write |
| `GET /api/analytics` | 30 | — | — | `{ calls: [...] }`, last 100, no transcripts; `503 no-db` | Open read of briefs |

## Proposed conventions

- **Errors:** `{ "error": { "code": "string", "correlationId": "uuid" } }`. No upstream or database text.
- **Header:** `X-Correlation-Id` on all responses.
- **Access:** `public-health`, `call-token`, `staff:<permission>`, `service`.
- **Validation:** strict Zod schemas. Unknown fields are rejected or ignored as specified per route, never trusted.

## Proposed: caller API

| Method and path | Access | Purpose |
| --- | --- | --- |
| `POST /api/calls` | Rate limited, public | Create a call; returns ID, token, notice and greeting |
| `POST /api/calls/:id/turns` | Call token | Submit caller text; returns validated reply |
| `POST /api/calls/:id/turns/:turnId/speech` | Call token | Audio for a validated agent turn |
| `POST /api/calls/:id/events` | Call token | Report playback complete, barge-in, STT failure, client timings |
| `POST /api/calls/:id/callback` | Call token | Add callback request |
| `POST /api/calls/:id/end` | Call token | End the call |

The `POST /api/calls` path keeps its name but changes meaning, which is a breaking change. `/api/agent`, `/api/tts`, `/api/extract` and the current `/api/calls` behaviour are removed when the browser moves to this API.

**Turn request:**

```json
{ "transcript": "string, max 2000 chars", "clientTurnId": "uuid", "source": "voice | typed", "interruptedTurnId": "uuid | null" }
```

**Turn response:**

```json
{
  "turnId": "uuid",
  "text": "validated reply",
  "agent": "orchestrator | sales | product | general | b2b",
  "pathway": "normal | restricted | boundary_script | emergency_script",
  "callState": "SPEAKING",
  "speechAvailable": true
}
```

No internal rule IDs, citations or scores go to the caller's browser. `clientTurnId` makes retries idempotent.

## Proposed: staff API

| Method and path | Permission | Purpose |
| --- | --- | --- |
| `GET /api/staff/calls` | `calls:list` | List, scoped by organization |
| `GET /api/staff/calls/:id` | `calls:read` | Header and summary |
| `GET /api/staff/calls/:id/transcript` | `transcript:read`, audited | Transcript |
| `DELETE /api/staff/calls/:id` | `calls:delete`, audited | Deletion request |
| `GET /api/analytics` | `analytics:read` | SQL aggregates, no transcripts |
| `GET /api/escalations` | `escalations:read` | Queue |
| `PATCH /api/escalations/:id` | `escalations:write`, audited | Assign, change status |
| `POST /api/knowledge/documents` | `knowledge:upload` | Upload |
| `POST /api/knowledge/versions/:id/approve` | `knowledge:approve`, not own upload | Approve |
| `POST /api/knowledge/versions/:id/retire` | `knowledge:approve` | Retire |
| `POST /api/reviews` | `reviews:write` | Record a finding or correction |
| `POST /api/reviews/:id/evaluation-case` | `reviews:write` | Propose a case; approval required |
| `GET /api/evaluations/runs`, `GET /api/evaluations/runs/:id` | `evaluations:read` | Results |
| `POST /api/evaluations/baseline` | `evaluations:admin`, audited | Promote baseline |
| `GET /api/audit-logs` | `audit:read` | Auditor view |

Staff routes return 401 with no session, 403 without permission, and 404 for another organization's record.

## Proposed: system

| Method and path | Access | Purpose |
| --- | --- | --- |
| `GET /api/health` | Public | Overall status only |
| `GET /api/health/details` | `ops:read` | Dependency status |
| `POST /api/internal/retention` | Service credential | Retention job |
| `POST /api/internal/sweep-calls` | Service credential | Close idle calls |

## Versioning

Internal API, used only by this app, so no version prefix for now. Add one if an outside client appears.
