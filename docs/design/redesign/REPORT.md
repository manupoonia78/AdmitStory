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
