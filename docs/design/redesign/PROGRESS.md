# Redesign progress: "The Literary Instrument"

The memory between sessions. Read this after the brief (`docs/design/fable-redesign-prompt.md`)
and before the parts of `SPEC.md` for the current phase.

Branch: `redesign/literary-instrument` (off `phase-0`). Never commit to `main` or `phase-0`, never
push, never deploy.

**Where the branches stand (seen 2026-11-17):** `main` and `origin/main` were fast-forwarded to
`f710165`, the merge that carries redesign Phases 0–2 and the funnel fixes, and the branch was
pushed too. No redesign session did that. Phase 3 was built with `main` checked out (nothing was
committed there); the session of 2026-11-17 moved the uncommitted work back to
`redesign/literary-instrument` and committed it on the branch, unpushed.

## Next step

**Phase 5 is done (2026-11-17). Do not start Phase 6 until Manu names it.** If his message has
feedback on the casing, Home or the Studio, write it into "Decisions" (with the date), change
SPEC §6.1, §6.3 or §6.4 to match, and fix that first.

When Phase 6 is named, start here:

1. Load the project skills that apply (`.claude/skills/`: `emil-design-eng`, `animate`,
   `choreograph`, `mobile-native`; SPEC §2.10). Manu asked again on 2026-11-17 that they be used.
2. Start the local environment from `local-db.md` (production build). Signed-in probes and
   populated screens: the Phase 5 scripts stub a request in the browser (see REPORT, Phase 5);
   nothing reaches the database.
3. Expand SPEC §6.2's Schools, workspace, preview, unlock and editor rows to full values, then
   build them. Add `/workspace` to `RAIL_PATHS` (`packages/ui/src/shell/nav-items.ts`) so the
   editor gets the 64 px rail. Redraw the kit's assembly without the Voiceprint still.

## Phases

| Phase                      | Covers                                                                                                                     | Status                         |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| 0. Read, capture, spec     | repo read, branch, `shoot.mjs`, `local-db.md`, before shots, SPEC.md, this file                                            | reviewed; answers not recorded |
| 1. Design system           | tokens, type, grain, frost, components, motion utilities, wordmark, favicon, utility migration, tests, `/prototype/system` | **done** (2026-11-13)          |
| 2. Landing hero            | nav, hero signature, reduced-motion still, phone composition, facts strip, frame cost, LCP                                 | built; Phase 3 named, no notes |
| 3. Landing, all scenes     | sections 2–13, GSAP sequence to CSS, Lenis decision                                                                        | **done** (2026-11-17)          |
| 4. Other marketing + entry | `/how-it-works`, `/pricing`, `/privacy`, `/terms`, OG, titles, `/sign-in`, `/welcome`, `/first-run`                        | **done** (2026-11-17)          |
| 5. Shell, home, Studio     | casing, sidebar, top bar, dock, palette, account menu, toasts, `/home`, `/studio`                                          | **done** (2026-11-17)          |
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

## Phase 2 checklist

Built in one session on 2026-11-14.

- [x] Marketing nav: one frosted pill, always dark, on the grid's margins; "Start your story";
      40 px round menu button below `lg`; `nav-compact.tsx` removed
- [x] Phone menu restyled (`--bg` with grain, 24 px top, links in `display-3`, primary at the foot)
- [x] Server-rendered hero: eyebrow, H1 word by word, subline, both actions, model credit
- [x] The poster: sample 1's sentence, three fanned sheets with margin notes, the Voiceline as an
      inline SVG path (one for `lg`+, one below)
- [x] `voiceline-shape.ts` (shared maths), `hero-loop-gate.tsx` (first load), `hero-loop.ts`
      (lazy: canvas line, word-by-word sentence, sheets rising into hairline slots, the mark, the
      notes; pause when hidden, offscreen or paused; pause control)
- [x] Three samples written in `_copy/hero.ts` (nine margin notes, nine openings)
- [x] Reduced-motion and no-JS still: the poster, no pause button, the loop never requested
- [x] Phone and tablet composition (the stage is a container; two designs scaled in `--u`)
- [x] Facts strip with the sample note and pause control
- [x] Old hero deleted: `hero-stage`, `hero-experience`, `hero-voiceprint`, `hero-state`,
      `hero-motion`, `hero-ui`, `hero-demo`; `rendererGate` removed from `_lib/gates.ts`
- [x] Measured: per-frame cost, frames while stopped, CLS, LCP (observed, Lighthouse simulated,
      Lighthouse applied), the loop's chunk, font preload, axe
- [x] Shot `landing` at 1440 / 390 / 375 with and without `--reduced`, plus hero evidence shots
- [x] Gates: typecheck, lint, build, `bundle:check`
- [x] SPEC §3 rewritten to the values as built; REPORT.md; committed

## Phase 3 checklist

