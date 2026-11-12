# Local database and app for redesign screenshots

Everything a session needs to open the signed-in screens without touching production. These are
the exact commands used in Phase 0 (2026-11-12); they worked end to end.

**Why this exists.** The repo-root `.env.local` has the **production** `DATABASE_URL`. Scripts and
the app load that file but never override a variable that is already set in the shell
(`dotenv` in `packages/db/src/env.ts` and `apps/web/next.config.ts`; `process.loadEnvFile` in the
seed script). So every command below runs with `DATABASE_URL` set in the shell first. If you ever
run `migrate`, `seed:*`, `packs:publish`, `admin:*` or `connect:import` without it, it hits prod.

Leave port **5433** alone: that's Manu's own database. This uses **5455**.

## 1. Start Postgres (throwaway, in a scratch directory)

`postgresql@17` and `pgvector` are already installed with Homebrew.

```sh
export PGBIN=/opt/homebrew/opt/postgresql@17/bin
export PGDIR="$TMPDIR/admitstories-redesign-pg"        # any scratch directory outside the repo

[ -d "$PGDIR" ] || "$PGBIN/initdb" -D "$PGDIR" -U postgres --auth=trust -E UTF8
"$PGBIN/pg_ctl" -D "$PGDIR" -l "$PGDIR.log" -o "-p 5455 -k '' -h 127.0.0.1" start
"$PGBIN/createdb" -h 127.0.0.1 -p 5455 -U postgres admitstory_redesign   # first time only
```

`-k ''` turns the Unix socket off (scratch paths are too long for one); connections are TCP on
127.0.0.1 only. A new session's scratch directory is empty, so expect to run `initdb`, `createdb`,
migrate and seed again: it takes under a minute.

Stop it when done: `"$PGBIN/pg_ctl" -D "$PGDIR" stop`.

## 2. The local environment

Save as `local-env.sh` in the scratch directory and `source` it in every shell that runs a script
or the app. Blank values switch each outside service to its local fake.

```sh
export DATABASE_URL="postgres://postgres@127.0.0.1:5455/admitstory_redesign"
export APP_URL="http://localhost:3100"
export SITE_URL=""
export RESEND_API_KEY="" TURNSTILE_SITE_KEY="" TURNSTILE_SECRET_KEY="" ANTHROPIC_API_KEY=""
export DODO_PAYMENTS_API_KEY="" DODO_PAYMENTS_WEBHOOK_KEY="" DODO_LIVE_API_KEY=""
export DODO_PRODUCT_SCHOOL_KIT="" DODO_PRODUCT_PACK5="" DODO_PRODUCT_PACK10=""
export POSTHOG_KEY="" SENTRY_DSN="" SENTRY_AUTH_TOKEN="" DEEPGRAM_API_KEY=""
export AI_MODE="replay" INNGEST_DEV="" INNGEST_EVENT_KEY="" PROTOTYPES_ENABLED="1"
```

What the blanks do:

| Blank                                 | Effect                                                                                   |
| ------------------------------------- | ---------------------------------------------------------------------------------------- |
| `RESEND_API_KEY`                      | sign-in emails are written to `.outbox/` at the repo root instead of sent                |
| `TURNSTILE_*`                         | no bot check on `/sign-in` (the key is inlined at build time, so build with it blank)    |
| `ANTHROPIC_API_KEY`, `AI_MODE=replay` | AI calls answer from `fixtures/llm-replays`; anything without a fixture fails quietly    |
| `DODO_*`                              | the localhost-only test checkout replaces Dodo, so nothing can be charged                |
| `INNGEST_*`                           | background jobs run inline after the response                                            |
| `POSTHOG_KEY`, `SENTRY_DSN`           | no analytics or error reports from screenshot runs                                       |
| `PROTOTYPES_ENABLED=1`                | `/prototype/*` renders (populated Studio, editor, kit and interview room on sample data) |

Port 3100 keeps clear of a dev server on 3000.

