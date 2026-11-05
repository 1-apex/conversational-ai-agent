# ADR-003: Server-side state machine; LLM proposes, policy decides

**Status:** Proposed
**Date:** 2026-11-04

## Context

The LLM picks the next agent, the browser follows it, and the browser supplies the current agent and all history. Nothing caps handoffs.

## Problem

How can the five-agent model stay while removing the LLM's and the client's control over the application?

## Decision

The server holds call state and enforces an explicit transition table. Routing is deterministic first; an LLM `proposedAgent` is checked against a handoff matrix and a per-call cap. Capabilities are set in code per agent. Output must meet a strict Zod contract. Model confidence scores aren't used. The browser keeps a separate, non-authoritative voice state.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Keep LLM-led routing | Unbounded, untestable, injection-prone |
| LangGraph or similar | Extra dependency for a small state table; safety logic should stay obvious |
| Single agent, dropping specialists | Might be simpler, but removes an existing feature with no evaluation data to justify it. Revisit with data |
| Full XState on the server | Possibly useful later; a typed table is enough at present |

## Benefits

Illegal states are impossible by construction. Handoff loops are capped. Each path can be tested exhaustively.

## Trade-offs

Deterministic routing can be rigid, so LLM proposals are kept as a release valve. Each turn adds database writes and some latency. Prompt and routing changes now need coordinating.

## Security implications

Forged history and agent claims stop working. Capabilities limit the blast radius of injection (OWASP LLM excessive agency).

## Privacy implications

Conversation state moves to the server, which means more stored data and a need for retention controls from the start.

## Consequences

The client API changes. Per-turn persistence fixes data loss on tab close. Concurrency needs a version check.

## Future reconsideration conditions

Evaluation showing specialist agents add no value; adding real tools or record access, which would need a stronger authorization model; or state complexity outgrowing a table.