Built across two sessions (the first, on 2026-11-16, built all twelve scenes and was cut off
with everything uncommitted and nothing shot; the second, on 2026-11-17, inspected that work,
kept all of it, fixed five things found in the screenshots, measured and committed).

- [x] SPEC §4 expanded to full values for scenes 2–13
- [x] Chrome: marketing dark-only (`marketing-theme.ts` and the footer's theme switch removed,
      `themeColor` Night), grain painted once on the wrapper, one `RevealObserver` in
      `PageTransition`, footer rebuilt
- [x] GSAP and Lenis removed (`package.json`, lockfile, `_follow/*`, `_motion/*`,
      `_lib/gates.ts`); nothing on the page runs a frame loop outside the hero
- [x] Scene 2, schools strip (static, two justified rows from 1280 px)
- [x] Scene 3, how it works (`#how`): four product windows, sticky stepper, complete without
      JavaScript; `HOW_HREF` in the hero points at it
- [x] Scene 4, school by school (new fictional applicant; Wharton, Tuck, HEC Paris)
- [x] Scene 5, the paper scene: sheet with margin notes, "your words" switch (`Y`), "Write your
      own line" back on the page, client-only
- [x] Scene 6, the model (dial seal and ledger, every word from `model-claims.ts`)
- [x] Scene 7, Connect (static grid of six illustrative portraits, roles only);
      `SocialProofSlot` after it, rendering nothing
- [x] Scene 8, what it won't do; scene 9, interview practice, labelled "Coming soon" and
      "Preview · not available yet"
- [x] Scene 10, pricing (plans from `_data/pricing.ts`, final-sale line); scene 11, questions;
      scene 12, final call; scene 13, footer
- [x] Old sections and their helpers deleted (`app-preview`, `real-screens`, `screens-stepper`,
      `your-words*`, `how-it-works-lines`, `final-voiceprint*`, `_ui/frames`, `_ui/hairline`)
- [x] Shot at 1440 and 390 scene by scene, plus 320, 375, 768, 1024, 1280 and 1920 for
      overflow, the stepper at each step, the switch on, a line placed, a question open, reduced
      motion and JavaScript off
- [x] Scored; five fixes; re-shot (see "Scores")
- [x] Measured: bundle, document weight, fonts, CLS, idle frames, axe, Lighthouse (two modes),
      LCP candidates on a throttled phone
- [x] Gates: typecheck, lint, build, `bundle:check`; existing unit tests
- [x] SPEC §4 and §3.3 updated where the build differs; REPORT.md; committed

## Phase 4 checklist

- [x] SPEC §4.2 (the four pages, OG images, titles) and §5 (entry) expanded to full values
- [x] Emil Kowalski's skills installed (`.claude/skills/`), rules in SPEC §2.10, phone layer in
      `theme.css`
- [x] `/how-it-works`: head, index, four stages with their windows, the pack assembling,
      interview row, what it won't do, AI policies on paper, final call (8.4; threads draw
      with `clip-path`, not a dash: a dash breaks on a stretched non-scaling stroke)
- [x] `/pricing`: the strike, plans, one kit opened, the ledger, elsewhere and here, payment,
      questions, final call; `SocialProofSlot` above the plans (8.4)
- [x] `/privacy` and `/terms` on paper: contents, hanging numbers, the voice path, the reading
      line (8.5)
