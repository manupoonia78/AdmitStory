# HANDOFF: read this first in a new chat

This file is the restart point if a session runs out of usage. It is updated after every chunk of
work. In a new chat, say: "Read HANDOFF.md and continue from the first unchecked item."

- Spec: `AdmitStory_Build_Spec.md` (§16 is the build plan).
- What each phase built: `docs/phase-N.md`.
- Memory notes for Claude: `~/.claude/projects/-Users-manu-Desktop-AdmitStory/memory/`.

## Goal (given 2026-11-02)

Finish everything (Phases 6 and 9 of the spec; Phases 7 and 8 are deferred, see below) so AdmitStory can launch. Every screen is held
to the award-winning bar (Awwwards / FWA Site of the Year level) and is fast. Make the open
decisions, record them, and list what Manu has to provide.

## Gates (must stay green after every chunk)

**Testing policy (Manu, 2026-11-02, second session): write NO new tests until after launch.** All testing happens
once we ship. Gates are the cheap ones only; existing unit tests should keep passing, but nobody writes new ones,
and integration tests are not a gate right now.

```sh
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test   # existing unit tests only
pnpm build && pnpm --filter @admitstory/web bundle:check        # every route ≤ 160 KB gz first-load JS
```

## Plan and progress

Status key: `[x]` done · `[~]` in progress · `[ ]` not started.

- [x] Phases 0–5 (committed: 7f60232 "phase 5")
- [x] **Phase 6: Recommender Kit** (§5.11, screen H, recommender portal `/r/[token]`), written up in `docs/phase-6.md`. Uncommitted. Built but never clicked through in a browser.
- [x] **Phase 7: Interview Studio is DEFERRED** (Manu, 2026-11-02: "ship faster"). It shows as "Coming soon". The full build
      spec for later is `docs/phase-7-interview-studio.md`; the reusable workflow script is `docs/plans/build-phase.workflow.md`.
      Done so far: `/interview` coming-soon page (`apps/web/lib/interview/coming-soon.ts`, `COMING_SOON` constant + test).
      Expert mock interviews (§5.13, a human) are deferred too, with the rest of Phase 8.
- [x] **Coming-soon sweep** (main tree done 2026-11-03; the one worktree item, the Phase 8 line in the marketing-direction override note, goes in with the marketing patch) (do it after Phase 6 finishes, since Phase 6 is editing these files). Two deferrals to cover: - _Phase 7 (interview practice, promised free to kit owners when it opens)_: label interview items "Coming soon" in the
      Workspace Files pane (`lib/workspace/view.ts` "interview" group), in the kit preview and unlock "what unlocks" lists
      (`lib/strategy/deliverables.ts` `interview_question`), and in screen F's stage-9 label. - _Phase 8 (not sold at launch at all)_: the table in `docs/phase-8-experts-connect-tracker.md` §2 is the checklist —
      coming-soon pages for the `connect` and `tracker` dock items, no expert-mock claim on `/interview`, and the marketing
      copy loses "The application tracker" and the `EXPERT_MOCK` block (`app/(marketing)/_data/pricing.ts`, `_copy/*`). - Grep gate: `rg -i "expert mock|application tracker|/tracker|/connect|/decisions|expert_session"`.
- [x] **Phase 8 is DEFERRED** (Manu, 2026-11-02: "skip phase 8, the whole mock interview/interview with expert feature, for now").
      Nothing in it ships at launch: expert mocks (§5.13), Connect (§5.14), Tracker (§5.15), After decisions (§5.16) and
      Notifications (§5.17) all wait. The come-back doc is `docs/phase-8-experts-connect-tracker.md`; the full build plan it wraps
      is `docs/plans/phase-8-plan.md` (still accurate). It also lists how to pull one piece forward — the Tracker alone is the
      smallest useful slice. Consequence: Phase 9b's hardening migration takes number **0008**, not 0009.
