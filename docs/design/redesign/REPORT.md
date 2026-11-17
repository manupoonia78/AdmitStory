# Redesign report: "The Literary Instrument"

Evidence for each phase. Images are in `shots/before/` (taken in Phase 0) and `shots/after/` (as
each screen lands). Spec: `SPEC.md`. Running state: `PROGRESS.md`.

## Phase 0: read, capture, spec (2026-11-12)

No product code changed. The branch adds four documents, one script and the before screenshots.

### What was done

- Read the brief, the handoff, the design system in `packages/ui`, the marketing site and the app
  routes.
- Created `redesign/literary-instrument` off `phase-0`.
- Brought up a throwaway local Postgres (port 5455), migrated and seeded it with the six fictional
  fixture schools, and ran a production build of the app against it with every outside service
  blanked. The production database was never contacted by a script: each one ran with
  `DATABASE_URL` set to the local database in the shell, behind a guard that checks the host.
- Wrote `local-db.md` (the exact commands) and `shoot.mjs` (the capture script).
- Captured the before state and wrote `SPEC.md`.

### Before screenshots

`shots/before/`, JPEG. Per route: `<name>-1440.jpg`, `<name>-1440-full.jpg`, `<name>-390.jpg`,
`<name>-390-full.jpg`; Night versions of the signed-in routes end `-night`.

| Set                                                  | Routes                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Marketing                                            | `landing`, `how-it-works`, `pricing`, `privacy`, `terms`                                                                                                                                                                                                                                                                                                       |
| Entry                                                | `sign-in`, `sign-in-sent`, `welcome`, `first-run-1-applying`, `first-run-2-where`, `first-run-3-bring`, `first-run-4-time`                                                                                                                                                                                                                                     |
| App                                                  | `home`, `studio`, `dossier`, `profile-read`, `schools`, `school` (locked: lands on unlock), `school-unlocked`, `school-preview`, `school-unlock`, `school-recommenders`, `school-resume`, `kit`, `workspace`, `recommenders`, `recommender`, `resume`, `resume-review`, `connect`, `settings`, `settings-privacy`, `settings-security`, `interview`, `tracker` |
| Other                                                | `portal-resend`, `portal-closed`, `goodbye`, `not-found`                                                                                                                                                                                                                                                                                                       |
| Reference (out of scope, populated with sample data) | `ref-prototype-studio`, `ref-prototype-workspace`, `ref-prototype-kit`, `ref-prototype-duet`                                                                                                                                                                                                                                                                   |

Start with: `landing-1440.jpg` and `landing-390.jpg` (the glowing orb the new hero replaces),
`sign-in-1440.jpg`, `home-1440.jpg`, `school-unlock-1440.jpg`, `ref-prototype-workspace-1440.jpg`
(the populated editor) and `studio-1440-night.jpg`.

### What the before state shows

From `report.json` and `report-night.json`:

- **375 px overflow**: `/schools/[id]/unlock` scrolls sideways by 13 px. Every other in-scope
  route passes.
- **Console**: clean on every route except `/studio`, where `POST /api/studio/sessions` returns
  500 locally (no AI key, no replay for a first question), and the 404 page's own 404.
- **Hydration warnings**: none.
- **Redirects**: `/kits/[id]`, `/schools/[id]/recommenders` and `/schools/[id]/resume` redirect to
  the school workspace; a locked `/schools/[id]` redirects to `/unlock`.

### What could not be done

- **Populated Studio, editor, Dossier, Profile Read, résumé, Connect directory and recommender
  portal** can't be reached on a fresh local account without live AI or real data. Their before
  shots are the empty, idle or locked states. The four `ref-prototype-*` shots show the populated
  Studio, editor, kit assembly and interview room from the Phase 0.5 prototypes instead.
- `/r/[token]` with a live invitation was not captured (it needs a built brief and a sent
  invitation); `portal-resend` and `portal-closed` were.
- Full-page shots of `/` have blank bands where the pinned section holds the viewport: a capture
  artefact.
- No scores yet: nothing has been redesigned.

### Gates

No product code changed in this phase, so the state of the gates is the state of `phase-0`:

- `next build`: passed (run in this session against the local database).
- `bundle:check`: passed. `/` 153.1 KB of 155; `/sign-in` 158.0 of 160; `/studio` 156.9.
- `eslint` on `shoot.mjs`: passed.
- `typecheck` and the unit tests were not re-run (nothing they cover changed).
- `pnpm format:check` flags `docs/design/fable-redesign-prompt.md` (whitespace only). The brief
  was committed as written.

## Phase 1: design system (2026-11-12 and 13) · done

Built over two sessions. The first was cut off with all of its work uncommitted; the second
inspected that work, found it sound, kept it, fixed the tests it had left failing, and added the
system page.

### What changed

- **Fonts.** Newsreader, Hanken Grotesk and JetBrains Mono are gone. Geist, Geist Mono and
  Instrument Serif italic load on every route; Source Serif 4 loads on the reading routes.
  Preloaded type fell from 157.3 KB to **66.5 KB** (105.8 KB on reading routes).
