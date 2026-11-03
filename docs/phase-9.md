# Phase 9b: Hardening and launch

Built 3 November 2026 on branch `phase-0`, uncommitted, on top of Phase 6 and the marketing site
(Phase 9a, `docs/phase-9a.md`). The plan is `docs/plans/phase-9b-plan.md`; it holds the decisions
(§1), data model (§2), routes (§6) and UI (§8), and is still accurate except where this file says
otherwise. Phase 8 (experts, Connect, Tracker) is deferred, so everything the plan wrote for
Phase 8's tables, switches and alerts is left out, and the migration is `0008`, not `0009`.

Built inline across two sessions (no builder wave): session 6 wrote the foundation and packages
A–D; session 7 finished D, wrote E and F, fixed what the gates and a browser pass turned up, and
wrote this file.

## What was built

### Foundation

- `packages/shared/src/ops.ts`: 13 kill switches (`FEATURE_SWITCHES`, `featureForTask`), alert
  kinds and labels, feedback targets and reasons, eval types and `EVAL_GATE`, privacy and admin
  view types, `AUDIT_ACTIONS`; validators in `schemas.ts`.
- Migration `0008_hardening` (applied to Neon): `feature_switches`, `route_overrides`,
  `admin_alerts`, `eval_runs`, `eval_samples`, `eval_ratings`, `break_glass_grants`,
  `account_deletions`; `feedback` gains status, handler, admin note and meta.
- `packages/ai`: `FeatureDisabledError`, the overlay's `disabledTasks` (15 s cache) checked in
  `run()` before the budget; `eval.judge` task, prompt, route and three synthetic replays
  (`record:phase9`); `src/evals` and `eval:gate`; `security/injection.ts`.
- `packages/voice`: Deepgram Aura-2 TTS (the new default) and the `openai_compat` adapter
  (self-hosted Kokoro).
- `apps/web/lib`: `redis`, `rate-limit` (Upstash sliding window, in-process fallback, every call
  site awaited), `idempotency` (Upstash), `features`, `alerts`, `launch-env`, `api-error`.
  `handle()` maps a paused feature to `503 { code: "paused" }`. Switch checkpoints on STT, TTS,
  uploads, checkout, invite sends, the reminders cron and the landing demo. Paused kit stages
  retry after 15 minutes. Payment and kit failures raise admin alerts. Production refuses to boot
  without its required services.

### A. Admin: overview, costs, switches, routing, alerts, spend watch

`/admin` (today's spend against the 7-day mean, open alerts, paused switches, new feedback, last
eval run), `/admin/costs` (7/30/90 days, replay toggle, by day as an inline SVG strip with "high"
days marked, by task, by model, top kits and users, voice, CSV), `/admin/switches` (grouped by
area, reason required, custom message with preview), `/admin/routing` (base route per task,
override with reason, clear). Hourly `admin/spend-watch` cron: spend spike (1.5× trailing mean),
kit soft and hard caps, repair rate over 20%.

### B. Admin: users, break-glass, comp kits, feedback

`/admin/users` (search by email or id) and `/admin/users/[userId]` (account, roles, schools and
kit status, purchases, entitlements with adjust, cost, deletion, audit trail; grant a comp kit,
change roles, open 30-minute break-glass with a reason of 20+ characters, delete the account).
`/admin/users/[userId]/content` is read-only, shows the expiry, and audits every load.
`/admin/feedback` filters by status, reason and surface; the draft excerpt shows only when the
owner opted in.

### C. Evals and prompt-injection hardening

`/admin/evals` (runs, gate failures, cost; "Run now"), `/admin/evals/[runId]` (metric deltas
against the baseline, samples), `/admin/evals/review` (ten items a week, 1–5 as 44 px buttons,
keys 1–5 and J/K). The `evals/run` job runs on canon publish, prompt activation and "Run now".
Injection: invisible and bidi characters stripped, delimiter look-alikes defused, an extra
"treat this as quoted material" line for instruction-like text, and an output leak check for our
own section markers.

### D. Account export and delete, privacy settings, feedback

- `/settings/privacy` (linked from Settings): "What we keep" inventory (counts settle in once,
  still under reduced motion); "Your data (JSON)" and "Your drafts (Word)" downloads, streamed,
  3 an hour; "Help improve AdmitStory" opt-in; staff access list; delete with type-to-confirm,
  a 15-minute fresh session (else "Sign in again"), and what goes and what stays.
- `POST /api/account/delete` signs the user out everywhere, records the deletion and starts
  `account/delete`: confirmation email, then the users row goes (everything cascades; the ledger
  and audit log keep anonymised rows). A failure alerts an admin. `/goodbye` afterwards.
- `FeedbackControl` ("Was this useful?", reason chips after a thumbs-down, an optional note) at the
  foot of the Workspace draft, the Profile Read and the Résumé pass. "This isn't true" raises a
  `not_true_report` alert.

### E. Security headers, CSRF, uploads, route audit, accessibility

