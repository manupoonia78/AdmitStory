# 0001 — Database driver and test databases

Status: accepted (Phase 0, 2026-10-27)

## Context

Section 7.1 fixes Postgres on Neon with Drizzle. It does not say which driver to use, or what the
integration and e2e tests (Section 15) run against in CI and on a laptop.

## Decision

- **Driver:** `drizzle-orm/node-postgres` with a small `pg` Pool. It works against Neon's pooled
  connection string from Vercel's Node runtime and against any plain Postgres. Neon's HTTP driver
  only talks to Neon endpoints, so it can't run against a CI service container.
- **CI:** a `pgvector/pgvector:pg17` service container in GitHub Actions (pgvector is ready for
  Phase 3's `kb_chunks`).
- **Production and shared dev:** Neon. Use the pooled (`-pooler`) URL as `DATABASE_URL`, and point
  integration tests at a disposable dev branch.
- **Local stand-in:** `pnpm db:local` starts PGlite (`@electric-sql/pglite-socket`, Postgres in
  WebAssembly) on port 5433, so tests run without Docker or a Neon branch. It is a dev-only tool,
  not part of the stack. If anything behaves differently there, Neon/Postgres is the truth.

## Consequences

Same code path everywhere. PGlite multiplexes connections and isn't a full Postgres, so run the
integration suite on Neon or CI Postgres before relying on edge cases.