- **Tokens** (`packages/ui/src/tokens.css`). The instrument (near-black `#0B0A09`, warm white in
  opacity steps, brass `#E2B36B`), paper (desk `#ECE9E2`, sheet `#F7F5F0`, ink, brass-ink
  `#85590F`) and night paper (`#1C1A17`). Status colours, with `--needs` now slate blue. The 12
  voice hues refit to one lightness and chroma. Radii, grain, eases and durations.
- **Utilities** (`render.css`). `card`, `sheet`, `frost` and `frost-flat`, `chip`, `btn-arrow`,
  `label`, `note`, `figure`, `serif-accent`, `enter`, `reveal`, `draw-line`. Every old utility
  name (`plane`, `eyebrow`, `meta`, `placeholder`, `lit`, `gloss`, `glass-control`, `chrome`,
  `grain`, `seal-turn`) still works and now draws the new material.
- **Components.** Buttons are pills with an optional arrow circle; the magnetic pull and the edge
  light are removed. Text fields, tabs with a sliding rule, the segmented control with a sliding
  pill, dialog and side sheet on the card radius.
- **Motion.** `EASES`, `DURATIONS` and `ease()` beside the springs; a 0.2 KB head script sets
  `data-motion` so no element is ever server-rendered hidden; one shared `RevealObserver`.
- **Brand.** The mark (a flat line that rises once), the wordmark, the favicon and the model
  seal as a dial. The seal's words still come only from `lib/model-claims.ts`.
- **`/prototype/system`**: every token and component on the instrument, paper and night paper.

Existing screens were not redesigned. They pick up the new tokens and utilities and keep their
old composition until their own phase.

### Screenshots

In `shots/after/`. Only the images below were kept: the other existing routes were re-shot to
check that they render (results in `after/report.json` and `after/report-night.json`) and their
images discarded, since each will be shot again when its own phase redesigns it.

- `prototype-system-1440-night.jpg` and `prototype-system-1440-full-night.jpg`: the system page
  as the instrument.
- `prototype-system-1440-full.jpg`: the same page in Day.
- `prototype-system-390-night.jpg` and `prototype-system-390-full-night.jpg`: the phone.
- `landing-1440.jpg`, `landing-390.jpg`, `sign-in-1440.jpg`, `home-1440.jpg`,
  `school-unlock-1440.jpg`, `home-1440-night.jpg`: existing screens on the new system, before
  their own redesign. Compare with the same names in `shots/before/`.

### Score: `/prototype/system`

| Glance | Signature | Type | Composition | Colour | Media | Motion | Mobile | Copy | Polish | Average |
| ------ | --------- | ---- | ----------- | ------ | ----- | ------ | ------ | ---- | ------ | ------- |
| 8      | 8         | 9    | 8           | 8      | 8     | 8      | 7      | 8    | 8      | **8.0** |

The first pass scored 7.4. Five faults were fixed and re-shot: transcript lines running under the
frost demo's caption, a clipped fourth tab, a two-thirds-empty Night-paper column, a section
heading that broke into three lines, and a cramped radius grid at 390. Mobile is the weakest
score: a correct single column, not a recomposition.

### What was checked, and how

| Check                                 | Result                                                                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `pnpm typecheck`                      | passed                                                                                                             |
| `pnpm lint`                           | passed                                                                                                             |
| `next build` (local environment)      | passed                                                                                                             |
| `bundle:check`                        | passed: `/` 153.3 of 155 KB, `/sign-in` 158.0 of 160, `/studio` 157.4, `/prototype/system` 155.2                   |
| Unit tests                            | 2,516 of 2,517 pass. The one failure is `packages/db/test/schema.test.ts`, in a package this branch does not touch |
| Contrast (`contrast.test.ts`)         | every text pair ≥ 4.5:1 and every control edge ≥ 3:1 on desk, card and sheet, in both themes, for all 12 hues      |
| axe, WCAG 2.2 AA, `/prototype/system` | 0 violations in Night and in Day                                                                                   |
| 375 px overflow                       | `/prototype/system` 0. Existing routes: nothing new (`/schools/[id]/unlock` 7 px, was 13; Phase 6)                 |
| Console, failed requests, hydration   | `/prototype/system` clean. Existing routes unchanged from before (`/studio` 500 without AI; the 404's own 404)     |
| Reduced motion                        | `/prototype/system` renders complete and still; `data-motion` is not set                                           |
| JavaScript off                        | `/prototype/system` renders complete (H1 opacity 1); nothing is hidden without the script that would reveal it     |
| Existing routes still render          | 38 routes re-shot in Day and the signed-in routes in Night; none skipped                                           |

### What could not be done, and what is left as it was

- **Manu's answers to the five Phase 0 questions were never written down** (the session he gave
  them in, if he did, was cut off). Phase 1 follows the spec's defaults. See PROGRESS.md.
- **One unit test fails and was left alone**: `packages/db/test/schema.test.ts` expects
  `entitlements.purchase_id` to be unique. The schema is untouched on this branch and out of
  scope for a presentation-layer job.
- **`next dev` could not be used**: under Playwright it reloads every page in a loop. Not
  diagnosed; all checks ran on the production build.
- **Interim look**: where an old screen used Newsreader italic outside a display line, the text
  is now a synthesised Geist oblique, and the WebGL orb still draws in the hero. Both go in the
  phases that redesign those screens.
