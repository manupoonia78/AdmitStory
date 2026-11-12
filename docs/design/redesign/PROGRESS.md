# Redesign progress: "The Literary Instrument"

The memory between sessions. Read this after the brief (`docs/design/fable-redesign-prompt.md`)
and before the parts of `SPEC.md` for the current phase.

Branch: `redesign/literary-instrument` (off `phase-0`). Never commit to `main` or `phase-0`, never
push, never deploy.

## Next step

**Wait for Manu's review of the Phase 0 spec.** Do not start Phase 1 until he names it. When he
replies, write his answers to the five questions under "Needs Manu" into "Decisions" below (with
the date) and change SPEC.md to match before anything else.

When Phase 1 is named, start here:

1. Start the local environment from `local-db.md` (a new session's scratch directory is empty:
   initdb, createdb, migrate, seed, build, start).
2. Expand nothing: SPEC §2 is already at full values. Build it in `packages/ui` in this order:
   fonts in `apps/web/app/layout.tsx` → `tokens.css` (the three scopes) → `theme.css` mapping →
   `render.css` utilities (§2.12 table) → `button-styles.ts` → text field, card, chip, tabs →
   `motion.ts` eases + the `data-motion` head script → wordmark, mark, `app/icon.svg`, seal →
   `contrast.test.ts`, `voice-hues.test.ts`, `motion.test.ts` → `/prototype/system`.

## Phases

| Phase                      | Covers                                                                                                                     | Status                           |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| 0. Read, capture, spec     | repo read, branch, `shoot.mjs`, `local-db.md`, before shots, SPEC.md, this file                                            | **awaiting review** (2026-11-12) |
| 1. Design system           | tokens, type, grain, frost, components, motion utilities, wordmark, favicon, utility migration, tests, `/prototype/system` | not started                      |
| 2. Landing hero            | nav, hero signature, reduced-motion still, phone composition, facts strip, frame cost, LCP                                 | not started                      |
| 3. Landing, all scenes     | sections 2–13, GSAP sequence to CSS, Lenis decision                                                                        | not started                      |
| 4. Other marketing + entry | `/how-it-works`, `/pricing`, `/privacy`, `/terms`, OG, titles, `/sign-in`, `/welcome`, `/first-run`                        | not started                      |
| 5. Shell, home, Studio     | casing, sidebar, top bar, dock, palette, account menu, toasts, `/home`, `/studio`                                          | not started                      |
| 6. Schools and the editor  | `/schools`, workspace and tabs, preview, unlock, `/workspace/[id]`, `/kits/[id]`                                           | not started                      |
| 7. The rest of the app     | dossier, profile read, recommenders, portal, résumé, connect, settings, interview, tracker, all states                     | not started                      |
| 8. Final pass              | consistency sweep, axe, Lighthouse, overflow, console, reduced motion, admin, REPORT.md                                    | not started                      |

## Phase 0 checklist

- [x] Read the brief, `HANDOFF.md`, `packages/ui` (tokens, theme, render, motion, springs, voice
      hues, theme preference, button styles, wordmark), the marketing sections, copy and data, the
      app routes, bundle script and model claims
- [x] Branch `redesign/literary-instrument` created off `phase-0`
- [x] Local Postgres on 5455, migrated and seeded (never the production database)
- [x] `docs/design/redesign/local-db.md`
- [x] `docs/design/redesign/shoot.mjs` (1440 × 900, 390 × 844, 375 px overflow check, Day and
      Night, reduced motion, console and network report)
- [x] Before screenshots: 37 routes in Day (public + signed-in + 4 reference prototypes), the
      welcome and first-run steps, and the 27 signed-in routes again in Night
- [x] SPEC.md: system and hero at full values, every other screen as a sketch, signature table,
      font and JS budgets, brief-versus-code list, proposals
- [x] PROGRESS.md, REPORT.md (Phase 0 summary)
- [x] Committed on the branch

## Decisions

Made in Phase 0 by Claude, in the spec, **not yet approved by Manu**:

