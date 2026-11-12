# Launch: accounts, keys and the go-live checklist

Everything Manu has to set up before AdmitStories takes real users, in the order to do it. Nothing
here is needed to build or run the app locally: every service below falls back to a fake or an
in-process version in development. `pnpm launch:check` shows, per service, whether it is live, a
dev fake, or missing, and exits 1 under `VERCEL_ENV=production` if production would refuse to boot.

Not needed at launch: R2, LiveKit (Phase 7, Interview Studio), Cal.com (Phase 8, expert mocks),
Cartesia, ElevenLabs.

## 1. Accounts and keys, in order

1. **Domain**: `admitstories.com` (bought). DNS at Vercel. Sets `APP_URL` (the app, `https://admitstories.com`)
   and `SITE_URL` (the public site; the same value unless the site lives on another host).
   In Vercel → Domains add both `admitstories.com` and `www.admitstories.com`, and set `www` to
   redirect (308) to `admitstories.com`, so sessions, passkeys and canonical URLs all use one host.
2. **Vercel Pro** (commercial use needs Pro). New project, root directory `apps/web`.
   `apps/web/vercel.json` sets the install and build commands and the function region.
   - **Region**: `sin1` (Singapore), next to the current Neon project in `ap-southeast-1`. Functions
     must sit beside the database. If you create the production database somewhere else, change
     `regions` in `apps/web/vercel.json` to match (us-east-1 → `iad1`, eu-central-1 → `fra1`).
   - Add every variable below for **Production** and **Preview**. Turn on Deployment Protection for
     previews.
3. **Neon** → `DATABASE_URL` (the pooled connection string). Production uses `main`; create a
   `preview` branch and use its URL for Vercel's Preview environment. Turn on point-in-time
   restore (7 days). Every production and preview build runs `pnpm db:migrate` first
   (`scripts/vercel-build.mjs`); migrations are additive, so the live deployment keeps working.
4. **Secrets you generate**:
   - `BETTER_AUTH_SECRET`: `openssl rand -base64 32`.
   - `CONTENT_ENCRYPTION_KEY_ID` + `CONTENT_ENCRYPTION_KEYS`: one 32-byte key
     (`openssl rand -base64 32`), set as `CONTENT_ENCRYPTION_KEYS={"k2026":"<the key>"}` and
     `CONTENT_ENCRYPTION_KEY_ID=k2026`. **Keep a copy in a password
     manager**: without it every story and draft is unreadable. Rotate yearly.
5. **Resend** → verify the sending domain (SPF, DKIM, DMARC) → `RESEND_API_KEY`, `EMAIL_FROM`
   (e.g. `AdmitStories <hello@admitstories.com>`).
6. **Google sign-in** (required at launch) → `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. The
   button is already built and appears on `/sign-in` once both are set.
   - console.cloud.google.com → new project "AdmitStories".
   - Google Auth Platform → Branding: app name, support email, logo, `admitstories.com` under
     "Authorized domains", links to `/privacy` and `/terms`. Audience: External. Data access:
     scopes `openid`, `email`, `profile` only (no Google verification review needed for these).
   - Clients → Create client → Web application. Authorized JavaScript origins:
     `https://admitstories.com` and `http://localhost:3000`. Authorized redirect URIs:
     `https://admitstories.com/api/auth/callback/google` and
     `http://localhost:3000/api/auth/callback/google`. Copy the client ID and secret.
   - Audience → "Publish app" (In production), or only test users listed there can sign in.
   - A Google sign-in with the same email as an existing magic-link account signs into that
     account (Google reports the email as verified).
7. **Cloudflare Turnstile** → `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` (hostname: `admitstories.com`).
8. **Anthropic** → `ANTHROPIC_API_KEY`, `AI_MODE=live`. Set a monthly spend limit in the console.
   Then re-record the replays (`pnpm --filter @admitstory/ai record:phase3` … `record:phase9`),
   run the live acceptance checks listed in `docs/phase-1.md` … `docs/phase-6.md`, and record the
   live eval baseline once:
   `pnpm --filter @admitstory/ai eval:gate --live --update-baseline`, then commit
   `fixtures/evals/baseline.json`.
9. **Voyage** → `VOYAGE_API_KEY` (embeddings for the knowledge base).
10. **Deepgram** → `DEEPGRAM_API_KEY` (dictation and read-aloud), `TTS_PROVIDER=deepgram`. Listen to
    the three Aura-2 voices in Deepgram's playground and confirm or change them
    (`packages/voice/src/config.ts`: warm `aura-2-thalia-en`, clear `aura-2-andromeda-en`, low
    `aura-2-orion-en`).
    Optional, no API cost: a self-hosted Kokoro-FastAPI → `TTS_PROVIDER=openai_compat`,
    `OPENAI_TTS_BASE_URL`, `OPENAI_TTS_API_KEY`, `OPENAI_TTS_MODEL` (default `kokoro`),
    `OPENAI_TTS_VOICES` (JSON, `{"warm":"af_heart","clear":"af_bella","low":"am_michael"}`).
11. **Upstash Redis** (same region as Vercel; or the Vercel Marketplace integration) →
    `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (or `KV_REST_API_URL` + `KV_REST_API_TOKEN`).
    Rate limits and idempotency are shared across instances only with this.
12. **Inngest Cloud** (Vercel integration) → `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`. Sync
    `https://admitstories.com/api/inngest` after the first deploy.
