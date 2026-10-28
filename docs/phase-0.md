# Phase 0: Foundation

Built 24–29 October 2026 on branch `phase-0`. Spec: `AdmitStory_Build_Spec.md`, §16 Phase 0.
The spec calls the product "Folio"; it is now AdmitStory, and the name lives only in
`APP_NAME` (`packages/shared/src/brand.ts`).

## Acceptance criteria

| Criterion (spec §16)                               | Status | How it is checked                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign-in works end to end                           | Met    | `apps/web/e2e/magic-link.spec.ts`: sign-in form → email link → `/welcome` (18+ and terms) → `/home` → sign out; the used link is rejected. `e2e/passkey.spec.ts`: add a passkey, sign out, sign in with it (button and autofill).                                                                                                                              |
| A sample `util.title` call records tokens and cost | Met    | `apps/web/lib/ai.int.test.ts` runs `util.title` through the app's `ai` against the real database: one `usage_ledger` row with the recorded token counts and a cost above zero, equal to `pricing.ts`. `e2e/ai-smoke.spec.ts` proves the same inside the built app through a localhost-only route, `POST /api/dev/ai-smoke`. Also unit-tested in `packages/ai`. |
| CI runs unit + e2e smoke                           | Ready  | `.github/workflows/ci.yml`: format, lint, typecheck and unit tests, then migrations, integration tests, build, e2e and Lighthouse against a Postgres service. Not yet run on GitHub (nothing is pushed).                                                                                                                                                       |
| Lighthouse ≥ 90 on the empty shell                 | Met    | `pnpm lighthouse`, mobile preset, median of 3 runs: `/sign-in` 99 / 100 / 100 and the signed-in `/home` 97 / 100 / 100 (performance / accessibility / best practices). SEO is excluded because app pages are deliberately not indexed.                                                                                                                         |

Last full local run (29 Oct, fresh database, after the review fixes): format, lint and typecheck
clean; 528 unit tests, 16 integration tests and 34 e2e tests passed; Lighthouse as above. Every
route is under the 180 KB gzipped JavaScript budget (§6.9); the largest is `/settings/security` at
172.5 KB.

## What was built

**Repository (§17).** pnpm + Turborepo monorepo at the repo root (it stands in for the spec's
`folio/` folder), packages scoped `@admitstory/*`, TypeScript strict, ESLint, Prettier, Vitest,
Playwright, GitHub Actions. Every directory in §17 exists; folders for later features (`dossier`, `kits/[id]`, `workspace/[deliverableId]`, `(expert)`, `(admin)`, `r/[token]`) hold only a README naming their phase. Packages for later phases (`kb`,
`linters`, `slots`, `voice`, `payments`, `apps/voice-agent`) are stubs with a README naming their
phase. ESLint enforces two §0 rules: model IDs appear only in `packages/ai/src/routing.ts`, and the
Anthropic SDK is imported only inside `packages/ai`.

**`packages/db`.** Drizzle schema and first migration for the Better Auth tables (users,
sessions, accounts, verifications, passkeys), `profiles`, `roles` and `usage_ledger`. Every table
has a database-generated uuid id, `created_at` and `updated_at`. Data access goes through
repositories that scope every query to the signed-in user. A new account gets its profile and the
`applicant` role automatically.

**`packages/ai`.** `ai.run(task, input)` follows the eight steps in §8.4: route lookup, budget
check, request built in the §8.2 cache layout, structured output, retries then fallback model,
Zod validation with one repair attempt, a ledger row per API attempt, and a Langfuse trace.
`routing.ts` holds all 28 routes from §8.3 as data; only `util.title` is runnable in Phase 0.
`pricing.ts` has the live 24 Oct prices, including Haiku 5.5's long-prompt tier. `AI_MODE=replay`
serves recorded responses from `fixtures/llm-replays/` and never touches the network. Its data folders (prompts, canon, replays) are found from the repo root at runtime, so the Next.js build can bundle it.

**Canon.** The 15 Appendix A files in `knowledge/canon/`, copied word for word (checked by script),
and a loader that finds all 139 rule IDs, picks canon by file or by rule, and compiles the same
input to the same text every time so the prompt cache keeps hitting.

**`packages/ui`.** The §6.2 colour tokens in light and dark, Schibsted Grotesk and Newsreader, the
type scale, base components on Radix, the app shell with the left rail (bottom tab bar on mobile),
an account menu, and a ⌘K / Ctrl K command palette. Theme follows the system, with a manual
override that doesn't flash on load.