- `pnpm format:check` still flags the brief, the two Phase 0 report files and one untouched
  component. Not one of the four gates.
- Four changed files in the working tree belong to other work (Studio slots v1.1) and were not
  committed with the redesign.

---

## Phase 2: landing hero (2026-11-14) · built; Phase 3 named with no notes

The marketing nav and the landing hero are rebuilt on the Phase 1 system. Everything below the
hero on `/` is still the old page (Phase 3).

### What changed

- **The hero** (`_hero/hero.tsx`, server markup). Left: the eyebrow, "Tell it once. / Tell it
  _well._", the subline, "Start your story" and "See how it works", and the model credit. Right:
  the stage. One line, the horizon, crosses the hero: flat under the headline, a voice in brass
  across the stage. A fictional applicant's sentence rests on it in italic serif, and above it
  three essay sheets are fanned like a hand of cards. Each sheet's margin carries its title, a
  note in mono on why the draft is built that way, and its word count; the top sheet shows the
  essay's opening with the applicant's own sentence marked as theirs. Under the line: three facts
  about how it works, the "fictional" label and a pause control.
- **The loop** (`_hero/hero-loop.ts`, 3.1 KB, lazy). After the page has loaded and gone idle, the
  sheets leave, three hairline pages wait, the next applicant speaks word by word while the line
  moves with the voice, the line settles, three sheets rise into place, the spoken sentence is
  underlined on the top sheet, and the notes appear. Three applicants, about eleven seconds
  each. It stops completely when the hero is off screen, the tab is hidden or pause is pressed.
- **The still.** What the server sends is the finished picture. Under reduced motion, with
  Save-Data, or with JavaScript off, that picture is the hero: no loop is downloaded and there is
  no pause button.
- **Phones.** The headline, both actions and the credit fill the first screen with the top of
  the fan showing; the sheets, the sentence and the line follow, then the strip. The stage is a
  CSS container, so the fan scales as one piece from 320 px to a 546 px column.
- **The nav.** One frosted pill on the page grid's margins, always dark so it also reads over
  paper scenes. "Start your story" replaces "Start free" there. Below 1024 px: the small button
  and a round menu button. The phone menu is restyled to match.
- **Copy.** New hero copy and three samples in `_copy/hero.ts`. The three applicants are the
  ones already on the page (night-shift analyst, fintech product manager, family packaging
  business), each quoted in a sentence they already had. All fictional, as is Northfield, and
  labelled so in the strip.
- **Removed.** The WebGL Voiceprint and its lamp-light gradients from the hero, the "See it
  happen" player and its reducer, the retired mic demo's token code, `nav-compact.tsx`.
- SPEC §3 is rewritten to the values as built.

### Screenshots (`shots/after/`; before: `shots/before/landing-*.jpg`)

| File                                                        | What it shows                                               |
| ----------------------------------------------------------- | ----------------------------------------------------------- |
| `landing-1440.jpg`, `landing-390.jpg`                       | first screen, laptop and phone                              |
| `landing-1440-rm.jpg`, `landing-390-rm.jpg`                 | the same under reduced motion: the still, no pause button   |
| `landing-hero-390-whole.jpg`                                | the whole hero on a phone (1,414 px)                        |
| `landing-hero-768-whole.jpg`, `landing-hero-1280-whole.jpg` | tablet, and a 1280 × 720 laptop                             |
| `landing-hero-1440-loop-1-speaking.jpg`                     | the loop: the second applicant mid-sentence, pages waiting  |
| `landing-hero-1440-loop-2-rising.jpg`                       | the sheets rising                                           |
| `landing-hero-1440-loop-3-held.jpg`                         | the second applicant's essays, sentence marked, notes shown |
| `landing-hero-390-loop-speaking.jpg`                        | the loop on a phone                                         |
| `landing-menu-390.jpg`                                      | the phone menu                                              |

`report-p2-landing.json` and `report-p2-landing-rm.json` are the capture script's reports for
these runs (no overflow at 375 px, no console errors, no failed requests, no hydration
warnings). Full-page shots were not kept: below the hero the page is unchanged.

### Score: `/` hero and nav

| Glance | Signature | Type | Composition | Colour | Media | Motion | Mobile | Copy | Polish | Average |
| ------ | --------- | ---- | ----------- | ------ | ----- | ------ | ------ | ---- | ------ | ------- |
| 9      | 9         | 9    | 8           | 9      | 9     | 8      | 8      | 8    | 8      | **8.5** |

The first pass scored about 7.0. Three rounds of fixes, each re-shot: (1) the sentence's words
ran together and the phone's top sheet clipped its word count; (2) the fan showed cut-off
slivers of the two lower essays, so the margins were widened until it shows three notes and one
essay; (3) the stage sat empty while an applicant spoke, so hairline pages now wait there, and
the counts moved into the margins. The three lowest scores now: composition (a lot of air
between headline and stage from 1440 up), motion (checked from timed frames, not yet watched at
speed by a person) and mobile (the sentence and line are just below the first screen).

### What was checked, and how

