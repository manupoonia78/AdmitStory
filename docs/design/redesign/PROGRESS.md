# Redesign progress: "The Literary Instrument"

The memory between sessions. Read this after the brief (`docs/design/fable-redesign-prompt.md`)
and before the parts of `SPEC.md` for the current phase.

Branch: `redesign/literary-instrument` (off `phase-0`). Never commit to `main` or `phase-0`, never
push, never deploy.

## Next step

**Phase 1 is done. Wait for Manu to name Phase 2 (landing hero).** Do not start it on your own.

Manu's answers to the five questions under "Needs Manu" have **not** been recorded: he named
Phase 1 in a session that was cut off before writing anything here, so Phase 1 was built on the
spec's own defaults. If his next message contains answers, write them into "Decisions" (with the
date) and change SPEC.md to match before anything else. Two of them touch code that now exists:
question 4 (`--needs` slate blue and the three hue labels, both in `tokens.css` /
`voice-hues.ts`) and question 1 (the casing, left Day-coloured in Day until Phase 5).

When Phase 2 is named, start here:

1. Start the local environment from `local-db.md`. Use the production build, not `next dev`
   (it reload-loops under Playwright; the note is in `local-db.md` §4).
2. Expand nothing: SPEC §3 is already at full values. Build in this order: the marketing nav
   (`frost` pill, `Wordmark`, "Start your story" with `buttonStyles({ arrow: true })`) → the
   server-rendered H1 and poster frame → the lazy Voiceline island (canvas, pause when hidden or
   offscreen, pause control) → the three essay sheets (`sheet` at `read-sm`, `note` margin lines)
   → the reduced-motion still → the phone composition → the facts strip. Then measure per-frame
   cost and LCP, shoot `landing` at 1440 / 390 / 375 with and without `--reduced`, score, and stop
   for review.
3. The system is in `packages/ui`; `/prototype/system` shows every piece. Reuse it: the hero's
   entrance is the `enter` utility with `--i`, the line is `draw-line` or the canvas, never a new
   keyframe.

## Phases

| Phase                      | Covers                                                                                                                     | Status                         |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| 0. Read, capture, spec     | repo read, branch, `shoot.mjs`, `local-db.md`, before shots, SPEC.md, this file                                            | reviewed; answers not recorded |
| 1. Design system           | tokens, type, grain, frost, components, motion utilities, wordmark, favicon, utility migration, tests, `/prototype/system` | **done** (2026-11-13)          |
| 2. Landing hero            | nav, hero signature, reduced-motion still, phone composition, facts strip, frame cost, LCP                                 | not started                    |
| 3. Landing, all scenes     | sections 2–13, GSAP sequence to CSS, Lenis decision                                                                        | not started                    |
| 4. Other marketing + entry | `/how-it-works`, `/pricing`, `/privacy`, `/terms`, OG, titles, `/sign-in`, `/welcome`, `/first-run`                        | not started                    |
| 5. Shell, home, Studio     | casing, sidebar, top bar, dock, palette, account menu, toasts, `/home`, `/studio`                                          | not started                    |
| 6. Schools and the editor  | `/schools`, workspace and tabs, preview, unlock, `/workspace/[id]`, `/kits/[id]`                                           | not started                    |
| 7. The rest of the app     | dossier, profile read, recommenders, portal, résumé, connect, settings, interview, tracker, all states                     | not started                    |
| 8. Final pass              | consistency sweep, axe, Lighthouse, overflow, console, reduced motion, admin, REPORT.md                                    | not started                    |

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

## Phase 1 checklist

Built across two sessions (the first, on 2026-11-12, was cut off with everything uncommitted; the
second inspected that work, kept all of it, and finished).

- [x] Fonts in `apps/web/app/layout.tsx` through `next/font/google`: Geist, Geist Mono,
      Instrument Serif italic preloaded; Source Serif 4 lazy, preloaded on the reading routes by
      `components/reading-fonts.tsx` (layouts added for `/workspace`, `/profile-read`, `/privacy`,
      `/terms`, `/r`)
- [x] `tokens.css`: material constants, Day / Night scopes (Night twice), voice hues, grain, type
      scale, radii, eases and durations, springs
- [x] `theme.css` mapping (old names kept: `display-xl` / `-lg` / plain / `-sm`, `rounded-plane`,
      `rounded-sheet`) and base rules
- [x] `render.css`: `card`, `sheet`, `frost`, `frost-flat`, `chip`, `btn-arrow`, `label`, `note`,
      `figure`, `serif-accent`, `enter`, `reveal`, `draw-line`; old utilities migrated per §2.12
- [x] `button-styles.ts` and `Button` (pills, arrow circle, no magnetic pull or edge light),
      text field, tabs (sliding rule), theme toggle (sliding pill), dialog, side sheet
- [x] `motion.ts` eases and durations, `motion-attribute.ts` head script in the root layout,
      `RevealObserver`
- [x] Wordmark, mark, `app/icon.svg`, model seal and seal mark
- [x] Voice hues refit (12, ids and order kept)
- [x] Callers migrated in the same change (class renames across admin, app, marketing and
      `packages/ui`, about 80 files)
