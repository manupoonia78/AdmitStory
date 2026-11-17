# AdmitStories redesign spec: "The Literary Instrument"

Source of truth between sessions. Brief: `docs/design/fable-redesign-prompt.md`. Progress and
decisions: `PROGRESS.md`. Evidence: `REPORT.md` and `shots/`.

**Status of each part** (Phase 0, 2026-11-12; §2 built in Phase 1, 2026-11-13, see §2.13; §3
built in Phase 2, 2026-11-14, and rewritten to the values as built):

| Part                                                                  | Depth                                                                                                                  |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| §1 Concept, §2 System, §3 Landing hero                                | Full values. Build from these.                                                                                         |
| §4 Marketing (scenes and pages), §5 Entry                             | Full values, as built in Phases 3 and 4.                                                                               |
| §6 App                                                                | §6.1 shell, §6.3 Home, §6.4 Studio at full values (Phase 5); the rest a composition sketch, expanded by its own phase. |
| §7 Signature-moment table, §8 Budgets                                 | Full.                                                                                                                  |
| §9 Where the brief and the code disagree, §10 Proposals needing a yes | For Manu's review.                                                                                                     |

When a value changes while building, change it here in the same commit.

---

## 1. Concept

### 1.1 One line, three jobs

The brief's signature is "voice becomes story becomes essays". This spec carries it with a single
graphic element used on every screen, called **the Voiceline**: one hairline, 1.25 px, that

1. moves as a waveform while someone is speaking;
2. lies flat as a rule once the words are down (a baseline, an underline, a margin rule, a
   timeline, a progress line);
3. rises once into a single sharp peak to mark "here" (the current step, a deadline, today).

Every signature moment in §7 is this line doing one of those three jobs. Nothing else in the
product is allowed to be decorative. That is what makes the site one object instead of a set of
nice pages, and it is cheap: a line is a canvas stroke or one SVG path.

**The line takes the colour of whoever is speaking.** Brass for our fictional sample speakers
(marketing), the applicant's own Voiceprint hue inside the app (§2.3), silver for the interviewer.
Flat rules are neutral (`--line`).

### 1.2 The instrument is round and dark; the paper is square and light

Two materials, never mixed:

|         | Instrument                                                                                                              | Paper                                                                                                               |
| ------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Where   | marketing, Story Studio, interview room, and the app's **casing** (sidebar, top bar, tab dock, command palette, toasts) | everything you read or write: essay sheets, school documents, the recommender portal, legal pages, the Profile Read |
| Colour  | near-black `#0B0A09`, warm white text, brass                                                                            | `#F7F5F0`, ink `#141414`, brass-ink                                                                                 |
| Corners | pills, 24 px cards, 32 px frames                                                                                        | 3 px (a sheet of paper has corners)                                                                                 |
| Type    | Geist, Geist Mono labels, Instrument Serif italic accents                                                               | Source Serif 4 for the text, Geist for controls, Geist Mono for margin notes                                        |
| Depth   | fill steps and hairlines, one frosted material                                                                          | one soft contact shadow                                                                                             |

**The casing is dark in both themes** (my call, see §10.1). Day and Night change what sits
_inside_ the instrument: in Day the working area is a warm desk with paper on it; in Night it is a
dark desk with "night paper". Walking from the dark marketing site through sign-in into the app
never flips the whole screen to beige, which is the main reason the current app reads as a
different, more ordinary product than its own landing page.

### 1.3 What is kept from the Paper direction

One accent. Hierarchy from opacity, not new colours. Generous padding. Honest labels. Solid
surfaces for anything you read. No glows.

### 1.4 What goes

Newsreader, Hanken Grotesk, JetBrains Mono. The bronze-italic headline flourish. The WebGL
Voiceprint orb and its radial glow (live in the hero and Studio; as a still in the final call,
first-run and the Dossier voice tab): it is exactly the "glow orb / radial-gradient visual /
floating 3D object" the brief bans (§9.1). The
people marquee and the turning seal ring (ambient motion). GSAP and Lenis (§8.3).

---

## 2. The system (full values)

Everything here lives in `packages/ui` (`tokens.css`, `theme.css`, `render.css`, `motion.ts`,
`springs.ts`, `components/`). Existing token and utility names are kept so current screens keep
rendering; §2.12 maps old to new.

### 2.1 Colour tokens

Contrast figures are WCAG ratios computed for these exact values (script kept in PROGRESS notes;
`contrast.test.ts` will assert them in Phase 1).

**Instrument (dark).** Scope: `[data-theme="night"]`, and always on marketing, immersive screens
and the casing.

| Token            | Value                                      | Use                                                    | Contrast on `--bg`   |
| ---------------- | ------------------------------------------ | ------------------------------------------------------ | -------------------- |
| `--bg`           | `#0B0A09`                                  | page, casing                                           |                      |
| `--fg`           | `#F4F1EA`                                  | headlines, primary text                                | 17.5                 |
| `--fg-80`        | `rgb(244 241 234 / .80)`                   | body copy                                              | 11.2                 |
| `--fg-64`        | `rgb(244 241 234 / .64)`                   | secondary text, **the floor for any text under 24 px** | 7.4                  |
| `--fg-60`        | `rgb(244 241 234 / .60)`                   | Instrument Serif accents, mono labels                  | 6.6                  |
| `--fg-48`        | `rgb(244 241 234 / .48)`                   | text of 24 px and up, icons, placeholders              | 4.6                  |
| `--fg-40`        | `rgb(244 241 234 / .40)`                   | control borders (needs 3:1), disabled, never body text | 3.5                  |
| `--line`         | `rgb(244 241 234 / .12)`                   | hairlines, flat Voiceline                              | decorative           |
| `--line-strong`  | `rgb(244 241 234 / .20)`                   | dividers that separate regions                         | decorative           |
| `--surface-1`    | `rgb(244 241 234 / .04)` (solid `#141312`) | cards on dark                                          |                      |
| `--surface-2`    | `rgb(244 241 234 / .07)` (solid `#1B1A19`) | the frosted material's fill                            | `--fg-64` on it: 6.9 |
| `--accent`       | `#E2B36B`                                  | brass                                                  | 10.3                 |
| `--accent-hover` | `#E9C283`                                  | brass fill on hover                                    |                      |
| `--on-accent`    | `#14110A`                                  | text on brass                                          | 9.8 on brass         |

The brief's `--bg #0A0A0B` is neutral-cool. `#0B0A09` is the same darkness one step warm, so the
paper scenes sit in the same world instead of looking yellow against a blue-black. The brief's 40 %
label opacity fails AA at 11 px (3.5:1), so mono labels use 60 % and nothing smaller than 24 px
goes below 64 %.

**Paper (Day reading and writing).** Scope: `[data-theme="day"]`.