- [x] OG images (five routes, one template) and titles (`HOME_TITLE` "AdmitStories: tell it
      once, tell it well")
- [x] The entry room (`auth-shell.tsx`, `entry.css`); `/sign-in` with the sheet, the line and
      "Check your email"; `/goodbye` and not-found
- [x] `/welcome`
- [x] `/first-run` (all five steps)
- [x] Old helpers deleted (`school-packs`, `tick`, `display-heading`, `notes`, `screens*`,
      `sample-hue`, `_unlock*`, `_assembly*`, `voice-path-play`, the `capture:screens` stub)
- [x] Shot, scored, fixed, re-shot; measured (bundle, overflow, console, axe)
- [x] Gates: typecheck, lint, build, `bundle:check`; existing unit tests (2,515 of 2,517, the same
      two failures as before)
- [x] SPEC updated where the build differs; REPORT.md; committed

## Phase 5 checklist

- [x] SPEC §6.1 (casing), §6.3 (Home) and §6.4 (Studio) at full values
- [x] The casing: sidebar, rail mode, bay, top bar, dock, palette, account menu, toasts, page
      header; Day `--rail` and `THEME_COLORS` to `#0B0A09`
- [x] `/home`: head, next step, the path line, schools with deadlines, the model credit
- [x] `/studio`: Night always, rail, the horizon Voiceline, record button, transcript, Speak /
      Write, shelf and coverage lines, gate, session summary
- [x] OGL out: the Studio, kit assembly and the studio and duet prototypes off the WebGL
      Voiceprint; `ogl`, `detect-gpu`, `public/detect-gpu`, the renderer and its tests deleted
- [x] Shot in Day and Night (1440, 390, 375 overflow), scored, fixed, re-shot; measured
- [x] Gates: typecheck, lint, build, `bundle:check`, format check; existing unit tests (2,442 of
      2,442: the two old failures are gone; the deleted renderer and tier tests account for the
      lower count)
- [x] SPEC updated where the build differs; REPORT.md; committed

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

Made in Phase 2 by Claude while building, **not yet approved by Manu**:

| Date       | Decision                                                                                                                     | Why                                                                                                                   | Spec       |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------- |
| 2026-11-14 | The loop is plain DOM, canvas and the Web Animations API on the server's own markup: no React island, no hydration           | 3.1 KB instead of a hydrated island; no chance of the lazy-island double blink; all three samples' copy stays in HTML | §3.5       |
| 2026-11-14 | Sheet margins are as wide as the step between sheets (108 of 120), on 272 × 344 sheets                                       | with 76 px margins the fan showed cut-off slivers of essay text; now it shows three notes, then one essay             | §3.2, §3.4 |
| 2026-11-14 | The sentence stays under its sheets and dims to 64 %; it does not lift and fade                                              | lifting left the band above the line empty for the whole hold, and the hold no longer matched the poster              | §3.5       |
| 2026-11-14 | Three hairline "slots" sit where the sheets lie and show while an applicant speaks                                           | without them the right half of the hero was empty for five seconds of every eleven                                    | §3.4       |
| 2026-11-14 | Title, note and word count all live in the sheet's margin; a "Spoken · role" label sits above the sentence                   | every sheet is then identifiable in the fan; the label says whose voice the line is                                   | §3.4       |
| 2026-11-14 | The flat line is `--line-strong` (20 %), not `--line` (12 %)                                                                 | at 12 % the horizon did not read as a line under the headline                                                         | §3.4       |
| 2026-11-14 | Sheets 1 and 2 sit a tone back and each sheet casts one contact shadow on the one beneath (the first spec said no shadow)    | three same-coloured overlapping sheets had no visible edges                                                           | §3.4       |
| 2026-11-14 | The stage is a CSS container and the fan is set in `--u`; two designs, switching at a 460 px stage                           | one composition from 320 px phones to 1920 px screens with no per-breakpoint numbers                                  | §3.2       |
| 2026-11-14 | The nav is always dark (frost on a 72 % wash of `--bg`), also over paper                                                     | plain frost over a paper scene would be a pale pill with white text; scene 5 and the legal pages are paper            | §3.3       |
| 2026-11-14 | Strip is four equal columns (three facts, then the sample note and pause), not facts at 1–4, 5–8, 9–12                       | the sample note and pause need a place on the strip's right end                                                       | §3.2       |
| 2026-11-14 | `/` preloads Source Serif 4 roman (+19.7 KB; 86 KB of fonts in all)                                                          | the sheets are on screen at first paint; without it the essay text swapped faces in view                              | §3.4, §8.1 |
| 2026-11-14 | Phone gutters stay the grid's 16 px (the first spec said 20 px)                                                              | every other marketing section uses `SECTION_GRID`                                                                     | §3.2       |
| 2026-11-14 | `synthetic-signal.ts` imports the springs from `../springs`, not `../motion`                                                 | `../motion` imports `motion/react`; the loop must not be able to pull Motion into its chunk                           | §3.5       |
| 2026-11-14 | The H1 is one inline-block a word, so it is not what Chrome reports as LCP; LCP is other server-rendered text at first paint | the brief asks for both a per-word rise and "the H1 is the LCP element"; see SPEC §3.7 and "Needs Manu" 6             | §3.7       |

Made in Phase 3 by Claude while building, **not yet approved by Manu**:

| Date       | Decision                                                                                                                             | Why                                                                                         | Spec         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ------------ |
| 2026-11-16 | GSAP and Lenis are removed                                                                                                           | the stepped scene needs neither; one scroll model, no ticker                                | §8.3         |
| 2026-11-16 | "How it works" is four steps (Tell, Position, Draft, Refine) with product windows drawn in markup, pinned by CSS `sticky`            | the brief's scene 3; real UI from the system, not screenshots; complete without JavaScript  | §4, scene 3  |
| 2026-11-16 | Scene 4's applicant is new (a site engineer on a metro line); the schools are Wharton, Tuck and HEC Paris, each prompt from its pack | the brief: real school names, a fictional applicant, any new sample a new person            | §4, scene 4  |
| 2026-11-16 | The paper scene's sheet and controls are one client component rendered on the server, not a lazy island                              | an island's markup arrives late and never shows without JavaScript                          | §4, scene 5  |
| 2026-11-16 | A written line is not cleaned of fillers: only trimmed, capitalised and given a full stop                                            | its caption says "Word for word, that's your line"                                          | §4, scene 5  |
| 2026-11-16 | The AI-policy table left the landing page; scene 8 links to `/how-it-works#ai-policies`                                              | "short and sharp"; sixteen rows of table were neither                                       | §4, scene 8  |
| 2026-11-16 | The Connect marquee is a static 3 × 2 grid                                                                                           | nothing in the background moves                                                             | §4, scene 7  |
| 2026-11-16 | Prices are set in Geist, not Geist Mono                                                                                              | in mono the four prices read as a terminal                                                  | §4, scene 10 |
| 2026-11-17 | The nav's wash is 88 % of `--bg`, up from 72 %                                                                                       | over the paper scene the pill was mid-grey with white text                                  | §3.3         |
| 2026-11-17 | The final call has one action. "Sign in" is not repeated there; the model credit is centred under the line                           | it sat alone under the credit; beside the button it would leave the peak under neither      | §4, scene 12 |
| 2026-11-17 | The pinned window is centred in the viewport (`top: max(112px, …)`), and the Studio window's question sits midway down               | at 1080 px tall the window hung in the top half; the Studio window had 200 px of dead space | §4, scene 3  |
| 2026-11-17 | The hero's entrance was **not** changed, although it now sets LCP ("Needs Manu" 6)                                                   | the hero was reviewed as built; the trade is Manu's                                         | §3.7         |

**From Manu, 2026-11-17 (naming Phase 4):** use the skills at
https://github.com/emilkowalski/skills throughout the project. Done the same day: seven copied
unchanged into `.claude/skills/` (see its README), their rules written into SPEC §2.10 ("Rules
from the project skills"), and the phone layer added to `theme.css` (tap highlight, text size
adjust, `touch-action`, `user-select` on controls). Every phase from 4 follows them. He also
asked why only the landing page has changed: answered that each screen gets its new layout in
its own phase (Studio and Home in 5, Schools in 6, the rest in 7), and until then wears only
Phase 1's colours and type.

Made in Phase 4 by Claude while building, **not yet approved by Manu**:

| Date       | Decision                                                                                                                                    | Why                                                                                       | Spec  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----- |
| 2026-11-17 | Emil Kowalski's seven web skills live in `.claude/skills/`; their rules are SPEC §2.10's; the phone layer is in `theme.css`                 | Manu asked for them throughout the project                                                | §2.10 |
| 2026-11-17 | `/how-it-works` keeps all eight old steps, two to a stage, beside the landing page's four windows; the moment is the pack's threads drawing | nothing the old page promised is lost; the windows already exist                          | §4.2  |
| 2026-11-17 | Lines on stretched drawings draw with `clip-path`, not a dash                                                                               | a dash on `pathLength="1"` breaks into fragments with a non-scaling stroke                | §4.2  |
| 2026-11-17 | `/pricing` opens on "5 schools. ~~$500~~ $349." with the strike drawn on load; the "Show what unlocks" switch is replaced by four sheets    | the price is the page's subject; a still kit shows more than a toggle and costs no script | §4.2  |
| 2026-11-17 | The legal pages are one sheet of paper from the top of the window; the reading line is on `/terms` only                                     | one moment per page: `/privacy` has the voice path                                        | §4.2  |
| 2026-11-17 | One OG template for five routes; Instrument Serif italic as a TTF beside it (OFL)                                                           | Satori reads TTF, not next/font's woff2; build-time only                                  | §4.2  |
| 2026-11-17 | The entry room is always Night and is the one shell for sign-in, welcome, first-run, goodbye and not-found                                  | "walking into a quiet room"; the room is part of the casing                               | §5    |
| 2026-11-17 | Welcome's button wakes from flat frost to brass, not from 45 % opacity                                                                      | a faded brass button that can still be pressed fails AA                                   | §5    |
| 2026-11-17 | The `capture:screens` stub script and `_data/screens*.ts` are deleted                                                                       | the windows are live markup now; the stub never captured anything                         | §4.2  |

**From Manu, 2026-11-17 (naming Phase 5):** "don't forget to use the new claude skill", read as
Emil Kowalski's project skills: `emil-design-eng`, `mobile-native` and `animate` were loaded and
applied (the palette has no animation; hover is gated; presses scale; the line is a canvas that
runs only while someone speaks; `viewport-fit=cover` so safe areas apply).

**From Manu, 2026-11-18 (naming Phase 6):** "Read the brief and PROGRESS, then do Phase 6. Use
the new claude skill." No feedback on Phase 5's screens, so the casing, Home and the Studio stand
as built. "The new claude skill" read as before: Emil Kowalski's project skills
(`emil-design-eng`, `animate`, `choreograph`, `mobile-native`) loaded at the start and followed.

Made in Phase 5 by Claude while building, **not yet approved by Manu**:

| Date       | Decision                                                                                                                                       | Why                                                                                                   | Spec       |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------- |
| 2026-11-17 | The working area is a **bay** inset 8 px in the dark casing from 1024 px; the sidebar has no fill of its own                                   | "a dark instrument holding a lit page"; the bay's edge is the only line needed                        | §6.1       |
| 2026-11-17 | Below 1024 px: a dark top bar and a **floating dock pill**, both on the marketing nav's 88 % wash (not plain frost)                            | plain frost over the Day desk is a pale pill with white text                                          | §6.1       |
| 2026-11-17 | The palette, account menu and toasts use `.casing-overlay` (the wash at 92 %), not `frost`                                                     | first shots: frost over the Day desk made them light and unreadable                                   | §6.1       |
| 2026-11-17 | The command palette has **no animation** and sits at 14 % of the height                                                                        | a keyboard action used many times a day (SPEC §2.10); the list grows downwards without jumping        | §6.1       |
| 2026-11-17 | `THEME_COLORS` is `#0B0A09` in both themes; Day `--rail` likewise; `contrast.test.ts` asserts it                                               | the top of every app screen is casing                                                                 | §6.1       |
| 2026-11-17 | `viewport-fit=cover` and `interactive-widget=resizes-content` in the root viewport; the marketing nav pads for the safe area                   | the mobile-native skill: without it every `env(safe-area-inset-*)` was 0                              | §6.4 notes |
| 2026-11-17 | Home's path is one line with four stops; the line draws, then brass to the current stop, then the peak rises; vertical on phones               | the brief's "path line draws to where you are", visible even on stage 1                               | §6.3       |
| 2026-11-17 | Home shows each school's next deadline from the pack's verified rounds (a read-only addition to `lib/home/server.ts`)                          | "schools, deadlines and next actions"; the same rule the school cards use                             | §6.3       |
| 2026-11-17 | The Studio is a conversation: the question in Geist `display-2`, the transcript in Instrument Serif italic, a horizon line with the button on it | "talking to someone attentive, not filling in a form"                                                 | §6.4       |
| 2026-11-17 | The line is silver while the question is read aloud, the applicant's hue while they speak                                                       | §1.1: the line takes the colour of whoever is speaking                                                | §6.4       |
| 2026-11-17 | Speak / Write moved to a segmented control in the top row; "Write instead" / "Talk instead" buttons removed (the notice action stays)          | one switch, always in the same place                                                                  | §6.4       |
| 2026-11-17 | The `Voiceprint` component is the still SVG; OGL, detect-gpu and their tests are deleted; the kit and duet keep the still until their phases   | Manu's yes (§10.3); deleting needed every caller off the renderer                                     | §6.4 notes |

Approved, changed or rejected by Manu: Phase 1 was named (so the Phase 0 spec was accepted as the
working basis). All of "Needs Manu" was answered on 2026-11-17, below.

## Answered by Manu (2026-11-17)

1. **Dark casing in Day** (SPEC §10.1): **yes, keep it dark.** Phase 5 builds the sidebar and top
   bar Night in both themes.
2. **Headline** "Tell it once. / Tell it _well._" (§3.3): **approved.**
3. **WebGL prototypes** (§10.3): **yes.** Done now: `/prototype/voiceprint` (lab, its tests and
   its e2e spec) is deleted. Still to do, in Phase 5: the live Studio (`voice-stage.tsx`) and the
   studio and duet prototypes move to the Voiceline, then `ogl`, `detect-gpu`,
   `public/detect-gpu` and the renderer in `packages/ui/src/voiceprint` go. They can't go before:
   the Studio still draws the OGL Voiceprint.
4. **`--needs` slate blue and the hue renames** (§10.4): **approved.** Both were already in the
   tokens and `voice-hues.ts` from Phase 1; nothing to change.
5. **The schools claim** (§9.4): **"16 schools"** (Manu). `MODEL_CORPUS` reads "16 · Schools, read
   closely" and the seal's fallback centre reads 16.
6. **The hero's entrance and LCP** (§3.7): **B.** The subline is still from the first frame; the
   headline still rises word by word, the eyebrow, buttons and model line still enter.
7. **First paint** (§3.7, §8.1): **drop the Source Serif preload, and get under 2.4 s.** Done: the
   sheets use the root's lazy face (`_ui/sheet-serif.ts`), and `experimental.inlineCss` sends the
   CSS inside the HTML. Lighthouse mobile, throttling applied, three runs, production build
   (local, gzip): **FCP 2.41 → 1.14 s, LCP 3.81 → 1.65 s**, performance 0.83 → 0.97. The LCP
   element is now a headline word as it rises. The document grew (the CSS is inlined once and
   repeated in the RSC payload): 68 → 156 KB over gzip locally, **55–68 KB over Brotli**, which
   is what Vercel sends; the five stylesheet requests are gone.

8. ~~The legal pages print `TODO(Manu)` placeholders~~ **Resolved 2026-11-17** (Manu: use our
   draft, write what's missing): entity is "AdmitStories", data region Singapore (Neon
   ap-southeast-1, Vercel sin1), EU/UK requests go to the privacy email, liability is capped at 12
   months' fees, Indian law governs. The draft note is off and `LEGAL_UPDATED` is 2026-11-17.
   Change `LEGAL_ENTITY` if a company is registered.

## Open problems

- **Someone else is working in this checkout at the same time** (seen 2026-11-14): during the
  Phase 2 session about twenty files outside the redesign changed in the working tree (Studio
  screens, `api/studio`, `packages/ai`, `packages/slots`, `packages/voice`, `knowledge/canon`),
  on top of the four listed below. All were left alone and none are in a redesign commit. Local
  builds for screenshots include them, because they are in the tree. One of them
  (`packages/voice/src/contract.ts`, the utterance end now 1,500 ms) makes
  `apps/web/app/api/stt/token/route.test.ts` fail; that test and the `db` schema test are the
  two failures of 2,517, and neither is the redesign's.
- **`next build` stops once with "Your version of Next.js is affected by a known security
  vulnerability"** (seen 2026-11-17, Next 16.4.3) and prints instructions to run
  `next upgrade --agent=security`. Running the build again continues. Nothing was upgraded:
  dependencies are outside this job. Manu should look at the advisory.
- **`/how-it-works`, `/pricing`, `/privacy` and `/terms` are dark with their old layouts** until
  Phase 4. They render cleanly (no overflow, console or hydration errors).
- **Uncommitted work that is not the redesign's** sits in the working tree and was left alone:
  `AdmitStory_Build_Spec.md`, `packages/slots/src/questions.ts`, `packages/slots/src/slots.ts`,
  `apps/web/lib/studio/summary.ts` (the Studio slots v1.1 change of 2026-11-12). Redesign commits
  never stage them; keep it that way (`git add` by path, not `-A`).
- **One unit test fails and is not the redesign's**: `packages/db/test/schema.test.ts` expects
  `entitlements.purchase_id` to be unique. `packages/db` is untouched on this branch, and schema
  is out of scope, so it was not changed. Every other test passes (2,516 of 2,517; `packages/ui`
  742 of 742).
- **Interim look on screens not yet redesigned**: old Newsreader italics outside display lines are
  now a synthesised Geist oblique. WebGL is gone from the product (Phase 5); the Voiceprint
  **still** (an SVG orb) remains on the Dossier voice tab, the kit's assembly and the duet
  prototype until Phases 6 and 7 redraw them.
- **Not seen working with a real microphone**: locally there is no speech-to-text key, so a
  spoken answer is refused before the line can follow a live voice. The line was seen moving on
  `/prototype/studio`'s scripted sample and in silver while a question was read aloud on the real
  screen; Manu should try one spoken answer on a preview deployment.
- **Toasts were restyled but not seen**: nothing on the Phase 5 screens raises one locally.
- **The recommender portal's browser chrome is now dark** for a light-scheme visitor, because
  `THEME_COLORS.day` is the casing. Phase 7 can give `/r` its own paper `themeColor`.
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
- Full-page screenshots of `/` repeat the fixed nav and catch the pinned stepper mid-scroll. A
  capture artefact; the scene-by-scene shots are the ones to judge.

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

## Measured after Phase 2 (2026-11-14, production build, local)

- First-load JS: `/` **151.9 KB** of 155 (was 153.3); `/how-it-works` 150.8, `/pricing` 145.6,
  `/privacy` 144.8, `/terms` 144.4, `/sign-in` 157.9 of 160. The hero's loop: 3.1 KB gz, lazy.
- Fonts preloaded on `/`: 86 KB (Source Serif 4 roman added for the sheets). Other routes
  unchanged.
- Loop on a phone at 4× CPU: 0.07 ms a frame in the callback, 1.9 ms of main-thread time a
  frame; 0 frames while paused, offscreen or hidden. Desktop: 0.04 ms and 1.0 ms.
- CLS over a full pass: 0 (phone), 0.0001 (desktop).
- LCP: equals first paint (observed locally 0.1–0.25 s). Lighthouse mobile, simulated: FCP 1.66 s,
  LCP 2.87 s, TBT 16 ms, CLS 0, performance 0.95, accessibility 0.97 (the old-section chip), best
  practices 1.00, SEO 1.00. Lighthouse mobile, throttling applied: FCP and LCP 2.28 s, TBT 40 ms.
- axe (WCAG 2.2 AA) on the hero and nav: 0 violations, with motion and with reduced motion.
- 375 px overflow on `/`: none. Console, failed requests, hydration warnings: none.

## Measured after Phase 3 (2026-11-17, production build, local)

- First-load JS: `/` **147.7 KB** of 155 (was 151.9); `/how-it-works` 149.2, `/pricing` 144.0,
  `/privacy` 143.2, `/terms` 142.8, `/sign-in` 158.0 of 160. The page's own chunk (the paper
  scene's toy and the stepper): 5.1 KB gz.
- Document: 245.9 KB, 47.0 KB gz (was 354 KB). 1,050 elements.
- Fonts preloaded on `/`: 86.1 KB in 4 files (unchanged); 105.8 KB fetched after a full pass.
- CLS over a full pass: 0 (phone), 0.0001 (desktop).
- Frames asked for in 3 s with the hero off screen: 0 (the GSAP ticker is gone).
- axe (WCAG 2.2 AA) on the whole page: 0 violations on desktop, under reduced motion, on a
  phone, and with the switch on, a line placed and a question open.
- Lighthouse mobile, simulated (two sets of three): performance 0.83 and 0.92, accessibility
  1.00, best practices 1.00, SEO 1.00; FCP 1.51 s, **LCP 3.3 s**, TBT 44 and 383 ms (it varies
  between sets), CLS 0.
- Lighthouse mobile, throttling applied: performance 0.86; FCP 2.44 s, **LCP 3.42 s**, TBT
  92 ms, CLS 0. LCP candidates on the same throttled phone, three runs: first paint at
  2.38–2.49 s (the top sheet's text), then the hero subline at 3.41–3.74 s. See "Needs Manu" 6.
- Overflow: none at 320, 375, 390, 768, 1024, 1280, 1440 or 1920. Console, failed requests,
  hydration warnings: none on any public page (the 404 page logs its own 404, as before).

## Measured after Phase 4 (2026-11-17, production build, local)

- First-load JS: `/how-it-works` **142.8 KB** of 155 (was 149.2), `/pricing` 143.2 (was 144.0),
  `/privacy` and `/terms` 142.8, `/` 147.7 (unchanged), `/sign-in` **157.6** of 160 (was 158.0),
  `/first-run` **148.4** (was 154.6; the Voiceprint still left it), `/welcome` 142.8, `/goodbye`
  137.5.
- Fonts: no route preloads more than before (`/sign-in`'s sheet uses the lazy reading serif).
- axe (WCAG 2.2 AA): 0 violations on `/how-it-works`, `/pricing`, `/privacy`, `/terms`,
  `/sign-in`, `/goodbye` and the 404 page at 1440 and 390, and on `/welcome` and two
  `/first-run` steps at 1440.
- Overflow at 375 px: none on any Phase 4 route. Console, failed requests, hydration warnings:
  none (the 404 page logs its own 404, as before).

## Measured after Phase 5 (2026-11-17, production build, local)

- First-load JS: `/studio` **157.9 KB** of 160 (was 157.4: the casing's CSS-driven sidebar and the
  Speak / Write switch; the canvas line is in the lazy voice stage), `/home` **146.1** (was 148.4),
  `/prototype/studio` 153.0, `/` 147.4, `/sign-in` 157.1, `/first-run` 148.2.
- The Voiceline (on `/prototype/studio`'s scripted sample, the page's other loops included):
  **0.18 ms** of script and 0.94 ms of main-thread work a frame; at 4× CPU slowdown 0.59 and
  1.88 ms. `/studio` at rest: **0.0 ms** of script in 3 s (no loop runs).
- axe (WCAG 2.2 AA): **0 violations** on `/home`, `/studio` and `/settings`, Day and Night, at 1440
  and 390.
- Overflow at 375 px: none on `/home`, `/studio`, `/schools`, `/settings` (and its two subpages),
  Day, Night and reduced motion. Hydration warnings: none. Console: `/studio` logs the known 500
  from `/api/studio/sessions` (no AI locally); nothing else.

## Scores

| Screen               | Glance | Signature | Type | Composition | Colour | Media | Motion | Mobile | Copy | Polish | Average |
| -------------------- | ------ | --------- | ---- | ----------- | ------ | ----- | ------ | ------ | ---- | ------ | ------- |
| `/prototype/system`  | 8      | 8         | 9    | 8           | 8      | 8     | 8      | 7      | 8    | 8      | **8.0** |
| `/` hero and nav     | 9      | 9         | 9    | 8           | 9      | 9     | 8      | 8      | 8    | 8      | **8.5** |
| `/` whole page       | 9      | 9         | 9    | 8           | 9      | 8     | 8      | 8      | 9    | 8      | **8.5** |
| 2 schools strip      | 8      | 7         | 9    | 8           | 8      | 8     | 7      | 8      | 8    | 9      | **8.0** |
| 3 how it works       | 9      | 9         | 9    | 8           | 9      | 9     | 8      | 8      | 9    | 8      | **8.6** |
| 4 school by school   | 9      | 8         | 9    | 8           | 9      | 8     | 7      | 8      | 9    | 8      | **8.3** |
| 5 essays, on paper   | 9      | 9         | 9    | 8           | 9      | 9     | 8      | 8      | 9    | 8      | **8.6** |
| 6 the model          | 8      | 8         | 9    | 8           | 8      | 8     | 8      | 8      | 8    | 8      | **8.1** |
| 7 Connect            | 8      | 7         | 9    | 8           | 8      | 8     | 7      | 8      | 8    | 8      | **7.9** |
| 8 what it won't do   | 8      | 7         | 9    | 8           | 8      | 7     | 7      | 8      | 9    | 8      | **7.9** |
| 9 interview, soon    | 8      | 8         | 8    | 8           | 9      | 8     | 8      | 8      | 9    | 8      | **8.2** |
| 10 pricing           | 8      | 8         | 8    | 8           | 9      | 7     | 7      | 8      | 9    | 8      | **8.0** |
| 11 questions         | 8      | 7         | 9    | 8           | 8      | 7     | 7      | 8      | 8    | 8      | **7.8** |
| 12 final call        | 8      | 7         | 9    | 8           | 8      | 7     | 8      | 8      | 8    | 8      | **7.9** |
| 13 footer            | 8      | 7         | 8    | 8           | 8      | 7     | 7      | 8      | 8    | 8      | **7.7** |
| `/how-it-works`      | 8      | 8         | 9    | 8           | 9      | 9     | 8      | 8      | 9    | 8      | **8.4** |
| `/pricing`           | 9      | 8         | 9    | 8           | 9      | 8     | 8      | 8      | 9    | 8      | **8.4** |
| `/privacy`, `/terms` | 9      | 8         | 9    | 9           | 9      | 8     | 8      | 8      | 8    | 9      | **8.5** |
| OG images            | 9      | 8         | 9    | 8           | 9      | 8     | n/a    | n/a    | 9    | 9      | **8.6** |
| `/sign-in`           | 9      | 8         | 9    | 8           | 9      | 8     | 8      | 8      | 8    | 8      | **8.3** |
| `/welcome`           | 8      | 7         | 9    | 8           | 9      | 7     | 8      | 8      | 8    | 8      | **8.0** |
| `/first-run`         | 8      | 8         | 9    | 8           | 9      | 7     | 8      | 8      | 8    | 8      | **8.1** |
| not-found, goodbye   | 8      | 7         | 9    | 8           | 8      | 7     | 7      | 8      | 8    | 8      | **7.8** |
| The casing           | 9      | 7         | 9    | 9           | 9      | 8     | 8      | 8      | 8    | 8      | **8.3** |
| Palette, menu, toast | 8      | 7         | 9    | 8           | 9      | 7     | 9      | 8      | 8    | 8      | **8.1** |
| `/home`              | 8      | 8         | 9    | 8           | 9      | 8     | 8      | 8      | 8    | 8      | **8.2** |
| `/studio`            | 9      | 9         | 9    | 8           | 9      | 9     | 8      | 8      | 8    | 8      | **8.5** |
| Studio free-half gate | 9     | 8         | 9    | 8           | 9      | 8     | 8      | 8      | 9    | 8      | **8.4** |

First pass scored 7.4 (polish 6, composition 7, mobile 6: transcript lines ran under the frost
caption, a tab was clipped at the panel edge, the Night-paper colour column was two-thirds empty,
one heading broke into three lines, and the radius grid was cramped at 390). All five were fixed
and re-shot. Mobile stays the weakest: it is a correct single column, not a recomposition, which
is acceptable for a hidden reference page and not for any real screen.

**Hero.** First pass scored about 7.0 (polish 5, media 6, signature 7): the sentence's words ran
together (a hanging indent inherited by every word), the word count was clipped off the phone's
top sheet, the fan showed cut-off slivers of the two lower essays, and the stage sat empty while
an applicant spoke. Fixed in three rounds and re-shot each time: the indent and a line clamp;
the wider margins (three notes in a row); then the slots, the counts in the margins, a stronger
live line, the earlier switch to the full design at 1280, and the text inset on the lower sheets.
The three lowest now are composition (at 1440 and wider there is a lot of air between the
headline and the stage), motion (judged from timed frames, not watched at speed by a person
yet) and mobile (the sentence and the line sit below the first screen; the fan's top shows
above it).

**Landing scenes (Phase 3).** Scored scene by scene and as one page. The page clears the bar
(8.5, nothing under 7). Five scenes on their own sit just under 8 (Connect, what it won't do,
questions, the final call, the footer): they are the quiet ones, lists and type on hairlines
with no visual of their own, and score 7 on signature, media or motion for that reason. That is
the brief's "one moment per page, everything around it quiet", but a jury looking at any one of
them alone would call it plain. The first pass found five faults, all fixed and re-shot: the nav
was a grey pill over the paper scene; the final call had "Sign in" stranded under a left-aligned
credit; the model ledger's last rule stopped at 560 px; the Studio window had 200 px of dead
space; the pinned window hung in the top half of tall screens. The weakest three now: the final
call (the peak is small for a closing image), pricing's three open columns (a lot of empty
height beside the filled card at 1440) and motion everywhere (judged from frames and timings,
not watched at speed by a person).