- [x] Existing tests updated to the new tokens, none added: `contrast.test.ts` (and its token
      regex, which skipped names with digits such as `--text-80`), `voice-hues.test.ts`,
      `motion.test.ts`, `button.test.tsx`, `sheet.test.tsx`, `voice-notice.test.tsx`
- [x] `/prototype/system` (SPEC §2.13), linked from `/prototype`, added to `shoot.mjs`
- [x] After shots of every existing route (Day, and signed-in Night) to confirm they still render
- [x] Gates: typecheck, lint, build, `bundle:check`; `packages/ui` tests 742 of 742
- [x] SPEC.md updated where the build differs (§2.1 names, §2.2 interim, §2.4, §2.10, §2.12,
      §2.13, §8.1); REPORT.md; committed

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

Made in Phase 1 by Claude while building, **not yet approved by Manu**:

| Date       | Decision                                                                                                                | Why                                                                                      | Spec       |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------- |
| 2026-11-12 | Geist Mono is preloaded everywhere, not lazy in the app                                                                 | a label sits on nearly every screen; the three faces together are 66.5 KB against 157.3  | §2.4, §8.1 |
| 2026-11-12 | Day `--rail` stays `#E4E0D8` and the Day theme-color stays the desk until Phase 5                                       | the old shell is still Day-coloured in Day; a black rail now would put ink text on black | §2.2       |
| 2026-11-12 | Brass constants are named `--brass*` in the stylesheet; `--accent` is the semantic name (brass in Night, brass-ink Day) | one name can't be both a constant and a per-theme value                                  | §2.1       |
| 2026-11-12 | `read-lg` (20 → 21 px) added to the reading scale                                                                       | lead paragraphs and positioning lines on sheets                                          | §2.4       |
| 2026-11-13 | The "5 font files in the build" cap is dropped; the cap is the preload (≤ 110 KB a route)                               | `next/font/google` always emits the other unicode-range files; they are never preloaded  | §8.1       |
| 2026-11-13 | `/prototype/system` follows Day / Night outside its three fixed material panels                                         | the same page then shows the working area both ways                                      | §2.13      |
| 2026-11-13 | The system page's sample is a new fictional applicant (cold-chain coordinator, Nashik), school Northfield               | the brief: any new sample is a new fictional person                                      | §2.13      |

Approved, changed or rejected by Manu: Phase 1 was named (so the Phase 0 spec was accepted as the
working basis), but no answer to the five questions below was written down. Treat all five as
open.

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

- **Uncommitted work that is not the redesign's** sits in the working tree and was left alone:
  `AdmitStory_Build_Spec.md`, `packages/slots/src/questions.ts`, `packages/slots/src/slots.ts`,
  `apps/web/lib/studio/summary.ts` (the Studio slots v1.1 change of 2026-11-12). Redesign commits
  never stage them; keep it that way (`git add` by path, not `-A`).
- **One unit test fails and is not the redesign's**: `packages/db/test/schema.test.ts` expects
  `entitlements.purchase_id` to be unique. `packages/db` is untouched on this branch, and schema
  is out of scope, so it was not changed. Every other test passes (2,516 of 2,517; `packages/ui`
  742 of 742).
- **Interim look on screens not yet redesigned**: old Newsreader italics outside display lines are
  now a synthesised Geist oblique (`/sign-in`'s right panel is the clearest case), and the WebGL
  orb still draws in the hero. Each goes in its own phase (SPEC §2.12).
- **`next dev` reload-loops under Playwright** on every route. Not diagnosed. Work from the
  production build (`local-db.md` §4).
- `pnpm format:check` also flags `apps/web/app/(app)/settings/privacy/delete-dialog.tsx` and the
  two `shots/before/report*.json` files; all three are unchanged from Phase 0.

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

## Measured after Phase 1 (2026-11-13, production build, local)

- First-load JS: `/` 153.3 KB of 155; `/sign-in` 158.0 of 160; `/studio` 157.4; `/first-run`
  154.6; `/schools/[id]/unlock` 154.9; `/home` 148.4; most app routes 148.3;
  `/prototype/system` 155.2.
- Fonts preloaded: 66.5 KB on every route, 105.8 KB on reading routes.
- 375 px overflow: `/schools/[id]/unlock` now 7 px (was 13; still Phase 6's to fix);
  `ref-prototype-studio` 4 px. Nothing new.
- Console: unchanged from before (`/studio` 500 without AI, the 404 page's own 404). No hydration
  warnings.
- axe (WCAG 2.2 AA) on `/prototype/system`: 0 violations in Night and in Day.

## Scores

| Screen              | Glance | Signature | Type | Composition | Colour | Media | Motion | Mobile | Copy | Polish | Average |
| ------------------- | ------ | --------- | ---- | ----------- | ------ | ----- | ------ | ------ | ---- | ------ | ------- |
| `/prototype/system` | 8      | 8         | 9    | 8           | 8      | 8     | 8      | 7      | 8    | 8      | **8.0** |

First pass scored 7.4 (polish 6, composition 7, mobile 6: transcript lines ran under the frost
caption, a tab was clipped at the panel edge, the Night-paper colour column was two-thirds empty,
one heading broke into three lines, and the radius grid was cramped at 390). All five were fixed
and re-shot. Mobile stays the weakest: it is a correct single column, not a recomposition, which
is acceptable for a hidden reference page and not for any real screen.
