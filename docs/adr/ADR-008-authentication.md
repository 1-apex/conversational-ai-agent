# ADR-008: Custom staff sessions; signed tokens for callers

**Status:** Implemented, revised 2026-11-05. It hasn't had an independent review.
**Date:** 2026-11-04

**Revision.** The original decision was Auth.js. While building, it turned out Auth.js's password provider requires JWT sessions, which can't be revoked immediately, and its database sessions need an OAuth or email provider, and this demo has neither. So the build uses a small custom implementation: scrypt password hashes, random session tokens stored only as hashes, idle and absolute expiry, immediate revocation, and SameSite=Strict HttpOnly cookies with an origin check. **Hand-written auth is a real risk, and there is no MFA. Use an identity provider if this ever goes beyond a demo.** The text below is the original reasoning.

## Context

No authentication exists. There are two kinds of user: anonymous callers and staff who see sensitive data.

## Problem

Which approach gives revocable staff sessions and call-scoped caller access, with the least new risk and vendor exposure?

## Decision

Use Auth.js with database sessions in Postgres for staff, and an OIDC provider when the operator has one. MFA comes from the identity provider. Callers get a short-lived signed token scoped to one call, with no account. RBAC tables and permission checks live in the app.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Clerk, WorkOS or Auth0 | Faster, with strong MFA and audit. Another processor of staff identity data, plus cost. **A good choice if Inogen or the operator already uses one** |
| Custom auth | Avoidable risk |
| JWT-only sessions | Immediate revocation is harder |
| HTTP basic auth or shared password | Acceptable only as a brief stopgap on a demo; no per-user audit |
| Caller login | Barrier in a support flow; collects more identity data |

## Benefits

Revocation is immediate. Identity data stays in the existing database. Works with enterprise identity providers later.

## Trade-offs

More maintenance than a hosted provider, and MFA depends on the configured sign-in method. An email magic link requires an email provider. Auth.js maturity with Next.js 16 must be verified at implementation.

## Security implications

The auth library becomes critical, so keep it patched. Sessions use secure, HttpOnly, SameSite cookies. State-changing requests need CSRF protection. Caller tokens are not proof of identity and mustn't grant access to anything but their own call.

## Privacy implications

Staff identity is stored locally. Callers remain anonymous unless they give a callback number.

## Consequences

Enables every staff feature. A login page, user administration and an initial admin process are needed.

## Future reconsideration conditions

The operator mandates a specific identity provider, MFA can't be met this way, or caller authentication becomes necessary to access records.