| Check                                    | Result                                                                                                                                                                                          |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`                         | passed                                                                                                                                                                                          |
| `pnpm lint`                              | passed                                                                                                                                                                                          |
| `next build` (local environment)         | passed                                                                                                                                                                                          |
| `bundle:check`                           | passed: `/` 151.9 of 155 KB (was 153.3); other marketing routes 144.4–150.8; `/sign-in` 157.9 of 160                                                                                            |
| The loop's chunk                         | 3.1 KB gz (budget 7), loaded after `load` and idle; contains no Motion, GSAP or OGL                                                                                                             |
| Per-frame cost, phone at 4× CPU throttle | 0.07 ms in the frame callback (worst 1.7), 1.9 ms of main-thread time a frame over a full pass (budget 1.5 and 4)                                                                               |
| Frames while stopped                     | 0 while paused, 0 off screen, 0 with the tab hidden. On laptops the old "follow" section's GSAP ticker keeps its own frames running until Phase 3 removes it                                    |
| CLS over a full pass                     | 0 on the phone, 0.0001 on desktop                                                                                                                                                               |
| LCP, observed                            | equal to first contentful paint with and without the entrance (0.1–0.25 s locally)                                                                                                              |
| Lighthouse, mobile, simulated (3 runs)   | performance 0.95, accessibility 0.97, best practices 1.00, SEO 1.00; FCP 1.66 s, **LCP 2.87 s**, TBT 16 ms, CLS 0                                                                               |
| Lighthouse, mobile, throttling applied   | FCP 2.28 s, **LCP 2.28 s**, TBT 40 ms, CLS 0                                                                                                                                                    |
| Fonts preloaded on `/`                   | 86 KB (cap 110)                                                                                                                                                                                 |
| axe, WCAG 2.2 AA, hero and nav           | 0 violations with motion and under reduced motion                                                                                                                                               |
| Reduced motion                           | the still; the loop's chunk is not requested; the pause button stays hidden                                                                                                                     |
| JavaScript off                           | the complete hero renders (headline at full opacity, stage, line, strip)                                                                                                                        |
| 375 px overflow, console, requests       | none on `/`                                                                                                                                                                                     |
| Unit tests                               | 2,515 of 2,517 pass. Neither failure is the redesign's: the `db` schema test (as before) and `api/stt/token/route.test.ts`, which follows someone else's uncommitted change to `packages/voice` |

### What could not be done, and what to know

- **The H1 is not the element Chrome reports as LCP.** It is split into one block a word so each
  can rise, and Chrome scores each block separately. What it reports is static server text
  painted in the first frame, so LCP equals first paint and the entrance costs nothing. SPEC
  §3.7 has the detail; PROGRESS "Needs Manu" 6 asks whether to keep the per-word rise.
- **Lighthouse's default, simulated LCP is 2.87 s, over the 2.5 s target.** With the throttling
  really applied it is 2.28 s. First paint is dominated by the 354 KB document, almost all of it
  the old sections below the hero. Re-measured in Phases 3 and 8.
- **"Write your own line" is off the page until Phase 3**, where it returns in the paper scene.
  Its copy (`_copy/write-line.ts`) and clean-up code (`_hero/line-cleanup.ts`) are kept.
- **"See how it works" jumps to the old `#follow` section** until Phase 3 builds scene 3.
- **Motion was verified from timed frames and measurements, not watched live.** Worth a look at
  speed in a real browser during review.
- Lighthouse's one accessibility failure and a 16 px overflow at 320 px both come from old
  sections below the hero, replaced in Phase 3.
- Other people's uncommitted work was in the tree during this session (about twenty files in
  Studio, `packages/ai`, `packages/slots`, `packages/voice`). None of it is in this commit.

## Phase 3: landing, all scenes (2026-11-16 and 17) · done

Built across two sessions. The first built scenes 2 to 13 and was cut off before anything was
shot or committed. The second inspected that work, kept all of it, shot every scene, fixed five
things the screenshots showed, measured, and committed. The landing page is now one dark page
from the hero to the footer, with one paper scene in the middle.

### What changed

- **One dark field.** Marketing is dark-only. The grain is painted once on the wrapper; the
  footer's theme switch and `marketing-theme.ts` are gone. One `RevealObserver` arms the scroll
  reveals for whichever marketing page is open.
- **GSAP and Lenis are removed** from `package.json` and the lockfile, with `_follow/*`,
  `_motion/*` and `_lib/gates.ts`. Nothing below the hero runs a frame loop.
- **Scene 2, schools strip.** The sixteen names as type between two hairlines; two justified
  rows from 1280 px, a wrapping run below. No scroller, no script.
- **Scene 3, how it works.** Tell, Position, Draft, Refine. Four product windows drawn in
  markup from the design system (Story Studio, a positioning, a draft on paper, a revision as a
  diff), with the analyst's 2 a.m. sentence passing through all four. On laptops the window is
  pinned with CSS `sticky` and swaps as each step crosses a line in the viewport: stepped,
  never scrubbed. Without JavaScript each step sits beside its own window. This replaces the old
  three-step section, "follow one sentence" and the screens stepper.
- **Scene 4, school by school.** A new fictional applicant (a site engineer on a metro line)
  says three sentences once; Wharton, Tuck and HEC Paris each get a draft opening built around a
  different one, because each asks a different question. Names are type; no logos.