**`apps/web`.** Sign-in by magic link, Google (when configured) and passkeys, with Turnstile on the
sign-in-link request. A first sign-in check for 18+ and the §14.7 integrity commitments. The shell
with calm placeholder pages for Home, Story, Schools, Interview, Connect and Tracker, plus Settings
and passkey management. Sentry (with a scrubber that removes bodies, cookies and any text content),
PostHog (all text masked, loaded only when idle), and Inngest (one function: `signup_completed`).

**`packages/emails`.** The sign-in email (HTML and plain text).

## How to run it

Requires Node 24+ and pnpm 10 (`npm i -g pnpm@10`).

```sh
pnpm install
pnpm db:local        # local Postgres stand-in on :5433; leave it running (or use Neon, below)
pnpm db:migrate
pnpm dev             # http://localhost:3000
```

Settings live in `.env.local` at the repo root (never committed; `.env.example` lists every
variable). Locally, sign-in emails are written to `.outbox/` instead of being sent; open the
newest file and follow the link.

Checks: `pnpm lint`, `pnpm typecheck`, `pnpm test` (unit), `pnpm test:integration` (needs the
database), `pnpm build && pnpm test:e2e`, `pnpm lighthouse`.

**Switching to Neon:** put your dev branch's pooled connection string in `.env.local` as
`DATABASE_URL`, then run `pnpm db:migrate` and `pnpm test:integration`. Use a disposable branch:
tests create and delete synthetic `test-…@example.test` users.

## The two placeholders you asked me to explain

**`EMAIL_FROM` (item 4).** The sender shown on sign-in emails, for example
`AdmitStory <hello@admitstory.com>`. Resend only sends from a domain you have verified with them,
which also depends on choosing the domain (spec §18, decision 1). Until both are set, sign-in works
only on localhost, where emails go to `.outbox/`. It isn't in Section 17's list, so it sits under
"Additions" in `.env.example`.

The other half of item 4 needed no new variables. Next.js only exposes variables starting with
`NEXT_PUBLIC_` to the browser, and four of Section 17's names are needed there (`TURNSTILE_SITE_KEY`,
`POSTHOG_KEY`, `POSTHOG_HOST`, `SENTRY_DSN`). `next.config.ts` passes them through under their
Section 17 names, so `.env.example` stays as the spec wrote it.

**`LANGFUSE_HOST` (item 5).** Langfuse is where every AI call is traced: inputs (when allowed),
outputs, tokens, cost and prompt version. You can use Langfuse Cloud (set this to
`https://cloud.langfuse.com`, or the EU/US region URL your account shows) or run it yourself. If you
self-host an older Langfuse v3 server, tell me: it needs SDK v5 instead of the v6 used now.
Without keys, tracing is simply off; the cost ledger works either way.

## Deviations from the spec, and why

- **Ledger columns** (approved; ADR 0004). `cache_write_tokens` is split into 5-minute and 1-hour
  columns, which cost different amounts, and the table adds `served_model`, `effort`,
  `stop_reason`, `attempt_kind`, `ai_mode`, `run_id`, `school_pack_id`. One row per API attempt.
- **`improve_folio_opt_in` is `improve_product_opt_in`**, so the old name isn't built into the
  schema. Profiles also gained `age_confirmed_at`, `terms_version` and `terms_accepted_at`
  (approved).
- **Route budgets.** Thinking tokens count toward `max_tokens` on all 5.5 models, so each route
  keeps the spec's "Max output" as `visibleBudget` and sends a larger `maxTokens`.
  `util.title` runs on Haiku with thinking off.
- **No `temperature`.** SDK 1.x rejects sampling parameters on every model, so CI is deterministic
  through replay only.
- **Server-side refusal fallback** (`fallbacks: "default"`) is enabled on live Opus and Sonnet
  routes, as Anthropic now recommends. It is separate from the spec's overload fallback.
- **Admin route overrides** store model keys (`opus`, `sonnet`, `haiku`), never model IDs, so IDs
  stay in `routing.ts` only.
- **Canon rule references** use two-digit IDs (`CRAFT-03`); §8.5's `CRAFT-3` is read as the same
  rule. Five Appendix A files had no title after the file name; their titles come from the name.
- **Cache sharing is lower than §12.1 assumes.** The output schema is part of the cached prefix, so
  caches are per agent rather than per model, and real canon subsets are much smaller than the
  §12.2 estimates. The ledger will show real hit rates.