## 3. Migrate and seed (local only)

```sh
source local-env.sh
node -e 'const u=new URL(process.env.DATABASE_URL); if(u.hostname!=="127.0.0.1"||u.port!=="5455"){console.error("NOT LOCAL");process.exit(1)} console.log("db target ok:",u.host)'

pnpm --filter @admitstory/db migrate
pnpm --filter @admitstory/web seed:fixtures
```

Run the `node -e` guard every time: it must print `db target ok: 127.0.0.1:5455` before anything
else runs. `seed:fixtures` loads six **fictional** schools (Halvorsen, Kestrel Lake, Marrowgate,
Saltmarsh, Ventrelle with packs; Quillfeather as "Pack coming soon") and refuses to run unless
`APP_URL` is localhost.

## 4. Build and start the app

```sh
source local-env.sh
cd apps/web
pnpm exec next build                       # about 2 minutes; rebuild after code changes
pnpm exec next start --port 3100 &         # or `pnpm exec next dev --port 3100` while building screens
curl -s http://localhost:3100/api/health   # {"ok":true,"db":"ok","redis":"off","version":"local"}
```

Use the production build for screenshots, bundle checks and Lighthouse. `next dev` is fine while
iterating on a screen, but its numbers mean nothing.

## 5. Sign in

By hand: open `http://localhost:3100/sign-in`, enter any `@example.test` address, then open the
newest `.outbox/*.json` and follow the `…/api/auth/magic-link/verify?…` link in its `text`.

`shoot.mjs` does the same automatically as `redesign-shots@example.test`. The first time, it
captures `/welcome` and the four `/first-run` steps on the way through (they can't be reopened
once completed; pass `--email fresh-name@example.test` to capture them again).

## 6. Take the screenshots

```sh
node docs/design/redesign/shoot.mjs                         # shots/before/, Day, every route
node docs/design/redesign/shoot.mjs --app --theme night     # signed-in routes in Night ("-night")
node docs/design/redesign/shoot.mjs --out after --only landing
node docs/design/redesign/shoot.mjs --out after --only landing --reduced   # reduced motion ("-rm")
```

Each run writes `shots/<out>/report[-night][-rm].json` with the 375 px overflow check, console
errors, failed requests and hydration warnings for every route. The script refuses any base URL
that isn't localhost.

Sample data it sets up through the app's own API, as the signed-in user (idempotent):

- three schools on the list (Halvorsen, Kestrel Lake, Quillfeather);
- Halvorsen unlocked with the test checkout, so the school workspace and the editor open;
- one fictional recommender (Dana Whitlock).

## What can't be reached locally

Known on 2026-11-12, with blank AI keys:

- **Story Studio can't start a session** (`POST /api/studio/sessions` returns 500: there's no
  replay for a new account's first question). `/studio` renders its idle state. The populated
  Studio is `ref-prototype-studio`.
- **The kit stops partway through drafting**, so the workspace opens with "Not drafted yet". The
  populated editor (provenance, margin panel, word count) is `ref-prototype-workspace`; kit
  assembly is `ref-prototype-kit`; the interview room is `ref-prototype-duet`.
- **The recommender portal `/r/[token]`** needs a built brief and a sent invitation, which need
  stories. Only `/r` (ask for a new link) and the closed-link state are captured.
- **Dossier, Profile Read, résumé and Connect** show their empty or locked states: the account has
  no stories and the directory is empty.
- `/kits/[id]`, `/schools/[id]/recommenders` and `/schools/[id]/resume` now redirect into the
  school workspace, and `/schools/[id]` redirects to `/unlock` until the school is paid for.
  `report.json` records where each one landed.

Phases 5 to 7 need populated versions of these screens. The plan (SPEC §12) is a hidden
`/prototype/redesign/*` gallery that renders each real screen component with sample props, the way
the Phase 0.5 prototypes do, so no AI key and no production data is ever involved.
