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

**Phase 4 is in progress (named by Manu on 2026-11-17, with no notes on Phases 0–3).** SPEC §4.2
and §5 are expanded to full values. Build in the order of the Phase 4 checklist below, one
screen at a time (shoot at 1440 and 390, score, fix, tick, commit), from the first unticked
line. The local environment is in `local-db.md`; work from the production build.

## Phases

| Phase                      | Covers                                                                                                                     | Status                         |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| 0. Read, capture, spec     | repo read, branch, `shoot.mjs`, `local-db.md`, before shots, SPEC.md, this file                                            | reviewed; answers not recorded |
| 1. Design system           | tokens, type, grain, frost, components, motion utilities, wordmark, favicon, utility migration, tests, `/prototype/system` | **done** (2026-11-13)          |
| 2. Landing hero            | nav, hero signature, reduced-motion still, phone composition, facts strip, frame cost, LCP                                 | built; Phase 3 named, no notes |
| 3. Landing, all scenes     | sections 2–13, GSAP sequence to CSS, Lenis decision                                                                        | **done** (2026-11-17)          |
| 4. Other marketing + entry | `/how-it-works`, `/pricing`, `/privacy`, `/terms`, OG, titles, `/sign-in`, `/welcome`, `/first-run`                        | **in progress** (2026-11-17)   |
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
- [ ] `/how-it-works`: head, index, four stages with their windows, the pack assembling,
      interview row, what it won't do, AI policies on paper, final call
- [ ] `/pricing`: the strike, plans, one kit opened, the ledger, elsewhere and here, payment,
      questions, final call; `SocialProofSlot` above the plans
- [ ] `/privacy` and `/terms` on paper: contents, hanging numbers, the voice path, the reading
      line
- [ ] OG images (five routes, one template) and titles
- [ ] The entry room (`auth-shell.tsx`, `entry.css`); `/sign-in` with the sheet, the line and
      "Check your email"; `/goodbye` and not-found
- [ ] `/welcome`
- [ ] `/first-run` (all five steps)
- [ ] Old helpers deleted (`school-packs`, `tick`, `display-heading`, `notes`, `screens*`,
      `_unlock*`, `_assembly-island`, `voice-path-play`)
- [ ] Shot, scored, fixed, re-shot; measured (bundle, fonts, overflow, console, axe)
- [ ] Gates: typecheck, lint, build, `bundle:check`; existing unit tests
- [ ] SPEC updated where the build differs; REPORT.md; committed

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

6. **The hero's entrance and LCP** (SPEC §3.7; measured again on 2026-11-17). On Lighthouse's
   slow phone the page first paints at about 2.4 s, and LCP is reported at **3.4 s**, over the
   2.5 s target. The cause is the hero's own entrance, not the scenes below it: the largest text
   above the fold is the subline, which fades in about a second after first paint, and that is
   the moment Chrome reports (three runs, the same each time). Two ways to settle it:
   - **A. Keep the entrance as built.** LCP stays about one second behind first paint.
   - **B. Let the subline be there at first paint (my recommendation).** The headline still
     rises word by word; the eyebrow, buttons and nav still enter. LCP should then equal first
     paint (about 2.4 s on the slow phone); not yet tried. One class on one element in
     `_hero/hero.tsx`.
7. **First paint on the slow phone is 2.4 s, close to the target on its own.** It is bound by
   the network (the document, 33 KB of CSS and 86 KB of preloaded fonts share a 1.6 Mbit line),
   not by the page's size: the document fell from 354 KB to 246 KB (47 KB gz) in Phase 3 and
   first paint did not move. Dropping the Source Serif preload on `/` (19.7 KB) would buy a
   little, at the cost of the sheets' text swapping faces in view on first load. Not done.

Also for you, not design: `LEGAL_ENTITY` in `_copy/chrome.ts` is still `TODO(Manu)` and shows in
the footer's copyright line.

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
  now a synthesised Geist oblique (`/sign-in`'s right panel is the clearest case). The WebGL orb
  left the landing page in Phases 2 and 3; it still draws on `/how-it-works`, in the Studio,
  first-run and the Dossier voice tab. Each goes in its own phase (SPEC §2.12).
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

## Scores

| Screen              | Glance | Signature | Type | Composition | Colour | Media | Motion | Mobile | Copy | Polish | Average |
| ------------------- | ------ | --------- | ---- | ----------- | ------ | ----- | ------ | ------ | ---- | ------ | ------- |
| `/prototype/system` | 8      | 8         | 9    | 8           | 8      | 8     | 8      | 7      | 8    | 8      | **8.0** |
| `/` hero and nav    | 9      | 9         | 9    | 8           | 9      | 9     | 8      | 8      | 8    | 8      | **8.5** |
| `/` whole page      | 9      | 9         | 9    | 8           | 9      | 8     | 8      | 8      | 9    | 8      | **8.5** |
| 2 schools strip     | 8      | 7         | 9    | 8           | 8      | 8     | 7      | 8      | 8    | 9      | **8.0** |
| 3 how it works      | 9      | 9         | 9    | 8           | 9      | 9     | 8      | 8      | 9    | 8      | **8.6** |
| 4 school by school  | 9      | 8         | 9    | 8           | 9      | 8     | 7      | 8      | 9    | 8      | **8.3** |
| 5 essays, on paper  | 9      | 9         | 9    | 8           | 9      | 9     | 8      | 8      | 9    | 8      | **8.6** |
| 6 the model         | 8      | 8         | 9    | 8           | 8      | 8     | 8      | 8      | 8    | 8      | **8.1** |
| 7 Connect           | 8      | 7         | 9    | 8           | 8      | 8     | 7      | 8      | 8    | 8      | **7.9** |
| 8 what it won't do  | 8      | 7         | 9    | 8           | 8      | 7     | 7      | 8      | 9    | 8      | **7.9** |
| 9 interview, soon   | 8      | 8         | 8    | 8           | 9      | 8     | 8      | 8      | 9    | 8      | **8.2** |
| 10 pricing          | 8      | 8         | 8    | 8           | 9      | 7     | 7      | 8      | 9    | 8      | **8.0** |
| 11 questions        | 8      | 7         | 9    | 8           | 8      | 7     | 7      | 8      | 8    | 8      | **7.8** |
| 12 final call       | 8      | 7         | 9    | 8           | 8      | 7     | 8      | 8      | 8    | 8      | **7.9** |
| 13 footer           | 8      | 7         | 8    | 8           | 8      | 7     | 7      | 8      | 8    | 8      | **7.7** |

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
