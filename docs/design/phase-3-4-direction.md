# Design direction: Phases 3 and 4

Written 31 October 2026 for screens D (Profile Read), E (School Strategy and the kit preview),
F (Kit generation), G (Workspace) and M (Admin). It works inside the §6 system as it stands:
the §6.3 tokens, the §6.4 type scale, the §6.5 planes and radii, and the four §6.6 springs in
`packages/ui/src/motion.ts`. It adds no colours, no easings and no durations.

The components it names live in `packages/ui/src/profile/` and `packages/ui/src/strategy/`
(Phase 3), and in `packages/ui/src/kit/` and `packages/ui/src/workspace/` (Phase 0.5, carried into
Phase 4).

## References

These set the bar for feel and quality. They are not designs to copy (§0: nothing borrowed from
admissions platforms, and nothing lifted from these either).

| #   | Reference                                                                                                                                | What to take                                                                                                                                                                                                                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | [Linear, "A calmer interface for a product in motion" (UI refresh, March 2026)](https://linear.app/now/behind-the-latest-design-refresh) | Chrome steps back so content leads: the nav is "a few notches dimmer", dividers are softened, and "structure should be felt not seen". Take this for Admin (M) and for every table: hairline `--edge` rules only between row groups, no zebra stripes, no boxed cells.                        |
| 2   | [Apple, iPhone compare](https://www.apple.com/iphone/compare/)                                                                           | Columns are chosen by the user, criteria are grouped into short named sections, and every claim carries a superscript footnote that links to its note. Take the whole citation pattern for `MatrixTable`: a numbered mark after each number, and the numbered sources listed under the table. |
| 3   | [Apple HIG, Activity rings](https://developer.apple.com/design/human-interface-guidelines/activity-rings)                                | A warning, not a model. Apple asks that nobody replicate the rings or use rings as ornament. So the `LensInstrument` is one dial cut into four quadrant arcs, never three or four concentric rings, and it carries information only: the level in words, and the stories that make each arc.  |
| 4   | [Our World in Data, Grapher (any chart, e.g. child mortality)](https://ourworldindata.org/grapher/child-mortality?tab=chart)             | Every chart has a sources line under it and a full citation one click away. Take the "sources under every figure" discipline: a table of school numbers always ends with its numbered sources, each with the year and the date it was verified.                                               |
| 5   | [Rauno Freiberg, "Invisible details of interaction design"](https://rauno.me/craft/interaction-design)                                   | Interruptible gestures, motion that shows where things came from, and less animation on frequent actions. Take this for the horizon: the morph plays only when the selection crosses two schools. Hovering and moving focus are instant.                                                      |
| 6   | [Lando Norris, by OFF+BRAND (Awwwards Site of the Year 2025)](https://www.itsoffbrand.com/our-work/lando-norris)                         | One confident transition carries each page, and huge type does the rest. Take the scale contrast: a 96–144 px display line against 13 px tabular data. Don't take the scroll-driven choreography: §6.6 keeps scroll hijacking off app routes.                                                 |
| 7   | [Messenger, by abeto (Awwwards Developer Site of the Year 2025)](https://www.awwwards.com/annual-awards/winners)                         | A tiny world rendered impeccably at a steady frame rate. Take the discipline: one hero per screen, built so it holds 60 fps on a mid-range phone, rather than many effects that each drop frames.                                                                                             |
| 8   | [The Pudding Cup 2025 winners, e.g. "The legislative network behind state trans laws"](https://pudding.cool/pudding-cup/)                | Text is the visual: document-like layouts, small multiples, nothing decorative. Take this for the Profile Read findings, where the three columns (helps, doubts, do) are typography, not cards.                                                                                               |
| 9   | [Raycast](https://www.raycast.com/)                                                                                                      | Keyboard-first, with the shortcut shown beside the action it triggers. Take it for the horizon (arrows, Space, Escape, shown once in a quiet hint line) and for Admin (`A`/`R` per field, `J`/`K` to move).                                                                                   |
| 10  | [Financial Times, Visual vocabulary](https://github.com/Financial-Times/chart-doctor/tree/main/visual-vocabulary)                        | Pick the form from the relationship. "Your score against the class median" is a deviation, so it is a word ("above median") with the median small beside it, never a coloured cell. Deadlines are a timeline, so the horizon is a shared time axis.                                           |
| 11  | [By-Kin (on a 2026 Awwwards juror's list)](https://by-kin.com/)                                                                          | Editorial type with confident measure and generous leading. Take it for the kit preview's positioning headline, set in Newsreader at reading-large size with a 62–70 character measure, so it reads as a sentence about the applicant rather than a marketing banner.                         |

## Rules that hold on every screen here

- **One hero per screen, and it's the only thing that moves on its own.** Everything else changes
  state on `snap` (toggles) or `glide` (panels, reflow), or not at all.
- **Text first.** Every visual has its words beside it: a level in words beside each arc, the median
  beside each "above median", "Locked" beside each lock. Colour never carries meaning alone (§6.3).
- **Numbers are typeset as numbers.** Right-aligned, tabular numerals (`tabular-nums`), units after
  the figure in `--text-soft`, and a numbered source mark after every school figure (§5.5 AC).
- **No new chrome colour.** Status uses `--verified`, `--needs` and `--risk` with an icon and a
  word. `--voice` appears only where the applicant's own material is shown: their stories in the
  lens dial and the threads in the kit assembly. School data never borrows it.
- **Avoided, as §6.1 lists:** no card grids with the same shadow (tables and planes instead), no
  all-caps eyebrow labels (headings are sentence case and stand alone), no arrows appended to
  button text, no sparkle icons, no scroll-triggered fade-ins section by section (only the one
  hero responds to entering view), no glassmorphism (one plane, `--depth`, a 1px edge light in
  Night).
- **Placeholders hold the exact shape.** A code-split hero is preceded by a box of its exact
  height in `--depth` with its `--edge` border. It isn't a grey skeleton: no shimmer, no fake
  bars.

## D. Profile Read

**Layout (1280+).** A 12-column work plane. The top band is the hero: the `LensInstrument` dial
spans columns 1–5, and the selected lens's stories sit in columns 6–12, so the dial and its
evidence read as one sentence. Below, four lens sections, each a heading (`text-display-sm`, Geist 600) and three columns: _What helps_, _What may raise doubts_, _What to do_ (UI 15/22; the first
line of each finding in 17). Then the strengthening plan as a plain ordered list with time
estimates right-aligned in tabular figures ("2 h", "3 weeks"). Evidence links sit inline at the
end of each finding and open the `EvidenceDrawer` from the right (the existing `Sheet`, glide).

**Type.** The page title is display (64 → 40 on phones). The dial's centre readout is
`text-display-sm` for the lens name and UI 15 in `--text-soft` for the level. Findings are UI,
not Newsreader: Newsreader is the product's spoken voice (§6.4), and this page is the product
explaining, so only the one-line verdict under the title ("How an admissions reader is likely to
see you in the first few minutes") is Newsreader 21.

**Hero: the four-lens instrument.** One dial, four quadrant arcs (Academics top right,
Self-awareness bottom right, Employability bottom left, Leadership top left), each with a gap
of 10° so they read as four. A faint `--edge` track shows each full quadrant. The filled part is
the lens's level (thin, developing, strong), and it is cut into segments, one per story behind it,
with 2° gaps, so the arc is visibly made of the applicant's own material. Segments are drawn in
`--voice`, because they are the applicant's stories.

_Choreography._ When the dial is 40% in view, the arcs fill on `drift`. Each arc's mask draws from
its start, Academics first, then the others 90 ms apart, so the dial completes like a sweep. It
plays once per page view. Hover or focus on an arc: the other three drop to 35% opacity (`snap`),
the centre readout changes to that lens, and the panel beside the dial lists its stories (the
list cross-fades on `snap`; it doesn't slide). Arrow keys move between arcs (roving focus), Enter
or Space pins the lens, and Escape returns to the overview.

_Reduced motion._ The arcs are drawn at their level from the first frame, and the whole dial fades
in over 120 ms. Hover dimming becomes an instant change.

_Accessible list._ Each arc is a labelled button ("Leadership: developing, from 3 stories").
`LensList` renders the same data as a plain list, and the four sections below repeat it in full.

**Empty and error.** With no stories, the dial shows four empty tracks and the panel says "No
stories behind your lenses yet. Talk for five minutes in Story Studio and they'll fill in." with
"Start talking". A read that failed to build keeps the previous read on screen with a line above:
"Your Profile Read didn't update. It still shows what you had on 12 Oct. Build it again?" and a
"Build my Profile Read again" button. There are no scores out of 100 and no odds (§14.5).

**Mobile.** The dial is centred at up to 320 px (the only centred element, as a single hero
graphic). The story panel follows below it, and the three columns stack, each with its own
heading.

## E. School Strategy and the kit preview

**Layout.** From top to bottom: the page headline as the next step ("Pick two schools to compare
side by side"), the horizon, the comparison (once two or more are selected), the honest flags,
the round planner, and the kit previews. Planes, not cards. The horizon and the comparison share
one plane, so the morph happens inside it.

**Hero: the horizon.** Each school is a lane across one shared time axis running from today to
the last decision date. Its rounds are marks on the lane, labelled "R1", "R2" and "R3". The round
the applicant plans to apply in is a filled mark with a ring, past rounds are hollow, and a
hairline "Today" marker crosses every lane. Lanes are options in a multi-select list.

_Choreography._ With one school selected, nothing moves: the lane takes the `--veil` plane and the
check appears (`snap`). When the selection reaches two, the lanes morph (`drift`, Motion `layout`):
each selected lane narrows and rises into a column, its name lifts into the column header, and
its round marks slide from their places on the axis into a vertical list with dates and days
left. Schools not selected fold into compact rows beneath them, one line each (name and round
dates), still selectable. The comparison then fades up below (`glide`, opacity only), so the table
body never travels; only the schools do. Deselecting below two plays the morph in reverse, and because springs carry their
velocity, a quick reselect mid-flight just turns around.

_Keyboard._ Tab reaches the list once. Up and Down (and Left and Right) move between schools,
Space or Enter toggles one, Home and End jump, and Escape clears the comparison. Focus stays on
the same school through the morph, because the lanes are never re-created; they're re-laid out
in place. A polite live region says "Comparing Northfield and Harbor".

_Reduced motion._ No layout morph. The view changes on the next frame, and the comparison fades in
over 120 ms.

**The comparison** (`MatrixTable`). Schools as columns, criteria as rows, in named groups: Class
profile (medians against yours, as "above", "near" or "below median" in words, with the median
small beside it); Outcomes in your target function (share of class, median base, top employers);
Location fit; Scholarships, where known; What the school looks for against your brand traits.
Every number has a superscript source mark: hover or focus shows "Class profile 2026, verified
12 Sep 2026", and the numbered sources are listed under the table. The first column is sticky
(a sticky header row can't stick vertically inside a sideways-scrolling region), and on phones
the table scrolls sideways inside its own focusable region.

**Honest flags.** A plain list under the table, each flag one sentence with a status icon and
word ("Risk", "Worth knowing") and its source mark. No banners.

**Round planner.** One horizontal lane per round on the same time axis as the horizon. Each school
is a bar that ends at its deadline and starts when work should begin, so the bar's length is the
effort. The effort is stated in words beside it too ("Start by 12 Aug, about 3 weeks for 2
essays"). Order numbers (1, 2, 3) say what to do first.

**Kit preview** (a sheet from the school's column or row: "Preview kit"). The positioning headline
in Newsreader 21 at a 66-character measure, the file map as a two-column list (deliverable, then
the story it uses, titles only), and the deliverables as rows that are visibly there, each with
its limit, the story it will use, faint ruled lines where the draft will be, and a lock with the
word "Locked". The CTA reads exactly "Unlock {School} for $100". For a school without a published
pack, the CTA is replaced by "Pack coming soon", a line saying why, and "Ask us to cover
{School}", which records interest.

**Empty and error.** With no schools: "No schools yet. Search for one to see its rounds and what it
asks for." and the search field takes focus. A school whose pack is unverified shows its name and
"Pack coming soon" in its lane, with no marks, since nothing unverified is shown. A failed preview
says "Darden's preview didn't finish. Your other previews are ready. Try Darden again?" with
"Preview Darden again".

**Mobile.** The horizon becomes vertical: schools are rows and rounds are dated items. The axis
is dropped and each school lists its rounds by date, because a 360 px axis can't separate a week. Selecting two
schools opens the comparison as a sideways-scrolling table with a sticky first column.

## F. Kit generation

Built in Phase 0.5 (`KitAssembly`, `KitStageList`, `GapQuestionsPlane`) and wired to the real
pipeline in Phase 4.

**Layout.** As in the §6.10 wireframe. The Voiceprint and story column sit on the left (columns
1–5), the school's deliverables on the right (columns 6–12), and the stage list with the gap
questions plane underneath. On 1024 px and up, threads connect the two sides.

**Hero: the assembly.** When the file map lands, each deliverable gets its thread: light leaves
the Voiceprint, passes through the chosen story and travels to the essay (`drift`). While an essay
drafts, a soft pulse runs along its thread (`settle`), and the essay's first lines stream in
sentence by sentence (180 ms fade-up, space reserved). When the stream connects, the kit page
picks up the current state at once, so a refresh mid-run never replays the whole show.

_Reduced motion and tier 1._ The threads appear in place, opacity only, and the Voiceprint is
still.

**Empty and error.** Before the file map: the deliverable rows are already present with "Waiting"
and the story slot reserved. A failed essay keeps the others and says, in its own row, "Essay 2
didn't finish drafting. Your other essays are ready. Try Essay 2 again?" with "Draft Essay 2
again". Gap questions are optional: "Skip, draft with gaps".

**Mobile.** Stages first, then deliverables as a list with story names. No threads below 1024 px.

## G. Workspace

**Layout.** Files 248 px, the document sheet (text column 720 px max), and the Coach at 400 px
(§6.5). Below 1280 px the Coach is a sheet, and on phones the three are swipeable views. In Day
the document is a paper sheet (`--depth`), and it can stay paper in Night.

**Hero: your words, lit.** `Y` toggles the view: sentences from the applicant's own words take
the `--voice-glow` (`glide` on background opacity), and composed sentences stay plain. Hovering
or focusing a lit sentence shows the transcript line it came from in a small plane below it.
Nothing else in the Workspace animates on its own. Accepting a revision blends the changed words
(`DiffMorph`, 240 ms), and the version scrubber crossfades.

_Reduced motion._ The glow appears without a fade, and diffs swap in place.

**Quiet everywhere else.** The Files pane is a list, not cards: deliverable, status in words, and
the limit count in tabular figures right-aligned ("187 / 200"). `J`/`K` move between deliverables
and `L` locks a paragraph. The Coach tabs are Why this, Options, Refine, Checks and Verify; Checks
are grouped Must fix, Should fix and Consider, each with an icon and a word.

**Empty and error.** A deliverable not yet drafted shows its prompt verbatim and "Draft Essay 3"
as the action. When a refinement fails, the paragraph is left untouched and the Coach says
"Paragraph 2 wasn't changed. Ask again?".

**Mobile.** The document comes first. Files and Coach are swipe or tab targets at the bottom
dock's level, and the NEED composer opens as a bottom sheet with the record button.

## M. Admin (pack review and consoles)

**No hero (§6.7).** Fast, dense and functional, in Linear's spirit: dim chrome, hairline rules, UI
13/18 for data and 15 for controls, tabular numerals everywhere, and Day by default.

**Pack review.** The source is on the left (scrolls on its own, with the passage behind the
focused field highlighted in `--veil` and an outline), and the proposed pack fields are on the
right as a table: field, proposed value, current value, a diff, and the source passage
reference. Accept or reject each field with `A`/`R`, move with `J`/`K`. Conflict badges use the
status icon and the word ("Conflict: 2 sources disagree"). The publish button names the version:
"Publish version 7". It's disabled with a stated reason while any field is unreviewed
("3 fields still need a decision").

**Costs, prompts, evals, users and orders.** `MatrixTable` with the same right-aligned tabular
numbers and no citations (internal numbers aren't school facts, so they use text cells). Filters
are a single row of select controls. Every destructive action, such as a refund or a kill switch,
asks for a reason code in a dialog whose button names the action ("Refund this order").

**Empty and error.** "No sources yet for Northfield 2026–27. Add one by pasting text, uploading a
PDF or entering a URL." Failed normalisation keeps the source and says which step failed and why,
with "Normalise again".

**Mobile.** Read-only and usable (look up a user, check costs). Pack review requires 1024 px and
says so.

## Component map

| Component                                                                          | Where                    | Client?                               | Motion?                                   |
| ---------------------------------------------------------------------------------- | ------------------------ | ------------------------------------- | ----------------------------------------- |
| `LensInstrument`                                                                   | D hero                   | yes (hover, focus, in-view)           | no: CSS transitions on the `drift` easing |
| `LensList`                                                                         | D, accessible list       | no                                    | no                                        |
| `EvidenceLink`, `EvidenceDrawer`                                                   | D, E                     | yes                                   | no (the `Sheet` glides with CSS)          |
| `HorizonTimeline`                                                                  | E hero, Tracker later    | yes, code-split by the route          | yes: `layout` on `drift`                  |
| `HorizonList`, `HorizonPlaceholder`                                                | E first paint, list view | no                                    | no                                        |
| `MatrixTable` (`ComparisonTable`)                                                  | E, Tracker, Admin        | no; `CitationMark` is the client leaf | no                                        |
| `HonestFlagList`                                                                   | E                        | no                                    | no                                        |
| `RoundPlanner`                                                                     | E                        | no                                    | no                                        |
| `PositioningBlock`, `FileMapList`, `LockedDeliverables`, `UnlockCta`, `KitPreview` | E sheet                  | no                                    | no                                        |
| `KitPreviewError`                                                                  | E sheet                  | no (`Button` is the client leaf)      | no                                        |
| `LensFindings`, `StrengtheningPlan`                                                | D, below the hero        | rendered from a client page           | no                                        |

The route imports `HorizonTimeline` through a one-line local module with `next/dynamic` (the
Dossier's `constellation-view.tsx` pattern) and shows `HorizonPlaceholder` for its exact height, so
Motion never reaches first-load JS. Until it loads, or for anyone who prefers it, `HorizonList`
says the same rounds in words.

Dates follow one house rule: English short months are three letters ("12 Sep 2026"), although
British English locale data says "Sept". `formatDate` in `packages/ui/src/strategy/time-scale.ts`
applies it everywhere.
