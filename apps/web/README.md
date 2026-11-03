# @admitstory/web

The Next.js app (App Router, React 19, Tailwind 4). Phase 0 ships sign-in, the first-run gate,
the signed-in shell with placeholder pages, settings, and the wiring for AI metering, email,
analytics, error reporting and background jobs.

## Running it

```sh
pnpm db:local            # local Postgres stand-in on :5433 (keep it running)
pnpm db:migrate
pnpm dev                 # http://localhost:3000
```

Configuration comes from the repo-root `.env.local`. Next only reads `.env*` files from
`apps/web`, so `next.config.ts` loads the root file itself; variables already set in the
environment (CI, Vercel) win. `lib/env.ts` validates the server environment with Zod on first
use, so `next build` never needs secrets. When `APP_URL` is not localhost it fails closed: the URL
must be https (session cookies are Secure), `INNGEST_SIGNING_KEY` is required, and an
`INNGEST_DEV` that turns on Inngest dev mode is rejected (see `inngest/README.md`).

The four browser-side values keep their Section 17 names (no `NEXT_PUBLIC_` prefix, agreed with
the owner) and are inlined at build time through `next.config.ts` `env`: `TURNSTILE_SITE_KEY`,
`POSTHOG_KEY`, `POSTHOG_HOST`, `SENTRY_DSN`. Changing one needs a rebuild.

## Scripts

| Command                                      | What it does                                                                                  |
| -------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `pnpm build`                                 | `next build` (Turbopack).                                                                     |
| `pnpm --filter @admitstory/web bundle:check` | First-load JS per route, gzipped, against the 160 KB budget (spec §6.11). Run after a build.  |
| `pnpm test:e2e`                              | Playwright (Chromium). Starts `next start` on `APP_URL`, building first if there is no build. |
| `pnpm lighthouse`                            | Lighthouse, mobile preset, on `/sign-in` and the signed-in `/home`; fails below 90.           |

React and the Next App Router client take 140.5 KB gz of the 160 KB budget before a route has
rendered anything, so a route has roughly 19 KB for its own code. Anything heavier is split and
loaded on demand (spec §6.11): the command palette on first open, the account menu when the page
is idle, and each Phase 0.5 prototype's demo — Motion, the Voiceprint and its fake-data script —
behind the `*-host.tsx` beside its page. A split demo is still server-rendered, so the screen
arrives whole; only its behaviour starts once its chunk has landed.

Unit tests (`*.test.ts`) and integration tests (`*.int.test.ts`, need the database) run from the
repo root with `pnpm test` and `pnpm test:integration`.

## Sign-in (spec §5.1)

Better Auth in `lib/auth.ts`, served at `/api/auth/*`. No passwords anywhere.

- **Magic link.** Links last 10 minutes, are single use, and are stored hashed. New accounts land
  on `/welcome`; existing ones on `/home`; failures come back to `/sign-in?error=…`, which
  explains what happened.
- **Google.** Turned on only when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are both set; the
  button is hidden otherwise. Google's `email_verified` flag is copied to the user.
- **Passkeys.** Added and managed on `/settings/security`; used from the sign-in button or from
  the email field's autofill. The relying party ID is `APP_URL`'s host, so **passkeys only work on
  localhost until the production domain is decided** (spec §18.1). Passkeys registered on one
  domain never work on another.
- **Turnstile** guards `POST /api/auth/sign-in/magic-link` only (the one route that sends email to
  any address). The browser sends the token in the `x-captcha-response` header. On localhost
  without keys the check is skipped; on any other host a missing secret stops the app from
  starting.
- **Rate limits.** Better Auth's built-in limiter (in memory): 5 sign-in links per minute per IP,
  and its defaults elsewhere. It is per server instance, so on Vercel it only slows abuse down;
  Upstash replaces it in Phase 9 (spec §12.4).
- **Email verification.** Magic link and Google both mark the email verified.
  `requireVerifiedEmail()` (`lib/session.ts`) will gate voice routes from Phase 2.
- **Sign-up hook.** `databaseHooks.user.create.after` creates the profile and `applicant` role
  (`onUserCreated`), then sends the Inngest event `user/created`. Sending never throws and gives
  up after 2 s, so sign-up never waits on Inngest.

## Email (ADR 0002)

`lib/email.ts` sends through Resend when `RESEND_API_KEY` and `EMAIL_FROM` are set. Otherwise,
and only when `APP_URL` is localhost, each email is written to `.outbox/` at the repo root (this
is how e2e tests and `pnpm lighthouse` read sign-in links). On any other host it fails with a
clear error. Links and bodies are never logged.

## First-run gate

Until a profile has both `age_confirmed_at` and `terms_accepted_at`, every signed-in page
redirects to `/welcome`, which asks for the 18+ confirmation (spec §14.4) and the integrity
commitments from spec §14.7. Acceptance is stored with `terms_version = "integrity-v1-draft"`.
**The full terms of use are still to be written by the owner**; when they are, bump the version in
`lib/terms.ts`.

The gate is checked on every request, not only in the `(app)` layout (Next renders a layout and
its page in parallel, and a server action never runs the layout). Every `(app)` page calls
`requireOnboardedUser()` (`lib/app-user.ts`), which redirects to `/welcome`; every server action
that acts for the user calls `requireOnboardedUser("action")`, which throws
`WelcomeNotCompletedError` (403). Sign-out is the one action left ungated.
`lib/welcome-gate.test.ts` fails if a page or action under `app/(app)` skips it. The layout's own
check stays, for UX.

