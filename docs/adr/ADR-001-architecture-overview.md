# ADR-001: Modular monolith on the existing stack

**Status:** Implemented
**Date:** 2026-11-04

## Context

The app is about 2,600 lines of Next.js with Neon and optional Upstash. Control sits in the browser and in prompts.

## Problem

Safety, auth and evaluation need a trusted server-side home. How much should the architecture change to provide one?

## Decision

Keep one Next.js application with strict internal modules (`lib/safety`, `lib/conversation`, and so on) and enforce dependency direction. Put the turn pipeline on the server. Add no new services or datastores.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Separate Python AI service | Adds deployment, auth and network boundaries with no present need; TypeScript can do this work |
| Microservices | No scale or team need; more attack surface |
| Full rewrite | Would discard tuned voice behaviour and add risk |
| Agent framework | Hides control flow where explicit control matters most |
| Keep logic in the browser | The client cannot be a trust boundary |

## Benefits

One deployment and one type system. The evaluation runner can call the same pipeline directly. Simple to operate at this scale.

## Trade-offs

Discipline is needed to keep modules separate; add a lint rule for import boundaries. Serverless duration limits constrain long jobs. All parts scale together.

## Security implications

A compromised app process reaches everything, so database roles, secret scoping and audit logging must compensate. Fewer network boundaries also means fewer to secure.

## Privacy implications

A single processing boundary simplifies data-flow mapping. It doesn't reduce any obligations toward outside providers.

## Consequences

`CallStudio.tsx` shrinks gradually. API contracts change, and old routes are removed once the browser moves over.

## Future reconsideration conditions

Sustained job duration above platform limits, independent scaling needs, separate team ownership, or real telephony needing long-lived connections.