- **Scene 5, essays that show their thinking.** The page turns to paper: one large sheet with
  its reasoning in the margin, a switch (and the `Y` key) that marks which sentences are the
  applicant's own, and "Write your own line", back on the page and still client-only.
- **Scene 6, the model.** The dial seal beside the ledger, typeset as a table whose rules draw
  in. Every word and figure comes from `lib/model-claims.ts`.
- **Scene 7, Connect.** Six illustrative portraits in a still grid, roles only, labelled.
  `SocialProofSlot` follows it and renders nothing until it is given real content.
- **Scene 8, what it won't do.** Five numbered lines on hairlines. The AI-policy table moved
  off this page; a link goes to it.
- **Scene 9, interview practice.** "Coming soon", the promise verbatim, and one still of the
  room labelled "Preview · not available yet".
- **Scene 10, pricing.** Free, 1, 5 and 10 schools from `_data/pricing.ts`; the 5-school pack
  is the one filled card with "Most chosen" and the only brass button; "All sales are final"
  sits in the terms line.
- **Scenes 11 to 13.** Questions as native `<details>`; the final call (one sentence, one
  button, the horizon line with its peak, the model credit); the footer.
- **Deleted:** `app-preview`, `real-screens`, `screens-stepper`, `your-words*`,
  `how-it-works-lines`, `final-voiceprint*`, `_ui/frames`, `_ui/hairline`.
- SPEC §4 is written to the values as built.

### Screenshots (`shots/after/`; before: `shots/before/landing-*.jpg`)

| File                                                           | What it shows                                             |
| -------------------------------------------------------------- | --------------------------------------------------------- |
| `landing-1440-full.jpg`, `landing-390-full.jpg`                | the whole page, laptop and phone (see the note below)     |
| `landing-scene-02-schools-strip-1440.jpg`                      | scene 2                                                   |
| `landing-scene-03-how-head-1440.jpg`, `…-how-step1…4-1440.jpg` | scene 3: the head, then the pinned window at each step    |
| `landing-scene-03-how-nojs-1440.jpg`, `…-how-1024.jpg`         | scene 3 without JavaScript, and at 1024 px                |
| `landing-scene-04-school-by-school-1440.jpg`, `…-sheets-1440`  | scene 4: the head and spoken lines, then the three drafts |
| `landing-scene-05-essays-1440.jpg`                             | scene 5 as the server renders it                          |
| `landing-scene-05-essays-words-on-1440.jpg`, `…-line-placed-…` | the switch on; a visitor's own line placed in the essay   |
| `landing-scene-06-model-1440.jpg`, `…-07-connect-1440.jpg`     | scenes 6 and 7                                            |
| `landing-scene-08-wont-do-1440.jpg`, `…-09-interview-1440.jpg` | scenes 8 and 9                                            |
| `landing-scene-10-pricing-1440.jpg`, `…-lists-1440`, `…-768`   | scene 10: the plans, the lists and terms, and at 768 px   |
| `landing-scene-11-questions-1440.jpg`, `…-questions-open-1440` | scene 11, closed and with one answer open                 |
| `landing-scene-12-final-call-1440.jpg`, `…-13-footer-1440.jpg` | scenes 12 and 13                                          |
| `landing-scenes-390-sheet-1.jpg` to `-4.jpg`                   | sixteen phone frames, four to a sheet, in page order      |
| `landing-1440.jpg`, `landing-390.jpg`, and the two `-rm` files | the first screen again, with and without reduced motion   |

`report-p3-public.json` and `report-p3-landing-rm.json` are the capture script's reports: no
overflow at 375 px, no console errors, failed requests or hydration warnings on `/`,
`/how-it-works`, `/pricing`, `/privacy`, `/terms` or `/sign-in`.

The two full-page images repeat the fixed nav and catch the pinned stepper mid-scroll, so judge
the scenes from the scene files.

### Scores

| Scene              | Glance | Signature | Type | Composition | Colour | Media | Motion | Mobile | Copy | Polish | Average |
| ------------------ | ------ | --------- | ---- | ----------- | ------ | ----- | ------ | ------ | ---- | ------ | ------- |
| `/` whole page     | 9      | 9         | 9    | 8           | 9      | 8     | 8      | 8      | 9    | 8      | **8.5** |
| 2 schools strip    | 8      | 7         | 9    | 8           | 8      | 8     | 7      | 8      | 8    | 9      | **8.0** |
| 3 how it works     | 9      | 9         | 9    | 8           | 9      | 9     | 8      | 8      | 9    | 8      | **8.6** |
| 4 school by school | 9      | 8         | 9    | 8           | 9      | 8     | 7      | 8      | 9    | 8      | **8.3** |
| 5 essays, on paper | 9      | 9         | 9    | 8           | 9      | 9     | 8      | 8      | 9    | 8      | **8.6** |
| 6 the model        | 8      | 8         | 9    | 8           | 8      | 8     | 8      | 8      | 8    | 8      | **8.1** |
| 7 Connect          | 8      | 7         | 9    | 8           | 8      | 8     | 7      | 8      | 8    | 8      | **7.9** |
| 8 what it won't do | 8      | 7         | 9    | 8           | 8      | 7     | 7      | 8      | 9    | 8      | **7.9** |
| 9 interview, soon  | 8      | 8         | 8    | 8           | 9      | 8     | 8      | 8      | 9    | 8      | **8.2** |
| 10 pricing         | 8      | 8         | 8    | 8           | 9      | 7     | 7      | 8      | 9    | 8      | **8.0** |
| 11 questions       | 8      | 7         | 9    | 8           | 8      | 7     | 7      | 8      | 8    | 8      | **7.8** |
| 12 final call      | 8      | 7         | 9    | 8           | 8      | 7     | 8      | 8      | 8    | 8      | **7.9** |
| 13 footer          | 8      | 7         | 8    | 8           | 8      | 7     | 7      | 8      | 8    | 8      | **7.7** |