- `apps/web/proxy.ts` (Next 16's request hook): a fresh nonce per page request and the
  Content-Security-Policy from `lib/security/csp.ts`, on the request (Next stamps the nonce on its
  scripts) and the response; for `/api/**`, a state-changing request whose `Origin` names another
  host gets 403 (webhooks, Inngest and Better Auth exempt). `CSP_REPORT_ONLY=1` flips to
  report-only; reports go to Sentry when `SENTRY_DSN` is set.
- `next.config.ts`: `X-Frame-Options: DENY`, `Permissions-Policy` (microphone self, payment
  Paddle), `Cross-Origin-Opener-Policy: same-origin-allow-popups`; HSTS, nosniff, Referrer-Policy
  and the portal headers kept.
- Uploads (`lib/studio/documents.ts`): bytes must match the format (`%PDF-`; a zip holding
  `word/document.xml`; no NULs in text), DOCX inflated size capped at 20 MB from the zip's central
  directory (zip bombs), PDFs read to 60 pages, 10-second extraction timeout, text capped at
  200,000 characters and stripped of invisible characters; the injection score (a number) is
  stored in `sources.meta.injectionScore`.
- `pnpm --filter @admitstory/web routes:audit`: every `app/api/**/route.ts` with a mutating handler
  must call a known guard or carry `// public-route: <why>`. 119 routes, 0 unguarded.
- `docs/a11y-audit.md`.

### F. Deploy, CI and launch docs

`apps/web/vercel.json` and `scripts/vercel-build.mjs` (migrate on production and preview builds,
then build). `maxDuration = 300` on the two SSE routes and `/api/inngest`. `GET /api/health`
(`{ ok, db, redis, version }`, 200 or 503). `pnpm launch:check`. CI gains `eval:gate`,
`routes:audit` and `pnpm audit --prod --audit-level=high`; `.github/workflows/evals.yml` (nightly
live gate when the secret exists); `.github/dependabot.yml`. `docs/LAUNCH.md` (every account and
key in order, the go-live checklist, the rollback runbook).

## Deviations from the plan

1. **Phase 8 is out.** Its four switches (`expert_booking`, `connect_ai`, `decisions_ai`,
   `notification_emails`) are not defined; booking blocks on deletion, expert accounts and the
   `booking_issue` alert wait for Phase 8. Migration `0008`, not `0009`. `frame-src` has no Cal.com.
2. **No system-prompt canary** (decision 20). A per-process canary in the system prompt would
   change every prompt, which breaks prompt caching and every replay hash. The output leak check
   looks for our own section markers and `<untrusted` tags instead.
3. **One nonce CSP for every page**, marketing included (decision 21 gave marketing a static
   `'unsafe-inline'` policy). The root layout reads the theme cookie, so every page already
   renders per request and can carry a nonce; the stricter policy costs nothing. Local allowances
   (`ws://localhost`, no `upgrade-insecure-requests`) follow `APP_URL` being localhost, not
   `NODE_ENV`, so `next start` in CI and Lighthouse works.
4. **The in-app eval run is advisory.** `evals/run` re-scores the replays and records the run,
   but prompt activation is never blocked (decision 17 wanted a block in live mode). The enforcing
   gate is `eval:gate` in CI and the nightly live workflow. Revisit once live mode has a baseline.
5. **Vercel region `sin1`, not `iad1`.** The Neon project is in `ap-southeast-1` (Singapore), and
   functions must sit beside the database. `docs/LAUNCH.md` says how to change it.
6. **API routes now answer 401 without a session.** Found in the browser pass: `requireUser()`
   in `lib/api.ts` went through the page guard, which throws a redirect, so a signed-out `fetch`
   got a 500. Route handlers now use their own guard (`requireOnboardedUser("api")`); pages and
   server actions still redirect. This predates Phase 9.

## Gates (3 November, after the last code change)

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`: green.
- `pnpm test`: 178 files, 2,428 tests pass (no new tests, by policy).
- `pnpm build`: green. `bundle:check`: every route in budget; `/` 154.4 of 155 KB, `/sign-in`
  157.9, `/settings/privacy` 156.4, `/admin` 144.3, `/goodbye` 137.3 (budget 160).
- `routes:audit`: 0 unguarded. `pnpm audit --prod --audit-level=high`: passes (1 low, 5 moderate).
- Browser pass (Chrome, production build): the eight signed-out pages hydrate under the nonce
  CSP with no violations and no axe findings; every executable script carries the nonce; a
  cross-site POST gets 403, a signed-out same-site POST 401. Signed-in screens were not checked:
  the sandbox could not reach Neon (see `docs/a11y-audit.md`).

## What Manu provides

Everything in `docs/LAUNCH.md` §1, in that order. For this phase specifically:
`ADMIN_ALERT_EMAIL`; Upstash; the three Aura-2 voices; a spend limit in the Anthropic console and
the live eval baseline (`eval:gate --live --update-baseline`, once, after re-recording); the
signed-in accessibility pass (`docs/a11y-audit.md`); HSTS `preload` once the domain is final;
counsel's review of deletion timing and PostHog in the privacy policy; sign-off on three real kits
and the 20-applicant beta; ten ratings a week in `/admin/evals/review`.
