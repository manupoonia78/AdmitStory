# @admitstory/db

Postgres schema, migrations and ownership-checked repositories (spec §10).
Production runs on Neon; the code uses `drizzle-orm/node-postgres` over a `pg`
pool, so it also runs against plain Postgres 16/17 locally and in CI.

## Scripts

| Command                                  | What it does                                                                                                                                                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm db:generate`                       | Diff `src/schema` against the last snapshot and write a new SQL migration to `migrations/`. Needs no database. Name it with `pnpm --filter @admitstory/db generate --name <change>`. |
| `pnpm db:migrate`                        | Apply pending migrations to `DATABASE_URL` (read from the repo-root `.env.local`).                                                                                                   |
| `pnpm --filter @admitstory/db check`     | Check the migration history for conflicts.                                                                                                                                           |
| `pnpm --filter @admitstory/db typecheck` | Type-check the package.                                                                                                                                                              |
| `pnpm test` / `pnpm test:integration`    | Unit tests need no database; integration tests (`*.int.test.ts`) need `DATABASE_URL` and fail, rather than skip, without it.                                                         |

Phase 3 scripts:

- `pnpm --filter @admitstory/db seed:schools` upserts the Appendix H schools with a draft
  `2026-27` cycle each, and the §14.2 AI policies as UNVERIFIED (`verified_at` null). Safe to re-run.
- `pnpm --filter @admitstory/db admin:grant <email>` gives an existing account the admin role and
  writes an `audit_log` row.

Migration 0004 runs `CREATE EXTENSION IF NOT EXISTS vector`, so a local Postgres needs pgvector
(0.8+ for `hnsw.iterative_scan`).

Commit the generated SQL and `migrations/meta`. A unit test fails if a table's
columns differ from the latest snapshot, so schema edits without a migration
are caught in CI.

With Neon, use the pooled (`-pooler`) connection string. Point integration
tests at a disposable dev branch, never production: they create and delete
synthetic users (`test-<uuid>@example.test`).

## Tables

- `users`, `sessions`, `accounts`, `verifications`, `passkeys`: Better Auth
  1.7 core plus the passkey plugin. Export keys are plural, so the Drizzle
  adapter must be configured with `usePlural: true` and
  `advanced.database.generateId: "uuid"`.
- `profiles`: one row per user, created by `onUserCreated` (call it from
  Better Auth's `databaseHooks.user.create.after`).
- `roles`: `applicant` | `expert` | `guide` | `admin`, unique per user.
- `usage_ledger`: one row per AI API attempt; `run_id` groups the attempts of
  one `ai.run()` call. `user_id` is set to null when the account is deleted, so
  cost history survives without identifying anyone.

Every table has `id uuid default gen_random_uuid()`, `created_at` and
`updated_at` (timestamptz). Drizzle sets `updated_at` on every update.

## The ownership rule

User-owned tables are read and written only through `src/repos/*`. Every repo
function takes the acting user's id and scopes every statement by it. Route
handlers pass the id from the authenticated session, never from the request
body. Unit tests check that every statement is bound to the caller's
`user_id`, and integration tests check that one user can't read or change
another's rows.

`grantRole` only writes the row. The caller decides who may grant elevated
roles. `recordUsage`, `costForUser` and `costForKit` are system operations
used by `ai.run()` for budgets (§12.4), not user-facing reads.

```ts
import { createUsageLedgerSink, getDb, getProfile, updateProfile } from "@admitstory/db";

const db = getDb();
const profile = await getProfile(db, session.user.id);
await updateProfile(db, session.user.id, { timezone: "Asia/Kolkata", studioMode: "standard" });
const ledger = createUsageLedgerSink(db); // passed to packages/ai
```

## Schools, knowledge and admin (Phase 3)

- Public reads take a plain handle and return only published data: `searchSchools`,
  `listSeedSchools`, `getSchoolBySlug`, `getPublishedPack`, `getVerifiedAiPolicy`.
- Admin repositories (schools, cycles, packs, KB sources/chunks/proposals, canon, prompts, AI
  policies, audit) take an `AdminContext` from `requireAdmin(db, userId)` (checks `roles`) or, for
  jobs and scripts only, `systemContext(db, job)`. Every mutation that changes a row writes
  `audit_log` in the same transaction (an update or delete that finds nothing writes none).
- `createChunkStore(db)` implements packages/kb's `ChunkStore`: pgvector cosine search and
  `websearch_to_tsquery` full-text search, filtered by school, cycle (plus evergreen chunks),
  source type (third-party reference excluded unless asked for) and minimum trust.
- `kb_sources.text_encrypted` uses the same content keyring as the applicant's sources (§14.4).

## Payments, kits and the Workspace (Phase 4)

Migration `0005_payments_and_kits` adds `checkouts`, `purchases`, `entitlements`, `webhook_events`,
`kit_stages`, `deliverables`, `angles`, `drafts`, `checks`, `need_items`, `verify_items`,
`revision_requests` and `feedback`, and gives `kits` its pipeline columns (`stage`, `started_at`,
`finished_at`, `regenerations`, `error`).

- **Webhook safety.** `applyPurchaseCompleted` runs in one transaction: it claims the event id in
  `webhook_events`, checks user, product and school cycle against the `checkouts` row our server
  wrote (custom data is buyer-editable), inserts the purchase (unique `provider_txn_id`), grants the
  entitlement, unlocks the school and upgrades the preview kit to `pending`. Replays return
  `duplicate`; disagreements return `mismatch` and grant nothing. `applyRefund` revokes the
  entitlement and keeps the dossier, kit and drafts.
- **Preview reuse.** The preview's positioning and file map are kept on unlock only while the latest
  dossier snapshot is the one they were built from; they are then recorded as finished stages 2–3.
- **Fair use.** `consumeEntitlement` increments a counter and checks its limit in one UPDATE, so
  concurrent requests cannot overshoot. Limits default to `DEFAULT_KIT_LIMITS` (§5.6) and are fixed
  on the entitlement when it is granted.
- **Ownership chain.** user → kit → deliverable → draft. Child rows are only created under a parent
  the caller owns and carry that `user_id`, so every statement is scoped without a join.
- **Versions.** Drafts are append-only; one is current per deliverable (partial unique index).
  Restore copies an old version into a new current one. `markDraftsStale` flags drafts whose
  `used_fact_codes`/`used_story_codes` overlap an edited fact or story (§5.3 AC).
- **Budget.** `isPaidUser` (also on the ledger sink) tells `ai.run` to apply the per-kit caps
  instead of the free-user cap; `getKitCost` sums `usage_ledger` per task.