The page as one screen clears the bar (8.5, nothing under 7). Five scenes taken alone sit just
under 8: Connect, what it won't do, questions, the final call and the footer. They are the quiet
ones, type on hairlines with no visual of their own, which is what the brief asks of everything
around the one moment; but a jury shown any one of them alone would call it plain.

The first pass found five faults, all fixed and re-shot:

1. over the paper scene the nav was a mid-grey pill (its wash is now 88 % of `--bg`, not 72 %);
2. the final call had "Sign in" stranded under a left-aligned credit (now one action, the
   credit centred under the line);
3. the model ledger's last rule stopped at 560 px (it runs the full column);
4. the Studio window had 200 px of dead space (the question sits midway down);
5. the pinned window hung in the top half of tall screens (it is centred in the viewport).

The three weakest now: the final call (the peak is small for a closing image), pricing's three
open columns (a lot of empty height beside the filled card at 1440) and motion everywhere
(judged from frames and timings, not watched at speed by a person).

### What was checked, and how

| Check                                        | Result                                                                                                                            |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`, `pnpm lint`                | passed                                                                                                                            |
| `next build` (local environment)             | passed on the second run; the first stopped on a Next.js security notice (see below)                                              |
| `bundle:check`                               | passed: `/` 147.7 of 155 KB (was 151.9); other marketing routes 142.8–149.2; `/sign-in` 158.0 of 160                              |
| The page's own script                        | 5.1 KB gz (the paper scene's toy and the stepper)                                                                                 |
| Document                                     | 245.9 KB, 47.0 KB gz (was 354 KB); 1,050 elements                                                                                 |
| Fonts preloaded on `/`                       | 86.1 KB in 4 files (cap 110); unchanged                                                                                           |
| CLS over a full pass                         | 0 on the phone, 0.0001 on desktop                                                                                                 |
| Frames with the hero off screen              | 0 `requestAnimationFrame` calls in 3 s (the GSAP ticker is gone)                                                                  |
| axe, WCAG 2.2 AA, whole page                 | 0 violations: desktop, reduced motion, phone, and with the switch on, a line placed and a question open                           |
| Lighthouse, mobile, simulated (2 sets of 3)  | performance 0.83 and 0.92, accessibility 1.00, best practices 1.00, SEO 1.00; FCP 1.51 s, **LCP 3.3 s**, TBT 383 and 44 ms, CLS 0 |
| Lighthouse, mobile, throttling applied       | performance 0.86; FCP 2.44 s, **LCP 3.42 s**, TBT 92 ms, CLS 0                                                                    |
| Overflow                                     | none at 320, 375, 390, 768, 1024, 1280, 1440, 1920                                                                                |
| Reduced motion                               | every block visible with no scroll; the stepper swaps with a 120 ms fade                                                          |
| JavaScript off                               | the whole page renders: nothing hidden, each step beside its own window, the paper scene with the switch off                      |
| Console, failed requests, hydration warnings | none on `/` or the other public pages (the 404 page logs its own 404, as before)                                                  |
| Unit tests                                   | 2,515 of 2,517 pass, as after Phase 2. Neither failure is the redesign's: the `db` schema test and `api/stt/token/route.test.ts`  |

### What could not be done, and what to know

- **LCP on a slow phone is 3.4 s, over the 2.5 s target, and it is the hero's entrance that
  sets it.** First paint is at 2.4 s; the subline, the largest text above the fold, fades in
  about a second later, and that is the moment Chrome reports. Phase 2 measured the two as the
  same moment; measured again with every candidate logged, they are not. The scenes below the
  hero are not involved, and shrinking the document by a third did not move first paint. The
  hero was left as built because it was reviewed that way. PROGRESS "Needs Manu" 6 gives the two
  options; the one recommended is to let the subline be there at first paint and keep the
  headline's rise.
- **Lighthouse's performance score moved between 0.83 and 0.92** across two sets of runs on the
  same build, almost all of it TBT (44 to 383 ms). Accessibility went from 0.97 to 1.00.
- **`next build` stopped once** with "Your version of Next.js is affected by a known security
  vulnerability" and instructions to run an upgrade command. The build was run again and
  passed; nothing was upgraded, since dependencies are outside this job. Worth Manu's look.
- **`main` already carries Phases 0 to 2.** `main` and `origin/main` are at the merge commit
  `f710165`, and Phase 3 had been built with `main` checked out. Its work was moved to
  `redesign/literary-instrument` uncommitted and committed there; nothing was pushed.
- **`/how-it-works`, `/pricing`, `/privacy` and `/terms` are now dark with their old layouts**
  until Phase 4. They render cleanly. `/how-it-works` still draws the old Voiceprint orb.
- **Motion was verified from timed frames and measurements, not watched live.**
- "12 schools, read closely" still stands in the model ledger beside a strip that names 16
  (PROGRESS "Needs Manu" 5). Only Manu changes claims.

## Phase 4: other marketing pages and entry (2026-11-17) · done

Built in one session. Phase 4 was named with no notes on Phases 0–3, and with one request: use
Emil Kowalski's skills (github.com/emilkowalski/skills) throughout the project. Seven of them
(the web ones) are now in `.claude/skills/`, their rules are SPEC §2.10's, and every screen below
was built to them: non-uniform staggers, exits faster than entrances, UI motion under 300 ms,
hover motion gated to real pointers, transitions (not keyframes) for anything that can be
toggled, and the phone layer (no tap flash, instant taps, controls that don't select on a long
press).

### What changed

- **`/how-it-works`** is the landing page's four steps told in full: a head, an index of the four
  stages, then a band for each stage with its two detailed steps (all eight old steps are kept)
  beside the same product window the landing page uses. Inside the Draft stage, the page's moment:
  **the pack assembles**, a thread drawing from each of the sample applicant's stories to each
  file it feeds, the file names coming up to full strength as their threads arrive, one story
  "held back". Then interview practice (coming soon), what it won't do, each school's AI policy
  typeset on a sheet of paper, and the final call. The old WebGL orb and the kit-assembly island
  are gone.
- **`/pricing`** opens on "5 schools. ~~$500~~ $349.": a line draws through the list price as the
  page settles and the price rises beside it. Then the landing page's four plans,
  `SocialProofSlot` (renders nothing), one kit opened as four sheets of paper with their margin
  notes and the applicant's own sentences marked, what's free and what a kit adds as one list,
  elsewhere and here, payment (with "All sales are final"), the pricing questions and the final
  call. Every number comes from `plans.ts`.
- **`/privacy` and `/terms`** are paper: one sheet from the top of the window to a rounded foot,
  a sticky contents list on a rule, each section's number hanging in the margin, the plain summary
  in the reading serif's italic and the full text at 68ch. `/privacy`'s moment is **where your
  voice goes**, one line doing the Voiceline's three jobs: a waveform from the microphone to
  speech-to-text, a flat rule on to your drafts, and a branch that dies away into a full stop,
  "discarded · never stored". `/terms`' moment is a **reading line**: brass grows down the
  contents rule as you read, on a scroll-driven timeline, with no script.
- **OG images**: one template for five routes (the wordmark, the page's headline with its italic
  line, the horizon with one brass peak). The home title is "AdmitStories: tell it once, tell it
  well".
- **The entry room** (`components/auth-shell.tsx`, `entry.css`) is the one shell for sign-in,
  welcome, first-run, goodbye and not-found: always Night, the wordmark, one thing to do, the
  horizon across the foot. On **`/sign-in`** the line brightens in brass while the email field
  has focus and rises into a peak on "Check your email"; a sheet of paper from the landing page's
  last sample stands on the horizon. **`/welcome`** is two columns; each box fills and draws its
  tick, and the button wakes from frost to brass when both are ticked. **`/first-run`**'s
  progress is the line with the mark's peak standing on the current step, travelling on Next and
  Back; the Voiceprint orb is gone. All of it is CSS on `:has()`: no route gained a script.
- **Deleted:** `_sections/school-packs`, `_ui/display-heading`, `_ui/notes`, `_ui/tick`,
  `_ui/sample-hue`, `_data/screens*`, `pricing/_unlock*`, `how-it-works/_assembly*` and
  `_data.ts`, `_legal/voice-path-play`, and the never-built `capture:screens` stub.

### Screenshots (`shots/after/`; before: `shots/before/`)

| File                                                                           | What it shows                                                        |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `how-it-works-1440.jpg`, `-1440-full`, `-390`, `-390-full`                     | the page, laptop and phone                                           |
| `how-it-works-pack-1440.jpg`, `…-pack-drawing-1440`, `…-pack-1440-rm`          | the pack drawn; mid-draw (threads arriving in turn); reduced motion  |
| `how-it-works-pack-390.jpg`, `how-it-works-policies-1440.jpg`                  | the pack as rows on a phone; the AI-policy sheet (local sample rows) |
| `pricing-1440.jpg`, `-full`, `-390`, `pricing-kit-1440`, `pricing-ledger-1440` | the head with the strike, the kit sheets, the ledger                 |
| `privacy-1440.jpg`, `privacy-voice-path-1440`, `privacy-voice-path-390`        | the paper page and its voice path                                    |
| `terms-1440.jpg`, `terms-reading-line-1440`, `terms-390`                       | `/terms`, with the reading line part way down                        |
| `og-home.png`, `og-pricing.png`, `og-privacy.png`                              | three of the five OG images                                          |
| `sign-in-1440.jpg`, `entry-signin-focus-*`, `entry-signin-sent-*`              | sign-in at rest, with the field focused, and "Check your email"      |
| `entry-welcome-*`                                                              | welcome, with one and with both boxes ticked                         |
| `entry-firstrun-*`                                                             | first-run steps 1 (a chip chosen), 2 and 5                           |
| `not-found-1440.jpg`, `not-found-390.jpg`, `goodbye-*`                         | the line with a gap                                                  |

`report-p4-public.json` is the capture script's report for the public Phase 4 routes.

### Scores

| Screen               | Glance | Signature | Type | Composition | Colour | Media | Motion | Mobile | Copy | Polish | Average |
| -------------------- | ------ | --------- | ---- | ----------- | ------ | ----- | ------ | ------ | ---- | ------ | ------- |
| `/how-it-works`      | 8      | 8         | 9    | 8           | 9      | 9     | 8      | 8      | 9    | 8      | **8.4** |
| `/pricing`           | 9      | 8         | 9    | 8           | 9      | 8     | 8      | 8      | 9    | 8      | **8.4** |
| `/privacy`, `/terms` | 9      | 8         | 9    | 9           | 9      | 8     | 8      | 8      | 8    | 9      | **8.5** |
| OG images            | 9      | 8         | 9    | 8           | 9      | 8     | n/a    | n/a    | 9    | 9      | **8.6** |
| `/sign-in`           | 9      | 8         | 9    | 8           | 9      | 8     | 8      | 8      | 8    | 8      | **8.3** |
| `/welcome`           | 8      | 7         | 9    | 8           | 9      | 7     | 8      | 8      | 8    | 8      | **8.0** |
| `/first-run`         | 8      | 8         | 9    | 8           | 9      | 7     | 8      | 8      | 8    | 8      | **8.1** |
| not-found, goodbye   | 8      | 7         | 9    | 8           | 8      | 7     | 7      | 8      | 8    | 8      | **7.8** |

Every page clears the bar except the two smallest screens, not-found and goodbye (7.8): one line
of text and a line with a gap, quiet on purpose. The faults the first screenshots showed, all
fixed and re-shot:

1. the pack's threads broke into dashes while drawing (a dash on a stretched, non-scaling
   stroke); they now draw with `clip-path`, checked mid-draw;
2. the kit sheets' text column was too narrow on a phone (one step smaller there);
3. the AI-policy rows on a phone put the date and the link on separate lines (one line now);
4. the sign-in sheet's caption sat on the horizon line and its margin note wrapped a word to a
   line (caption above, margin 96 → 116 px);
5. welcome's heading broke into three lines (one more grid column);
6. with no footnote, the horizon sat on the window's edge on not-found and goodbye (it keeps
   72 px under it);
7. straight apostrophes in new copy (typographic now).

The three weakest now: welcome's signature (the tick and the waking button are small for a
first impression), not-found and goodbye (plain by design), and motion everywhere, judged from
timed frames and mid-animation captures rather than watched at speed by a person.

### What was checked, and how

| Check                                        | Result                                                                                                                                               |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`, `pnpm lint`                | passed                                                                                                                                               |
| `next build` (local environment)             | passed; it stops once on a Next.js security notice and continues on the second run, as in Phase 3                                                    |
| `bundle:check`                               | passed. `/how-it-works` 142.8 of 155 (was 149.2), `/pricing` 143.2, legal 142.8, `/sign-in` 157.6 of 160 (was 158.0), `/first-run` 148.4 (was 154.6) |
| axe, WCAG 2.2 AA                             | 0 violations on every Phase 4 route at 1440 and 390; `/welcome` and `/first-run` at 1440                                                             |
| Overflow at 375 px                           | none on any Phase 4 route                                                                                                                            |
| Console, failed requests, hydration warnings | none (the 404 page logs its own 404, as before)                                                                                                      |
| Reduced motion                               | the pack and the voice path render drawn and still; the strike is drawn; the reading line is absent                                                  |
| Sign-in flow                                 | a fresh account signed in through the local magic link, reached welcome, ticked both boxes, went through first-run                                   |
| Unit tests                                   | 2,515 of 2,517 pass; the two failures are the same as before and not the redesign's                                                                  |

### What could not be done, and what to know

- **The AI-policy table was checked with four sample rows written to the local database only**
  (fictional fixture schools, removed afterwards). With no verified policies the page shows the
  fallback sentence on the sheet, as before.
- **After sign-up, new accounts go to `/home`, not `/welcome`, and welcome goes to `/home`, not
  `/first-run`** (the funnel change of 16 November). Both screens were reached by opening them
  directly. The routing was not touched.
- **The legal pages print `TODO(Manu)` placeholders** (data region, postal address, EU/UK
  representative, governing law, liability). They were there before and are content for counsel,
  not design; PROGRESS "Needs Manu" 8.
- **Next.js advises a security upgrade** on every build ("Your version of Next.js is affected by
  a known security vulnerability"; it suggests `next upgrade --agent=security`). Dependencies
  are outside this job, so nothing was upgraded. Worth doing on its own branch.
- Sign-in copy in `lib/sign-in-copy.ts` keeps its straight apostrophes ("we'll", "can't"): that
  module's voice is unit-tested, and the tests were left alone.
- **Motion was verified from timed frames and mid-animation captures, not watched live.**