| Date       | Decision                                                                                                                                           | Why                                                                       | Spec        |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------- |
| 2026-11-12 | The Voiceline (one hairline: waveform, rule, peak) is the single graphic idea on every screen                                                      | carries "voice becomes story becomes essays" everywhere at almost no cost | §1.1        |
| 2026-11-12 | Dark casing in both themes; Day and Night change only the working area                                                                             | one world from landing to app                                             | §1.2, §10.1 |
| 2026-11-12 | `--bg #0B0A09` (brief: `#0A0A0B`), `--accent-ink #85590F` (brief: `#9A6B1F`, which fails AA at 4.29), mono labels at 60 % not 40 % (40 % is 3.5:1) | harmony with paper; AA                                                    | §2.1        |
| 2026-11-12 | Reading serif: Source Serif 4, static 400 roman + italic (20.1 KB each, the opsz-14 text master)                                                   | real text cut without the 130 KB axis                                     | §2.4        |
| 2026-11-12 | Fonts through `next/font/google` (Geist 29.3 KB, Instrument Serif italic 15.7, Geist Mono 23.1)                                                    | the `geist` package isn't subsetted                                       | §2.4, §8.1  |
| 2026-11-12 | Frost has a blurred form for floating things and a flat form for in-flow things                                                                    | twenty blurred chips cost more than the hero                              | §2.7        |
| 2026-11-12 | `--needs` amber → slate blue; three hue labels renamed (Ember, Citron, Stone), ids kept                                                            | amber collided with brass                                                 | §2.1, §2.3  |
| 2026-11-12 | Hero: horizon line 128 px above the hero's bottom edge; a server-rendered poster frame that the lazy island takes over; pause control              | LCP, no layout shift, WCAG 2.2.2                                          | §3          |
| 2026-11-12 | Headline "Tell it once. / Tell it _well._"; "Your story, admitted." rejected as an outcome promise                                                 | honesty rules                                                             | §3.3        |
| 2026-11-12 | WebGL Voiceprint replaced by the 2-D Voiceline on every redesigned screen; Voiceprint data untouched                                               | brief bans WebGL and glow orbs                                            | §9.1        |
| 2026-11-12 | Recommend removing Lenis and GSAP in Phase 3                                                                                                       | stepped scenes; sticky and native scroll                                  | §8.3        |
| 2026-11-12 | Marketing is dark-only: the footer theme switch goes                                                                                               | brief                                                                     | §4          |
| 2026-11-12 | Screenshots are JPEG (viewport q88, full page q60) to keep the repo light                                                                          | 272 files                                                                 | `shoot.mjs` |

Approved, changed or rejected by Manu: nothing yet.

## Needs Manu (answer at the Phase 0 review)

1. **Dark casing in Day** (SPEC §10.1): yes, or a paper-toned sidebar in Day?
2. **Headline**: "Tell it once. / Tell it _well._" (§3.3)?
3. **WebGL prototypes** (§10.3): may `/prototype/voiceprint` be retired and the studio and duet
   prototypes moved to the Voiceline, so `ogl`, `detect-gpu` and `public/detect-gpu` can be
   deleted? Otherwise they stay for prototypes only.
4. **`--needs` to slate blue and the three hue label renames** (§10.4): both are visible to
   existing users.
5. **"12 schools, read closely" in `model-claims.ts`** while 16 packs are published (§9.4): leave,
   or will you update the claim? (Only you change claims.)

Also for you, not design: `LEGAL_ENTITY` in `_copy/chrome.ts` is still `TODO(Manu)` and shows in
the footer's copyright line.

## Open problems

- **Populated signed-in screens can't be reached locally** without live AI: Studio can't start a
  session (500 from `/api/studio/sessions`, no replay), the kit stops partway, and the portal
  needs a sent invitation. Before shots show their empty or idle states; the Phase 0.5 prototypes
  stand in as `ref-prototype-*`. Plan for Phases 5–7: a hidden `/prototype/redesign/*` gallery
  rendering the real components with sample props (SPEC §12).
- **Before state has two 375 px overflows**: `/schools/[id]/unlock` scrolls sideways by 13 px
  (the plan cards). Fix in Phase 6. (`ref-prototype-studio` overflows by 4 px; out of scope.)
- **`pnpm format:check` flags `docs/design/fable-redesign-prompt.md`** (blank lines and `*` versus
  `_` only). It is Manu's file, committed byte for byte; run Prettier on it if you want that gate
  green.
- Full-page screenshots of `/` show blank bands where the pinned "follow" section holds the
  viewport, and repeat the sticky nav. A capture artefact, not a page bug.

## Baselines measured on 2026-11-12 (production build, local)

- First-load JS: `/` 153.1 KB of 155; `/sign-in` 158.0 of 160; `/studio` 156.9; `/first-run`
  155.1; `/schools/[id]/unlock` 155.0; `/home` 148.4; most app routes 147.8.
- Fonts: 157.3 KB preloaded on every route; 388 KB and 16 files in the build.
- Landing: 17,790 px tall at 1440; TTFB 175 ms locally.

## Scores

None yet. The rubric (SPEC §11) is applied from Phase 1 on.