13. **Dodo Payments** (merchant of record; business verification first, it can take days; sign up
    as an individual, payouts by wire to your own bank account). In live mode:
    - Developer → API Keys → a live key. Then create the three products from `SCHOOL_PLANS`:
      `DODO_PAYMENTS_API_KEY=<live key> DODO_PAYMENTS_ENVIRONMENT=live_mode pnpm --filter
@admitstory/web payments:products`. It prints the `DODO_PRODUCT_*` lines.
    - Developer → Webhooks → Add endpoint `https://admitstories.com/api/webhooks/dodo` with the
      events `payment.succeeded`, `payment.failed`, `refund.succeeded`, `dispute.opened`,
      `dispute.lost`, `dispute.accepted`. Its signing secret is `DODO_PAYMENTS_WEBHOOK_KEY`.
    - Vercel production → `DODO_PAYMENTS_ENVIRONMENT=live_mode`, `DODO_PAYMENTS_API_KEY`,
      `DODO_PAYMENTS_WEBHOOK_KEY`, `DODO_PRODUCT_SCHOOL_KIT`, `DODO_PRODUCT_PACK5`,
      `DODO_PRODUCT_PACK10`. Never put test-mode keys on production: test cards would unlock kits.
    - Settings → Design: match the checkout to the paper theme (overlay colors and font).
      Test mode first, locally: the test products already exist (ids in `.env.local`). Install the Dodo
      CLI, `dodo login`, `dodo wh listen http://localhost:3000/api/webhooks/dodo`, put the relay
      endpoint's signing secret in `.env.local`, uncomment the Dodo block and pay with a test card.
14. **Sentry** (optional) → `SENTRY_DSN`, plus `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`
    for source maps. With a DSN set, CSP violation reports go to Sentry too.
15. **PostHog** (optional) → `POSTHOG_KEY`, `POSTHOG_HOST`. Session replay masks every input and
    all text.
16. **Langfuse** (optional) → `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST`.
17. **Admin** → `ADMIN_ALERT_EMAIL` (spend spikes, failed kits, "this isn't true" reports, failed
    deletions). Sign in once on production, then
    `DATABASE_URL=<prod> pnpm --filter @admitstory/db admin:grant <your email>`.
18. **GitHub** → repository secret `ANTHROPIC_API_KEY` (the nightly live eval in
    `.github/workflows/evals.yml`; without it the job prints a notice and passes). Branch
    protection on `main` requiring the CI `checks` job.
19. **Legal and content** →
    - Data processing agreements: Anthropic, Deepgram, Voyage, Dodo Payments, Resend, PostHog, Neon,
      Vercel, Upstash, Inngest, Sentry.
    - Counsel review of `/privacy` and `/terms` (the `TODO(Manu)` list in `docs/phase-9a.md`:
      legal entity, address, contact emails, data region, governing law), including deletion
      timing ("within the hour", backups within 35 days) and PostHog's pseudonymous events.
    - Verify the 12 launch school packs, their AI policies and `COMMON_LOR_QUESTIONS`, then publish
      them from `/admin/schools`.
    - Add `preload` to HSTS in `apps/web/next.config.ts` now that the domain is final (`admitstories.com`), and submit it
      at hstspreload.org.

Leave `PROTOTYPES_ENABLED` unset in production (the `/prototype` pages stay off).

Escape hatches you can set at any time: `CSP_REPORT_ONLY=1` (the Content-Security-Policy only
reports, never blocks; use it if a third-party script breaks in production), `DEMO_STT=off` (the
landing page's speaking demo, hard off).

## 2. Go-live checklist

- [ ] `VERCEL_ENV=production pnpm launch:check` passes with the production values.
- [ ] `https://admitstories.com/api/health` returns 200 with `"db":"ok"` and `"redis":"ok"`. Point an
      uptime monitor at it (Vercel, Better Stack or similar), every minute.
- [ ] In Chrome and Safari, with the browser console open, check there are no CSP violations:
      dictation (the capture worklet) records, read-aloud plays, Dodo checkout opens, Turnstile
      renders on sign-in and the landing demo, the Voiceprint shader runs.
- [ ] One real purchase at $100 and one 5-school pack at $349 on production Dodo: the pack
      unlocks its school at once and shows 4 credits; spend one from another school's unlock page.
      All sales are final (no refund policy), so test with your own card.
- [ ] Kill switches: in `/admin/switches`, pause `read_aloud`, check Studio shows "Reading
      questions aloud is paused", then turn it back on.
- [ ] Three complete kits for real schools, read and signed off (spec Phase 9 acceptance).
- [ ] A 20-applicant beta before opening sign-ups.
- [ ] Ten ratings a week in `/admin/evals/review` from then on (§8.11).

## 3. Rollback runbook

- **A bad deploy**: Vercel → Deployments → the last good one → "Instant Rollback". Migrations are
  additive, so the older code runs against the newer schema.
- **A feature misbehaving** (cost, quality, a provider outage): `/admin/switches` pauses it in
  under 15 seconds for every instance, with a calm message to applicants. Paused kit builds wait
  and resume on their own.
- **A model or prompt regression**: `/admin/routing` overrides a task's model, effort or token
  cap; `/admin/prompts` reactivates the previous prompt version.
- **Spend running away**: the hourly spend watch alerts by email; pause `kit_generation` and
  `refinements` first, then look at `/admin/costs`.
- **Data damage**: Neon → Branches → restore `main` to a point in time (7 days of history), or
  restore into a new branch, check it, then point `DATABASE_URL` at it.
- **Rate-limit store down**: the app falls back to in-process limits on its own and raises a
  `rate_limit_store_down` alert; budget caps still bound AI cost.