- [x] **Phase 9a: Marketing site** (built in the worktree `../AdmitStory-marketing`, branch `marketing-site`; applied to this
      tree on 2026-11-03 from `../AdmitStory-marketing/marketing.patch`). `/`, `/pricing`, `/how-it-works`, `/privacy`, `/terms`,
      the OG image, robots/sitemap, and the "keep this line" hand-off (sign-in → first run → Studio's first question). Written up
      in `docs/phase-9a.md` (gates, Lighthouse, deviations D1–D17, what Manu provides). Uncommitted. The worktree can be removed
      once Manu is happy (`git worktree remove ../AdmitStory-marketing`); nothing in it is needed any more.
- [x] **Phase 9b: Hardening and launch** (migration `0008_hardening`, renumbered now that Phase 8 is deferred) (admin: costs, users, feedback, evals, kill switches; account export and delete;
      rate limits; security headers; a11y; prompt-injection tests; eval gates in CI; Vercel deploy config; Deepgram Aura-2 +
      `openai_compat` TTS adapters (default TTS);
      `docs/LAUNCH.md`), written up in `docs/phase-9.md`

## Decisions made on Manu's behalf (2026-11-02). He can override any of them.

Spec §18 open decisions:

1. **Name**: AdmitStory (`APP_NAME` in `packages/shared/src/brand.ts`). The domain is `admitstories.com`.
2. **Pricing**: flat $100 per school kit at launch. Bundles and regional (INR/PPP) pricing come after launch.
3. **Refunds**: full refund within 7 days if no deliverable is marked final and fewer than 3 refinements were used.
4. **`limited` schools**: coach mode by default (already built).
5. **Expert mocks**: deferred with Phase 8 (2026-11-02). When built: 45 minutes, $100, free reschedule or cancel up to 24 h before, a no-show is charged; experts set their price in admin.
6. **Launch schools**: the 12 in §9.5. Packs stay drafts until Manu verifies them.
7. **Recommender portal**: ships at launch.
8. **Raw audio retention**: off (already decided).
9. **Programme scope**: MBA only at launch.

Infrastructure:

- **Hosting**: Vercel (Pro plan is needed for commercial use) for `apps/web`. Neon Postgres (already in use). Inngest Cloud for
  background jobs. LiveKit Cloud runs the live-mock voice agent (`apps/voice-agent`, deployed with `lk agent create`), because
  Vercel can't host a long-running worker.
- **No LangChain.** The app calls Anthropic directly through `packages/ai` (`run()`). Langfuse is optional tracing, not LangChain.
- **Voice**: STT is Deepgram (built in Phase 2). The default TTS becomes **Deepgram Aura-2**: the same key as STT, $200 of free
  credit, and about 100–200 ms to first audio. An `openai_compat` adapter lets a self-hosted open-source model (Kokoro-82M through
  Kokoro-FastAPI) stand in at no API cost. The Cartesia and ElevenLabs adapters stay.

## What Manu needs to provide (see docs/LAUNCH.md once written)

The Anthropic key; Deepgram; Vercel Pro; (LiveKit Cloud only when Phase 7 is built); a domain; Resend (sending domain); Turnstile; Paddle (seller
verification); (Cal.com only when Phase 8 is built); Upstash Redis; Inngest; optional Sentry, PostHog, Langfuse and R2. He must also verify the school
packs, and sign off the screen recordings. For the public site: the legal entity, address, contact emails, data
region, governing law and counsel's review of /privacy and /terms (the `TODO(Manu)` list in `docs/phase-9a.md`).

## Log (newest last)

- 2026-11-02: Read the spec and the state of the repo. Created this file. Starting Phase 6.
- 2026-11-02: Manu deferred Phase 7. Wrote docs/phase-7-interview-studio.md, the /interview coming-soon page, and
  docs/plans/build-phase.workflow.md. Added a coming-soon override to the top of the marketing direction and plan docs
  (main tree and worktree).
- 2026-11-02: Marketing PLAN (worktree /Users/manu/Desktop/AdmitStory-marketing, branch marketing-site): wrote docs/plans/marketing-plan.md (Foundation + 5 build packages A hero/speak route, B pinned sequence, C rest of landing, D /pricing + /how-it-works, E legal + OG + keep-line hand-off). Key findings: framework first-load floor is ~140.5 KB so the 120 KB marketing budget becomes 155 KB; gsap 3.15.0 + lenis 1.3.27 verified (GSAP standard licence ok, @gsap/react not needed); keep-line uses localStorage 24 h (magic link opens a new tab); no product code written.
- 2026-11-02 (session 2): Resumed. State found: Phase 6 foundation partly built (migration 0007, schema, repos, tokens, shared types, ai schemas/lor.ts; tasks/lor.ts not yet typechecking; routing/prompts/replays/linter types/lib stubs/wiring missing). Marketing foundation partly built in the worktree (env, motion-curves, springs, lib/marketing/*). Manu: no new tests until after ship. Launched one workflow: P6 (finish foundation, packages A–E, integrate, review, fix, doc) + marketing (finish foundation, packages A–E, integrate, patch) + Phase 8 and 9b plans, all in parallel.
- 2026-11-02 (session 2): Workflow run wf_300b7662-81d (script: ~/.claude/projects/-Users-manu-Desktop-AdmitStory/551f193a-4a62-481b-8acb-5d4bf3635865/workflows/scripts/launch-p6-marketing-wf_300b7662-81d.js). If the session dies, a new session can't resume it; start from the first unchecked item and the per-stage log lines below.
- 2026-11-02: Phase 8 PLAN: wrote docs/plans/phase-8-plan.md (migration 0008_experts_connect_tracker, 14 tables; @admitstory/shared/apply; AI tasks connect.outreach, connect.insights, decisions.letter with phase8 replays; Cal.com v2 behind lib/scheduling with a fake; expert_session product on the Paddle fake; foundation + packages A experts, B connect, C guides, D tracker+home, E notifications, F after decisions). Starts after Phase 6 integration. No product code written.
- 2026-11-02: Phase 9b PLAN: wrote docs/plans/phase-9b-plan.md (migration 0009_hardening: feature_switches, route_overrides, admin_alerts, eval_runs/samples/ratings, break_glass_grants, account_deletions, feedback status cols; DB kill switches enforced in ai.run via overlay disabledTasks; async Upstash checkRateLimit + idempotent() with in-process fallback; eval.judge task + eval:gate CI; nonce CSP via proxy.ts; Aura-2 + openai_compat TTS; Foundation + packages A admin ops, B admin users/feedback, C evals+injection, D account/privacy/feedback, E security+a11y, F voice/deploy/LAUNCH.md). Aligned with phase-8-plan (Phase 8 owns /admin/experts, payouts, guides). No product code.
- 2026-11-02: P6 foundation: finished. ai: lor.extract/lor.plan routes (+SPEC rows), 4 lor tasks registered, v1 prompts (prompts/lor._), briefCiteIssues/assistProvenanceIssues exported, cost lor.plan 0.02, record:phase6 --synthetic run (7 samples replay; scripts/samples/phase6_.ts), check-tasks samples. linters/src/lor (types + STUBs for E). db getAccountIdentity; migration 0007 applied to Neon. web: lib/recommenders/schools.ts real; STUBs lib/recommenders/{stage,consistency,covers,files,briefs,summary,view}.ts (A), lib/reminders/view.ts (D), emails recommender-render.ts (D), inngest lor-brief.ts (A) + recommender-reminders.ts (D) registered with typed events; pipeline stage 9 + positioning recommenders; consistency brief docs; Files pane 'Recommender briefs' + WhyThisDraft covers; Cmd-K action; lor_question redirect; email replyTo/fromName; lib/idempotency.ts; portal headers in next.config; placeholder /recommenders and /r/[token]. typecheck + lint green.
- 2026-11-02 (session 3): Manu deferred Phase 8 ("skip phase 8, the whole mock interview/interview with expert feature, for now"). Wrote docs/phase-8-experts-connect-tracker.md (come-back doc wrapping docs/plans/phase-8-plan.md: what launch says instead, the coming-soon sweep table, hooks to keep, ordering vs Phase 9b, how to pull the Tracker forward alone, workflow args). Updated this file: Phase 8 marked deferred, sweep item extended, Phase 9b migration renumbered to 0008, Cal.com moved off the launch needs list. Remaining: Phase 6 packages A-E (all still foundation stubs), coming-soon sweep, Phase 9a integration, Phase 9b.
- 2026-11-02 (session 3): Phase 8 coming-soon sweep, part 1 (the parts that no Phase 6 package owns): new apps/web/lib/deferred/coming-soon.ts (COMING_SOON + CONNECT/TRACKER copy, interview re-exports the label) and apps/web/components/coming-soon-page.tsx (shared server page, zero client JS); /connect and /tracker now use it instead of the generic placeholder; /interview moved onto the same component keeping its promise line. Marketing worktree: dropped "The application tracker" from the free list and deleted EXPERT_MOCK from (marketing)/_data/pricing.ts. Also fixed a real CI flake: tests/lint-rules.test.ts got a 30 s suite timeout (ESLint config load exceeded the 5 s default under a loaded suite). Dock left unchanged on purpose.
- 2026-11-02 (session 3): Launched the two remaining build waves in parallel, 10 builders. Main tree: Phase 6 packages A (applicant server+brief job), B (portal /r/[token]), C (screen H + Home), D (invites/reminders/emails/exports/cron), E (deterministic overlap + voice profile) — the Phase 6 foundation was done but ALL five packages were still foundation stubs. Worktree ../AdmitStory-marketing: Phase 9a packages A (hero+speak route), B (pinned sequence), C (landing sections), D (/pricing+/how-it-works), E (legal+OG+keep-line) — found that only the marketing FOUNDATION had landed; 15 files were still "// STUB (Foundation)" (hero, follow, every _sections/*, pricing, how-it-works, privacy, terms, opengraph-image). Worktree gates before the wave: format/lint/typecheck/build green, every route inside budget (/ 147.3 KB of 155; app /studio 159.2 of 160). All builders: no new tests, no pnpm build, own paths only, Phase 7+8 deferral overrides in their briefs. NEXT after they land: Phase 6 integration (full gates incl. build+bundle:check), then marketing INTEGRATE (lighthouse, docs/phase-9a.md, marketing.patch applied to the main tree), then Phase 9b.
- 2026-11-03 (session 4): Found the tree red: 3 type errors from the package wave (`kit.schoolCycleId` doesn't exist; resend passed a Date). Packages A–E had landed their libs and UI leaves but NO API routes and NO pages; `lib/reminders/view.ts` was still a stub. Wrote: `lib/recommenders/{stories,route}.ts` (intake → `lor.extract`), `lib/brief-export`, `loadStatusView`, all `/api/recommenders/**` and `/api/r/**` routes, `/api/dev/reminders`, `/recommenders` + `/recommenders/[recommenderId]` (tabs in the URL), `/r` + `/r/[token]` (writing half behind next/dynamic), Home recommender lines + dated ask headline. Small edits: `StoryFieldsForm` exported from ui, `privacyLine` (applicant side) renamed `recommenderPrivacyLine`, `DetailDictation` takes a `label`, coverage-board render counter fixed for the React compiler lint. Gates green: format, lint, typecheck, 174 files / 2327 tests, build, bundle:check (/r 142.3, /r/[token] 142.4, /recommenders* 154.0). Wrote docs/phase-6.md. NEXT: the coming-soon sweep (Phase 6 no longer edits those files), then Phase 9a marketing (worktree: 16 files still `// STUB`, none of the package A–E wave landed there), then Phase 9b.
- 2026-11-03 (session 4): Coming-soon sweep, main tree. Files pane: new `coming_soon` FileStatus ("Coming soon") for interview items; `/workspace/<interview_question>` redirects to `/interview`; the kit preview's file map labels interview rows "(Coming soon)"; the unlock list now names the form advisor, résumé pass and recommender briefs, plus the Phase 7 promise line (`INTERVIEW_COMING_SOON.promise`); stage 9 is labelled "Forms, résumé and recommender briefs". Grep gate clean apart from the deliberately kept dock items, the `expert_session` enum and tests. `placeholder-copy.ts`/`placeholder-page.tsx` are unused outside their tests and left in place. Gates: format, lint, typecheck green; full test run had 3 load flakes (sheet, your-words, admin-routes) that pass alone. NEXT: Phase 9a marketing in the worktree, then Phase 9b.
- 2026-11-03 (session 5): Phase 9a finished. In the worktree: package D (`/pricing` with the sample kit preview and the
  "Show what unlocks" island, the ledger, refunds, questions, Product JSON-LD; `/how-it-works` with the real KitAssembly
  island from 1024 px, eight steps, `#ai-policies`) and package E (`/privacy` with the voice-path diagram, `/terms`, shared
  legal layout, OG image via a new pure `voiceprintStillSvg` in packages/ui, the line hand-off: `KeptLine` on
  `/sign-in?from=line`, the first-run checkbox + `firstLine` on `completeFirstRun`, `lib/studio/homepage-line.ts` +
  `turn.ts`, `listSourceTexts` returns `meta`, new `updateSourceMeta`). Phase 8 deferral applied to all of it (no expert
  mocks, tracker, after decisions, Cal.com/LiveKit). Fixes found on the way: Foundation "proof" islands were still on `/`;
  the hero called an effect event from a handler (hooks lint); per-page OG images (pages' own openGraph replaced the
  inherited one); the integrity line promised an audio opt-in that doesn't exist. Budget: root `error.tsx` used `<Button>`
  (Radix Slot + magnetic in every first load) — now `buttonStyles()`, −2.7 KB on every route; `ToastProvider` moved from
  the root layout into `(app)/layout.tsx` and the portal's `portal-work.tsx`. Worktree gates: format, lint, typecheck,
  2362 tests, build, bundle (all routes in budget, `/` 154.4 of 155), Lighthouse ≥ 91 / 100 / 100 / 100 on all five pages,
  CLS 0. Patch applied here (one hand-merge: `(app)/layout.tsx`); main-tree gates in the next log line. NEXT: Phase 9b.
- 2026-11-03 (session 5): Main tree after applying `marketing.patch` (plus hand edits: `(app)/layout.tsx` wraps
  `ToastProvider`, the portal's `portal-work.tsx` brings its own, `_copy/shared.ts` imports `COMING_SOON` from
  `lib/deferred/coming-soon.ts`, the direction doc's Phase 8 override copied over): format, lint, typecheck green; 178 files /
  2358 tests pass; build green; bundle check green (`/` 154.4 of 155, `/sign-in` 156.8, `/r/[token]` 139.2, `/recommenders`
  151.2, `/home` 152.1). Backup of the tree before the patch: the session scratchpad (`main-before.diff`,
  `main-untracked-before.tgz`). NEXT: Phase 9b (`docs/plans/phase-9b-plan.md`, migration 0008).
- 2026-11-03 (session 6): Phase 9b started, built inline (no builder wave). Done so far: Phase 6 leftovers (reminders cron
  wired to `runDueReminders`; stale STUB marker on lor-brief). FOUNDATION: `packages/shared/src/ops.ts` (13 switches; the 4
  Phase 8 ones dropped) + validators in `schemas.ts`; migration `0008_hardening` (8 tables + feedback status/meta), applied to
  Neon; repos `ops`, `admin-costs`, `admin-users`, `admin-feedback`, `evals`, `account`; ai: `FeatureDisabledError`, overlay
  `disabledTasks` (15 s), check in `run()`, `security/injection.ts` (strip invisible, instruction note in `untrustedBlock`,
  output leak check in `parseOutput`; NO system-prompt canary, it would break caching and replay hashes), `eval.judge` task +
  prompt + route + 3 synthetic replays (`record:phase9`), `src/evals` + `eval:gate` (replay: 63 samples pass) +
  `fixtures/evals/baseline.json`; voice: Aura-2 (`tts/deepgram.ts`, default) + `openai_compat` adapters; emails:
  account-deleted + admin-alert; web: `lib/{redis,rate-limit,api-error,idempotency (Upstash),features,alerts,launch-env}.ts`,
  every `checkRateLimit` awaited, `handle()` maps paused → 503, switch checkpoints (stt, tts, uploads, checkout, invite send,
  reminders cron, landing demo), kit job retries paused stages after 15 min, payments + kit failures raise admin alerts, env
  production guard. Existing-test edits: routing SPEC row, schema table list, TTS default provider, admin-routes timeout.
  NEXT: admin pages/routes (A, B, C), account export/delete + /settings/privacy + /goodbye + feedback control (D), CSP/proxy +
  uploads + routes audit + a11y doc (E), vercel/CI/health/launch-check/LAUNCH.md (F), docs/phase-9.md, gates.
- 2026-11-03 (session 7): Found session 6 had gone past its last log line: admin A (overview, costs, switches, routing,
  alerts, spend watch), B (users, break-glass, comp kits, feedback inbox), C (evals pages/routes, `evals/run` job, prompt
  activation gate) and most of D (account export/delete/privacy routes, `/settings/privacy`, `/goodbye`, delete job,
  `/api/feedback`, `FeedbackControl`) were written but not logged; typecheck was red (null passed to live-message props).
  Fixed that and finished D: `FeedbackControl` mounted at the foot of the Workspace draft, Profile Read (`readId` added to
  `loadProfileRead`) and the Résumé pass. NEXT: E (proxy.ts CSP + CSRF, headers, uploads sniffing, routes:audit, a11y
  doc), F (health, vercel.json, vercel-build, launch:check, CI/evals/dependabot, maxDuration, LAUNCH.md), docs/phase-9.md, gates.
- 2026-11-03 (session 7): Phase 9b finished. E: `apps/web/proxy.ts` (per-request nonce CSP from `lib/security/csp.ts`
  on every page; 403 for cross-site state-changing `/api` requests via `lib/security/origin.ts`), headers in
  `next.config.ts` (X-Frame-Options, Permissions-Policy, COOP; the old static CSP removed), upload sniffing and caps
  in `lib/studio/documents.ts` (+ injection score in `sources.meta`), `routes:audit` (119 routes, 0 unguarded),
  `docs/a11y-audit.md`. F: `/api/health`, `apps/web/vercel.json` (region `sin1`: the Neon project is in
  ap-southeast-1) + `scripts/vercel-build.mjs`, `pnpm launch:check`, `maxDuration` on SSE + inngest, CI
  (eval:gate, routes:audit, pnpm audit), nightly `evals.yml`, dependabot, `docs/LAUNCH.md`. Fixed a pre-existing bug
  found in the browser pass: signed-out API calls returned 500 (page redirect) — now 401 via
  `requireOnboardedUser("api")`. Repo-wide `pnpm format` (session 6 left 47 files unformatted). Gates: format, lint,
  typecheck, 2428 tests, build, bundle (`/` 154.4/155), Chrome pass on 8 signed-out pages (no CSP violations, 0 axe).
  Wrote `docs/phase-9.md` (deviations 1–6). NEXT: nothing left in the plan. Manu: commit, then `docs/LAUNCH.md` §1 in
  order; the signed-in a11y/CSP pass (needs a session and DB access) is on the go-live list.
- 2026-11-03 (session 8): Committed everything (89105bf). Gates before the commit: format, lint, typecheck, 2428
  tests, build, bundle. Google sign-in was already built (Phase 0: `socialProviders` in `lib/auth.ts`, the button on
  `/sign-in`, hidden until both keys are set); Manu wants it at launch, so `launch-env.ts` now requires
  `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` in production and `docs/LAUNCH.md` §1.6 has the Google Cloud steps.
  Verified: Google sign-in links to an existing magic-link account with the same email (both verified). NEXT: Manu's
  keys, in `docs/LAUNCH.md` §1 order; then the live acceptance runs and the signed-in CSP/a11y pass.
- 2026-11-03 (session 10): **"Rendered" redesign of every app page** (Manu: all pages must look award-winning, like
  they were made in Blender). Researched Awwwards/FWA 2025–26 winners (Lusion, abeto, Hubtown, Resend's iridescent
  shader, Stripe's gradient glass). Built: (1) a live 3D studio behind every signed-in, first-run, sign-in, admin and
  recommender-portal page: `packages/ui/src/scene/` (raw WebGL2 raymarcher, no library, glass with dispersion and
  thin-film, holographic chrome, softbox lighting, bloom; nine objects, one per area via `scene-ids.ts`, morphing on
  navigation; loads on idle, so 0 KB first-load; adaptive resolution; still frame under reduced motion; CSS-lit
  fallback). (2) `packages/ui/src/render.css`: glass `plane` and `bg-depth`, glossy pill buttons (`gloss`), lit
  selection (`lit`, aria-pressed chips, tabs), recessed inputs, chrome page titles with a one-time shine, page-entry
  cascade, `eyebrow`. (3) Page work: bigger titles across (app)/(admin), new Coming-soon layout (Interview, Connect,
  Tracker), glass tabs, empty-state orb, `Page` eyebrows, Résumé got its missing h1, Dossier padding fix, Studio aside
  as glass, `AuthShell`/`AuthFrame` split (root not-found must stay client-free: `/` budget). Gates: typecheck, lint,
  format, 1105 ui+web tests, build, bundle (`/` 154.4/155, max app route 158.8/160). Uncommitted. NOT seen in a
  browser (need data): kits, workspace, school preview/unlock, recommender detail, populated home/dossier.
