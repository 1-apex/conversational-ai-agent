# 18 — API Reference

**Current endpoints are verified against the working tree on 2026-11-05. Proposed endpoints are not implemented and may change.**

## Conventions

Every route uses the wrapper in `lib/http/route.ts`. Errors are `{ "error": { "code", "correlationId" } }` with no upstream or database text, and every response has an `X-Correlation-Id` header. Common errors: `400 invalid_json`, `400 invalid_request`, `401 unauthorized`, `403 forbidden`, `403 bad_origin`, `413 payload_too_large`, `429 rate_limited`, `500 internal_error`, `503 no-db`.

Access is one of `public`, `call-token` (the handler verifies a signed token), `service` (`CRON_SECRET`) or a staff permission. A test fails if a route handling call data or staff work lacks a staff permission.

## Caller API

| Method and path | Access | Limit/min | Purpose |
| --- | --- | --- | --- |
| `POST /api/calls` | public | 10 | Start a call. Returns `callId`, `callToken`, greeting `text`, `speechToken` |
| `POST /api/calls/:id/turns` | call-token | 30 | One turn. See below |
| `POST /api/calls/:id/end` | call-token | 5 | End the call. Returns `brief` and `intelligence` |
| `POST /api/calls/:id/callback` | call-token | 10 | Add a callback number. Needs a database |
| `POST /api/tts` | call-token | 30 | `{ speechToken }`. Audio stream, `501 tts_not_configured` or `502 upstream_error`. Only speaks signed text |

**Turn request:** `{ "callToken", "event": "message" | "takeover" | "silence" | "human_request", "text"?: "up to 2,000 chars" }`

**Turn response:**

```json
{
  "callToken": "new signed state",
  "turnId": "uuid",
  "text": "validated reply",
  "agent": "agent that spoke",
  "nextAgent": "agent for the next turn",
  "pathway": "normal | restricted | boundary_script | emergency_script | human_request | injection_script",
  "handoff": false,
  "escalationId": null,
  "speechToken": "signed text for /api/tts"
}
```

Extra errors: `401 invalid_call_token`, `409 call_ended`, `409 no_pending_takeover`, `409 no_more_checkins`.

The old `/api/agent` and `/api/extract` routes are gone, and `POST /api/calls` has a new meaning.

## Staff API

Staff routes return 401 with no session, 403 without permission, and 404 for another organization's record. Writes also require a same-origin request.

| Method and path | Permission | Purpose |
| --- | --- | --- |
| `POST /api/auth/login`, `/logout`; `GET /api/auth/me` | public | Session management. Login is limited to 10/min |
| `GET /api/analytics` | `analytics:read` | SQL totals, per-day counts, latency, safety and model counts, latest 100 calls |
| `GET /api/staff/calls/:id` | `transcript:read`, or assigned | Transcript and summary. Audited |
| `DELETE /api/staff/calls/:id` | `calls:delete` | Delete. Audited |
| `POST /api/staff/users/:id/revoke-sessions` | `sessions:manage` | End someone's sessions |
| `GET /api/escalations` | `escalations:read` | Queue. Support sees own and unclaimed |
| `GET /api/escalations/:id` | `escalations:read` | Detail. The number is shown only to the assignee or a supervisor |
| `PATCH /api/escalations/:id` | `escalations:write` | `{ action: "claim" | "assign" | "status", ... }` |
| `GET /api/knowledge`, `POST /api/knowledge` | `knowledge:read`, `knowledge:upload` | List, upload text up to 1 MB |
| `GET /api/knowledge/versions/:id` | `knowledge:read` | Chunks for review |
| `POST /api/knowledge/versions/:id` | `knowledge:approve` | `{ action: "approve" | "reject" | "retire" }`. `409 own_upload` |
| `GET /api/reviews`, `POST /api/reviews` | `reviews:write` | Findings, corrections, proposed cases |
| `GET /api/evaluations/runs`, `/runs/:id` | `evaluations:read` | Stored runs and failures |
| `GET /api/audit-logs` | `audit:read` | Latest 200 entries and chain status |

## System

| Method and path | Access | Purpose |
| --- | --- | --- |
| `GET /api/health` | public | Overall status only |
| `GET /api/health/details` | `ops:read` | Database, configured providers, versions |
| `GET /api/internal/retention` | service | Daily retention and idle-call sweep |
