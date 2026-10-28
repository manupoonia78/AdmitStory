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