| Token           | Value                 | Use                                                                                              | Contrast on paper / desk |
| --------------- | --------------------- | ------------------------------------------------------------------------------------------------ | ------------------------ |
| `--paper`       | `#F7F5F0`             | sheets, cards in Day                                                                             |                          |
| `--desk`        | `#ECE9E2`             | the Day working area behind sheets                                                               |                          |
| `--paper-raise` | `#FCFBF8`             | inputs on paper                                                                                  |                          |
| `--ink`         | `#141414`             | text                                                                                             | 16.9 / 15.3              |
| `--ink-80`      | `rgb(20 20 20 / .80)` | long-form body                                                                                   | 9.4                      |
| `--ink-66`      | `rgb(20 20 20 / .66)` | secondary text (the brief's .62 passes at 5.0 on paper and 4.8 on the desk; .66 gives more room) | 5.7 / 5.5                |
| `--ink-50`      | `rgb(20 20 20 / .50)` | control borders, 24 px+ text                                                                     | 3.4 / 3.3                |
| `--rule`        | `rgb(20 20 20 / .10)` | hairlines                                                                                        | decorative               |
| `--rule-strong` | `rgb(20 20 20 / .18)` | region dividers                                                                                  | decorative               |
| `--accent-ink`  | `#85590F`             | brass on paper: margin notes, caret, the Voiceline on paper                                      | 5.6 / 5.1                |

The brief's `--accent-ink #9A6B1F` measures 4.29 on paper and 3.85 on the desk, under AA. `#85590F`
is the same hue, darker.

**Night paper.** Scope: `[data-theme="night"]` working area.

| Token           | Value                      | Use                                                              | Contrast         |
| --------------- | -------------------------- | ---------------------------------------------------------------- | ---------------- |
| `--desk-night`  | `#0B0A09` (same as `--bg`) | Night working area                                               |                  |
| `--card-night`  | `#151412`                  | cards                                                            | text 14.9        |
| `--sheet-night` | `#1C1A17`                  | night paper: a warm dark sheet, never black                      | text 14.1        |
| `--text-night`  | `#ECE7DD`                  | text on night paper (a step softer than `--fg` for long reading) |                  |
| secondary       | `rgb(236 231 221 / .64)`   |                                                                  | 6.4              |
| accent          | `#E2B36B`                  |                                                                  | 9.0 on the sheet |

**Status** (always with an icon and a word, never colour alone):

| Token                 | Night     | Day       | Lowest contrast (Night / Day) |
| --------------------- | --------- | --------- | ----------------------------- |
| `--verified`          | `#8CCBA0` | `#2A6B45` | 9.2 / 5.3                     |
| `--needs`             | `#A9BEE0` | `#34588F` | 9.2 / 5.9                     |
| `--risk`              | `#F09080` | `#A8382A` | 7.5 / 5.3                     |
| `--record` (non-text) | `#F0664E` | `#C8452F` | 5.6 / 4.0                     |

`--needs` moves from amber to a calm slate blue. Amber sat one shade from the brass accent, and
"needs you" is a question, not a warning; these chips appear all over an anxious person's essay.

**Accent discipline.** Brass appears on exactly three kinds of element: (1) the primary action's
fill, (2) the Voiceline when it is alive or marking "here", (3) the text caret and selection.
Not on headings, icons, badges, links or active nav items.

**Names in the code** (`tokens.css`, Phase 1). The tables above name each value once. In the
stylesheet the brass constants are `--brass`, `--brass-hover`, `--on-brass` and `--brass-ink`
(the tables' `--accent`, `--accent-hover`, `--on-accent`, `--accent-ink`), because `--accent` is
the _semantic_ name that resolves to brass in Night and brass-ink in Day (§2.2). The opacity steps
have semantic names too, which is what components use: `--text-80`, `--text-soft` (64 % / 66 %),
`--text-label` (60 % / 66 %), `--text-faint` (48 % / 50 %), `--edge-strong`, `--field` (input
fill), `--frost`, `--frost-hover`, `--frost-solid`, `--signal-hover` and `--sheet-text`.
`contrast.test.ts` asserts every constant equals the theme value built from it.

**First rule in the stylesheet** (no white flash):
`html,body{background:#0B0A09;color:#F4F1EA}` before anything else, with `color-scheme: dark`.
The Day working area paints its desk inside the casing.

### 2.2 Semantic mapping (existing names keep working)

| Existing token                                                 | Night / instrument                  | Day                                                                  |
| -------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------- |
| `--space`                                                      | `#0B0A09`                           | `#ECE9E2`                                                            |
| `--depth` (cards, planes)                                      | `#151412`                           | `#F7F5F0`                                                            |
| `--sheet` (new: document sheets)                               | `#1C1A17`                           | `#F7F5F0`                                                            |
| `--veil`                                                       | `rgb(244 241 234 / .04)`            | `rgb(20 20 20 / .04)`                                                |
| `--edge`                                                       | `rgb(244 241 234 / .12)`            | `rgb(20 20 20 / .10)`                                                |
| `--control-edge`                                               | `rgb(244 241 234 / .40)`            | `rgb(20 20 20 / .50)`                                                |
| `--text`                                                       | `#F4F1EA` (`#ECE7DD` on sheets)     | `#141414`                                                            |
| `--text-soft`                                                  | `rgb(244 241 234 / .64)`            | `rgb(20 20 20 / .66)`                                                |
| `--signal` (primary fill)                                      | `#E2B36B`                           | `#141414`                                                            |
| `--on-signal`                                                  | `#14110A`                           | `#F7F5F0`                                                            |
| `--accent`                                                     | `#E2B36B`                           | `#85590F`                                                            |
| `--silver` (interviewer; 10.1 on night paper, 5.5 on the desk) | `#C9C5BC`                           | `#5E5C57`                                                            |
| `--rail` (casing)                                              | `#0B0A09`                           | `#0B0A09`                                                            |
| `--scrim`                                                      | `rgb(0 0 0 / .64)`                  | `rgb(20 20 20 / .36)`                                                |
| `--shadow-paper`                                               | `none`                              | `0 1px 0 rgb(20 20 20 / .04), 0 12px 32px -20px rgb(20 20 20 / .18)` |
| `--shadow-overlay`                                             | `0 24px 64px -24px rgb(0 0 0 / .7)` | `0 24px 48px -24px rgb(20 20 20 / .28)`                              |

The casing elements carry `data-theme="night"` themselves, so they are dark in both themes. The
duplicated Night block (media query and selector) stays, as `contrast.test.ts` requires.
`THEME_COLORS` (browser chrome) becomes `#0B0A09` for both themes, since the top of every screen
is casing.

**Interim, until Phase 5 recases the shell** (and until Manu answers §10.1): the existing sidebar
and top bar are still Day-coloured in Day, so Phase 1 leaves Day `--rail` at `#E4E0D8` and
`THEME_COLORS.day` at `#ECE9E2` (the desk). Making them `#0B0A09` now would put ink text on a
black rail. Phase 5 switches both when the casing gets its own `data-theme="night"`.
`ImmersiveScope` likewise still follows the chosen theme; forcing Night on immersive screens is
Phase 5's change.

### 2.3 Voiceprint hues

The code has **12** hues (`voice-hues.ts`), one chosen per applicant, not four (§9.3). The ids,
order and count stay, so every stored choice still resolves. The values are refit to one lightness
and chroma so they sit with brass and the warm neutrals, and three that collided with brass move
away from it. Night `oklch(0.84 0.085 h)`, Day `oklch(0.46 0.10 h)`:

| id     | Label  | h               | Night     | Day       | Lowest contrast (Night / Day) |
| ------ | ------ | --------------- | --------- | --------- | ----------------------------- |
| aqua   | Aqua   | 195             | `#84DCDC` | `#006869` | 11.0 / 5.4                    |
| amber  | Ember  | 48              | `#F9BA9A` | `#844420` | 10.4 / 6.1                    |
| violet | Violet | 300             | `#D3BEFA` | `#614A87` | 10.4 / 6.1                    |
| coral  | Coral  | 25              | `#FDB5AF` | `#873F3B` | 10.3 / 6.2                    |
| gold   | Citron | 108             | `#CFCF8E` | `#5E5B00` | 10.8 / 5.8                    |
| lime   | Lime   | 128             | `#BAD69A` | `#48621E` | 10.9 / 5.7                    |
| fern   | Fern   | 146             | `#A7DAAA` | `#2D6634` | 11.0 / 5.6                    |
| mint   | Mint   | 165             | `#95DDBD` | `#00694A` | 11.0 / 5.6                    |
| sky    | Sky    | 238             | `#95D3FC` | `#055F89` | 10.8 / 5.8                    |
| orchid | Orchid | 328             | `#EAB7E7` | `#754274` | 10.3 / 6.2                    |
| rose   | Rose   | 355             | `#F8B4CD` | `#823E5B` | 10.2 / 6.2                    |
| sand   | Stone  | 80 (chroma .02) | `#D1C9BC` | `#5E574C` | 10.6 / 5.9                    |

No hue sits within 25° of brass (75°) at full chroma. `--voice-glow` (the highlight behind own
words) stays `color-mix(--voice 16 % Day / 22 % Night, transparent)`.

**Colour-blind safety: provenance never depends on hue.** In essays, a sentence's origin is drawn
three ways at once:

| Kind (`provenance.ts`)             | Mark                                                                              |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| `verbatim` (said word for word)    | `--voice-glow` fill **and** a solid 1.25 px underline in `--voice`, offset 0.22em |
| `adapted` (theirs, lightly edited) | lighter fill (60 % of the glow) **and** a dotted underline                        |
| `composed` (written for them)      | plain text                                                                        |
| an open question (`need`)          | dashed chip in `--needs` with the question-mark glyph                             |

### 2.4 Type

Four faces, loaded with `next/font/google`, `subsets: ["latin"]`, `display: "swap"`, automatic
metric-matched fallbacks (`adjustFontFallback`). Sizes below are measured latin woff2 files
(Google Fonts, 2026-11-12).

| Face                                               | Role                                                                                                                                  | Load                                          | File           |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | -------------- |
| **Geist** (variable 100–900)                       | headlines and all interface text                                                                                                      | preload everywhere                            | 29.3 KB        |
| **Instrument Serif**, italic 400 only              | 1–3 accent words in a headline, the live transcript, the Voiceline's words. Never upright (the roman isn't loaded), never under 20 px | preload everywhere                            | 15.7 KB        |
| **Geist Mono** (variable)                          | labels, margin notes, figures                                                                                                         | preload everywhere (changed in Phase 1, §8.1) | 23.1 KB        |
| **Source Serif 4**, 400 roman + 400 italic, static | long-form text on paper                                                                                                               | preload only on reading routes (§8.1)         | 20.1 + 20.1 KB |

**Why Source Serif 4 for reading.** It has a true optical-size axis (8–60), and when the axis is
not requested Google serves its default instance, opsz 14: the text master, with the sturdier
serifs, open counters and looser fit that 17–19 px screen text needs. So we get the real text cut
in a 20 KB static file, where carrying the axis costs 130 KB a style. Its rational, slightly
squared drawing matches Geist's geometry, where Instrument Serif (display only, high contrast)
would break up at text size. Two files only: the editor has bold switched off
(`doc-canvas/extensions.ts`), so roman and italic are all an essay can contain.

Geist comes from `next/font/google`, not the installed `geist` package, because the package ships
unsubsetted files (45–73 KB each). The package stays for the OG image's `.ttf`.

**Scale.** Breakpoints are the existing `sm` 640, `lg` 1024, `xl` 1280. No `md` is added: tablets
take the `sm` composition.

| Token          | Size (base → sm → lg+)                                        | Weight | Line-height | Tracking                      | Use                                               |
| -------------- | ------------------------------------------------------------- | ------ | ----------- | ----------------------------- | ------------------------------------------------- |
| `display-hero` | `clamp(44px, 7vw, 112px)`: 44 at 390, 72 at 1024, 101 at 1440 | 450    | 0.95        | −0.045em (−0.035em under 640) | landing H1 only                                   |
| `display-1`    | `clamp(36px, 5vw, 72px)`                                      | 450    | 1.0         | −0.04em                       | scene headings                                    |
| `display-2`    | `clamp(28px, 3.4vw, 48px)`                                    | 500    | 1.05        | −0.035em                      | page titles in the app, sub-scenes                |
| `display-3`    | `clamp(22px, 2.2vw, 32px)`                                    | 500    | 1.15        | −0.025em                      | card titles, prompts                              |
| `title`        | 18 → 18 → 20 px                                               | 500    | 1.3         | −0.015em                      | list and panel headings                           |
| `body-lg`      | 16 → 17 → 17 px                                               | 400    | 1.55        | −0.005em                      | marketing paragraphs                              |
| `body`         | 15 → 15 → 16 px                                               | 400    | 1.55        | 0                             | default copy                                      |
| `ui`           | 14 px                                                         | 500    | 20 px       | 0                             | buttons, nav, form labels                         |
| `ui-sm`        | 13 px                                                         | 400    | 18 px       | 0                             | captions, helper text (the minimum for sans)      |
| `label`        | 11 px Geist Mono, uppercase                                   | 500    | 16 px       | +0.18em                       | eyebrows, column heads, at `--fg-60` / `--ink-66` |
| `note`         | 11.5 px Geist Mono, sentence case                             | 400    | 18 px       | 0                             | margin notes, at `--accent-ink` on paper          |
| `figure`       | Geist Mono, `tabular-nums`                                    | 400    | inherits    | −0.01em                       | prices, counts, dates                             |
| `accent`       | Instrument Serif italic at 1.06× the surrounding size         | 400    | inherits    | −0.01em                       | headline accents, at `--fg-60`                    |
| `transcript`   | Instrument Serif italic 24 → 28 → 34 px                       | 400    | 1.2         | −0.005em                      | live transcript, Voiceline words                  |
| `read`         | Source Serif 4, 17 → 18 → 19 px                               | 400    | 1.65        | 0                             | essays and documents, measure `68ch`              |
| `read-sm`      | Source Serif 4, 15 px                                         | 400    | 1.6         | 0                             | sheets shown small (hero cards, previews)         |
| `read-lg`      | Source Serif 4, 20 → 21 px (added in Phase 1)                 | 400    | 1.5         | 0                             | a lead paragraph or a positioning line on a sheet |

Rules: headlines are never bold (max 500). The hero H1 is 5.9× body at 1440 (101 / 17).
Headlines are broken by hand with a phone array beside each desktop array, as `_copy/hero.ts`
does. `text-wrap: balance` on h2/h3, `pretty` on paragraphs. Geist's `ss01`/`cv11` settings from
the old body rule are dropped (they were Hanken's).

### 2.5 Space and grid

- 4 px base. Scale: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 160.
- Grid (the existing 4 / 8 / 12 column `SECTION_GRID`): base 4 columns, 20 px margins, 16 px
  gutters; `sm` 8 columns, 32 px margins, 20 px gutters; `lg` 12 columns, 48 px margins, 24 px
  gutters, content capped at 1344 px (a column is 90 px at 1440).
- Scene padding (top and bottom): 80 px base, 112 px `sm`, 160 px `lg`.
- Inside cards: 24 px base, 32 px `lg`. Inside product frames: 8 px bezel.
- Tap targets 44 px minimum; smaller visuals get a 44 px hit area (`HIT_AREA`, kept).

### 2.6 Radius, edge, elevation

| Token                                   | Value   | Use                                                                 |
| --------------------------------------- | ------- | ------------------------------------------------------------------- |
| `--radius-round`                        | 9999 px | every action (buttons, chips, tabs, toggles, the nav bar, the dock) |
| `--radius-card` (was `--radius-plane`)  | 24 px   | cards, panels, dialogs, the app's working area                      |
| `--radius-frame` (was `--radius-sheet`) | 32 px   | large product windows on marketing                                  |
| `--radius-control`                      | 14 px   | text fields, selects, textareas                                     |
| `--radius-inset`                        | 8 px    | things nested in a card: key hints, thumbnails                      |
| `--radius-paper`                        | 3 px    | every sheet of paper                                                |

Edges are 1 px `--edge`. There are no shadows on dark. Paper on a Day desk gets `--shadow-paper`;
paper on dark gets none (the contrast is the lift).

### 2.7 The one material: frost

```css
/* floating things that content scrolls beneath */
@utility frost {
  background-color: var(--surface-2); /* fg at 7 % */
  border: 1px solid var(--line);
  -webkit-backdrop-filter: blur(16px);
  backdrop-filter: blur(16px);
}
/* the same look for things that sit in the flow: no blur to pay for */
@utility frost-flat {
  background-color: var(--surface-2);
  border: 1px solid var(--line);
}
```

- On paper and the Day desk: fill `rgb(20 20 20 / .05)`, edge `--rule`, same blur.
- `frost` (real blur): marketing nav, app top bar, tab dock, the editor's floating toolbar, command
  palette, toasts, sticky table heads. At most three on screen at once.
- `frost-flat`: chips, secondary buttons, the sidebar, cards on dark. A list of twenty chips each
  with its own backdrop blur would cost more than the hero.
- No highlight, no gradient, no inner glow. It is frosted, not glossy.
- Fallback when `backdrop-filter` is unsupported or `prefers-reduced-transparency: reduce`: solid
  `#1B1A19` (dark) or `#EFEDE7` (paper).

### 2.8 Grain

One static SVG `feTurbulence` tile (200 × 200, `baseFrequency .8`, 2 octaves, greyscale) as a
data URI in `--grain-image`, painted as a `background-image` layer on dark surfaces at 6 % alpha.
A background layer, not a fixed overlay, so it costs nothing to composite, takes no pointer events
and can't animate. No grain on paper. The old top-of-page radial "warm light" on `body` is removed.

### 2.9 Components

All server-safe class builders stay server-safe (`buttonStyles()` works on a plain element; the
root layout and error boundary never import `Button` or Radix).

**Button** (`button-styles.ts`). Pills. Geist 14 / 20, weight 500.

|                       | Height                 | Padding                                    | Arrow circle |
| --------------------- | ---------------------- | ------------------------------------------ | ------------ |
| `lg` (marketing CTAs) | 52 px                  | 0 8 px 0 24 px with arrow; 0 24 px without | 36 px        |
| `md` (default)        | 44 px                  | 0 6 px 0 20 px with arrow; 0 20 px without | 32 px        |
| `sm`                  | 36 px (44 px hit area) | 0 16 px                                    | none         |

| Variant            | Rest                                                                           | Hover (200 ms `--ease-rise`)                  | Pressed (100 ms) |
| ------------------ | ------------------------------------------------------------------------------ | --------------------------------------------- | ---------------- |
| `primary` on dark  | fill `--accent`, text `--on-accent`; arrow circle `#14110A` with a brass arrow | fill `--accent-hover`; arrow moves 2 px right | scale 0.98       |
| `primary` on paper | fill `--ink`, text `--paper`; arrow circle `--paper` with an ink arrow         | fill `rgb(20 20 20 / .88)`; arrow 2 px right  | scale 0.98       |
| `secondary`        | `frost-flat`, text `--text`                                                    | fill steps to 10 % (dark) / 8 % (paper)       | scale 0.98       |
| `quiet`            | text `--text`, no fill                                                         | 1 px underline, offset 4 px                   |                  |
| `danger`           | fill `--risk`, text `--on-signal`                                              | fill 8 % lighter                              | scale 0.98       |

The arrow is a `btn-arrow` span whose glyph is a CSS mask (inline SVG data URI, 14 px, 1.5 px
stroke), so it needs no icon import. It is on by default for forward actions ("Start your
story", "Unlock", "Continue") and off for everything else. Disabled: 45 % opacity, no motion.
Focus: §2.11. The old magnetic pull and edge-light are removed from `Button`.

**Text field.** 48 px tall, `--radius-control`, fill `--surface-1` (dark) / `--paper-raise`
(paper), border `--control-edge`, Geist 16 px (never smaller: iOS zooms under 16). Label above in
`ui`, helper below in `ui-sm`. Focus: border `--text`, plus the focus ring. Caret `--accent`.
Error: border `--risk`, message with an icon. Textareas the same, min-height 120 px.

**Card.** `--radius-card`, fill `--surface-1` + `--line` on dark, `--paper` + `--rule` +
`--shadow-paper` in Day. Padding 24 / 32 px. A card that is a link lifts its fill one step on
hover (200 ms); nothing scales.

**Sheet of paper** (`sheet` utility). `--sheet` fill, `--radius-paper`, `--shadow-paper` in Day,
padding 40 px base / 56 px `sm` / 72 px `lg`, text in `read`.

**Chip** (toggle or filter). 32 px tall (44 px hit area), pill, `frost-flat`, `ui-sm` weight 500.
Selected: fill `--text`, text `--space` (inverted, not brass).

**Tabs.** Text tabs in `ui`, `--text-soft` at rest, `--text` selected, with a 1.25 px rule under
the selected tab that slides between tabs (transform only, `glide` spring). Segmented control
(Speak / Write, Day / Night): a `frost-flat` pill with a sliding inner pill in `--surface-2`.

**Eyebrow** (`eyebrow` utility, kept): `label` type, preceded by a 24 px rule in `--line-strong`
(neutral now, not bronze).

**Status label** (kept): icon + word in the status colour; `ui-sm`.

**Dialog / sheet / palette.** `--radius-card`, `frost` on dark casing or solid `--depth` when it
holds a form, `--shadow-overlay`, scrim `--scrim`. Enter 250 ms `glide`; reduced motion 120 ms fade.

**Tooltip-like labels** stay CSS-only (no Radix Tooltip).

**Wordmark and mark** (`brand/wordmark.tsx`, `components/brand-mark.tsx`, `app/icon.svg`).

- **The mark is the Voiceline making its peak**, which also reads as a capital A: a flat line that
  rises once. In a 24 × 24 box: `M2 16 H8.4 L12 5.5 L15.6 16 H22`, stroke 1.75 px, mitre joins,
  butt caps, no fill. Brass on dark, ink on paper.
- Favicon: the same path, stroke 2.25 px, brass, on a `#0B0A09` square with 22 % corner radius.
  At 16 px it stays one clean chevron on a line.
- Wordmark: "Admit" in Geist 500, tracking −0.02em; "Stories" in Instrument Serif italic at
  1.12× (to match x-heights), same colour at 100 % (the wordmark is the one place the italic is
  full strength). 18 px in the nav, 17 px in the sidebar.

**Model seal** (`components/model-seal.tsx`; all words still from `model-claims.ts`). Redrawn as
an instrument dial, not a stamp: one 1 px ring, 60 minute-ticks (every fifth longer) in `--line`,
the ring text in Geist Mono 10.5 px at `--fg-60`, the figure in Geist 450, and one brass tick at
twelve o'clock. It does not turn (the 120 s rotation is ambient motion and goes).
`ModelSealMark` (the 28 px credit) is the ring, twelve ticks and the brass tick.

### 2.10 Motion

Two vocabularies, each with one job.

**Springs** (kept, `springs.ts`; for things the user moves): `snap` toggles and presses, `glide`
panels, sheets and tab rules, `drift` shared-element flights and the hero's sheets, `settle`
nothing ambient any more (kept for the tests and long settles).

**Eases** (new, `motion.ts` + tokens; for choreography):

| Token          | Value                            | Use                            |
| -------------- | -------------------------------- | ------------------------------ |
| `--ease-rise`  | `cubic-bezier(0.22, 1, 0.36, 1)` | every entrance and reveal      |
| `--ease-exit`  | `cubic-bezier(0.4, 0, 1, 1)`     | things leaving                 |
| `--ease-line`  | `cubic-bezier(0.65, 0, 0.35, 1)` | a line drawing or settling     |
| `--dur-press`  | 100 ms                           | pressed states                 |
| `--dur-hover`  | 200 ms                           | hovers (range allowed 150–250) |
| `--dur-swap`   | 250 ms                           | content swapping in place      |
| `--dur-reveal` | 600 ms                           | scroll reveals                 |
| `--dur-enter`  | 800 ms                           | page entrances                 |
| `--dur-draw`   | 900 ms                           | a Voiceline drawing            |

The comment in `motion.ts` ("no cubic-béziers") is rewritten to say this; `motion.test.ts` gains
assertions for the new constants and keeps the spring ones.

**How entrances stay safe if JS fails.** Markup renders visible. A 0.3 KB inline script in
`<head>` (CSP nonce) sets `<html data-motion="on">` before first paint unless
`prefers-reduced-motion` is set. Hidden start states exist only under that attribute and are pure
CSS keyframes with `animation-fill-mode: both`, so once started they finish without any further
JS. No JS: no attribute, everything simply visible. No element is ever server-rendered with
`opacity: 0`.

**Page entrance** (utility `enter`, order set with `--i`): opacity 0 → 1, `translateY` 24 px → 0,
`blur` 8 px → 0, `--dur-enter`, `--ease-rise`. Blur is used only in entrances above the fold;
never on scroll.

**Scroll reveal** (utility `reveal`): opacity 0 → 1, `translateY` 16 px → 0, `--dur-reveal`,
`--ease-rise`, children staggered 60 ms up to five. One shared `IntersectionObserver` (threshold
0.15) adds `data-in` once and stops observing. 0.4 KB. As built: `<RevealObserver>` first marks
everything already in view, then sets `<html data-reveal="on">`, and the hidden state exists only
under that attribute, so an element is never hidden unless the script that will show it is
already running. It does nothing when `data-motion` is absent (reduced motion, no JS).

**A line drawing** (utility `draw-line`, on a path with `pathLength="1"`): `stroke-dashoffset`
1 → 0 over `--dur-draw` on `--ease-line`, ordered with `--i` like `enter`. Only under
`data-motion="on"`.

**Hover:** colour and fill only, plus the 2 px arrow nudge. Nothing scales above 1.0 on hover;
pressed is 0.98.

**App route change:** the existing `page-rise` becomes opacity 0 → 1 and 8 px → 0 over 400 ms,
`--ease-rise`, first three blocks staggered 60 ms.

**Never:** anything looping in the background, parallax, scroll-scrub, scroll-snap, a
`<ViewTransition update>` around lazy islands (the double blink), a hidden island with no
after-`load` guard (`deferred.tsx` keeps its guard).

**Reduced motion:** all of the above become 120 ms opacity fades or nothing; springs already
collapse to 120 ms linear; the Voiceline shows a designed still (§3.6).

**Rules from the project skills** (added 2026-11-17; `.claude/skills/`, from emilkowalski/skills,
at Manu's request). The tokens above stay the vocabulary; these are the rules for using them,
and every phase from 4 on follows them:

- **Gate first.** Before anything moves, name its frequency and purpose. Keyboard-triggered and
  100-a-day actions (the command palette, tab switches, `Y` for "your words", space-to-talk)
  get no animation beyond an instant state change. Delight lives only on rare, first-time
  screens (the landing page, first-run, unlock).
- **UI motion stays under 300 ms**: presses 100–160 ms, toggles and small controls 150–250 ms,
  sheets and dialogs up to 500 ms. Longer is allowed only for explanatory moments (the hero, a
  page's signature moment, a line drawing).
- **Exits are faster than entrances** (an entrance at 250 ms leaves at 150–200 ms) and use
  `--ease-exit` only for leaving; nothing on screen ever uses a plain `ease-in`.
- **Toggles and anything a person can fire twice in a second are CSS transitions**, which
  retarget mid-flight, never keyframes, which restart. Keyframes are for one-shot entrances.
- **Staggers are non-uniform** and one entrance per container. Page heads use delays that
  shrink as the group goes on (eyebrow 0, first line 70 ms, second line 130 ms, paragraph and
  action 180 ms; `--i` values 0, 0.8, 1.45, 2 on the 90 ms `enter` step), never `i × 90 ms`
  past the hero's per-word line. Product lists never stagger.
- **Hover motion is gated** behind `@media (hover: hover) and (pointer: fine)` (Tailwind 4's
  `hover:` already is; hand-written `:hover` in CSS files must be wrapped). Press feedback is
  `:active`, which works on touch.
- **Only `transform`, `opacity` and `clip-path` animate**, plus `stroke-dashoffset` on a line
  and a measured height on the FAQ. Blur only in entrances, never above 8 px.
- **The phone layer** (in `theme.css`, Phase 4): `-webkit-tap-highlight-color: transparent` and
  `-webkit-text-size-adjust: 100%` on `html`; `touch-action: manipulation` on links and buttons;
  `user-select: none` on buttons, chips and tabs only (never on text); inputs 16 px minimum;
  `100dvh` for full-screen app and entry screens, `100svh` for marketing first screens;
  `env(safe-area-inset-*)` on anything fixed to an edge.
- **Self-review before ticking a screen**: run `review-animations`' ten standards over the
  motion it added, and `break-ui`'s catalogue over anything that renders user data (long
  names, unbreakable emails, one item, none).

### 2.11 Focus and accessibility

- Focus ring: 2 px solid `--fg` on dark, `--ink` on paper, offset 3 px, radius following the
  element. On the brass primary button the ring is `--fg` (brass on brass would vanish). Never
  removed; `:focus-visible` only.
- Text fields: border goes to `--text` and the ring shows; no coloured halo.
- Selection: `color-mix(in srgb, var(--accent) 30%, transparent)`.
- `prefers-contrast: more` and `forced-colors`: hairlines go to `--control-edge`, `mark` gains its
  dotted underline (kept), frost becomes solid.
- Skip link kept. Autoplaying motion over 5 s (the hero) has a pause control (WCAG 2.2.2).

### 2.12 Migration of existing utilities (Phase 1 does this in one change)

| Utility                                               | Becomes                                                                                                            |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `plane`                                               | card: `--depth`, `--edge`, `--radius-card`, `--shadow-paper`                                                       |
| `eyebrow`                                             | §2.9 eyebrow (neutral rule)                                                                                        |
| `meta`                                                | `figure`/`label` hybrid as today: Geist Mono 12 / 18, `--text-soft`, tabular                                       |
| `placeholder`                                         | dashed `--edge`, `--radius-card`, `--text-soft` (unchanged in purpose)                                             |
| `lit`                                                 | selected state: `--surface-2` fill, `--text`; no ring                                                              |
| `gloss`                                               | primary-fill hover and press behaviour from §2.9 (no inset highlight)                                              |
| `glass-control`                                       | `frost-flat`                                                                                                       |
| `chrome`                                              | Instrument Serif italic at `--fg-60` (no accent colour)                                                            |
| `grain`                                               | §2.8                                                                                                               |
| `seal-turn`                                           | removed with the rotation; class kept as a no-op until its one caller is rewritten                                 |
| `rounded-control` / `rounded-plane` / `rounded-sheet` | 14 / 24 / 32 px (names kept in `@theme`)                                                                           |
| `font-display`                                        | Geist (headlines); `font-reading` → Source Serif 4; `font-mono` → Geist Mono; new `font-accent` → Instrument Serif |
| `h1 em` rule                                          | italic accent at `--fg-60`, not `--accent`                                                                         |

**New utilities** (`render.css`, Phase 1): `card` and `card-link`, `sheet`, `frost` and
`frost-flat`, `label`, `note`, `figure`, `serif-accent` (the name `chrome` now aliases), `chip`,
`btn-arrow`, `enter`, `reveal`, `draw-line`. New theme names: `font-accent`, `text-ui`,
`text-title`, `text-read`, `text-read-sm`, `text-read-lg`, `text-transcript`,
`text-display-hero` / `-1` / `-2` / `-3` (the Paper names `display-xl` / `-lg` / plain / `-sm`
resolve to the same four), `rounded-card` / `-frame` / `-inset` / `-paper`, `ease-rise` /
`-exit` / `-line`.

**Sliding selection** (`lib/sliding-indicator.ts`): `useSlidingIndicator` measures the selected
item and writes `--ind-x` / `--ind-w` on the group; `SLIDING_RULE` (tabs) and `SLIDING_PILL`
(segmented control) draw one indicator from them and move it with a transform on the `glide`
spring. Before it has measured, each option shows its own static selected state.

**Until a screen's own phase.** Screens not yet redesigned render with the new tokens and
utilities but keep their old composition. Two things are visibly interim: text that was set in
Newsreader italic outside a display line is now a synthesised Geist oblique (each phase replaces
it with the italic accent or removes the emphasis), and the WebGL Voiceprint still draws in the
hero, Studio, first-run and the Dossier voice tab (§9.1; replaced in Phases 2, 4, 5 and 7).

Admin, `/prototype/*` and the email templates only inherit tokens.

### 2.13 `/prototype/system` (built in Phase 1)

A hidden page (never indexed, 404 in production unless `PROTOTYPES_ENABLED=1`) that shows every
token and component. Seven sections, each headed by a flat rule with the one brass peak: colour,
type, material, components, voice, motion, brand. Three fixed panels, **Instrument**
(`data-theme="night"`), **Paper** (`data-theme="day"`) and **Night paper** (`data-theme="night"`
on a `--sheet` fill), carry the colour steps and the same component kit three times; everything
outside the panels follows the Day / Night switch in the header, so the page also shows the
working area both ways. Its signature is the masthead Voiceline: a waveform that goes flat and
rises once into the mark, drawn with `draw-line` after the headline has entered. The kit, the
motion bench and the overlays load behind `next/dynamic` hosts (first load 155.2 KB of 160).
Sample text is a new fictional applicant (a cold-chain coordinator, the night outside Nashik) at
the fictional Northfield.

---

## 3. The landing hero (full values; built in Phase 2, 2026-11-14)

Replaced `_hero/hero.tsx`, `hero-stage.tsx`, `hero-experience.tsx`, `hero-voiceprint.tsx`,
`hero-state.ts`, `hero-motion.ts`, `hero-ui.tsx` and `_chrome/nav-compact.tsx`. `hero-demo.ts` (the
retired mic demo's Turnstile and token code) had no importer and is deleted (§9.2). The hero is
now four files:

| File                       | What it is                                                                                   | Ships                           |
| -------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------- |
| `_hero/hero.tsx`           | server markup: copy, the poster (all three applicants, two hidden), the strip                | HTML only                       |
| `_hero/voiceline-shape.ts` | the line's maths, shared by the poster path and the canvas                                   | with the loop                   |
| `_hero/hero-loop-gate.tsx` | the only first-load code: waits for `load`, idle and the hero in view, then imports the loop | first load, a few hundred bytes |
| `_hero/hero-loop.ts`       | the loop: plain DOM, canvas and the Web Animations API. No React, no Motion                  | lazy, 3.1 KB gz                 |

`line-cleanup.ts` and the "Write your own line" copy (`_copy/write-line.ts`) wait for scene 5 in
Phase 3; until then the toy is not on the page (it lived in `hero-experience.tsx`, last in commit
`98dfc25`).

### 3.1 Composition

A dark scene, `--bg` with grain. One horizontal line crosses the whole hero: **the horizon**, the
bottom edge of the hero's main block, with the facts strip hanging under it. It is the Voiceline.
Under the headline it lies flat and neutral; across the stage it is alive and brass. Voice enters
at the bottom right, becomes a sentence just above the line, and above the sentence are three
essay sheets built from it. The eye reads the right side bottom to top, the way something is
distilled, then lands back on the headline and the button.

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ( ⌃ AdmitStories            How it works  Pricing  Sign in  [Start your story →] ) │  nav, frost
│                                                                            │
│  ── MBA APPLICATIONS · IN YOUR OWN WORDS            ┌──────┬──────┬──────┬───────┐ │
│                                                     │ WHY  │SHORT │A TIME│ FIRST │ │  three sheets,
│  Tell it once.                                      │ note │ note │ note │ DRAFT │ │  fanned: three
│  Tell it well.                                      │      │      │      │ essay │ │  margins, then
│                                                     │ n/250│ n/100│ n/200│ text… │ │  the top essay
│  AdmitStories listens to your life story once…      └──────┴──────┴──────┴───────┘ │
│  [ Start your story → ]  ( See how it works )       SPOKEN · HOSPITAL SYSTEMS ANALYST│
│  ◌ The AdmitStories model · trained on …            “It was 2 a.m. and the feed…”   │  sentence, italic
│ ───────────────────────────────────────────────────╱╲╱‾╲╱╲__╱‾‾╲╱╲╱╲╱‾╲╱── │  the horizon
│  01 You talk.      02 It drafts.      03 You see why.      SAMPLE… FICTIONAL ❙❙ │  facts strip
└────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Layout values

| Element      | `lg`+ (1440 × 900 shown)                                                                                                                 | base (390 × 844)                                                                                                  | `sm` 640–1023                             |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Hero         | `min-height: clamp(832px, 100svh, 1000px)`; a column: main block (flex 1), then the strip                                                | height from content (1,414 px at 390)                                                                             | same as base                              |
| Nav          | fixed, top 16 px, inset 48 px (the grid's margins, max 1344 px), height 56 px, pill                                                      | top 12 px, inset 12 px, height 52 px                                                                              | inset 32 px                               |
| Copy column  | grid columns 1–7 (774 px), `padding-top: clamp(140px, 19svh, 190px)`, `padding-bottom: 56px`                                             | full width, the grid's 16 px gutters, `padding-top: 108px`                                                        | columns 1–8                               |
| H1           | 24 px under the eyebrow; two lines                                                                                                       | two lines, same breaks                                                                                            |                                           |
| Subline      | 28 px under the H1, max-width 460 px                                                                                                     | 20 px under, full width                                                                                           | max-width 520 px                          |
| Actions      | 36 px under the subline, row, gap 12 px                                                                                                  | 28 px under, stacked, full width, gap 12 px                                                                       | row                                       |
| Model credit | 32 px under the actions, 44 px tall link                                                                                                 | 24 px under                                                                                                       |                                           |
| Stage        | columns 8–12 (546 px at 1440), bottom-aligned on the horizon, `padding-top: 104px`                                                       | below the credit, 56 px gap, full width                                                                           | below the copy, max-width 560 px, centred |
| Horizon      | the bottom edge of the main block, full bleed; the line's box is 96 px tall, centred on it                                               | the same edge: the stage's bottom                                                                                 | same as base                              |
| Facts strip  | 128 px tall, `padding-top: 40px`; four equal columns (each = 3 grid columns): three facts, then the sample note and pause, right-aligned | under the horizon: the sample note and pause on one row, then the facts stacked 20 px apart; 48 px bottom padding | sample note row, then three columns       |

Under 832 px of height at `lg` the strip falls below the fold rather than the hero shrinking its
type. The phone's first screen holds the headline, both actions, the credit and the top 200 px of
the fan; the sentence and the line are one short scroll down.

**The stage is a container** (`container: hero-stage / inline-size`) and everything in it is set
in `--u`, one pixel of the design it was drawn at, so the fan and the sentence scale as one piece
with the column. Two designs:

|                                  | Full (stage ≥ 460 px; `--u: 100cqw / 546`) | Small (stage < 460 px; `--u: 100cqw / 350`) |
| -------------------------------- | ------------------------------------------ | ------------------------------------------- |
| Sheet                            | 272 × 344                                  | 190 × 262                                   |
| Step between sheets              | 120                                        | 82                                          |
| Sheet margin (the note's column) | 108, padding 8                             | 76, padding 5                               |
| Body padding                     | 14                                         | 10                                          |
| Essay text                       | 12.5 / 1.6, 10 lines at most               | 10.5 / 1.6, 9 lines at most                 |
| Note                             | 10.5 / 1.43 mono                           | 9.5 / 1.43 mono                             |
| Title, kicker, count             | 9 mono caps, tracking 0.06em               | 8.5 mono caps, tracking 0.08em              |
| Sentence                         | 34 / 1.2                                   | 24 / 1.2                                    |

At 1440 the stage is 546 px and `--u` is 1 px. At 1280 it is 479 px (full design at 0.88); at
1024, 373 px (small design at 1.07); at 390, 358 px (small design at 1.02).

### 3.3 Elements

| Element      | Type                                                                                                           | Colour                                       | Notes                                                                                                                                                                                            |
| ------------ | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Nav pill     | `frost` look on an 88 % wash of `--bg` (72 % until Phase 3: over paper it read as a grey pill), blur 16 px     | always the instrument (`data-theme="night"`) | the wash is what lets one pill read over the dark hero and over a paper scene alike; solid `--frost-solid` without backdrop-filter or under reduced transparency                                 |
| Wordmark     | §2.9, 18 px                                                                                                    | `--fg`                                       | links to `/`                                                                                                                                                                                     |
| Nav links    | `ui` 14 / 20, 500                                                                                              | `--fg-80`, hover `--fg` 200 ms               | "How it works", "Pricing", "Sign in"; `lg`+ only                                                                                                                                                 |
| Nav CTA      | `lg`+: button `md` primary, 40 px tall, 28 px arrow circle. Below: button `sm`, no arrow (hidden under 340 px) | brass                                        | "Start your story" (`START_STORY` in `_copy/shared.ts`) → `/sign-in`                                                                                                                             |
| Menu button  | 40 px round, `frost-flat`, 44 px hit area; two hairlines, the lower 62.5 % as long                             | `--fg`                                       | below `lg`; opens the phone menu                                                                                                                                                                 |
| Eyebrow      | `eyebrow`                                                                                                      | `--fg-60`                                    | "MBA applications · in your own words"                                                                                                                                                           |
| H1           | `display-hero`                                                                                                 | `--fg`                                       | lines `["Tell it once.", "Tell it well."]`; "well." in Instrument Serif italic at `--fg-60`. Server-rendered, one inline-block per word so each can rise in turn                                 |
| Subline      | `body-lg` 17 / 1.55                                                                                            | `--fg-80`                                    | "AdmitStories listens to your life story once, then drafts each school's essays from it, shows its reasoning, and marks which words are yours."                                                  |
| Primary      | button `lg` primary with arrow                                                                                 | brass                                        | "Start your story" → `/sign-in`                                                                                                                                                                  |
| Secondary    | button `lg` secondary                                                                                          | frost-flat                                   | "See how it works" → `#follow` today; Phase 3 builds scene 3 with the id `how` and changes `HOW_HREF` in `hero.tsx`                                                                              |
| Model credit | `ui-sm` 13 / 18                                                                                                | name `--fg-80`, rest `--fg-64`               | `ModelSealMark` 28 px + `MODEL_NAME` · "trained on " + `TRAINED_ON`; links to `#the-model`                                                                                                       |
| Facts        | index in `label`; text `ui` 14 / 20, max-width 272 px                                                          | lead `--fg` 500, rest `--fg-64`              | "01 You talk. By voice or by typing, one question at a time." · "02 It drafts. Every essay, one school at a time." · "03 You see why. Each draft shows its reasoning and which words are yours." |
| Sample note  | `label`                                                                                                        | `--fg-60`                                    | "Sample applicants · fictional, as is Northfield"                                                                                                                                                |
| Pause        | button `sm` icon, secondary (36 px, 44 px hit area)                                                            | `--fg`                                       | "Pause the sample" / "Play the sample"; server-rendered `hidden`, shown by the loop when it starts, so it is absent under reduced motion and without JS                                          |

**Phone menu.** The native `<dialog>` sheet (`menu-dialog.tsx`): `--bg` with grain, 24 px top
radius, `calc(100dvh - 24px)` tall, a "Menu" `label` and a 40 px round close button, the three
links in `display-3` on hairlines (72 px rows), and the primary button full width at the bottom
above `max(24px, env(safe-area-inset-bottom))`. It rises on the `glide` spring and fades under
reduced motion.

Copy lives in `_copy/hero.ts`. Headline reasoning: "Your story, admitted." promises an outcome,
which the product refuses to do (`INTEGRITY_LINES`), so it is out. "Tell it once. Tell it well."
is the product's actual mechanism in six words and sets in two equal lines at any width.

### 3.4 The stage

All of it is decorative (`aria-hidden`), with one visually hidden sentence describing it:
"A sample: a sentence a fictional applicant said becomes the opening of three Northfield essays,
each with a note on why."

**The Voiceline.** A `<canvas>` across the full hero width, 96 px tall, centred on the horizon,
`devicePixelRatio` capped at 2. Until the loop starts it is an inline SVG path of the same frame.

- Stroke 1.25 px, round joins. Colour is a horizontal gradient: `--line-strong` (20 %; `--line`
  at 12 % was too faint to read as the horizon) to `--accent`.
- Shape at x (0–1 across the width), for a width of W pixels, at time t:
  `y = A · E(x) · [0.55·sin(2π(xW/140 − 0.6t)) + 0.30·sin(2π(xW/52 + 1.1t) + 1.7) + 0.15·n(xW/18 + 2.4t)]`
  where `n` is 1-D value noise and `E(x) = smoothstep(rise₀, rise₁, x) · (1 − smoothstep(0.965, 1, x))`.
- Two forms (`voiceline-shape.ts`):

  |                        | `lg`+       | below `lg`  |
  | ---------------------- | ----------- | ----------- |
  | rise (flat → full)     | 0.50 → 0.70 | 0.04 → 0.20 |
  | tint (neutral → brass) | 0.50 → 0.68 | 0.02 → 0.22 |
  | peak height            | 34 px       | 22 px       |
  | poster drawn for W =   | 1440        | 390         |

- `A` is the speaking level, 0–1: `syntheticSignalAt()` (in `@admitstory/ui`) over the sentence's
  word timings, times 1.3 and capped at 1, followed with a time constant of 60 ms rising, 110 ms
  falling between words and 150 ms settling to flat.
- One segment every 4 px of the live part (48 to 260 segments). One `beginPath`, one `stroke`.
  Nothing else is drawn. A flat line is drawn once and not again.
- **The poster** is the frame at t = 1.7 s, level 0.86, drawn for the form's own W and stretched
  to the hero (`preserveAspectRatio="none"`, `vector-effect: non-scaling-stroke`). The canvas
  draws that same frame first, so the hand-over cannot be seen, and uses the real width from the
  first live sentence on.

**The sentence.** Instrument Serif italic, 34 px (full design) or 24 px (small), line-height 1.2,
`--fg`, balanced, in curly quotation marks with the opening mark hung in the margin. Above it a
`label`: "Spoken · " and the speaker's role ("Hospital systems analyst", "Fintech product
manager", "Family packaging business"). Its last baseline sits about 52 px above the horizon
(`padding-bottom: 40px`). The three applicants' sentences share one grid cell, so the tallest
reserves the height and nothing shifts. Words that have not been said are at opacity 0 in place.

**The sheets.** Three sheets of paper (`data-theme="day"`), `--radius-paper`.

- A hand of cards: sheet 1 left and lowest, sheet 3 right and on top. From the stage centre
  (x, y, rotation): (−step, +10, −5°), (0, 0, 0°), (+step, +12, +5°), bottoms 28 design px above
  the sentence block.
- **A sheet's margin is almost as wide as the step**, so what shows of the two sheets beneath is
  their margins: three notes in a row, then the top sheet's essay. (The first build used 76 px
  margins on 248 px sheets; the gaps then showed cut-off slivers of essay text.)
- Margin column, top to bottom: the essay's title in mono caps (`--ink`), the note (`note` type,
  `--brass-ink`), and at the foot the count against the limit on two lines ("187 / 200", "WORDS").
- Body column: a kicker "FIRST DRAFT", then the essay's opening in the reading serif, clamped to
  10 (9) lines, with the applicant's sentence marked as `verbatim` (§2.3): a 15 % brass-ink fill
  and a 1.25 px brass-ink underline. On sheets 1 and 2 the text starts 36 px in, clear of the
  wedge the fan leaves open.
- Sheets 1 and 2 sit a tone back (`--paper` mixed 9 % and 5 % with `--bg`), so the top sheet is
  the subject. Each casts paper's one contact shadow onto the sheet beneath (it is lost on the
  dark): `-16px 8px 32px -12px rgb(11 10 9 / .55)` plus a 1 px edge at 6 % ink.
- **The slots.** Behind the sheets, in the same three positions, are three empty pages drawn in
  hairline (`--line` border and margin rule on `--bg`). They are hidden while the paper is down;
  while an applicant is speaking they are the three pages waiting to be written, so the stage is
  never empty.
- The reading serif's roman is preloaded on this page (+19.7 KB) because the sheets are on screen
  at first paint.

**The three samples** (existing fictional applicants; `_copy/hero.ts`, `HERO_SAMPLES`). The third
sheet, "A time you led", is the one on top and carries the sentence:

| #   | Applicant (source)                                       | Sentence                                                                            | Notes: Why Northfield · Short-term goal · A time you led                                                                                                                                                                          |
| --- | -------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Night-shift hospital systems analyst (`_data/sample.ts`) | "It was 2 a.m. and the feed from the lab system was dropping every fourth message." | "Opens on the ward at 2 a.m. The school asks about ownership, so it comes first." · "The goal grows out of that night: teams that never need the call." · "No title in this story. Kept: the phone list and the terrible coffee." |
| 2   | Fintech product manager (`_data/sample-words.ts`, L115)  | "Not one of them was angry. They had simply forgotten it was there."                | "Starts with the feature you shut down. Candour is what this prompt rewards." · "The goal follows from the calls: products people come back to." · "Leading, here, is ending your own work. The week of calls is the proof."      |
| 3   | Family packaging business (`_sections/app-preview.tsx`)  | "My father ran the plant from a notebook, and the notebook was always right."       | "Begins with the notebook, not the job title. It shows what you came to learn." · "The goal is the next problem: a plant that runs without one memory." · "Your line opens it. The year of “homework” is where you lead."         |

No word in a note is longer than ten characters: the margin holds about ten at the small size.
(The brief's example says 3 a.m.; the sample says 2 a.m., and the sample wins.)

### 3.5 Motion

**Entrance** (CSS, under `data-motion="on"`; each step is the §2.10 `enter`, its delay set as
`--i: ms / 90`):

| Step | Element                             | Delay                                                     | Ends |
| ---- | ----------------------------------- | --------------------------------------------------------- | ---- |
| 1    | nav                                 | 0 ms                                                      | 800  |
| 2    | eyebrow                             | 60 ms                                                     | 860  |
| 3    | H1, per word (6 words), 90 ms apart | 120, 210, 300, 390, 480, 570 ms                           | 1370 |
| 4    | subline                             | 520 ms                                                    | 1320 |
| 5    | actions, then model credit          | 640, 700 ms                                               | 1500 |
|      | stage, line, strip                  | not animated in: they are simply there (the poster frame) |      |

**The poster.** The server renders the stage complete and still: sample 1's sentence, its three
sheets fanned with their notes, and the Voiceline frozen mid-sentence. That is the first thing
anyone sees, with or without JS, and it is the screenshot.

**The loop.** `hero-loop-gate.tsx` waits for `load`, then idle, then the hero intersecting, and
imports `hero-loop.ts`, which takes the poster's own elements over. All three applicants are in
the HTML (two with `data-off`, `visibility: hidden`), so the loop carries no copy. One pass:

| t (s) | What happens                             | Values                                                                                                                                                                                                             |
| ----- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0.0   | hold                                     | 2.4 s on the poster the first time, 3.0 s afterwards                                                                                                                                                               |
| 2.4   | sheets leave                             | each: opacity 1 → 0, y 0 → −12, 500 ms `--ease-exit`, 60 ms apart; sentence opacity → 0 over 400 ms; the line settles flat. The slots are left showing                                                             |
| 3.4   | rest                                     | 400 ms of a flat line and three empty pages; the next applicant's elements are swapped in, hidden                                                                                                                  |
| 3.8   | the next applicant speaks                | the "Spoken ·" label fades in (300 ms); each word at its timing (`estimateWordTimings`, 215 wpm, about 250 ms a word): opacity 0 → 1, y 10 px → 0, blur 6 px → 0, 420 ms `--ease-rise`; the line follows the voice |
| ≈ 7.1 | last word lands; the line settles        | 900 ms                                                                                                                                                                                                             |
| ≈ 8.0 | three sheets rise into their slots       | each: y +60 → 0, opacity 0 → 1, rotation 0 → rest, scale 0.96 → 1, `drift` spring (680 ms), 120 ms apart. **The sentence stays** and dims to 64 % over 600 ms `--ease-line`: it rests on the line under its essays |
| ≈ 9.0 | the spoken sentence is marked on sheet 3 | fill and underline draw left to right, `background-size` 0 → 100 %, 500 ms `--ease-line`                                                                                                                           |
| ≈ 9.2 | margin notes appear                      | opacity 0 → 1, 300 ms, 150 ms apart, left to right                                                                                                                                                                 |
| ≈ 9.8 | hold                                     | 3.0 s, then back to "sheets leave"                                                                                                                                                                                 |

One pass is 11 to 12 s depending on the sentence. Words, sheets and notes are DOM, moved with the
Web Animations API on `opacity`, `translate`, `rotate`, `scale`, `transform` and (words only)
`filter`; each animation runs _from_ a start state _to_ the element's own style, so a cancelled
animation leaves the element at rest. The loop imports no React, no Motion and no GSAP.

(The first spec had the sentence lift 40 px and fade as the sheets rose. Built, that left the
band above the line empty for the whole hold and made the hold look unlike the poster. Staying
and dimming is "the line lies flat once the words are down", §1.1.)

**Stops.** One clock drives the loop and it only advances inside `requestAnimationFrame`.
`IntersectionObserver` (hero under 10 % visible), `visibilitychange` (tab hidden) and the pause
button each cancel the frame loop and pause the running animations. Paused means zero frames,
not an idle loop. Resuming continues from the same instant.

### 3.6 Reduced motion and no JS

The poster frame, exactly, and nothing else. No pause button, no loop, no download of the loop
(the gate returns before importing under `prefers-reduced-motion`, and under Save-Data). It is
composed to stand as a picture: the line rising at the right, the sentence resting on it, the
sheets above.

### 3.7 Budget for the hero, and what was measured (2026-11-14, production build, local)

|                                          | Budget                                            | Measured                                                                                                                                          |
| ---------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| First-load JS for `/`                    | ≤ 152 KB gz (was 153.3 of 155)                    | **151.9 KB**                                                                                                                                      |
| Lazy loop                                | ≤ 7 KB gz, no Motion, no GSAP, no OGL             | **3.1 KB gz** (6.8 KB raw), none of the three                                                                                                     |
| Canvas frame                             | ≤ 1.5 ms of script, ≤ 4 ms total, phone at 4× CPU | **0.07 ms** in the frame callback on average (1.7 ms worst), **1.9 ms** of main-thread time a frame over a full pass; desktop 0.04 and 1.0 ms     |
| Frames while hidden, offscreen or paused | 0                                                 | **0** in all three (on laptops the old "follow" section's GSAP ticker still runs its own frames until Phase 3 removes it)                         |
| CLS                                      | 0                                                 | **0** on the phone, 0.0001 on desktop, over a full pass                                                                                           |
| LCP                                      | < 2.5 s on a mid-range phone                      | Lighthouse mobile, throttling applied for real: **2.28 s**, equal to first paint. Lighthouse's default simulated estimate: **2.87 s** (see below) |
| Fonts preloaded on `/`                   | ≤ 110 KB                                          | **86 KB** (Geist, Geist Mono, Instrument Serif italic, Source Serif 4 roman)                                                                      |

**About LCP.** The H1 is split into one inline-block a word so each can rise, and Chrome scores
each block on its own, so no H1 word is ever the largest element. What Chrome reports as LCP is
static, server-rendered text that paints with the first frame: the sample sentence on laptops
and the top sheet's essay on phones (the subline under reduced motion). So LCP equals first
contentful paint and the entrance costs it nothing, which is the point of the rule, though the
element is not literally the H1. Lighthouse's simulated mode adds about 1.2 s on top of first
paint by assuming everything that had loaded by then was needed; with the throttling actually
applied, the two are the same moment. First paint itself (2.3 s on slow 4G) is mostly the 354 KB
HTML document, nearly all of it the old sections below the hero that Phase 3 replaces.

**Measured again after Phase 3 (2026-11-17), and the paragraph above no longer holds.** With the
throttling applied, first paint is at 2.4 s and Chrome reports LCP at 3.4 s. It records two
candidates: the top sheet's text at first paint, then the subline, which is larger and fades in
about a second later as part of the entrance (three runs, the same each time). So the entrance
does cost LCP on a phone, by about a second. First paint did not move when the document shrank
from 354 KB to 246 KB: it is bound by the network, not by the page's size. The hero was left as
built; PROGRESS "Needs Manu" 6 has the two ways to settle it.

**Settled (Manu, 2026-11-17).** The subline is still from the first frame (option B), `/` no
longer preloads Source Serif (the sheets use the root's lazy face, swapping without shift), and
`experimental.inlineCss` puts the CSS in the HTML, so first paint no longer waits on a second round
trip for five stylesheets. Lighthouse mobile, throttling applied, three runs: **FCP 1.14 s, LCP
1.65 s** (was 2.41 and 3.81), performance 0.97. LCP is now a headline word as it rises, well under
the 2.5 s target. Fonts preloaded on `/`: 66.5 KB. The document is 55–68 KB over Brotli.

---

## 4. Marketing: the landing scenes (full values; built in Phase 3, 2026-11-16)

Dark-only. `marketingTheme()` returns Night for every preference, the footer's theme switch is
gone (the app keeps its own) and `themeColor` is the Night colour. The page is one dark field
(`--bg` with the grain tile, painted once on the marketing wrapper) that turns to paper for
scene 5 only. Order: hero, 2 schools, 3 how it works, 4 school by school, 5 essays (paper), 6 the
model, 7 Connect, 8 what it won't do, 9 interview practice, 10 pricing, 11 questions, 12 final
call, 13 footer.

**Shared values**

| Thing            | Value                                                                                                                                                                                                                             |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scene padding    | 80 px base, 112 px `sm`, 160 px `lg`, top and bottom (`Section`, `spacing="default"`); the strip and scene 9 set their own                                                                                                        |
| Grid             | `SECTION_GRID`: 4 / 8 / 12 columns, 16 / 32 / 48 px margins, 16 / 24 / 24 px gutters, 1440 px cap                                                                                                                                 |
| Scene head       | `eyebrow` (mono 11 px, +0.18em, `--fg-60`, behind a 24 px rule); 24 px; `h2` in `display-1` (36 → 72 px, 450, 1.0, −0.04em, `--fg`), broken by hand, its last 1–3 words in the italic accent at `--fg-60`                         |
| Scene paragraph  | `body-lg` (16 → 17 px / 1.55), `--fg-64`, at most 440 px wide, 24 px under the heading or in the right-hand columns on the heading's last baseline                                                                                |
| Head to content  | 56 px base, 96 px `lg`                                                                                                                                                                                                            |
| Reveal           | the `reveal` utility (§2.10): opacity 0 → 1 and 16 px → 0, 600 ms, `--ease-rise`, 60 ms apart by `--i`, once at 15 %. One `RevealObserver`, mounted in `PageTransition` and keyed by the pathname, so a client navigation re-arms |
| Lines that draw  | `scene-draw` on a path with `pathLength="1"` inside a `reveal` block: `stroke-dashoffset` 1 → 0, 900 ms, `--ease-line`, when the block reveals. Still, and fully drawn, without `data-reveal`                                     |
| Hairlines        | 1 px `--line` (12 %); a rule that carries structure (the strip, the horizon) is `--line-strong` (20 %)                                                                                                                            |
| Sheets of paper  | `scene-sheet`: `--paper`, ink text, 3 px radius, Source Serif 4. The hero's `hero-sheet` keeps its own fan geometry; the paper, margin rule, mono note and mark (`sheet-mark`) are the shared classes both use                    |
| Brass            | three element types on this page, as everywhere: a primary action's fill, a live or marking line (the Voiceline in the Studio window, the timer arc, the peak in the final call), and marks on paper (as brass-ink)               |
| Fictional people | every applicant is fictional and says so in a `label` under its scene. Scene 4 introduces a new one (a site engineer on a metro line); scenes 3 and 5 reuse the analyst and the product manager                                   |

### Scene 2 · Schools strip (`_sections/schools-strip.tsx`)

One band between two `--line-strong` hairlines, static: the sideways scroller is gone.

- From 1280 px (`xl`): 96 px tall content box (20 px above and below two 28 px lines). Columns 1–3: two `label`
  lines, "16 schools" and "verified for 2026–27" (the count is `COVERED_SCHOOLS.length`). Columns
  4–12: the sixteen names as two justified rows. The rows are cut by the code so each holds about
  half the characters (6 names, then 10), and each row is `display: flex; justify-content:
space-between`, so both rows run edge to edge like a masthead.
- Names: Geist 20 / 28 px, 450, −0.015em, `--fg-80`. Between names a middle dot in `--fg-40`.
- Below 1280 px: the label on one line, 16 px, then the names as one wrapping run, 17 / 30 px,
  dots between, left-aligned. Band padding 28 px. (Two justified rows need about 880 px of
  names column, so the masthead starts at `xl`, not `lg`.)
- No logos, no motion, no JS. Reveal: none (it is directly under the hero).

### Scene 3 · How it works (`#how`; `_sections/how-scene.tsx`, `how-windows.tsx`, `how-stepper.tsx`)

Folds in the old three-step section, "follow one sentence" (GSAP) and the screens stepper. Four
steps: **Tell → Position → Draft → Refine**. The analyst's sentence ("It was 2 a.m. …") is the
one thing that passes through all four windows.

- Head: eyebrow "How it works"; `h2` "Twenty minutes / to a _first draft._"; paragraph in columns
  9–12 on `lg` with the "See how it works in full" text link to `/how-it-works`.
- **`lg`+, a sticky split.** The steps are four rows of one grid. Text in columns 1–4; the
  product window in columns 6–12 from 1280 px (774 px at 1440) and columns 5–12 below that
  (611 px at 1024), `aspect-ratio: 4 / 3`. Each
  row is as tall as the window plus 96 px, computed in CSS from the grid's own width
  (`--how-row`), so the scene is the same height with or without JavaScript.
  - Without JavaScript each window sits at the top of its own row: four steps, each beside its
    screen. Complete on its own.
  - `how-stepper.tsx` (0.4 KB, the scene's only script) sets `data-live` on the scene. Then all
    four windows share one grid area spanning the four rows and each is `position: sticky`, centred in the
    viewport and never under the nav (`top: max(112px, (100dvh − window height) / 2)`), so they
    lie on top of one another and stay put while the steps scroll. An `IntersectionObserver`
    with `rootMargin: -65% 0 -35% 0` (a line 65 % down the viewport) puts `data-on` on the step
    whose text is crossing it.
  - The swap is stepped, never scrubbed: the window whose step is current goes opacity 0 → 1 and
    `translateY` 8 px → 0 over 250 ms (`--dur-swap`, `--ease-rise`); the one leaving goes to 0
    over 150 ms (`--ease-exit`). Each is a self-contained transition; nothing rests half-way.
    Reduced motion: the same swap as a 120 ms fade.
  - The step text that is not current sits at 40 % opacity (250 ms).
- **Step text.** `label` "01 · Tell" (number and verb); 16 px; title in `display-3` (22 → 32 px,
  500, 1.15); 12 px; `body`, `--fg-64`, at most 360 px; 20 px; a `chip`-height flat pill saying
  what it costs: "Free" on steps 1 and 2, "With a school pack" on 3 and 4 (`label` type in a
  `frost-flat` pill, 28 px tall).
- **The window.** Frame: `--radius-frame` 32 px, 8 px bezel in `--surface-1` with a `--line`
  edge; screen: 24 px radius, `--depth` (`#151412`). Everything inside is set in `em`, and the
  screen's font size is `100cqw / 46` (16.8 px at 774, 11.5 px at 531), so the whole window
  scales as one piece. Below `lg` the window is as wide as the column, its font size is
  `100cqw / 25` (13.7 px at 342) and its height is its content's: the same markup, recomposed in
  one column. The windows are live markup built from the system, `inert` and hidden from
  assistive technology behind a caption that says what each shows.
  1. **Tell: Story Studio.** Chapter tabs as `label` text ("Early life", "Work" current,
     "Turning points"); a Speak / Write control, Speak current. The question in Geist 1.375em /
     1.2, 500, the last clause at `--fg-48`. The answer in Instrument Serif italic 1.625em / 1.2,
     `--fg-80`. The two sit midway between the bar and the line. A static Voiceline across the full width in brass (1.25 px, the hero's maths, frozen)
     with the record button on it: 4.5em, brass fill, mic glyph in `--on-brass`. Under it
     "Listening · hold space" in `label`.
  2. **Position: the positioning for one school.** `label` "Northfield · positioning". Three
     positioning lines in Geist 1.25em / 1.3, 450, on hairlines, numbered in mono. Beside them
     (under them on phones) "Which story goes where": the pack's files, each with the story that
     feeds it, in 0.875em, joined by a hairline. Along the foot, on hairlines: what the positioning
     "lands" and what "a reader may doubt", one line each.
  3. **Draft: an essay sheet.** A `scene-sheet` on the dark screen, inset 1.5em: a left margin
     (11em) with the essay's title in mono capitals, one brass-ink margin note and the count
     "199 / 200 words"; the body in Source Serif 1.0625em / 1.6 with the applicant's own sentence
     marked.
  4. **Refine: a revision.** The same sheet, one request above it in a `frost-flat` pill ("Cut
     twelve words from paragraph two. I need room for the ending."), the changed sentence shown as a diff (the removed
     words struck through at `--ink-50`, the kept words in ink), the count going "199 → 187 /
     200", and two controls drawn as pills: "Keep" (ink) and "Undo".
- Under the scene: `label` "A sample applicant · fictional, as is Northfield".
- Phone: no pin; each step is followed by its window, 40 px apart, 72 px between steps. Each
  step reveals.

### Scene 4 · School by school (`_sections/school-by-school.tsx`)

One story, three real schools, three readings. A new fictional applicant: a site engineer on a
metro line. The schools are Wharton, Tuck and HEC Paris, and what each "asks" is taken from the
essay prompt in its published pack (`knowledge/schools/*/2026-27`): adding value to the
community, supporting another person when it was not easy, and leadership and ethics.

- Head: eyebrow "School by school"; `h2` "One story. / _Three schools._" in columns 1–6.
- Columns 8–12 on `lg` (under the heading below): what she said, once. `label` "Spoken once ·
  site engineer, metro line", then her three sentences in `transcript` type (Instrument Serif
  italic 24 → 28 px / 1.25, `--fg-80`).
- Then three columns (one below `lg`), 24 px gutters, each:
  - the school's name in Geist 24 / 28 px, 450; under it `label`, the essay it is ("The
    community essay");
  - one line, `body`, `--fg-64`, min-height three lines: what that prompt asks;
  - a `scene-sheet`, full column width: a 104 px left margin (title "First draft", one margin
    note in `note` type, brass-ink) and the essay's opening in `read-sm` (15 px / 1.6). In each
    sheet a different one of her three sentences is marked as hers, and the opening is built
    around it. Sheets are 3 px radius, `--paper`, no shadow on dark.
- Under the row: `label` "A sample applicant, fictional · each school's prompt as published for
  2026–27". No logos; names are type.
- Reveal: head, the spoken lines, then the three columns 60 ms apart.

### Scene 5 · Essays that show their thinking (`_sections/essay-scene.tsx`, `essay-toy.tsx`)

The page turns to paper. The scene is a Day island: a full-bleed desk (`--desk`, `#ECE9E2`) with
32 px corners top and bottom, rising out of the dark, and one large sheet on it. Ink primary
button; brass-ink notes. The nav above it stays dark (§3.3).

- Head: eyebrow "On paper" (ink at 66 %); `h2` "Essays that show / _their thinking._" in ink,
  the accent at `--ink-66`; paragraph in columns 9–12.
- **The sheet** (columns 1–9 on `lg`, 1002 px): `--paper`, `--shadow-paper`, 3 px radius. Inside,
  two columns divided by a `--rule` hairline: the essay (padding 56 px, text column at most 68ch)
  and a 232 px right margin for notes. Sheet head: "Essay 1 · Northfield" in mono capitals and
  "What matters most to you, and why?" in Source Serif italic 17 px. Essay: the product
  manager's four paragraphs (`_data/sample-words.ts`) in `read` (17 → 19 px / 1.65). Three
  reasoning notes in `note` type (11.5 / 18 px, brass-ink), each at the top of the paragraph it
  explains, each led by a 16 px brass-ink rule. Below `lg` the margin folds away and each note
  sits under its paragraph, indented behind a 1 px rule.
- **The controls** (columns 10–12 from 1280 px, sticky at 112 px; above the sheet below that,
  with "Write your own line" under the sheet):
  - "Your words": a switch (44 px target, 40 × 24 px track, ink when on) labelled "Show which
    words are yours", with a `Y` key hint; `Y` works while focus is inside the scene. On, every
    sentence takes its mark (§2.3): word for word, a brass-ink wash and a solid 1.25 px
    underline; lightly edited, a 60 % wash and a dotted underline; written to connect them,
    plain. The marks sweep in left to right (`background-size` 0 → 100 %, 400 ms, `--ease-line`,
    40 ms apart). A three-row legend under the switch names the kinds. Pointing at or focusing
    a marked sentence shows when it was said in a line under the legend.
  - "Write your own line" (the client-only toy, back from the old hero): one paper text field
    (48 px, 16 px type), "Place it in an essay" (ink primary). The line is cleaned
    (`line-cleanup.ts`) and set as the first sentence of the essay, marked as word for word;
    the caption and "Sign up and keep this line" (→ `/sign-in?from=line`, the line kept in this
    browser only) and "Try another line" follow. Nothing typed leaves the browser.
- Under the sheet: the fictional note in `label`, ink at 66 %.
- The sheet and its controls are one small client component (`essay-toy.tsx`; with the stepper it is the page's own 5.1 KB gz chunk),
  rendered on the server like any other and hydrated with the page. Not a lazy island: an
  island's markup arrives late and never shows without JavaScript. The server's render has the
  switch off, which reads as a finished page on its own.

### Scene 6 · The model (`#the-model`; `_sections/the-model.tsx`)

An instrument panel, not a badge wall. Every word from `lib/model-claims.ts`.

- Columns 1–4: the dial seal, 240 px (200 px on phones); 40 px; eyebrow (`MODEL_COPY.eyebrow`);
  `h2` in `display-2` (28 → 48 px): `MODEL_COPY.headingLines`, the last line in the accent; 20 px;
  the paragraph, `body`, `--fg-64`. This column is sticky at 112 px on `lg`.
- Columns 6–12: the ledger (`MODEL_CORPUS`) as rows on hairlines. Each row: the figure in Geist
  Mono 40 px (28 px on phones), tabular, `--fg`, in a 144 px column (88 px on phones); the title
  in `title` (18 → 20 px, 500); the line in `body`, `--fg-64`, at most 520 px. Row padding 28 px.
  The hairline above each row draws left to right as the ledger reveals (`scaleX` 0 → 1, 600 ms,
  `--ease-line`, 80 ms apart).
- After the last row, 40 px: `MODEL_COPY.yoursLine` in Instrument Serif italic 24 → 28 px / 1.25,
  `--fg-80`, at most 560 px.

### Scene 7 · Connect (`#connect`; `_sections/connect-people.tsx`)

- Columns 1–5: eyebrow; `h2` (`CONNECT_COPY.headingLines`, accent on the last line); paragraph;
  then the three kinds of people as rows on hairlines (`label` in a 96 px column, the line in
  `body`); the text link to `/pricing`.
- Columns 7–12: a static 3 × 2 grid of six of the illustrative portraits (2 × 3 on phones),
  16 px gutters, 4 : 5, 24 px radius, `grayscale(1) brightness(.9)` at rest. Under each, its role
  in `label`. Roles only: no names, no schools. The marquee is gone.
- Directly under the grid: `label` "Illustrative portraits", then `ILLUSTRATIVE_NOTE`, `ui-sm`,
  `--fg-64`.
- `SocialProofSlot` follows this scene (§4.1) and renders nothing.

### Scene 8 · What it won't do (`#wont-do`; `_sections/wont-do.tsx`)

Short and sharp. The five `INTEGRITY_LINES`, each split at its first full stop.

- Head: eyebrow "Trust"; `h2` "What it / _won't do._".
- A numbered list on hairlines, row padding 28 px (`lg` 36 px). Each row on `lg`: the number in
  `label` (column 1); the first sentence in Geist 28 / 1.25, 450, −0.02em, `--fg` (columns 2–8);
  the rest of the line in `body`, `--fg-64` (columns 9–12). Below `lg`: 20 px for the first
  sentence, the rest under it.
- The AI-policy table has left this page; a text link, "See all schools' AI policies", goes to
  `/how-it-works#ai-policies`.

### Scene 9 · Interview practice, coming soon (`_sections/interview-soon.tsx`)

A half-height scene (padding 64 / 96 px), between hairlines, honest first.

- Columns 1–5: a `chip`-style pill in `label` type, "Coming soon"; `h2` in `display-2`,
  "Interview practice, / _from the same story._"; `INTERVIEW_COMING_SOON_LINE` verbatim in
  `body-lg`, `--fg-80`.
- Columns 7–12: one still of the room in a product frame (32 px radius, 8 px bezel), with a
  pill on its top edge: "Preview · not available yet". Inside, set in `em` like the windows of
  scene 3: `label` "Follow-up · from your essay"; the question in Geist 1.5em, 500; a timer
  ring, 7.5em across: a `--line` circle with 35 % of it (0:42 of 2:00) drawn in brass 1.5 px
  from twelve o'clock, "0:42" in mono inside; four lines of an answer in Instrument Serif italic
  1.25em, the last line at `--fg`, the earlier ones at `--fg-48`.
- The arc draws to its place when the scene reveals (900 ms, `--ease-line`).

### Scene 10 · Pricing (`#pricing`; `_sections/pricing.tsx`)

- Head: eyebrow `PACK_PITCH.eyebrow`; the two-line contrast as `h2` in `display-2`
  (`PACK_PITCH.others`, then `PACK_PITCH.ours`; the first line at `--fg-60`, the second at
  `--fg`: here the quiet line is the competitor's and the full-strength one is ours).
- **Four columns on one baseline** (`lg`): Free · 1 school · **5 schools** · 10 schools, from
  `FREE_PLAN` and `PLAN_CARDS`, never typed. Each: the name in `label`; 20 px; the price in Geist
  56 px (40 px below `lg`), 450, tabular, −0.04em (`price-figure`; set in mono the four prices
  read as a terminal, not a price list); the struck-through list price beside it in
  mono 18 px, `--fg-48`; 16 px; one line, `ui-sm`, `--fg-64`; then the button at the column's
  foot.
  - The 5-school column is the only filled card (`--surface-2`, `--line-strong` edge, 24 px
    radius, 32 px padding), 16 px taller top and bottom than the row, with "Most chosen" as a
    `label` pill, `PACK_PITCH.detail` under its line and the page's only brass button in this
    scene, "Start your story" with the arrow.
  - The other three are open columns, 32 px padding, a `--line` hairline between neighbours,
    each with a secondary button, "Start free".
  - Phone: 5 schools first, then 1, 10, Free, stacked with hairlines.
- Under the row, two typeset lists on hairlines, `lg` side by side: "Included free"
  (`FREE_FEATURES`) and "In every school kit" (`KIT_FEATURES`), `ui-sm`, `--fg-80`, each item
  behind a 12 px rule; the interview line (`KIT_COMING_SOON`) under the second with its
  "Coming soon" pill.
- Last: `TAX_AND_FINAL_LINE` ("…All sales are final…") in `ui-sm`, `--fg-64`, and the text link
  "See what's in a kit" to `/pricing`.

### Scene 11 · Questions (`#questions`; `_sections/faq.tsx`)

- Columns 1–4: `h2` in `display-1`, "Questions." Columns 6–12: the list as native `<details>`,
  a hairline between rows. Summary: `title` (18 → 20 px, 500), 24 px padding, 44 px minimum, a
  16 px plus on the right whose stem turns 90° on `snap`. Answer: `body`, `--fg-80`, at most
  60ch, 28 px under it. Height glides open where `interpolate-size` exists.
- FAQPage JSON-LD and `faq_open` tracking unchanged.

### Scene 12 · Final call (`_sections/final-call.tsx`)

- Centred: `h2` in `display-1`, "Your story, _told well,_ / for each school."; 40 px; the
  primary button "Start your story" (`lg`, with the arrow), alone. No "Sign in" here: it is in
  the nav above and the footer directly below, and a second action beside the button left the
  peak under neither.
- Under the line, 32 px: the model credit, centred, at most 420 px wide, the small seal above
  its sentence.
- The horizon returns: one full-bleed line (`--line-strong`, 1.25 px) 72 px under the buttons,
  flat, with one brass peak (the mark's rise, 42 px tall) under the button. It draws from the
  left as the scene reveals (900 ms). No Voiceprint, no orb.

### Scene 13 · Footer (`_chrome/site-footer.tsx`)

Dark, above a `--line` hairline. Columns 1–4: the wordmark (18 px) and one line, "Tell it once.
Tell it well." in `ui-sm`, `--fg-64`. Then Product, Trust and Contact: `label` heads; links in
`ui` at `--fg-64`, 44 px rows, `--fg` on hover. Last row, on a hairline: the copyright and the
affiliation disclaimer, `ui-sm`, `--fg-60`. No theme switch. `LEGAL_ENTITY` is still a TODO in
the code (§9.6); until it is set the line reads "© 2026 AdmitStories." and no placeholder shows.

### 4.1 `SocialProofSlot`

`components/social-proof-slot.tsx`: takes `items` from a single data file that ships empty, and
returns `null` when there are none. No wrapper, no heading, no spacing when empty. It is placed
after Connect on `/` and above the plans on `/pricing`, with a comment at each call site.
`placeholder-copy.test.ts` keeps guarding it.

### 4.2 Other marketing pages (full values; built in Phase 4, 2026-11-17, and written to the values as built)

Four pages, two materials. `/how-it-works` and `/pricing` are the instrument: dark, built from
the landing page's own parts (`SceneHead`, the product windows, `scene-sheet`, `soon-pill`, the
plan row). `/privacy` and `/terms` are paper: the whole page is a sheet, for reading.

**Shared values**

| Thing            | Value                                                                                                                                                                                                                                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Page head        | `PageHead` (`_ui/page-head.tsx`): `eyebrow`; 24 px; `h1` in `display-1` (36 → 72 px, 450, 1.0, −0.04em), broken by hand, last line in the italic accent; paragraph in `body-lg`, `--fg-64`, at most 440 px, in columns 9–12 on the heading's last baseline from `lg`, 24 px under it below. Padding 56 px above (96 `lg`), below set by the page |
| Head entrance    | the `enter` utility (§2.10): eyebrow `--i: 0`, heading lines `--i: 0.8, 1.45`, paragraph and action `--i: 2` (0, 70, 130, 180 ms: shrinking gaps, the skills' non-uniform stagger). Opacity 0 → 1, 24 px → 0, blur 8 px → 0, 800 ms, `--ease-rise`; done by 1.0 s. Visible without JavaScript                                                    |
| Everything below | `reveal` (600 ms, 16 px, once at 15 %), as on the landing page. One moment per page (§7); nothing else moves                                                                                                                                                                                                                                     |
| Closing          | `/how-it-works` and `/pricing` end on the landing page's final call (`FinalCall`): the horizon and its one peak                                                                                                                                                                                                                                  |
| Titles           | `HOME_TITLE` is "AdmitStories: tell it once, tell it well". The rest keep the `%s \| AdmitStories` template: "How it works", "Pricing", "Privacy", "Terms"                                                                                                                                                                                       |

#### `/how-it-works` (`how-it-works/page.tsx`, `_stages.tsx`, `_assembly.tsx`)

The landing page tells it in four steps; this page tells the same four in full. The old page's
eight numbered steps are kept, two to a stage, so nothing it promised is lost.

- **Head.** Eyebrow "How it works, in full"; `h1` "From one conversation / _to every school._";
  paragraph: four stages, the first two free. Padding below 48 px (`lg` 72 px).
- **The index** (directly under the head): one band between `--line-strong` hairlines, four
  equal columns from `lg` (two below, hairlines between). Each is a link to its stage: the
  number and verb in `label` ("01 · Tell"), then what it costs in `ui-sm`, `--fg-80` ("Free ·
  20 to 90 minutes"; "Free"; the single-school price from `_data/pricing.ts` "or less in a
  pack"; "In your kit"). 20 px padding, 44 px minimum. Hover: the verb goes to `--fg`.
- **Four stages** (`#tell`, `#position`, `#draft`, `#refine`), each a band with 96 px above and
  below (`lg` 144 px) and a `--line` hairline between bands.
  - Columns 1–5: `label` "01 · Tell"; 20 px; `h2` in `display-2` (28 → 48 px, 500, 1.05): the
    landing step's title; 16 px; the stage's cost as a `soon-pill`. 40 px. Then its two detailed
    steps as rows on `--line` hairlines, 24 px padding: heading in `title` (18 → 20 px, 500),
    what it takes right-aligned in `label` ("20–90 min", "Free", "A few minutes", "In your
    kit"), 8 px, body in `body`, `--fg-64`, at most 440 px.
  - Columns 7–12: the stage's product window from the landing page (`HOW_WINDOWS`), static, 4 : 3
    from `lg`, its content's height below. Not pinned: `position: sticky; top: 112px` only within
    its own band, so on a tall band the window keeps the text company and never leaves it.
  - Below `lg`: the text, 32 px, then the window.
- **The pack assembles** (inside stage 3, under its row; the page's moment). A figure across all
  twelve columns, 72 px under the stage's row, between hairlines:
  - Head: `label` "A sample kit · Northfield"; the line "Which story goes where" in `display-3`.
  - From `lg`: three columns. Columns 1–4, the stories: six rows (five stories and the Fact
    Sheet), each the story's name in `title` weight 450 and its context in `label`. Columns
    9–12, the files: eight rows (three essays, the short answer, the goal statement, recommender
    briefs, the form, the résumé), each the name in `title` and its limit in `label`. Rows are
    56 px. Columns 5–8, the threads: one inline SVG, `preserveAspectRatio="none"`,
    `vector-effect: non-scaling-stroke`; one cubic path from each story's row to the file it
    feeds (eight paths), 1.25 px, brass. One story has no thread and carries the label "Held
    back": not every story is used for every school.
  - Motion: each thread is uncovered left to right (`clip-path: inset()` on the path, 900 ms,
    `--ease-line`), 80 ms apart by `--i`, when the figure reveals. Not a dash: on a stretched
    drawing with a non-scaling stroke, `pathLength` dashes break into fragments (seen in Phase 4). A file's name is `--fg-48` until its thread
    arrives, then `--fg` (250 ms, delayed to the thread's end). Without the reveal script:
    drawn, and every name at `--fg`.
  - Below `lg`: no threads. The files as rows on hairlines, each with "From · the story's name"
    in `label` above it; the hairline above each row draws left to right (the ledger's rule,
    600 ms, 80 ms apart).
  - Under it: `label` "A sample applicant · fictional, as is Northfield".
- **Interview practice** (after stage 4): one row between hairlines, 32 px padding: the
  "Coming soon" pill, "Practise the interview." in `title`, and `INTERVIEW_COMING_SOON_LINE`
  verbatim in `body`, `--fg-64`. No still here; the landing page has it.
- **What it won't do**: the landing page's scene 8, reused whole. Its link lands on the table
  directly below.
- **Each school's AI policy** (`#ai-policies`): a paper band, the page's one Day island (32 px
  corners, `--desk`), like scene 5. Head: eyebrow "On the record"; `h2` in `display-2`, "Each
  school's / _AI policy._"; paragraph in columns 9–12. The table sits on one sheet (`--paper`,
  3 px, `--shadow-paper`), 8 px padding around it (`lg` 24 px 40 px): column heads in `label`;
  rows 56 px on `--rule` hairlines; the school in Geist 16 px, 500; the policy in `body`; what
  AdmitStories does in `body`, `--ink-66`; the date checked in Geist Mono 13 px, tabular,
  `--ink-66`; "Policy" as a text link to the school's own page. Below 640 px each school is a
  block: name, policy, mode, then date and link on one line. With no verified rows: the fallback
  sentence on the sheet, no table.
- **Final call**: reused.

#### `/pricing` (`pricing/page.tsx`, `_strike.tsx`, `_kit.tsx`)

- **Head, and the page's moment.** Eyebrow "Pricing"; `h1` in `display-hero` scale capped for a
  subpage, `clamp(44px, 8vw, 120px)`, 450, 0.95, −0.045em, two lines:
  "5 schools." / "~~$500~~ $349." The struck price is `--fg-48`; the price is `--fg`. Columns
  9–12 on the last baseline: the subline (`body-lg`, `--fg-64`) and "Start your story" (`lg`,
  arrow).
  - Motion, once, on load: the lines enter as every page head does; then a 0.045em line in
    `--fg-80` draws through "$500" left to right (`scaleX` 0 → 1, 600 ms, `--ease-line`, 900 ms
    after load) and "$349." rises beside it (`enter`, 1,300 ms after load). Done by 2.1 s.
  - Still (reduced motion, no JavaScript): the line drawn, both prices present. Screen readers
    hear "5 schools. $349, instead of $500."
  - Every number comes from `lib/payments/plans.ts`.
- `SocialProofSlot` sits between the head and the plans and renders nothing.
- **The plans**: scene 10's four columns (`PlanRow`, exported from `_sections/pricing.tsx`), 72 px
  under the head. Under the row, on a `--line` hairline: `PACK_PITCH.credits` (how a pack's
  credits work) on the left, `TAX_AND_FINAL_LINE` on the right, both `ui-sm`, `--fg-64`.
- **One kit, opened** (`_kit.tsx`). Head: eyebrow "What a school kit holds"; `h2` in
  `display-2`, "Everything one school / _asks for._"; paragraph in columns 9–12. Then the kit as
  paper on the dark: four `scene-sheet`s in a row from `lg` (two by two from `sm`, one column
  below), 24 px gutters, each with a margin (the file's name, the story it comes from in
  brass-ink `note`, the limit) and the draft's first two sentences in `read-sm`, the applicant's
  own sentence marked. Under the sheets, on hairlines, the files that are not essays as four
  columns of `label` + `ui-sm`: the application form, the résumé pass, recommender briefs,
  Connect. Last: `label`, the fictional note. Static; the "Show what unlocks" switch is gone.
- **Free, and with a kit** (the ledger). `h2` in `display-2`, "What's free, / _and what a kit
  adds._" in columns 1–5, sticky at 112 px from `lg`. Columns 6–12: the three groups; each
  group's name in `label` on a `--line-strong` hairline, then its rows on `--line` hairlines,
  20 px padding: the feature in `title` (18 px), its description in `ui-sm`, `--fg-64`, and on
  the right one word in `label`: "Free" at `--fg`, "Per school" at `--fg-60`, or the "Coming
  soon" pill. One list at every width (the two-column table and its phone copy are gone).
- **Elsewhere, and here.** `h2` in `display-2`: `PACK_PITCH.others` at `--fg-60`, then
  `PACK_PITCH.ours` at `--fg`, as on the landing page. Then two columns on hairlines, heads in
  `label` ("Elsewhere", "AdmitStories"): each row 24 px padding, theirs in `body-lg`, `--fg-60`,
  ours in `body-lg`, `--fg`. No ticks, no brass.
- **Payment.** Two columns on one `--line-strong` hairline: "Payment and tax" (processor, no
  subscription, the final-sale rule at `--fg`, the tax line) and "What we won't charge for".
  Heads in `title`, text in `body`, `--fg-64`.
- **Pricing questions**: the landing page's FAQ pattern (columns 1–4 the heading in
  `display-2`, columns 6–12 the rows), four questions.
- **Final call**: reused. Product JSON-LD unchanged.

#### `/privacy`, `/terms` (`_legal/legal-layout.tsx`, `voice-path.tsx`; paper)

The page is paper from the top of the window to a 32 px rounded foot where the dark footer
begins: `data-theme="day"`, `--paper`, ink. The nav stays the dark pill (§3.3).

- **Head.** 160 px from the top (`lg`; 128 px below). Columns 5–12 from `lg`: `label`, "Legal ·
  last updated 3 November 2026" (`<time>`); 24 px; `h1` in `display-1`, ink: "Privacy," /
  "_in plain words._" (and "Terms," / "_in plain words._"), the accent at `--ink-66`; 20 px;
  the draft note in `ui-sm`, `--ink-66`, while `LEGAL_DRAFT` is true.
- **Body**, 72 px under the head (`lg` 96 px), from `lg` a 12-column grid:
  - Columns 1–3: the contents, sticky at 128 px. `label` "On this page"; 16 px; the section
    titles as links, `ui-sm`, `--ink-66`, 36 px rows, ink on hover, each behind its number in
    Geist Mono 11 px. A 1 px `--rule` line runs down the list's left edge.
  - Column 4: each section's number, `label`, on the heading's baseline.
  - Columns 5–11: the sections, at most 68ch. Each: `h2` in Geist 24 → 28 px, 500, 1.2,
    −0.02em; 16 px; the plain summary in Source Serif 4 italic, `read-lg` (20 → 21 px / 1.5),
    ink; 24 px; the full text in `read` (17 → 19 px / 1.65), `--ink-80`, paragraphs 16 px apart;
    lists as rows on `--rule` hairlines, 12 px padding, each behind an 8 px rule. 64 px between
    sections, a `--rule` hairline between them.
  - Below `lg`: the contents are a `<details>` between hairlines above the first section; each
    number sits above its heading; text at 17 px; 16 px gutters.
- **`/terms`, the moment: a reading line.** Over the contents list's rule, a 1.25 px
  `--accent` line grows down as the document is read: `scaleY` 0 → 1 on a view timeline of the
  sections (`animation-timeline`, range `contain`), so it is full exactly when the last
  section's end reaches the bottom of the window. No script. Absent where scroll-driven
  animation is unsupported, and under reduced motion.
- **`/privacy`, the moment: where your voice goes.** A figure between the head and the body,
  columns 1–12, between `--rule-strong` hairlines, 48 px padding. Head: `h2` "Where your voice
  goes" in `display-3`, and the description (until now read by screen readers only) in `body`,
  `--ink-66`, at most 560 px, beside it from `lg`.
  - The drawing is one Voiceline doing its three jobs. From `lg`, five stops in five equal
    columns: Microphone, Speech-to-text, Text, Your Dossier, Your drafts; each stop's name in
    Geist 15 px, 500, and a `label` under it ("your voice", "Deepgram", "kept", "encrypted",
    "where it is used"). Under the names, the line: between the first two stops it is a
    **waveform**, 1.25 px, brass-ink (a voice); at "Speech-to-text" it goes **flat** and runs
    on through the last three stops as an ink rule at 50 % (text). Each stop is a 9 px ring on
    the line. From "Speech-to-text" a second line drops 56 px and runs right, a waveform that
    dies away into a **full stop**: a 9 px ink dot, with "Audio" and `label` "discarded · never
    stored" beside it.
  - Below `lg` the same drawing runs down the left edge: the stops are rows 72 px apart, the
    waveform is the first segment, and the audio branch is a short row that ends in the dot.
  - Motion, once, as the figure reveals: the voice draws to "Speech-to-text" (600 ms,
    `--ease-line`), the rule runs on to "Your drafts" (800 ms), the audio branch draws (700 ms,
    from 700 ms) and the full stop lands (opacity and scale 0.4 → 1, 200 ms, at 1.4 s). 1.6 s in
    all, each line uncovered with `clip-path` like the pack's threads. CSS on the reveal's
    `data-in`; the old play island (`voice-path-play.tsx`) is deleted. As built, the phone
    drawing's voice segment is a straight brass rule (a vertical waveform read as noise at 72 px);
    the audio row keeps its small dying waveform and the full stop.
    Still under reduced motion and without JavaScript.

#### Open Graph images (`_lib/og.tsx`; five routes)

1200 × 630, `#0B0A09`, one template. Top left, 72 px in: the mark (brass, 40 px) and the
wordmark, "Admit" in Geist 500 and "Stories" in Instrument Serif italic, 34 px, `#F4F1EA`. The
page's headline, bottom-aligned 196 px above the foot, 72 px in: Geist 500, 92 px, 0.98,
−0.045em, `#F4F1EA`, with its accent line in Instrument Serif italic 98 px at 60 %. The horizon:
a 2 px line at 20 % across the width, 132 px above the foot, with one brass peak (the mark's
rise, 60 px tall) at 72 % of the width. Under the line, right: the page's path in Geist Mono
22 px at 60 %. Headlines: "Tell it once. / _Tell it well._"; "From one conversation / _to every
school._"; "5 schools. / _$349._" (from `plans.ts`); "Privacy, / _in plain words._"; "Terms, /
_in plain words._". Fonts: Geist Medium and Geist Mono from the installed `geist` package;
Instrument Serif italic as one TTF beside the template (`_lib/InstrumentSerif-Italic.ttf`, SIL
Open Font Licence, with its licence text), because Satori cannot read the woff2 that
`next/font` fetches. Read at build only; nothing ships to the browser.

---

## 5. Entry (full values; built in Phase 4, 2026-11-17, and written to the values as built)

As built, the first-run flow renders inside the room (`ImmersiveScope` and the Voiceprint still
are gone from it), and the Turnstile widget is always asked for its dark theme.

"Walking into a quiet room": the instrument with almost nothing in it. `/sign-in`, `/welcome`,
`/first-run`, `/goodbye` and the not-found page share one shell, `EntryRoom`
(`components/auth-shell.tsx`, styles in `components/entry.css`). Always Night, whatever the
theme cookie says: the room is part of the casing (§1.2).

**The room**

| Thing    | Value                                                                                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Field    | `data-theme="night"`, `--bg` with the grain tile, `min-height: 100dvh`, safe-area padded                                                                           |
| Inset    | `--room-x`: 20 px, 48 px from `sm`, `clamp(48px, 11vw, 168px)` from `lg` (158 px at 1440)                                                                          |
| Top      | the wordmark (24 px mark, a plain anchor to `/`), 28 px from the top (`sm` 36 px), at `--room-x`                                                                   |
| Column   | the content, 400 px wide (`/sign-in`, `/goodbye`, not-found) or the room's width (`/welcome`, `/first-run`), centred vertically in the space above the horizon     |
| Horizon  | one full-bleed line, 1.25 px `--line-strong`, 96 px above the foot (`sm`; 76 px below). Under it at `--room-x`: one `label` line, "Free to start · no card needed" |
| Type     | `h1` in `display-2` (28 → 48 px, 500, 1.05, −0.035em); intro in `body`, `--fg-64`; fields and buttons from §2.9                                                    |
| Entrance | `enter`: wordmark `--i: 0`, heading 1, intro 2, form 3, the aside 4. Done by 1.2 s                                                                                 |

| Screen                | Full values                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/sign-in`            | Column: `h1` "Sign in or create / your account"; 12 px; intro; 32 px; the email field (48 px, label above in `ui`); 16 px; the primary button, full width, `md`, brass, "Email me a sign-in link" with the arrow; 28 px; a hairline "or" (`label` between two `--line` rules); 20 px; Google and passkey as secondary buttons, full width, 12 px apart, each with its icon. Notice (an expired link): a `frost-flat` card, 16 px padding, above the field. **Aside** (`lg`+, right of the column, centred in the remaining width): one sheet of paper, 360 × 404 px with a 116 px margin, turned −2°, standing on the horizon so its foot crosses the line: the hero's sheet (`hero.ts`, sample 3: the title, the brass-ink margin note, the count, the opening with the applicant's own sentence marked), set in the root's lazy reading serif so `/sign-in` preloads nothing more; `label` **above** it, `HERO_COPY.sampleNote` (under it, it sat on the line). Hidden from assistive technology. Phones: no sheet; the horizon stays. **The moment:** over the horizon, from the screen's left edge to 70 px short of the column's right edge, a brass line `scaleX` 0 → 1 from the left (280 ms, `--ease-rise`) while the email field has focus, and back (160 ms, `--ease-exit`) when it leaves: a transition, so a quick focus and blur retargets instead of restarting. **"Check your email"** takes the form's place: the page's heading and intro leave the layout (kept for screen readers), `label` "Link sent"; `h2` in `display-2`, "Check your email"; the address in `body`, `--fg`; the hint in `body`, `--fg-64`; "Send another link" (secondary) and "Use a different email" (quiet). The brass line stays drawn and rises into the mark's peak (30 × 42 px, `stroke-dashoffset` 1 → 0, 500 ms, `--ease-line`) at its right end. All CSS (`:has()`); `/sign-in` gains no script. Turnstile, Google, passkeys, autofill and the kept line (`?from=line`, in the applicant's hue, in Instrument Serif italic 24 px) work as before; Turnstile is asked for its dark theme |
| `/welcome`            | The room's width, two columns from `lg` (columns 1–5 and 7–12 of the room). Left: `label` "Before you start"; `h1` "You're in." / "_Here's what happens next._"; 32 px; the three next steps as rows on `--line` hairlines, 20 px padding, the number in `label`, the line in `body-lg`, `--fg-80`; 24 px; "All of that is free." in `body`, `--fg-64`. Right, the form on a `--surface-1` card (24 px radius, 32 px padding): `label` "Two things first"; the age box; a hairline; "How we work together" in `title`, its three lines on hairlines in `body`, `--fg-80`; the agreement box; 28 px; "Agree and continue" (primary, arrow). **Checkboxes**: a 24 px box, 7 px radius, 1 px `--control-edge`, in a 44 px row; ticked: fill `--fg` (150 ms), and the tick, a 1.75 px `--bg` stroke, draws (`stroke-dashoffset`, 200 ms, `--ease-rise`, 60 ms after the fill: the box, then its tick). Unticking is instant. **The moment:** the button rests as flat frost (text `--fg`, a hairline edge) until both boxes are ticked, then wakes to its brass fill (200 ms). Not 45 % opacity as first written: a faded brass button fails AA while it can still be pressed. It can still be pressed early: the server's errors and focus handling are unchanged. Below `lg`: one column, the form under the steps                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `/first-run`          | The room's width, at most 720 px of content. Under the wordmark, 40 px: **the progress line**. `label` "02 / 05 · Schools" above it; then a 1.25 px `--line-strong` hairline the content's width with a 5 px tick at each stop; brass from the start to the current stop (`scaleX`, 500 ms, `--ease-line`); and the mark's peak (24 × 34 px, brass) standing on the current stop. **The moment:** on "Next" and "Back" the peak travels to its new stop and the brass follows it (`translate` and `scaleX` in container units, 350 ms, `--ease-line`: moving on screen, so ease-in-out). Transitions, so a fast double "Next" retargets. Under the line, `ui-sm`, `--fg-64`: "This becomes your Voiceprint: drawn from the way you actually talk." (The orb is gone; the line is the form.) 56 px. One question a screen: `h1` in `display-2`; hint in `body`, `--fg-64`, at most 60ch; 32 px. Choices: 44 px pills, `frost-flat`, `ui`; chosen: fill `--fg`, text `--bg` (inverted, never brass); groups 28 px apart under a `label` legend. "How much time do you have today?": three cards in a row from `sm` (stacked below), 24 px radius, `--surface-1`, 24 px padding: the name in `title`, the minutes in `label`, the line in `ui-sm`, `--fg-64`; chosen: `--surface-2` and a `--fg` edge. The upload step: a dashed `--line-strong` card, 24 px radius, 40 px padding, its behaviour untouched. Actions: "Next" (primary, arrow) left, "Skip for now" quiet beside it, "Back" quiet at the right. Reduced motion: the peak and the brass jump                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `/goodbye`, not-found | The room, the 400 px column: `h1` in `display-2`, one or two lines of `body`, one text link. The horizon has a 48 px gap in it at the column's left edge (the line with a gap, §6.2 "Error"), and no footnote: the horizon then keeps 72 px under it so it never sits on the window's edge (first-run likewise). `app/error.tsx` is unchanged: `buttonStyles()` on a plain element                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

---

## 6. App: composition sketches

### 6.1 Shell: the casing (full values; Phase 5, 2026-11-17)

The casing is the instrument around the work: sidebar, top bar, dock, command palette, account
menu and toasts. **It is Night in both themes** (Manu, 2026-11-17): every casing part carries
`data-theme="night"`, so only the bay follows Day / Night. Files: `packages/ui/src/shell/*`,
styles in `shell/casing.css` (imported by `theme.css`).

| Part             | Full values                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Casing**       | The shell's root, `.casing`: `--bg` with the grain tile, `min-height: 100dvh`. `html:has(.casing)` paints `--bg` too, so overscroll never shows the desk. `THEME_COLORS` is `#0B0A09` for both themes and Day `--rail` is `#0B0A09` (the Phase 1 interim ends)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **The bay**      | The routed content, `.bay`. From `lg`: 256 px left of it is the sidebar; the bay sits 8 px from the top, right and bottom, `--radius-card` (24 px), `--space` fill (the Day desk or Night), a 1 px `--edge` hairline (in Night it is the only thing that separates bay from casing), `min-height: calc(100dvh - 16px)`. It scrolls with the page (the sidebar is fixed), so a phone's native scroll and the keyboard both work. Below `lg`: full-bleed, no radius, no edge, under the top bar, with `padding-bottom: calc(80px + env(safe-area-inset-bottom))` for the dock. **Rail mode** (`/studio`; Phase 6 adds `/workspace`): the sidebar is 64 px, and the bay is edge to edge (`margin: 0`, no radius, no edge) and Night                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Sidebar**      | `lg`+, fixed, 256 px, no fill of its own (it is the casing), padding 20 px 12 px 12 px. Top: the wordmark at 17 px in a 44 px link, 8 px inset. 20 px. "New story": primary `md` (44 px), full width, the plus glyph 16 px, brass (the casing's one brass thing). 12 px. Search: a 40 px `frost-flat` pill, a 16 px magnifier and "Search" in `ui-sm` `--fg-64`, the shortcut (`⌘K` / `Ctrl K`) right-aligned in `label` type at `--fg-48`. 28 px. `label` "Workspace" at `--fg-60`, 8 px inset, 8 px under it. The seven destinations: 40 px rows, `--radius-round`, 12 px inset, 12 px icon gap, icons 18 px Phosphor regular at `--fg-48`, text `ui` (14 / 500) at `--fg-64`. Hover: text `--fg`, fill `--surface-1` (200 ms, colour only). Current: text and icon `--fg`, fill `--surface-2`. No brass, no lift. Foot, above a `--line` hairline with 12 px over it: Settings (same row), then the account row (52 px: a 28 px initials disc, `--fg` fill, `--bg` text in Geist Mono 11 / 500; the name in `ui-sm` 500 `--fg`; the email in Geist Mono 11 at `--fg-64`, both truncated). **Rail mode:** 64 px wide, padding 20 px 10 px; the mark alone (24 px) instead of the wordmark; "New story" a 44 px brass circle; search a 44 px `frost-flat` circle; rows 44 × 44 circles, labels hidden visually (kept as the accessible names); the account row is the disc alone |
| **Top bar**      | Below `lg`: sticky, 52 px plus `env(safe-area-inset-top)`, a 88 % wash of `--bg` with a 16 px blur (the marketing nav's material, so it stays dark over the Day desk), a `--line` hairline under it. 8 px inset each side. Left: the mark (24 px) in a 44 px link to `/home`, then the page's name in `ui` `--fg` (from the current destination: Home, Story Studio, Schools …, Settings, Your dossier, Recommenders). Right: search and the account disc, each 44 px                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Dock**         | Below `lg`: fixed, a floating pill 56 px tall, 12 px from the left, right and bottom edges plus `env(safe-area-inset-bottom)`, the same dark wash and blur, a `--line` edge, `--shadow-overlay`. Seven equal slots, each a 44 px target; icons 20 px at `--fg-64`; current: `--fg` and a 4 px `--fg` dot 6 px under the icon. Labels are screen-reader only (seven do not fit 375 px at 13 px). Press: `scale(0.94)` 100 ms                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Palette**      | `data-theme="night"`, `.casing-overlay` (as built: the dark wash at 92 % with the 16 px blur and a `--line` edge; plain `frost` over the Day desk turned the panel light and the white text unreadable), 24 px radius, `--shadow-overlay`, 560 px wide (`min(100% − 32px, 560px)`), top at `max(16px, 14dvh)` so the list grows downwards and nothing jumps. Input row 56 px: a 18 px magnifier at `--fg-48`, the field in Geist 17 px `--fg` (16 px under `sm`, never smaller), placeholder `--fg-48`. Group heads in `label` at `--fg-60`, 12 px inset. Rows 44 px, `--radius-round`, `ui` `--fg-80`; selected: `--surface-2` fill, `--fg`. Footer: the key hints in `label` with keys as 20 px `frost-flat` pills. The input row has no outline: its hairline brightens to `--fg-48` while the field has focus. **No animation** (SPEC §2.10: a keyboard action, 100 times a day): it appears and goes at once. Scrim `--scrim`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Account menu** | `data-theme="night"`, `.casing-overlay`, 24 px radius, `--shadow-overlay`, 6 px padding, min 256 px. Head: the name in `ui-sm` 500, the email in Geist Mono 11 at `--fg-64`, 12 px padding. Rows 44 px (as built: the tap minimum, not 40), `--radius-round`, `ui` `--fg-80`, icons 18 px `--fg-48`; highlighted: `--surface-2`, `--fg`. Theme: three rows with a check, unchanged in behaviour. Opens from its trigger (`transform-origin: var(--radix-dropdown-menu-content-transform-origin)`): opacity 0 → 1 and `scale(0.97)` → 1, 150 ms `--ease-rise`; closes in 100 ms, opacity only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Toasts**       | `data-theme="night"` (dark in Day too), `.casing-overlay`, `--radius-card`, 12 px 12 px 12 px 20 px padding, min-height 52 px, max 420 px wide, bottom centre: 24 px from the bottom from `lg` (centred on the bay), above the dock below it (`calc(80px + env(safe-area-inset-bottom))`). Title `ui` `--fg`, description `ui-sm` `--fg-64`; action a secondary `sm` pill; close a 36 px quiet circle. Enter: `translateY(12px)` → 0 and opacity, 250 ms `--ease-rise` (a transition from `@starting-style`, so a burst retargets); leave: opacity, 150 ms. Swipe down to dismiss                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Page header**  | (`components/page-header.tsx`) `label` eyebrow; 12 px; title in `display-2` `--text`; 16 px; one `body-lg` line in `--text-soft`, at most 60ch; 48 px above the content. Page padding: 24 / 40 / 56 px top (base / `sm` / `lg`), 20 / 40 / 56 px sides, max 880 px                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

**Motion in the casing.** Hover is colour only (200 ms). Presses `scale(0.97)` 100 ms (dock
`0.94`). The route change keeps the existing View Transition on the content only (the casing
never moves). Nothing in the casing animates on load.

### 6.2 Screens

| Screen                                                 | Sketch (layout · key type · states that must survive)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Home** `/home`                                       | Full values in §6.3                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Story Studio** `/studio`                             | Full values in §6.4                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Dossier** `/dossier`                                 | Tabs Stories · Facts · Brand · Voice stay. Stories becomes the life as chapters: a horizontal timeline (a Voiceline with year ticks in mono) that scrolls sideways; chapter cards hang beneath their years, each with the story's name in `title`, its context in `label` and the themes found as chips. Selecting a card opens the existing story detail. Phone: the same timeline turned vertical. Voice tab: the applicant's line, and the hue picker as twelve swatches. Empty: a flat line and "Talk for five minutes and they'll start appearing here." Dragging stories into school slots is a proposal only (§10.2)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Profile Read** `/profile-read`                       | A paper sheet, 68ch, in the bay. The headline read in Source Serif italic 32 px; then "what lands" and "what a reader may doubt" as two typeset columns; every figure followed by a superscript citation mark in mono whose source and date show in a CSS-only label on hover and focus (as now, no Radix). The lenses become a small table on hairlines, not a ring chart. Evidence drawer keeps working. Empty and "needs two stories" states on the sheet itself                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Schools** `/schools`                                 | Page header, then school cards in a 3-column grid (24 px radius): cycle in `label`, the name in `display-3`, round and deadline in mono, status as a status label, and a small line with a peak at the next deadline. Locked schools show the price and "Free preview"; "Pack coming soon" cards are flat and quiet. Add schools: one search field and results as rows, below the grid. Strategy details and the round planner keep their place                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **School workspace** `/schools/[id]` and its tabs      | Header: breadcrumb in `label`, school name in `display-3`, cycle in mono; tabs Essays · Application · Video · Recommenders · Résumé as text tabs. Body: the document in the middle (a sheet), its chat panel on the right (320 px, `frost-flat`; a bottom sheet below `lg`), the file list on the left at `xl` (a dropdown below). While the kit is being prepared: three numbered steps on hairlines ("Your stories", "Questions for the school", "Drafts") with the deliverables resolving from "Drafting" to "Ready" one by one. The positioning summary sits at the top of the Essays tab as four lines in Geist 20 px that settle in one after another on first view. `/schools/[id]/recommenders`, `/resume` and `/kits/[id]` are redirects into this (§9.5) and stay so                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Preview** `/schools/[id]/preview`                    | The free showcase, kept: positioning preview, which story goes where (hairlines from story names to deliverables), the illustrative example stories labelled "illustrative, not a real client", every deliverable listed and locked. Round and reapplicant choices as tap-to-save chips                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Unlock** `/schools/[id]/unlock`                      | The money screen: quiet. Top: "Unlock Halvorsen" in `display-2` and one line. Then the two tap-to-save choices (round, reapplicant) as chips in one card. Then the plans: three columns on one baseline with **5 schools** in the centre as the only filled card and the only brass button, preselected as today; "usually $500" struck through; "Most chosen" as a `label` chip; per-school price and saving in mono. Choosing a plan shows that many small sheets dealing out into a row beside the total (1, 5 or 10). One line under the plans: all sales are final, linking to terms. The model credit last. The Dodo overlay, the test checkout, the polling and `?paid=1` handling are not touched                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Essay editor** `/workspace/[deliverableId]`          | The sidebar collapses to the 64 px rail. Centre: a sheet, text column 68ch (≈ 610 px at 19 px Source Serif), 56 px padding. Sheet header: the prompt in Source Serif italic 17 px, and the word count against the limit in mono, top right (`limit-counter`; `--risk` when over). **Right margin**, 176 px, attached to the sheet beyond a hairline: reasoning notes in `note` type, each aligned to the paragraph it explains. Far right: the panel (Chat · Why this · Options · Checks · Verify), 296 px. Left at 1440: the file list, 184 px. At `xl` the file list becomes a dropdown; at `lg` the margin notes fold into paragraph-end markers; on phones the sheet is full width at 17 px, the panel a bottom sheet. Under the sheet: the **version timeline**, a hairline with a tick per version, dates in mono, the peak on the current one (same drag and arrow-key behaviour as the scrubber). A floating `frost` toolbar, bottom centre: Your words (Y), Refine, Options, Export, Mark final. Provenance marks per §2.3. Revision review and diff, option split, needs chips, the authorship banner, coach mode, autosave and every shortcut are kept. Form screens (`form-screen.tsx`) use the same sheet with fields set as a typeset form |
| **Recommenders** `/recommenders`, `/recommenders/[id]` | List: one row per recommender on hairlines: name in `title`, role in `ui-sm`, schools as chips, and a four-stop line (not invited → invited → writing → submitted) with the peak on the current stop. Detail: a two-pane layout: left, the person and the four tabs (Stories · Brief · Coverage · Status and reminders); right, the brief as a paper sheet. Invitation preview stays word for word what is sent                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Recommender portal** `/r/[token]`, `/r`              | Seen by people who aren't customers: paper, one column, no casing, no sidebar. A small wordmark, then a greeting in Source Serif italic 28 px, who is asking and for which schools, then the brief as a sheet at 18 px on phones with 20 px margins, the notes and the answer areas as large paper fields, one ink primary button fixed at the bottom on phones. Works in one sitting on a phone: no horizontal scroll, 16 px inputs, nothing below 15 px. Loads no Motion; Source Serif preloaded. `/r` (ask for a new link) and the closed and submitted states in the same sheet                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Résumé** `/resume`, `/resume/review`                 | `/resume`: "What story should your résumé tell?" in `display-2`; left, the three narrative fields on a card; right, "Build it from" as three option cards; one primary button. The built résumé is a sheet at true page proportions. Review: each bullet as before → after with the diff, accept or keep, on hairlines                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Connect** `/connect`                                 | Locked: heading, who you can talk to as three lines, the static portrait grid with its illustrative label, "Unlock a school". Unlocked: left pane 360 px (Messages / Find people tabs, search field, school select, filter chips, people as rows with 40 px portraits), right pane the conversation or profile; "Works with us" as a `label` chip. One column below `lg`. Loads no Radix and no Motion, as now                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Settings** `/settings`, `/privacy`, `/security`      | One column, max 720 px, sections on hairlines with `label` heads. Appearance: Day / Night / Match system as a segmented control beside a small sheet swatch that turns with it. Voice: the hue picker and voice options. Dossier link. Privacy: the inventory as a table, export and delete (dialog kept). Security: passkeys as rows, add and remove dialogs kept                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Interview** `/interview`                             | Coming soon, as a still of the room on dark: the question in `display-2`, the timer ring (a Voiceline circle, drawn to 0:42 of 2:00), four lines of transcript in italic serif, all under a `label` chip "Preview". Beside it the honest promise from `INTERVIEW_COMING_SOON.promise` and the four parts as a plain list. No live room is built                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Tracker** `/tracker`                                 | Keeps its current coming-soon state; inherits the page header and tokens only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Empty, loading, error**                              | Empty: a flat line, one sentence in `title`, one action; never an illustration. Loading: skeletons are hairline rules at the positions of the real lines (no shimmer), with the page header already in place. Error: the line with a gap, what happened in plain words, "Try again". Every screen above gets all three, expanded in its phase                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

### 6.3 Home `/home` (full values; Phase 5, 2026-11-17)

One column, the page frame of §6.1 (max 880 px). Calm and scannable: one card, one line, one
list. Server-rendered, no client code of its own.

| Element          | Full values                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Head             | `label` "Your application"; 12 px; `h1` in `display-2`: "Welcome back," / the first name as the italic accent (`serif-accent`, `--text-soft`), a full stop after it. No name: "Welcome back." Entrance `enter`, `--i` 0, 0.8                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| The next step    | 48 px under the head. A `card` (24 px radius; Night `--depth` on `--edge`; Day paper with `--shadow-paper`), padding 28 px (`sm` 40 px). `label` "Next step"; 12 px; the step in `display-3` (22 → 32 px, 500, 1.15), at most 26ch; 28 px; the primary `md` button with its arrow ("Tell your first story" and so on, unchanged copy). From `sm`: the title left and the button bottom-right on one baseline. Entrance `enter` `--i` 1.45                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| The path         | 64 px under. `label` "The path" and, right-aligned, where they are in `label` ("Stage 2 of 4", or "All four done"). 24 px. **The line**: a 1.25 px `--line-strong` rule the width of the column, a 5 px tick at each of four stops (0, 25, 50, 75 %, `--fg-48`; a done stop's tick is `--text`). Brass (`--accent`) runs from 0 to the current stop (the first not done; all done: to 100 %). The mark's peak (16 × 22 px, 1.5 px brass stroke, mitre joins) stands on the current stop. Under each stop, 16 px down, a link to the stage (44 px min, the full column): number in `label`, the stage in `ui` (14 / 500, `--text`), its state in `ui-sm` `--text-soft` (e.g. "3 stories told"); done stages say "done" to screen readers. Phones (under `sm`): the same line turned vertical: a rule down the left at 7 px, the four stages as 72 px rows to its right, brass down to the current one, the peak turned 90° to point at it |
| Schools          | 64 px under. `label` "Your schools"; 16 px; rows on `--edge` hairlines (no card around them), 20 px vertical padding. From `sm` a four-column grid `1.2fr 1.5fr 9rem auto`: the school in `title` (18 / 20 px, 500); where it stands in `ui-sm` `--text-soft` (the recommender line under it, a link); the next deadline in Geist Mono 13 px `tabular-nums` `--text-80` with the round in `label` above it ("R1 · deadline"), or "No date yet" in `--text-soft`; "Open" as a quiet link with the arrow, 44 px. Phones: name and Open on the first line, the state and the deadline under it. Deadline: the applicant's round, else the next round whose date is still ahead, from the cycle's `rounds` (read-only; `lib/home/server.ts`)                                                                                                                                                                                                 |
| Empty schools    | The empty state of §6.2: a flat `--edge` line, "No schools on your list yet." in `title`, one secondary button "Choose your schools"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Writing with you | 64 px under, above a `--edge` hairline, 32 px padding top: `ModelSealMark` (40 px) beside `label` "Writing with you" and the model's name and heading line from `model-claims.ts` in `title`; under it the first three corpus rows as figures (Geist 450, 24 px, `tabular-nums`, `--text`) with their titles in `ui-sm` `--text-soft`, three columns from `sm`. Every word from `model-claims.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **The moment**   | Once per visit, after the page has entered: the brass run draws from the first stop to the current one (`scaleX` 0 → 1 from the left, 900 ms, `--ease-line`, 300 ms delay; vertical on phones, `scaleY`), then the peak rises out of the line (`clip-path: inset(100% 0 0 0)` → `inset(0)`, 400 ms `--ease-rise`, starting at 1,050 ms). CSS keyframes under `[data-motion="on"]` only, so with reduced motion or no JS the line is simply drawn. 0 KB JS                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

States: Home has no loading screen of its own (the server renders it whole); errors go to the
app's error boundary.

### 6.4 Story Studio `/studio` (full values; Phase 5, 2026-11-17)

Night in both themes (`ImmersiveScope` carries `data-theme="night"`; `immersiveTheme()` returns
Night for every preference). The shell is in rail mode, so the bay is the whole window right of
a 64 px rail. **The page is a conversation, not a form**: one question, the answer appearing
under it, and one line across the room that answers your voice.

**Layout** (the screen's own grid, inside the bay; `.studio` in `app/(app)/studio/studio.css`):

| Element           | Full values                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frame             | `min-height: 100dvh` (below `lg`: `100dvh` less the top bar and dock). Padding 20 px (`sm` 40 px, `lg` 48 px). From `xl` two columns: the stage (`1fr`) and the shelf (320 px), 48 px apart                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Top row           | The chapter tabs on the left and Speak / Write on the right, on one 44 px row, a `--line` hairline under it. Tabs: `label` type (Geist Mono 11 / 500, uppercase, +0.18em), `--fg-60` at rest, `--fg` selected with a 1.25 px `--fg` rule under it (no slide: switching chapters is a click, and it is instant), 24 px apart, the row scrolling sideways under 1024 px with no scrollbar. Speak / Write: a segmented control, 36 px, `frost-flat`, the selected half a `--surface-2` inner pill with `--fg` text, the other `--fg-64`; the inner pill slides (CSS transition, `translate`, 200 ms `--ease-rise`)                                                                                                                                                                                         |
| The question      | 12 % of the stage's height under the top row (at least 40 px). `label` with the chapter ("Roots" etc.) at `--fg-60`; 20 px; the question in Geist `display-2` (28 → 48 px, 500, 1.05, −0.035em), `--fg`, at most 22ch, left-aligned, inset one column (`lg`: `calc(100% / 12)`; under `lg`: 0). While it is read aloud, words not yet reached sit at `--text-soft` (64 %, as built) and brighten to `--fg` as they are spoken (the existing TimedText); with reduced motion all are `--fg`. While the reply streams in it shows as it arrives, the same type                                                                                                                                                                                                                                                                 |
| The transcript    | 32 px under the question, same inset, at most 34ch, three lines tall and bottom-aligned (older lines rise under a 40 px fade at the top). Instrument Serif italic, `transcript` (24 → 28 → 34 px, 1.2): final words `--fg`, interim words at 40 % (as built; the existing test pins it, and at 24 px and up 3.5:1 passes AA for large text); a phrase fades in as one group (120 ms), never letter by letter. Empty: `ui` `--fg-64` "Answer out loud. Your words appear here as you speak." After an answer: the saved answer in the same italic at `--fg-64`, clamped to three lines, with "Saved to your Dossier" in `label` under it                                                                                                                                                                                                                                                         |
| **The horizon**   | A line across the stage at 68 % of its height (below `lg`: 62 %), the stage's full width (the bay's width less the shelf at `xl`), 120 px tall box centred on it. At rest: one 1.25 px stroke, `--line-strong`, flat. Listening: the stroke turns the applicant's hue (`--voice`) and moves with the real microphone signal. Being read to: `--silver`, moved by a synthetic signal while the question is spoken. A canvas (`StudioVoiceline`, `packages/ui/src/studio/voiceline.tsx`)                                                                                                                                                                                                                                                                                                                  |
| The record button | Centred on the horizon, on top of it. 88 px circle. Rest: `frost-flat` (`--surface-2`, `--line` edge), a 28 px microphone glyph `--fg`; hover `--surface-1` → 10 %. Listening: brass fill (`--accent`), a stop glyph (filled square, 24 px) in `--on-accent`. Processing: `frost-flat`, the waveform glyph at `--fg-64`, `aria-disabled`. Error: `--risk` 1.5 px edge, the warning glyph `--risk`. Press `scale(0.97)` 100 ms. Colour changes 200 ms. The glyph swaps with an opacity and `scale(0.9 → 1)` crossfade, 160 ms. Focus ring 3 px out, `--fg`                                                                                                                                                                                                                                               |
| Under the button  | 16 px under the circle: the status in `label` `--fg-60` ("Tap to talk, or hold Space", "Listening", "Writing down your answer"); an error in `ui-sm` `--risk`. 20 px under: Done (secondary `sm`), then two quiet `sm` toggles, "Read aloud" and "Hands-free", each with its state (`aria-pressed`, a 6 px dot: `--fg` on, a `--fg-40` ring off; the base layer's pressed ring is turned off here, since the dot says it). Speak / Write in the top row replaces the old "Write instead" and "Talk instead" buttons; Write while talking still carries the words said so far into the composer (the stage hands the screen a callback). A voice notice's own "Write instead" action stays                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Session row       | At the stage's foot, a `--line` hairline over it, 16 px padding: "Skip for now", "I'm short on time" (quiet `sm`) on the left, "Finish for now" (quiet `sm`) on the right; the status and alert messages above it in `ui-sm`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Write mode        | The record button and its row leave; the horizon stays flat and neutral. In the transcript's place: the answer field, a textarea on `--surface-1` with a `--control-edge` border, 14 px radius, 20 px padding, Source Serif 4 at `read` (17 → 18 → 19 px, 1.65), `--fg`, caret brass, min 168 px, at most 64ch, label "Your answer" in `label` above it. Under it: "Done" (primary `md` with the arrow; ⌘ / Ctrl Enter sends) and the hint "⌘ Enter to send" in `label` `--fg-48`                                                                                                                                                                                                                                                                                                                       |
| The shelf         | `xl`: a 320 px column, sticky 24 px from the top, `frost-flat`, 24 px radius, 24 px padding. Under `xl`: the same panel full width under the session row. `label` "Your shelf" with the count right-aligned in `label`; the stories as rows on `--line` hairlines, 14 px vertical padding: the nickname in `ui` 500 `--fg`, context and era in `label` `--fg-60`, traits in `ui-sm` `--fg-64`, status as a status label. 28 px. **Coverage as six thin lines**: `label` "Coverage"; each lens a 44 px row: name in `ui-sm` `--fg-80`, its level word in `label` `--fg-60` right-aligned, and under them a 1.25 px `--line` track with a `--fg-64` run to the level (⅓, ⅔, full; `scaleX`, 250 ms `--ease-rise` when it changes), the note (if any) in `ui-sm` `--fg-64`. Then the facts link in `ui-sm` |
| Free answers left | From five left: one line in `ui-sm` `--fg-80` in the status slot ("3 free answers left in Story Studio. Everything you've said stays saved."), unchanged copy                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

**The moment: the line answers your voice.** When an answer starts, the line's live part grows
outwards from the button: the envelope's half-width goes from 0 to the full stage over 600 ms
(`--ease-rise`), while its amplitude follows the microphone level through the `snap` spring
(`followSpring`, already in `synthetic-signal.ts`), up to 34 px at full voice (22 px under `sm`).
The shape is the hero's: two sines and a little value noise, shaped by the applicant's
Voiceprint numbers (pitch sets the wavelength, 110–170 px; pace the second frequency; range the
amplitude, 0.8–1.15×). When the answer ends, the amplitude settles to zero on the spring and the
stroke fades back to `--line-strong` (250 ms), then the loop stops. Being read to: the same line
in `--silver` at 55 % of the amplitude, driven by a synthetic level (0.35–0.7). **Cost:** one
canvas stroke a frame, one point every 4 px (≤ 360 points), `devicePixelRatio` capped at 2; the
loop runs only while someone is speaking or the line is settling, and stops when the tab is
hidden. Reduced motion: the line never moves; while listening it turns `--voice` and stays flat,
and the button's fill says the rest.

**First paint.** The server renders the frame whole: tabs, the question as plain text (or the
waiting line), the flat horizon, a placeholder button (the same 88 px circle, microphone glyph,
`aria-hidden`, no handlers), the session row and the shelf. The voice stage (dictation, read
aloud, the canvas) loads after hydration and takes over the same boxes, so nothing moves.

**The free-half gate** (`studio-gate.tsx`, Night, the bay's frame, max 880 px): `label` "Story
Studio · the free half"; `h1` `display-2` "You're halfway through" / "_your story._" (accent
`--fg-60`); the made line in `body-lg` `--fg-80`. **The half line**: a 1.25 px rule the
column's width, brass over the first half with the peak (16 × 22) at the midpoint, the second
half a dashed `--fg-40` stroke; `label` under each end ("Free · 30 answers", "With a school pack
· the rest"). The stories told as `chip`s (Geist, not serif). Then the three option cards in a
row from `sm` (stacked under): the unlock card (`--surface-2`, a `--fg-40` edge: the only filled
card, with the only brass button) and the two free steps (`--surface-1`, quiet link buttons);
24 px radius, 28 px padding, title in `title`, body `ui-sm` `--fg-64`. The price line under the
row in `ui-sm` `--fg-64`, read from `plans.ts`. The gate's line draws on entry (900 ms) like
Home's.

**The session summary** (`session-summary.tsx`): the same frame; `label` "Session saved"; the
headline in `display-2`; the thin lenses as rows on hairlines; the actions as before (primary
first, secondary, then "Keep talking" quiet).

Keeps every capture state (idle, connecting, listening, finishing, failed, refused, permission
asked, denied, unsupported, offline queue, long silence), space-to-talk, the voice notices,
skip / short on time / finish, read aloud, hands-free, the story-capture flight into the shelf,
the summary and the gate. Nothing in `voice-flow.ts`, the APIs or the copy of a notice changes.


**As built in Phase 5 (2026-11-17), where it differs from the tables above:**

- **Home's moment** draws the neutral line first (`scaleX` 0 → 1, 700 ms, `--ease-line`, 250 ms
  delay), then the brass run (900 ms from 450 ms), then the peak (400 ms from 1,150 ms): with an
  applicant on stage 1 there is no brass to draw, and the moment was otherwise invisible. The
  peak is 16 × 22 px on phones (pointing right, its base on the line) and 20 × 28 px from `sm`.
  Stages ahead of the current one have their title at `--text-soft`; done and current at `--text`.
- **Home's deadline** comes from the published pack's verified rounds (`packRounds`, the same
  rule as the school cards in `lib/strategy/page-data.ts`), not the cycle's `rounds` column,
  which is empty for most schools.
- **Rail screens are Night in the bay too**: `.casing[data-rail] .bay` paints `--bg` with the
  grain, so the gate and the summary never show the Day desk under them.
- **The Voiceprint component is now the still SVG only** (`voiceprint/voiceprint.tsx`, props
  unchanged). The renderer, shaders, GPU tiering, `ogl`, `detect-gpu` and
  `public/detect-gpu` are deleted. The kit's assembly (Phase 6) and the duet prototype show the
  still until their own phases; `/prototype/studio` uses `StudioVoiceline`.
- **The viewport is edge to edge** (`viewportFit: "cover"`, `interactiveWidget:
  "resizes-content"` in the root layout), so the `env(safe-area-inset-*)` paddings take effect;
  the marketing nav's top padding became `max(12px, env(safe-area-inset-top))`.
- **The open chapter tab scrolls into view** on phones (the row's `scrollLeft`, never
  `scrollIntoView`, so the page doesn't move).

---

## 7. Signature moments

One per page. Everything else on the page reveals quietly (§2.10) or doesn't move.
"CSS" means compositor-only transforms and opacity with no per-frame script.

| Page                       | The moment                                                                                            | JS cost (gz)                                                                         | Per-frame cost                                                |
| -------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `/`                        | **Voice becomes a sentence becomes three essays** on the horizon line (§3)                            | gate ≤ 0.6 KB first load; island ≤ 7 KB lazy                                         | canvas ≤ 1.5 ms script, ≤ 4 ms total; 0 when hidden or paused |
| `/how-it-works`            | The pack assembles: each deliverable's line draws from a story to its file as it enters view          | ≤ 1.5 KB lazy (existing island, restyled)                                            | CSS (`stroke-dashoffset`), 900 ms each                        |
| `/pricing`                 | The strike draws through "$500" and "$349" settles beside it, once                                    | 0                                                                                    | CSS, 600 ms                                                   |
| `/privacy`                 | The voice path: a Voiceline travels audio → text and ends in a full stop where audio is discarded     | ≤ 1 KB lazy (existing play island)                                                   | CSS path animation, 1.6 s, on press                           |
| `/terms`                   | A reading-progress hairline along the contents list                                                   | 0 (`animation-timeline: scroll()`; absent where unsupported)                         | compositor                                                    |
| `/sign-in`                 | The line under the form brightens as the field takes focus, and rises to a peak on "Check your email" | 0                                                                                    | CSS, 300 / 500 ms                                             |
| `/welcome`                 | Each commitment's tick draws; the second one wakes the button                                         | 0                                                                                    | CSS, 300 ms                                                   |
| `/first-run`               | The peak travels to the next stop on the progress line                                                | 0                                                                                    | CSS, 500 ms                                                   |
| `/home`                    | The path line draws to where you are                                                                  | 0                                                                                    | CSS, 700 + 900 + 400 ms, once per visit                       |
| `/studio`                  | **The line answers your voice** from the record button outwards                                       | lazy, in the voice stage; first load 157.9 KB of 160 (measured)                      | 0.18 ms script a frame (0.59 at 4× CPU); 0 at rest (measured) |
| `/dossier`                 | Chapters draw onto the timeline in order                                                              | 0 beyond the shared reveal observer                                                  | CSS, line 900 ms, cards 60 ms apart                           |
| `/profile-read`            | The headline read sets word by word, once per new read                                                | 0                                                                                    | CSS, 90 ms apart                                              |
| `/schools`                 | Each card's deadline peak rises on its line                                                           | 0                                                                                    | CSS, 400 ms, 60 ms apart                                      |
| `/schools/[id]` (and tabs) | Positioning lines settle in one after another                                                         | 0                                                                                    | CSS, 600 ms, 120 ms apart, first view only                    |
| `/schools/[id]/preview`    | Lines connect each story to the deliverable it feeds                                                  | 0                                                                                    | CSS, 900 ms                                                   |
| `/schools/[id]/unlock`     | **The pack assembles**: 1, 5 or 10 small sheets deal out as the plan is chosen                        | ≤ 0.5 KB (in the existing plan picker)                                               | CSS, `glide` spring, 40 ms apart                              |
| `/workspace/[id]`          | **Your own words light up as yours** (Y): the marks sweep sentence by sentence                        | 0 new (existing your-words view)                                                     | CSS `background-size`, 400 ms, 40 ms apart                    |
| `/recommenders`            | Each person's status line draws to its stop                                                           | 0                                                                                    | CSS, 600 ms                                                   |
| `/recommenders/[id]`       | The brief sheet sets: headings first, then lines                                                      | 0                                                                                    | CSS, 60 ms apart                                              |
| `/r/[token]`               | The greeting sets in italic, once                                                                     | 0                                                                                    | CSS, 800 ms                                                   |
| `/resume`                  | The built résumé sheet rises into place                                                               | 0                                                                                    | CSS, `drift`                                                  |
| `/resume/review`           | A bullet morphs from before to after on accept (existing `diff-morph`)                                | 0 new                                                                                | existing                                                      |
| `/connect`                 | A person's row opens into their profile (existing shared element)                                     | 0 new                                                                                | existing                                                      |
| `/settings`                | The sheet swatch turns from Day to night paper with the switch                                        | 0                                                                                    | CSS, 250 ms                                                   |
| `/interview`               | The timer ring draws to its preview position, once                                                    | 0                                                                                    | CSS, 900 ms                                                   |
| `/tracker`                 | none (unchanged coming-soon state)                                                                    | 0                                                                                    | 0                                                             |

---

## 8. Budgets

### 8.1 Fonts

Measured latin woff2 sizes; today's figures from the current production build.

|                                                                                                 | Today                                                       | New                                                                     |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------- |
| Preloaded on marketing and entry                                                                | 157.3 KB (Newsreader roman 58.2 + italic 64.5, Hanken 34.7) | **68.1 KB** (Geist 29.3, Instrument Serif italic 15.7, Geist Mono 23.1) |
| Preloaded in the app                                                                            | 157.3 KB                                                    | **45.0 KB** (Geist, Instrument Serif italic); Geist Mono 23.1 lazy      |
| Extra preload on reading routes (`/workspace/*`, `/r/*`, `/privacy`, `/terms`, `/profile-read`) | 0                                                           | **+40.2 KB** (Source Serif 4 roman + italic)                            |
| All font files in the build                                                                     | 388 KB, 16 files                                            | **≤ 110 KB, 5 files**                                                   |

**Measured in Phase 1** (production build, 2026-11-13): every route preloads **66.5 KB** (Geist
28.6, Geist Mono 22.6, Instrument Serif italic 15.3), down from 157.3; the reading routes
(`/workspace/*`, `/r/*`, `/privacy`, `/terms`, `/profile-read`) preload **105.8 KB** (+ Source
Serif 4 roman 19.7 and italic 19.6). Geist Mono is preloaded in the app as well as on marketing:
a label sits on nearly every screen, and at 66.5 KB the three together are still under half the
old preload. The "5 files in the build" cap below was wrong about `next/font/google`: it also
emits each family's other unicode-range files (latin-ext, cyrillic and so on; 27 files, 350 KB
on disk), which a browser fetches only if a page contains those characters. The cap that matters
is the preload, and it holds.

**Phase 2:** `/` also preloads Source Serif 4 roman (the hero's sheets are set in it and are on
screen at first paint), so the landing page preloads 86 KB. **Reversed 2026-11-17** (Manu): `/`
preloads only the shared 66.5 KB; the sheets use the root's lazy Source Serif (§3.7).

Hard caps for the gates: no route preloads more than 110 KB of fonts. Source Serif is declared once without preload in
the root layout (so `--font-reading` exists everywhere and lazy uses just work) and declared again
with preload in the layouts of the reading routes. As built: `next/font` names a preloaded file
differently from a lazy one, so `components/reading-fonts.tsx` wraps the reading routes and
re-points `--font-source-serif` at the preloaded declaration for everything inside. CLS from fonts: 0,
through `next/font`'s size-adjusted fallbacks.

### 8.2 JavaScript (first load, gzipped; from `bundle:check` on 2026-11-12)

| Route                                             | Today                      | Budget | Plan                                                                                       |
| ------------------------------------------------- | -------------------------- | ------ | ------------------------------------------------------------------------------------------ |
| `/`                                               | 153.1                      | 155    | ≤ 152 after the hero's reducer and gates leave first load                                  |
| `/how-it-works`, `/pricing`, `/privacy`, `/terms` | 149.9, 144.8, 143.9, 143.5 | 155    | no growth                                                                                  |
| `/sign-in`                                        | 158.0                      | 160    | the tightest route: the redesign may not add a byte; the right-hand sheet is server markup |
| `/studio`                                         | 156.9                      | 160    | goes down when the OGL stage leaves                                                        |
| `/first-run`, `/schools/[id]/unlock`              | 155.1, 155.0               | 160    | no growth; unlock's "assembling" is CSS                                                    |
| every other app route                             | 146.0–153.2                | 160    | no growth                                                                                  |

Rules carried from the brief and memory: large screens behind `next/dynamic` hosts; one helper
per file for `"use client"` modules; nothing imported _from_ a dynamically loaded module; no Radix
Tooltip; no top-level `z.enum()` in client code; no `Button` or Radix in the root layout or
boundaries. The reveal observer (0.4 KB) and the motion attribute script (0.3 KB, inline) are the
only additions to every page.

### 8.3 Dependencies

Added: none.

| Removed                                                      | When                             | Why                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gsap`                                                       | Phase 3                          | its one user, `_follow/follow-sequence.ts`, folds into the stepped "How it works" scene (CSS transitions)                                                                                                                                                                                               |
| `lenis`                                                      | Phase 3 (removed)                | With stepped scenes there is nothing for smooth scrolling to smooth. It is desktop-only today, starts on the first wheel event, and adds input latency and a second scroll model that fights `position: sticky`, anchor links and the phone's native scroll. Anchor jumps use `scroll-behavior: smooth` |
| `ogl`, `detect-gpu`, `public/detect-gpu`                     | **Phase 5 (removed 2026-11-17)** | the brief says no WebGL anywhere; they stay only as long as `/prototype/*` uses them                                                                                                                                                                                                                    |
| `next/font` faces Newsreader, Hanken Grotesk, JetBrains Mono | Phase 1                          | replaced                                                                                                                                                                                                                                                                                                |

---

## 9. Where the brief and the code disagree

The code wins; these are the places it does.

1. **WebGL is not retired.** The brief says the WebGL studio is gone and `public/detect-gpu` is a
   leftover to delete "if nothing references it". It is referenced: `voiceprint/tier.ts` loads it,
   and the OGL Voiceprint renders live in the landing hero (`hero-voiceprint.tsx`), Story Studio
   (`voice-stage.tsx`) and three prototypes (studio, duet, voiceprint). The final call, first-run
   and the Dossier voice tab show the same orb as an SVG still. This spec replaces all of them on
   every redesigned screen with the 2-D Voiceline. The applicant's Voiceprint _data_
   (`/api/profile/voiceprint`, the identity numbers) is untouched: the same numbers shape their
   line (pitch → wavelength, pace → the second frequency, range → amplitude, pause rhythm → gaps),
   so "a form drawn from the way you speak" stays true. The package and folder can only be deleted
   once `/prototype/voiceprint`, `/prototype/studio` and `/prototype/duet` stop using the renderer
   (§10.3).
2. **`_hero/hero-demo.ts` holds no sample lines.** The brief points to it for reusable fictional
   lines; it is the retired microphone demo's Turnstile and token client, and nothing imports it.
   The lines are in `_data/sample.ts`, `_data/sample-words.ts` and `_sections/app-preview.tsx`.
   `/api/demo/stt-token` and the `DEMO_*` env settings still exist server-side; they are backend,
   so they are left alone and reported here.
3. **There are 12 voice hues, not four**, one per applicant. §2.3 refits all twelve. "Whose words
   are whose" in an essay is the three provenance kinds, which §2.3 marks without relying on hue.
4. **The model ledger says "12 schools, read closely"; 16 packs are published** and the strip says 16. Both come from the code (`model-claims.ts` and `_data/schools.ts`). The spec shows each
   where it is and changes neither; if 12 is out of date, that is a one-line change for Manu in
   `model-claims.ts`.
5. **Three routes in the brief are redirects now.** `/kits/[id]`, `/schools/[id]/recommenders` and
   `/schools/[id]/resume` redirect into the school workspace, and `/schools/[id]` redirects to
   `/unlock` until paid. They are designed as the workspace's states and tabs.
6. **The footer's legal entity is still `TODO(Manu): legal entity`** in `_copy/chrome.ts`, and it
   renders in the copyright line today. Needs a real value before launch; not a design decision.
7. **"$100 per school" is typed into `LINES_COPY`** (`_copy/landing.ts`) instead of read from
   `plans.ts`. The rebuilt scene reads the price from `_data/pricing.ts`.
8. **Immersive screens are Night unless the applicant chose Day** (`immersiveTheme()`), not always
   Night. This spec makes Studio, kit preparation and the interview still dark in both, as the
   brief describes; `immersiveTheme()` returns Night for every preference. Presentation only.
9. **The marketing site is not dark-only today**: it follows the theme cookie, with a Day/Night
   switch in the footer. Both go (§4).

---

## 10. Proposals that need a yes

**Answered 2026-11-17 (Manu):** 1 yes (dark casing in Day), 3 yes (the lab prototype is gone; the
rest goes once Phase 5 moves the Studio to the Voiceline), 4 yes, 5 yes. 2 is still a still for
Phase 7. See PROGRESS "Answered by Manu".

1. **Dark casing in Day** (§1.2). Recommended. The alternative is a paper-toned sidebar and top
   bar in Day, which is the current arrangement in new clothes. Everything else in the spec works
   either way; only the casing's `data-theme` changes.
2. **Dragging stories into school slots on the Dossier.** New behaviour, as the brief says: not
   built. Proposal: at `lg`+, a right-hand column lists each school's open slots (essay prompts
   from the pack); a story card can be dragged, or moved with "Use for…" from its menu (the
   keyboard path), onto a slot, which records a _preference_ the next draft honours. It needs a
   new table or column and an API route, so it is outside a presentation-layer job. Phase 7 will
   draw it as a still in the spec for a decision and build nothing.
3. **Retiring the WebGL prototypes.** To delete `ogl`, `detect-gpu` and `public/detect-gpu`
   entirely, `/prototype/voiceprint` goes and `/prototype/studio` and `/prototype/duet` switch to
   the Voiceline. Otherwise the renderer stays in the tree for prototypes only and nothing in the
   product loads it.
4. **`--needs` from amber to slate blue** (§2.1) and **three hue labels renamed** (Amber → Ember,
   Gold → Citron, Sand → Stone; ids unchanged, §2.3). Both are visible to existing users.
5. **Headline**: "Tell it once. / Tell it _well._" (§3.3).

---

## 11. Rubric

Each screen is scored 1–10 on the brief's ten criteria (first glance, signature, typography,
composition and space, colour and light, media integration, motion, mobile, copy, polish) from
screenshots at 1440 × 900 and 390 × 844, as a jury would. A screen ships at an average of 8 or
more with nothing under 7. Scores go in PROGRESS.md and REPORT.md.

## 12. How populated app screens will be checked (Phases 5–7)

A fresh local account can't reach a populated Studio, editor, Dossier, Profile Read or portal
without live AI (`local-db.md`). Each of those phases adds a hidden page under
`/prototype/redesign/` that renders the real screen component with sample props (fictional
applicants only), as the Phase 0.5 prototypes do, and `shoot.mjs` captures it beside the real
route's empty state. No production data and no API key is ever involved.
