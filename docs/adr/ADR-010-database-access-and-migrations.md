# ADR-010: Versioned migrations with Drizzle; least-privilege roles

**Status:** Implemented with Drizzle, tested on PGlite. Separate database roles aren't done, and Neon isn't tested.
**Date:** 2026-11-04

## Context

`ensureSchema()` runs DDL at request time with the application's credentials. Queries use tagged SQL through the Neon driver. The planned schema grows to many related tables.

## Problem

How can schema changes be made safe and reviewable, and how can queries be kept from missing organization scoping?

## Decision

Use Drizzle ORM and drizzle-kit with the Neon driver. Migrations are generated SQL files, reviewed and committed, and applied only by CI with a migrator role. The runtime role has no DDL rights. Repository functions require `organizationId`. pgvector and raw SQL stay available where needed.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Prisma | Heavier; Drizzle is closer to SQL, which suits pgvector and RLS work. Viable alternative |
| Raw SQL with `node-pg-migrate` | **Fewest dependencies, a real option.** Loses typed queries, which help enforce scoping across about 25 tables |
| Keep `ensureSchema` | Runtime DDL, no history, excessive privilege |
| Row-level security alone | Valuable second layer, but needs per-request session settings that must be verified with the serverless driver |

## Benefits

Typed queries, reviewable migrations, simple rollout on Neon branches.

## Trade-offs

Adds a dependency and something new to learn. Generated migrations still need human review. ORMs can obscure performance issues.

## Security implications

Removes DDL rights from the runtime path. Parameterized queries remain the default. The migrator credential exists only in CI.

## Privacy implications

Retention and deletion become schema-level concerns. Migrations must never copy sensitive data into logs or seed files.

## Consequences

Existing `calls` data needs an explicit decision, and it won't be carried over by default. Every schema change goes through a PR and CI.

## Future reconsideration conditions

Drizzle blocks a required Postgres feature, or a move away from Neon.