- **Design tokens.** No values changed, but: `--record` is used only for icons and fills (3.9:1 on
  white is too low for text); primary buttons use `--paper` text (white on dark-mode `--ink` is
  2.4:1); form-control borders use `--slate` (`--line` is 1.3:1, below WCAG's 3:1 for controls);
  the smallest type step is 13px (the scale's 12.8px is under the spec's own minimum); breakpoints
  are 640 / 1024 / 1280 as in §6.9.
- **Mobile account menu** sits in a slim top bar, not as a seventh tab: seven labelled tabs don't
  fit a 375px screen at the 13px minimum.
- **Tooling.** TypeScript 6.0 rather than 7.0 (ADR 0005); `pg` driver plus a CI Postgres service
  and an optional local PGlite stand-in (ADR 0001); a localhost-only email outbox for tests
  (ADR 0002); Langfuse on its own tracer so it doesn't clash with Sentry (ADR 0003).
- **Things the spec doesn't define, written for Phase 0:** the `util.title` prompt and schema, the
  replay recording format, the base component list, placeholder copy (in §6.7's voice), and the
  `/api/auth` and `/api/inngest` routes, which §11 omits.

## What the review caught

Four independent reviewers (security and auth, the AI wrapper, accessibility and design,
completeness against the spec) read the finished code. Everything they proved was fixed and
re-tested:

- **`ai.run()` couldn't run inside the built app.** The package located its prompt, canon and
  replay folders in a way Turbopack can't bundle; the ledger test passed only because Vitest
  doesn't bundle. Folders are now found from the repo root at runtime, and an e2e test calls
  `util.title` through the built app.
- **Sentry could still collect IP addresses and AI content.** `sendDefaultPii` no longer exists in
  Sentry v11. The app now sets `dataCollection` with every category off, and the scrubber also
  cleans streamed spans (IP headers, query strings, `gen_ai.*` attributes).
- **`INNGEST_DEV=0` turned on dev mode,** which skips request signing. The SDK now parses it, and on
  any non-localhost host the app refuses dev mode and requires `INNGEST_SIGNING_KEY`.
- **The 18+ and terms check was only in the layout.** Every signed-in page and server action now
  checks it (sign-out is the one exception, so nobody gets stuck). `APP_URL` must be https off
  localhost, so session cookies are always marked secure.
- **Accessibility:**
  - the rail now scrolls on short screens such as a phone held sideways;
  - form errors are announced, and focus moves to the first invalid field;
  - live regions stay in the accessibility tree;
  - focus is kept when you switch to a different email;
  - ticked checkboxes survive a validation error.
- **Design rules:** the toast now repeats its button's verb ("Save name" → "Name saved"),
  placeholder text is one left-aligned line, and the theme toggle uses the 6px control radius.
- **AI accounting:**
  - a fallback edge case was priced at the wrong model's rates;
  - an empty first reply made the repair attempt fail with a 400;
  - Langfuse received raw output that skipped field redaction.

  All three are fixed. Retries are read as three retries after the first request (4 requests per
  model before the fallback model).

## Not done, or needs you

- **Record `util.title` live.** The committed recording is hand-made and marked `synthetic`. Once
  `ANTHROPIC_API_KEY` is in `.env.local`, run `AI_MODE=live pnpm --filter @admitstory/ai
record:util-title` (well under $0.01).
- **Decisions still open:** the domain (passkeys only work on localhost until then, and Resend needs
  it), `EMAIL_FROM`, Langfuse cloud or self-hosted, and the full terms of use (acceptance is stored
  as `integrity-v1-draft`).
- **Manual checks with real keys,** which CI can't do: Google sign-in, Resend delivery, Turnstile
  production keys, Sentry scrubbing in the dashboard, PostHog masking in replays, Langfuse traces,
  Inngest with signing keys (or `INNGEST_DEV=1` with the Inngest dev server).
- **CI on GitHub** hasn't run yet; it will on the first push or pull request.

## Left for later phases

- **Phase 1:** first-run onboarding (§5.1; the spec assigns it to no phase, and it ends in Studio,
  so Phase 1 fits), `ai.run.stream()` for SSE, content encryption helpers (`CONTENT_ENCRYPTION_*`),
  the remaining Studio agents and their prompts.
- **Phase 3:** the database overlay for prompts, canon versions and route overrides (the file-based
  registries are the seed); `audit_log` before any admin access to user content; Batch API transport
  for `kb.normalize` and `kb.refresh_check`.
- **Phase 4:** kit and entitlement tables. Until then every user counts as free for budget caps.
- **Phase 9:** full CSP, Upstash rate limits in place of Better Auth's in-memory limiter, the
  marketing site, and the privacy and terms pages.
