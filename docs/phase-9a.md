# Phase 9a: the marketing site

Built 2 and 3 November 2026 in the worktree `../AdmitStory-marketing` (branch `marketing-site`)
and applied to the main tree as `marketing.patch`. The direction is
`docs/design/marketing-direction.md` and the plan is `docs/plans/marketing-plan.md` (both carry
the launch-scope override at the top: interview practice is "Coming soon", and Phase 8 isn't sold).

## What's there

| Route                         | What it is                                                                                                                                                                                                                                           |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                           | The landing page: the speak-in-hero ("Say one thing about yourself", 15 s through `POST /api/demo/stt-token`), the pinned "follow one sentence" sequence, how it works in three lines, real screens, your words lit, what it won't do, pricing, FAQ. |
| `/pricing`                    | "$100 per school.", a sample kit preview for the fictional Northfield with the "Show what unlocks" switch, the ledger (free vs. with a kit, grouped by stage), refunds and tax, what we won't charge for, pricing questions, Product JSON-LD.        |
| `/how-it-works`               | The real `KitAssembly` playing the prototype's scripted run once when 40% in view ("Play again" after), from 1024 px; a plain list below that. Eight steps; `#ai-policies`; the integrity list.                                                      |
| `/privacy`                    | The voice-path diagram (one dot fades at "Discarded", the other reaches "Your drafts"), then 12 sections, plain summary left and full text right, sticky contents from 1280 px.                                                                      |
| `/terms`                      | Nine sections in the same layout.                                                                                                                                                                                                                    |
| OG image                      | Night, "Say one thing about yourself." in Geist 600, the sample Voiceprint. Each marketing page names it (see D14).                                                                                                                                  |
| `/robots.txt`, `/sitemap.xml` | The five marketing pages only.                                                                                                                                                                                                                       |

**Keep this line** (plan §5). The hero saves the visitor's line in `localStorage` for 24 h and
goes to `/sign-in?from=line`, which shows "Keep your first line" with the line in their hue (same
`SharedElement` name, so it flies there). First run's last step offers "Start Story Studio with the
line you said on our homepage" (on by default); if kept, `completeFirstRun` stores it as a
`conversation_note` source with `meta.origin = "homepage_line"`. Story Studio's first question of
the next conversation with no turns quotes it ("On our homepage you said: “…” Tell me what happened
next."), then marks it `meta.usedAt` so it's used once. No migration: `listSourceTexts` now also
returns `meta`, and there's a new `updateSourceMeta` repo function.

## Gates (3 Nov 2026, worktree)

- format, lint, typecheck: green. Unit tests: 183 files, 2362 tests, all passing. No new tests
  (testing policy, 2 Nov); the two Studio turn tests got `listSourceTexts`/`updateSourceMeta` in
  their db mocks.
- Build green. Bundle check green, every route in budget. Marketing (≤ 155 KB gz): `/` 154.4,
  `/how-it-works` 149.8, `/pricing` 144.7, `/privacy` 143.9, `/terms` 143.5. App (≤ 160): `/sign-in`
  156.8, `/studio` 156.4, `/first-run` 153.9. Every route dropped about 2.7 KB (D1 below).
- Lighthouse, mobile preset, median of 3 (`pnpm lighthouse --marketing`): performance 91 / 91 /
  91 / 94 / 92 for `/`, `/pricing`, `/how-it-works`, `/privacy`, `/terms`; accessibility, best
  practices and SEO 100 on all five. CLS 0 everywhere. The LCP element is the H1 on four pages; on
  `/terms` it's the first section's summary paragraph, which is larger than the short "Terms."
  heading. Harmless; left as is.
- Visual pass at 1440 and 390 in Night (screenshots, not recordings): `/pricing` locked and
  unlocked, `/how-it-works`, `/privacy`, `/terms`, `/sign-in?from=line` with a stored line.
  Day theme, reduced motion and tier 1 still need Manu's screen recordings (below).

## Deviations from the direction (Manu can overturn any of them)

D1–D11 are the plan's (§7), unchanged except D1 and D7:

- **D1 (budget).** Marketing budget 155 KB instead of 120 (the framework floor is about 133). The
  lever was taken: `ToastProvider` moved from the root layout into `(app)/layout.tsx` and the
  recommender portal page, which are the only places that toast (−0.5 KB). The real win was the
  root `error.tsx`: it used `<Button>`, which pulled Radix Slot and the magnetic edge light into
  every route's first load; it now uses `buttonStyles()` on a plain `<button>` (−2.7 KB on every
  route, app included).
- D2 `localStorage` for 24 h (magic link opens a new tab). D3 no `@gsap/react`. D4 in-process 1 h
  memo instead of `'use cache'`. D5 dev uses the existing fake STT server. D6 15 s client cap and
  20 s watchdog (no server-side cap without a relay; a 9b risk). D8 the sample plays silently with
  captions until there's a Deepgram key. D9 native `<dialog>` phone menu. D10 deferred-hydration
  islands. D11 per-route CSP for Turnstile and Deepgram on `/` goes to 9b.
- **D7.** Exhibit 5 is the Résumé Pass (the interview report is deferred with Phase 7).

New in packages D and E:

- **D12.** The voice-path dots use SVG `animateMotion` instead of CSS `offset-path`, so they follow
  the drawn paths at any size. Two drawings (across from 1024 px, down below) keep labels at 13 px.
- **D13 (Phase 8 deferred).** No expert-mock plane on `/pricing`, no "After decisions" ledger group,
  no tracker in "what we won't charge for", no expert-sessions section in `/terms` (so 9 sections,
  not 10), and no Cal.com or LiveKit among the `/privacy` processors. The pricing questions don't
  mention launch codes or referral credit, because the app has neither.
- **D14.** Pages that set their own `openGraph` metadata replace the inherited image, so
  `/pricing`, `/how-it-works`, `/privacy` and `/terms` each have an `opengraph-image.tsx` that
  re-exports the shared one.
- **D15.** The integrity line now ends "Audio is turned into text and discarded." (it used to add
  "unless you ask us to keep it", but there's no audio-retention opt-in at launch).
- **D16.** The `/pricing` unlock uses CSS transitions, not `StreamingText`/Motion, so its island is
  a few KB; each sentence still fades up over 180 ms, and the applicant's own sentences are lit.
- **D17.** The kit assembly plays three times faster than the prototype (about 13 s), and doesn't
  start on its own under reduced motion ("Play again" still works).

Also fixed while integrating: the landing page was still rendering two Foundation "proof"
islands (sample story cards labelled "never island" / "visible island", plus a server
`console.log`); they're gone, with `_proof/`. And the hero called an effect event (`fail`) from a
plain handler, which the hooks lint rejects; it now calls a plain `failNow`.

## What Manu provides

1. The domain (`SITE_URL`: canonical URLs, sitemap, OG).
2. Deepgram and Turnstile keys; then run `pnpm --filter @admitstory/web marketing:sample` once for
   the voiced sample.
3. The legal entity, postal address, EU/UK representative if needed, the hello and privacy
   emails, the data region (Neon, Vercel, Upstash), governing law and the liability clause. They're
   `TODO(Manu)` constants in `_copy/chrome.ts`, `_copy/privacy.ts` and `_copy/terms.ts`, and they
   show on the pages until set. Counsel reviews `/privacy` and `/terms`; flip `LEGAL_DRAFT` in
   `_legal/legal-types.ts` and update `LEGAL_UPDATED` after.
4. Verify the school packs and AI policies (the FAQ list and the policy tables appear only for
   verified rows).
5. Screen recordings to sign off (§6.13): the hero and the pinned sequence at tiers 3, 2 and 1,
   with reduced motion; `/pricing` unlock; `/how-it-works` assembly; Day theme on every page.
6. Real screen captures: `pnpm --filter @admitstory/web capture:screens` against a seeded app on
   port 3100 (until then the "Real screens" row and the step captures are left out).

## Depends on Phase 9b

- `/privacy` promises export (JSON + DOCX) and account deletion from Settings; 9b builds them.
- D6 and D11 above; the demo route's limiter moves to Upstash.
- The build warns that `listApplicantSlugs` (`existsSync`/`readdirSync` on a computed path) makes
  the server trace the whole project. Pre-existing, not marketing code; fix it in 9b's deploy work.