On `/welcome`, a failed submit keeps the boxes the person ticked (the action returns them and the
form renders them as defaults, because React resets an action form after it runs) and moves focus
to the first box still needed.

## Observability

- **Sentry** starts only when `SENTRY_DSN` is set: `instrumentation.ts` (server and edge) and
  `instrumentation-client.ts` (browser, loaded as its own chunk, without Session Replay).
  `next.config.ts` wraps the config with `withSentryConfig` only when a DSN or auth token is set.
  What leaves the app (spec §14.4), in `lib/observability/`:
  - `sentry-options.ts` sets an explicit v11 `dataCollection` with every category off: user info
    and IP inference, cookies, request and response headers, bodies, URL query parameters,
    GraphQL, generative-AI and MCP inputs and outputs, database query data, queue arguments and
    stack-frame variables. (`sendDefaultPii` does nothing in `@sentry/*` 11; without
    `dataCollection` all of these are collected.)
  - Spans are streamed (`traceLifecycle: "stream"`, the v11 default, set explicitly), so
    `beforeSendTransaction` never runs. `beforeSendSpan` (`scrubSpan`) removes query strings from
    `url.full`, `http.url`, `http.target` and span names, and drops `url.query`,
    `client.address` and other client IP attributes, `user.*` fields other than `user.id`,
    `http.request.header.*`/`http.response.header.*`, bodies and every `gen_ai.*` attribute.
  - `beforeSend` (`scrubEvent`) removes request bodies, cookies, query strings, server variables,
    auth headers and client IP headers (`x-forwarded-for`, `x-real-ip`, `cf-connecting-ip`,
    `true-client-ip`, `forwarded`, Vercel's `x-vercel-*` IP and geo headers), user fields other
    than the id and Zod issue values, and applies the span rules to the trace context and to
    any transaction spans.
- **PostHog** loads in the browser only with `POSTHOG_KEY`, after the page is idle. Inputs and
  text are masked, autocapture records no element text, and people are identified by user id
  only. Server events go through `lib/analytics/server.ts` (posthog-node).
- **Langfuse** lives inside `@admitstory/ai`. Route handlers that call `ai().run()` must
  `await ai().flush()` before returning.

## AI smoke route (Phase 0 acceptance)

`POST /api/dev/ai-smoke` proves, inside the built app, that a sample `util.title` call records
tokens and cost in `usage_ledger` (spec §16). It is a 404 unless `APP_URL` is localhost (the same
rule as the email outbox, ADR 0002) and the request has a session, and a 409 unless
`AI_MODE=replay`, so it never reaches the network. It runs `ai().run("util.title", { text })` on
the synthetic sample passage (`packages/ai/scripts/util-title-sample.ts`) for the signed-in user,
awaits `ai().flush()`, and returns the title and the new ledger row's id, task, mode, token counts
and `costUsd`. `e2e/ai-smoke.spec.ts` calls it and reads the row back from the database.

## Accessibility notes

- Status and error messages use `components/live-message.tsx` (`StatusMessage`, `AlertMessage`):
  the live region is always in the accessibility tree and only its text changes, so messages are
  announced. Never hide an empty live region with `display: none` (`empty:hidden`).
- After a failed submit, focus moves to the first invalid field (`focusFirstInvalid` from
  `@admitstory/ui`), which reads its label, state and error. "Use a different email" returns focus
  to the email field, filled in with the last address.
- Toasts repeat the button's verb (spec §6.7); passkey copy lives in
  `app/(app)/settings/security/passkey-copy.ts` ("Save name" → "Name saved").
- `<meta name="theme-color">` is rendered from the theme cookie (`themeColors()` in the root
  layout's `generateViewport`), and `@admitstory/ui` updates it when the theme changes.
- Placeholder empty states are one short line (`components/placeholder-copy.test.ts`) and
  left-aligned.

## Security headers

`next.config.ts` sends HSTS, `X-Content-Type-Options: nosniff`, a strict referrer policy and
`Content-Security-Policy: frame-ancestors 'none'`. The full CSP (script, style and connect
sources for Turnstile, PostHog, Sentry, Paddle and Cal.com) is a Phase 9 item.

## Layout (spec §17)

| Path               | Contents                                                                                                                                        |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/(marketing)/` | `/` redirects to `/home` or `/sign-in`. The marketing site is Phase 9.                                                                          |
| `app/(app)/`       | Signed-in shell and pages. `dossier/` (Phase 1), `kits/[id]/` and `workspace/[deliverableId]/` (Phase 4) hold only a README until those phases. |
| `app/(expert)/`    | Placeholder (Phase 8).                                                                                                                          |
| `app/(admin)/`     | Placeholder (Phase 3 onwards).                                                                                                                  |
| `app/r/[token]/`   | Placeholder (Phase 6).                                                                                                                          |
| `app/prototype/`   | Phase 0.5 look and feel prototypes (spec §6.13, §16). Off unless `PROTOTYPES_ENABLED=1`. Each page renders its demo through a `*-host.tsx`.     |
| `app/api/`         | Better Auth and Inngest route handlers, and the localhost-only `dev/ai-smoke`.                                                                  |
| `inngest/`         | Inngest client, events and functions.                                                                                                           |
| `lib/`             | Server and shared modules. `ai.ts`, `auth.ts`, `session.ts` are server-only.                                                                    |
| `e2e/`             | Playwright specs.                                                                                                                               |
| `scripts/`         | `lighthouse.ts`, `bundle-size.ts`.                                                                                                              |
