# AdmitStories redesign spec: "The Literary Instrument"

Source of truth between sessions. Brief: `docs/design/fable-redesign-prompt.md`. Progress and
decisions: `PROGRESS.md`. Evidence: `REPORT.md` and `shots/`.

**Status of each part** (Phase 0, 2026-11-12):

| Part                                                                  | Depth                                                                                                                                 |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| §1 Concept, §2 System, §3 Landing hero                                | Full values. Build from these.                                                                                                        |
| §4 Marketing scenes, §5 Entry, §6 App                                 | Composition sketch: layout, signature moment, key type sizes. Each phase expands its own screens to full values here before building. |
| §7 Signature-moment table, §8 Budgets                                 | Full.                                                                                                                                 |
| §9 Where the brief and the code disagree, §10 Proposals needing a yes | For Manu's review.                                                                                                                    |

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

| Face                                               | Role                                                                                                                                  | Load                                            | File           |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | -------------- |
| **Geist** (variable 100–900)                       | headlines and all interface text                                                                                                      | preload everywhere                              | 29.3 KB        |
| **Instrument Serif**, italic 400 only              | 1–3 accent words in a headline, the live transcript, the Voiceline's words. Never upright (the roman isn't loaded), never under 20 px | preload everywhere                              | 15.7 KB        |
| **Geist Mono** (variable)                          | labels, margin notes, figures                                                                                                         | preload on marketing and entry; lazy in the app | 23.1 KB        |
| **Source Serif 4**, 400 roman + 400 italic, static | long-form text on paper                                                                                                               | preload only on reading routes (§8.1)           | 20.1 + 20.1 KB |

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
0.15) adds `data-in` once and stops observing. 0.4 KB.

**Hover:** colour and fill only, plus the 2 px arrow nudge. Nothing scales above 1.0 on hover;
pressed is 0.98.

**App route change:** the existing `page-rise` becomes opacity 0 → 1 and 8 px → 0 over 400 ms,
`--ease-rise`, first three blocks staggered 60 ms.

**Never:** anything looping in the background, parallax, scroll-scrub, scroll-snap, a
`<ViewTransition update>` around lazy islands (the double blink), a hidden island with no
after-`load` guard (`deferred.tsx` keeps its guard).

**Reduced motion:** all of the above become 120 ms opacity fades or nothing; springs already
collapse to 120 ms linear; the Voiceline shows a designed still (§3.6).

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

Admin, `/prototype/*` and the email templates only inherit tokens. `/prototype/system` (Phase 1)
shows every token and component on dark, paper and night paper.

---

## 3. The landing hero (full values)

Replaces `_hero/hero.tsx`, `hero-stage.tsx`, `hero-experience.tsx`, `hero-voiceprint.tsx`,
`hero-state.ts`, `hero-motion.ts`, `hero-ui.tsx`. `hero-demo.ts` (the retired mic demo's Turnstile
and token code) has no importer and is deleted (§9.2). `line-cleanup.ts` moves with the "Write
your own line" toy to scene 5.

### 3.1 Composition

A dark scene, `min-height: 100svh`, capped at 1000 px tall, `--bg` with grain. One horizontal line
crosses the whole hero **128 px above its bottom edge: the horizon**. It is the Voiceline. Under
the headline it lies flat and neutral; across the right 45 % it is alive and brass. Voice enters
at the bottom right, becomes a sentence just above the line, and the sentence rises into three
essay sheets above that. The eye reads the right side bottom to top, the way something is
distilled, then lands back on the headline and the button.

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ( ⌃ AdmitStories            How it works  Pricing  Sign in  [Start your story →] ) │  nav, frost
│                                                                            │
│  ── MBA APPLICATIONS · IN YOUR OWN WORDS            ┌────┐┌────┐┌──────────┐ │
│                                                     │note││note││note│ essay│ │  three sheets,
│  Tell it once.                                      │    ││    ││    │ text │ │  fanned like a
│  Tell it well.                                      │    ││    ││    │      │ │  hand of cards
│                                                     └────┘└────┘└──────────┘ │
│  AdmitStories listens to your life story once…                              │
│  [ Start your story → ]  ( See how it works )       It was 2 a.m. and the   │  sentence, italic
│  ◌ The AdmitStories model · trained on …            feed from the lab…      │
│ ───────────────────────────────────────────────────╱╲╱‾╲╱╲__╱‾‾╲╱╲╱╲╱‾╲╱── │  the horizon
│  01 You talk.        02 It drafts.        03 You see why.        ❙❙ SAMPLE  │  facts strip
└────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Layout values

| Element           | 1440 × 900 (`lg`+)                                                                       | 390 × 844 (base)                                         | `sm` 640–1023                                          |
| ----------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| Nav               | fixed, top 16 px, inset 48 px, height 56 px, pill, `frost`                               | top 12 px, inset 12 px, height 52 px                     | inset 32 px                                            |
| Copy column       | grid columns 1–7 (774 px, 57 %)                                                          | full width, margins 20 px                                | columns 1–8                                            |
| Eyebrow           | top at 172 px                                                                            | top at 108 px                                            |                                                        |
| H1                | 24 px under the eyebrow; two lines                                                       | two lines, same breaks                                   |                                                        |
| Subline           | 28 px under the H1, max-width 460 px                                                     | 20 px under, full width                                  | max-width 520 px                                       |
| Actions           | 36 px under the subline, row, gap 12 px                                                  | 28 px under, stacked, full width, gap 12 px              | row                                                    |
| Model credit      | 32 px under the actions                                                                  | 24 px under                                              |                                                        |
| Stage             | columns 8–12 (546 px wide), from 120 px to the horizon                                   | below the credit, 48 px gap, full width, 372 px tall     | below the copy, 420 px tall, max-width 560 px, centred |
| Horizon           | `bottom: 128px`, full bleed                                                              | the stage's bottom edge, full bleed                      | same as base                                           |
| Facts strip       | the last 128 px: 3 columns at grid 1–4, 5–8, 9–12, text baseline 56 px under the horizon | below the stage, stacked, 16 px apart, 32 px top padding | 3 columns                                              |
| Left content ends | at least 40 px above the horizon at every height ≥ 720 px                                | n/a                                                      |                                                        |

Under 720 px of height at `lg`, the model credit drops below the fold with the strip rather than
the hero shrinking its type.

### 3.3 Elements

| Element      | Type                                                   | Colour                          | Notes                                                                                                                                                                                            |
| ------------ | ------------------------------------------------------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Wordmark     | §2.9, 18 px                                            | `--fg`                          | links to `/`                                                                                                                                                                                     |
| Nav links    | `ui` 14 / 20, 500                                      | `--fg-80`, hover `--fg` 200 ms  | "How it works", "Pricing", "Sign in"                                                                                                                                                             |
| Nav CTA      | button `sm` primary with arrow (40 px tall in the nav) | brass                           | "Start your story" → `/sign-in`. Phone: `sm` without arrow, plus a 40 px menu button                                                                                                             |
| Eyebrow      | `label`                                                | `--fg-60`                       | "MBA applications · in your own words", 24 px rule before it                                                                                                                                     |
| H1           | `display-hero`                                         | `--fg`                          | lines `["Tell it once.", "Tell it well."]`; "well." in Instrument Serif italic at `--fg-60`. Server-rendered; the LCP element. Phone array identical                                             |
| Subline      | `body-lg` 17 / 1.55                                    | `--fg-80`                       | "AdmitStories listens to your life story once, then drafts each school's essays from it, shows its reasoning, and marks which words are yours."                                                  |
| Primary      | button `lg` primary with arrow                         | brass                           | "Start your story" → `/sign-in`                                                                                                                                                                  |
| Secondary    | button `lg` secondary                                  | frost-flat                      | "See how it works" → `#how`                                                                                                                                                                      |
| Model credit | `ui-sm` 13 / 18                                        | name `--fg-80`, rest `--fg-64`  | `ModelSealMark` 28 px + `MODEL_NAME` · "trained on " + `TRAINED_ON`; links to `#the-model`                                                                                                       |
| Facts        | index in `label`; text `ui` 14 / 20                    | index `--fg-60`, text `--fg-80` | "01 You talk. By voice or by typing, one question at a time." · "02 It drafts. Every essay, one school at a time." · "03 You see why. Each draft shows its reasoning and which words are yours." |
| Sample note  | `label`                                                | `--fg-60`                       | "Sample applicants · fictional, as is Northfield", right end of the strip (base: under the stage)                                                                                                |
| Pause        | 36 px icon button (44 px hit area), `frost-flat`       | `--fg-80`                       | "Pause the sample" / "Play the sample"; beside the sample note; absent under reduced motion                                                                                                      |

**Phone menu.** The existing native `<dialog>` sheet (`menu-dialog.tsx`), restyled: `--bg` with
grain, 24 px top radius, the three links in `display-3` on hairlines, the primary button full
width at the bottom above the safe-area inset. It rises on the `glide` spring and fades under
reduced motion. Past the hero the nav keeps the same frost; it does not change shape.

Copy lives in `_copy/hero.ts`. Headline reasoning: "Your story, admitted." promises an outcome,
which the product refuses to do (`INTEGRITY_LINES`), so it is out. "Tell it once. Tell it well."
is the product's actual mechanism in six words and sets in two equal lines at any width.

### 3.4 The stage

All of it is decorative (`aria-hidden`), with one visually hidden sentence describing it:
"A sample: a sentence a fictional applicant said becomes the opening of three Northfield essays,
each with a note on why."

**The Voiceline.** A `<canvas>` across the full hero width, 96 px tall, centred on the horizon,
`devicePixelRatio` capped at 2.

- Stroke 1.25 px, round joins. Colour is a horizontal gradient: `--line` from 0 to 50 % of the
  width, blending to `--accent` at 68 % and holding to the right edge.
- Shape at x (0–1 across the width) and time t:
  `y = A(t) · E(x) · [0.55·sin(2π(xW/140 − 0.6t)) + 0.30·sin(2π(xW/52 + 1.1t) + 1.7) + 0.15·n(xW/18, 2.4t)]`
  where `n` is 1-D value noise, `E(x) = smoothstep(0.50, 0.70, x) · (1 − smoothstep(0.965, 1, x))`
  keeps it flat under the copy and tapered at the edge, and `A(t)` is the speaking amplitude:
  `syntheticSignalAt()` (already in `@admitstory/ui`, driven by the sentence's word timings),
  smoothed, times 34 px at `lg`, 22 px at base.
- 180 sample points at `lg`, 96 at base. One `beginPath`, one `stroke`. Nothing else is drawn.
- On phones `E(x)` spans the full width (`smoothstep(0.04, 0.2, x)` and the same taper).

**The sentence.** Instrument Serif italic, 34 px at `lg`, 24 px at base, line-height 1.2,
`--fg` for words already said and `--fg-48` for none (words that haven't been said aren't
rendered ahead of time, so nothing dims). Max two lines at `lg` (546 px), three at base. Its last
baseline sits 52 px above the horizon. Each sentence's block height is reserved up front (the
tallest of the three), so nothing shifts.

**The sheets.** Three sheets of paper (`data-theme="day"`), each 248 × 336 px at `lg`, 168 × 228
px at base, `--radius-paper`, no shadow.

- A hand of cards: sheet 1 left and lowest, sheet 3 right and on top. Offsets from the stage
  centre (x, y, rotation): `lg` (−132, 10, −5°), (0, 0, 0°), (+132, 12, +5°); base (−86, 6, −5°),
  (0, 0, 0°), (+86, 8, +5°). Their bottoms sit 132 px above the horizon at `lg`, 104 px at base.
- Each sheet is two columns: a **left margin** 76 px wide (52 px at base) holding the margin note,
  a 1 px `--rule`, then the body. The left margin is the part of every sheet that stays visible
  in the fan, so all three notes can be read.
- Margin note: `note` type at 10.5 px / 15 (9.5 px at base), `--accent-ink`, sentence case, top
  aligned 44 px down.
- Body: a `label` at 9.5 px in `--ink-66` ("WHY NORTHFIELD", "SHORT-TERM GOAL", "A TIME YOU
  LED"), then the essay's opening in `read-sm` at 12.5 px / 1.6 (`--ink`), 5–7 lines, with the
  applicant's spoken phrase marked as `verbatim` (§2.3, brass-ink hue for samples). A foot line in
  `label` 9 px with the count against the limit (for example "187 / 200 WORDS").

**The three samples** (existing fictional applicants; one new person each loop, never the same
one twice in a row):

| #   | Applicant (source file)                                                 | Sentence                                                                            |
| --- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1   | Night-shift hospital systems analyst (`_data/sample.ts`, `SAMPLE_LINE`) | "It was 2 a.m. and the feed from the lab system was dropping every fourth message." |
| 2   | Fintech product manager (`_data/sample-words.ts`, L115)                 | "Not one of them was angry. They had simply forgotten it was there."                |
| 3   | Family packaging business (`_sections/app-preview.tsx`)                 | "My father ran the plant from a notebook, and the notebook was always right."       |

Margin notes for sample 1 (the others are written in Phase 2 in the same voice, three each):
"Why Northfield" → "Opens on the ward at 2 a.m. The school asks about ownership, so it comes
first." · "Short-term goal" → "The goal grows out of that night: teams that never need the call." ·
"A time you led" → "No title in this story. Kept: the phone list and the terrible coffee."
(The brief's example says 3 a.m.; the sample says 2 a.m., and the sample wins.)

### 3.5 Motion

**Entrance** (CSS, under `data-motion="on"`; each step is the §2.10 `enter`):

| Step | Element                             | Delay                                                     | Ends |
| ---- | ----------------------------------- | --------------------------------------------------------- | ---- |
| 1    | nav                                 | 0 ms                                                      | 800  |
| 2    | eyebrow                             | 60 ms                                                     | 860  |
| 3    | H1, per word (6 words), 90 ms apart | 120, 210, 300, 390, 480, 570 ms                           | 1370 |
| 4    | subline                             | 520 ms                                                    | 1320 |
| 5    | actions, then model credit          | 640, 700 ms                                               | 1500 |
|      | stage, strip                        | not animated in: they are simply there (the poster frame) |      |

The H1's first word starts 120 ms after first paint, so LCP stays within one frame of FCP +120 ms.
Phase 2 measures it; if the animated H1 costs more than 100 ms of LCP against a static one, the
H1 words keep `opacity: 1` and animate only translate and blur.

**The poster.** The server renders the stage complete and still: sample 1's sentence, its three
sheets fanned with their notes, and an inline SVG path of the Voiceline frozen at a chosen
speaking shape (t = 1.7 s, seed fixed). That is the first thing anyone sees, with or without JS,
and it is the screenshot.

**The loop.** A lazy island (loaded on idle after `load`, only while the hero is in view) takes
over from the poster at the "hold" step and runs:

| t (s)  | What happens                           | Values                                                                                                                                                                                                |
| ------ | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.0    | hold on the poster                     | 2.4 s on the first pass                                                                                                                                                                               |
| 2.4    | sheets leave                           | each: opacity 1 → 0, y 0 → −12 px, 500 ms `--ease-exit`, 60 ms apart; sentence fades 400 ms; line settles flat (amplitude → 0, 600 ms `--ease-line`)                                                  |
| 3.4    | rest                                   | 400 ms of a flat line                                                                                                                                                                                 |
| 3.8    | next applicant speaks                  | amplitude 0 → 1 over 400 ms; each word at its estimated timing (`estimateWordTimings`, about 250 ms a word): opacity 0 → 1, y 10 px → 0, blur 6 px → 0, 420 ms `--ease-rise`                          |
| ≈ 7.6  | last word lands; line settles          | amplitude → 0 over 600 ms; 500 ms beat                                                                                                                                                                |
| ≈ 8.7  | the sentence lifts into the sheets     | sentence: y 0 → −40 px, opacity 1 → 0, 600 ms `--ease-rise`. Sheets rise from the horizon: y +60 px → rest, opacity 0 → 1, rotation 0 → rest, scale 0.96 → 1, `drift` spring (≈ 680 ms), 120 ms apart |
| ≈ 9.7  | the spoken phrase is marked on sheet 3 | the underline draws left to right, `background-size` 0 → 100 %, 500 ms `--ease-line`                                                                                                                  |
| ≈ 9.9  | margin notes appear                    | opacity 0 → 1, 300 ms, 150 ms apart, left to right                                                                                                                                                    |
| ≈ 10.5 | hold                                   | 3.0 s, then back to 2.4                                                                                                                                                                               |

One pass is about 11 s. Words and sheets are DOM, moved with the Web Animations API on
`transform`, `opacity` and (words only) `filter`; the island imports no Motion and no GSAP.

**Stops.** `IntersectionObserver` (hero under 10 % visible), `visibilitychange` (tab hidden) and
the pause button each cancel the `requestAnimationFrame` loop and pause the running animations.
Paused means zero frames, not an idle loop. Resuming continues from the same step.

### 3.6 Reduced motion and no JS

The poster frame, exactly, and nothing else: flat-to-speaking line as inline SVG, sample 1's
sentence, its three sheets and notes. No pause button, no loop, no island download (the gate
returns "never" under `prefers-reduced-motion`). It is composed to stand as a picture: the line
rising at the right, the sentence resting on it, the sheets above.

### 3.7 Budget for the hero

|                                          | Budget                                                                                                                                              | How it's checked                                            |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| First-load JS for `/`                    | ≤ 152 KB gz (today 153.1 of 155). The hero's first-load part is a gate of ≤ 0.6 KB; today's `HeroStage` reducer and renderer gates leave first load | `bundle:check`                                              |
| Lazy hero island                         | ≤ 7 KB gz, no Motion, no GSAP, no OGL                                                                                                               | source map of the chunk                                     |
| Canvas frame                             | ≤ 1.5 ms of script, ≤ 4 ms total per frame on a mid-range phone (4× CPU throttle)                                                                   | Performance trace over one full loop; recorded in REPORT.md |
| Frames while hidden, offscreen or paused | 0                                                                                                                                                   | trace                                                       |
| CLS                                      | 0 from fonts and from the loop (reserved sentence box; sheets absolutely placed)                                                                    | Lighthouse                                                  |
| LCP                                      | H1; < 2.5 s on Lighthouse mobile                                                                                                                    | Lighthouse                                                  |

---

## 4. Marketing: composition sketches

Dark-only. `marketingTheme()` returns Night for every preference and the footer's theme switch
goes (the app keeps its own). Each scene is one idea, one composed visual, and space. Scenes
reveal once (§2.10); only the hero moves on its own. Headings are `display-1` unless noted; scene
eyebrows are `label`.

| #   | Scene                                             | Layout                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Key type and details                                                                                                                                                                                                                                                                 |
| --- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2   | **Schools strip**                                 | One full-width band between hairlines, 96 px tall. The 16 names from `_data/schools.ts` set as one justified paragraph of names, two lines at `lg`, separated by mid-dots; a mono label at the left: "16 schools, verified for 2026–27". Static: the current sideways scroller goes                                                                                                                                                                                                                              | Names: Geist 20 / 28, 450, `--fg-80`. No logos. CSS only                                                                                                                                                                                                                             |
| 3   | **How it works** (`#how`)                         | Sticky split, `lg`+: left columns 1–5, the four steps (Tell → Position → Draft → Refine) as a list; right columns 6–12, one product window (32 px frame, 8 px bezel, `--surface-1`) pinned at `top: 112px`. As each step's text block crosses the middle of the viewport the window swaps to that step's screen: a self-contained 250 ms cross-fade plus 8 px rise, stepped, never scrubbed. Phone: no pin; each step is followed by its own window. Folds in "follow one sentence" and the real-screens stepper | Step number in `label`; step title `display-3`; body `body`. Windows are live markup built from the system: the Studio (prompt, Voiceline, transcript), the positioning summary, an essay sheet with margin notes, the revision review. The Voiceline in the Studio window is static |
| 4   | **School by school**                              | Heading left. Below, three columns, one per real school from the packs (default: Wharton, Tuck, HEC Paris; final pick in Phase 3 from what the packs actually emphasise). Each column: the school name, a one-line "what this school listens for" taken from its pack, then the _same_ fictional story's opening as a small sheet, with a different phrase marked and a different margin note. The row is the idea: one story, three readings                                                                    | School names Geist 24, 450. Sheets as in the hero (`read-sm`). Fictional applicant and "illustrative" label under the row. No school logos                                                                                                                                           |
| 5   | **Essays that show their thinking** (paper scene) | The section itself turns to paper: full-bleed `--paper` with a 32 px top radius rising out of the dark. Centre: one essay sheet at reading size, 68ch; right margin: three reasoning notes aligned to the paragraphs they explain; a "Your words" switch above it (the existing toy, `Y` key). Below the sheet: "Write your own line" (browser-only, redesigned as one paper text field whose line then appears marked in the sheet's first paragraph)                                                           | Essay in `read` 19 / 1.65. Notes in `note`. Heading in ink, `display-1`. Fictional note. Source Serif loads lazily here (below the fold)                                                                                                                                             |
| 6   | **The model** (`#the-model`)                      | An instrument panel: left columns 1–4 the dial seal (240 px) with the heading under it; right columns 6–12 the ledger from `MODEL_CORPUS` as a typeset table: figure, title, one line, each row on a hairline                                                                                                                                                                                                                                                                                                    | Figures: Geist Mono 40 px, tabular, `--fg`. Titles `title`. Lines `body` `--fg-64`. `yoursLine` as the closing sentence in Instrument Serif italic 24 px. Rules draw in on reveal (`scaleX` 0 → 1, 600 ms, 80 ms apart)                                                              |
| 7   | **Connect**                                       | Heading and paragraph left (columns 1–5); right, a static grid of six of the illustrative portraits (3 × 2, 24 px radius, greyscale at rest at 90 % brightness, each with its role in `label` beneath). The marquee goes. "Photos are illustrative" stays directly under the grid                                                                                                                                                                                                                                | Roles only, never names or schools. `SocialProofSlot` sits after this scene (§4.1)                                                                                                                                                                                                   |
| 8   | **What we won't do** (`#wont-do`)                 | Short and sharp: the five `INTEGRITY_LINES` as a numbered list, one hairline between each, on dark. The AI-policy table moves behind the existing "See all schools' AI policies" link (it stays on `/how-it-works`)                                                                                                                                                                                                                                                                                              | Lines in Geist 28 / 1.25 at `lg` (20 px base), 450, `--fg`; numbers in `label`. The first clause of each line carries the weight; the rest is `--fg-64`                                                                                                                              |
| 9   | **Interview practice, coming soon**               | Small: a half-height scene. Left, the honest line; right, one still of the room in a 32 px frame: a question in `display-3`, a timer ring (the Voiceline bent into a circle, 42 s of 2:00 drawn), four lines of transcript in Instrument Serif italic. A `label` chip on the frame: "Preview · coming soon"                                                                                                                                                                                                      | Copy from `INTERVIEW_COMING_SOON_LINE` verbatim. If the still can't be made both honest and beautiful in Phase 3, the scene is dropped and reported                                                                                                                                  |
| 10  | **Pricing** (`#pricing`)                          | Lead-in sentence (the $349-for-guidelines comparison) as a `display-2`. Four columns on one baseline: Free · 1 school · **5 schools** · 10 schools. The 5-school column is the only card with a filled surface (`--surface-2`), the only brass button, and is 16 px taller top and bottom. The others are open columns separated by hairlines with secondary buttons. Phone: 5 schools first, then 1, 10, Free                                                                                                   | Prices in Geist Mono 56 px (`figure`), from `plans.ts` via `_data/pricing.ts`, never typed. "$500" struck through beside "$349" in `--fg-48`. "Most chosen" as a `label` chip. Under the row, one quiet line: `TAX_AND_FINAL_LINE` ("…All sales are final…"), `ui-sm`, `--fg-64`     |
| 11  | **FAQ** (`#questions`)                            | Heading in columns 1–4; the list in columns 6–12 as native `<details>`, hairline between rows, a plus that turns 45°                                                                                                                                                                                                                                                                                                                                                                                             | Questions `title`; answers `body` `--fg-80`, max 60ch                                                                                                                                                                                                                                |
| 12  | **Final CTA**                                     | One sentence, centred, `display-1`, and the primary button. Behind it the horizon line crosses the full width at the baseline of the last line of type, flat, with one peak (the mark) under the button. No Voiceprint                                                                                                                                                                                                                                                                                           | "Your story, told well, for each school." with "told well" in the italic accent                                                                                                                                                                                                      |
| 13  | **Footer**                                        | Dark. Wordmark and one line left; Product, Trust, Contact columns; the affiliation disclaimer and copyright on a last hairline row                                                                                                                                                                                                                                                                                                                                                                               | Links `ui` `--fg-64`; `label` column heads. `LEGAL_ENTITY` is still a TODO in the code (§9.6)                                                                                                                                                                                        |

### 4.1 `SocialProofSlot`

`components/social-proof-slot.tsx`: takes `items` from a single data file that ships empty, and
returns `null` when there are none. No wrapper, no heading, no spacing when empty. It is placed
after Connect on `/` and above the plans on `/pricing`, with a comment at each call site.
`placeholder-copy.test.ts` keeps guarding it.

### 4.2 Other marketing pages

| Page                 | Sketch                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/how-it-works`      | Dark. A longer telling of scene 3: each of the four steps gets a full-width band with its product window (static here, no pin). Then the pack's file map "assembling" (the existing `_assembly` island restyled: each deliverable is a line that draws from a story to a file). Then the full AI-policy table (`#ai-policies`) on a paper band, typeset as a real table with dates in mono. Page title `display-1`                                    |
| `/pricing`           | Dark. Title, then the same four-column plan row as scene 10 at full size, then "what's in a pack" as a two-column typeset list (free vs pack), the comparison table against other services on hairlines, the coming-soon line for interview practice, the final-sale line, the FAQ subset. `SocialProofSlot` above the plans                                                                                                                          |
| `/privacy`, `/terms` | **Paper pages, built for reading.** The page body is `--paper` under the dark nav (which takes the paper frost variant once the title has scrolled past). One column of `read` 19 / 1.65 at 68ch in columns 4–10; a sticky contents list in columns 1–3 in `ui-sm`; section numbers in `label` hanging in the margin. `/privacy` keeps the voice-path diagram (audio → text → discarded) redrawn as a Voiceline that ends in a full stop. Footer dark |
| OG images            | 1200 × 630, `#0B0A09`: the wordmark top left, the page's headline in Geist 88 px with its italic accent, the horizon line with one peak across the lower third. Per-page headline; same template for all five                                                                                                                                                                                                                                         |
| Titles               | `HOME_TITLE`: "AdmitStories: tell it once, tell it well". Others: "How it works", "Pricing", "Privacy", "Terms" with the existing `%s                                                                                                                                                                                                                                                                                                                 | AdmitStories` template |

---

## 5. Entry: composition sketches

"Walking into a quiet room": dark, one thing to do, nothing else on screen.

| Screen                            | Sketch                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/sign-in`                        | Full dark screen, wordmark top left. Left half (columns 2–6): heading "Sign in or create your account" in `display-2`, one line of `body`, the email field, the primary button ("Email me a sign-in link"), a hairline "or", then Google and passkey as two secondary buttons. Right half: a single sheet of paper at a slight angle (−2°) carrying a sample essay opening with its margin note, and under the form a flat Voiceline that brightens left to right when the field takes focus. The current split panel with its radial glow goes. "Check your email": the form is replaced in place by the heading and the address, the line draws to a peak. Phone: form only; the sheet is dropped, the line stays. All three sign-in methods, Turnstile and the kept-line note keep working untouched |
| `/welcome`                        | Same room. "Before you start" in `display-2`; the two commitments as plain checkboxes with `body` text at 60ch; the three "how we work together" lines on hairlines. The button is disabled until both are ticked; each tick draws a short stroke                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `/first-run`                      | Same room, four steps. Top: the progress is a Voiceline with four stops; the peak sits on the current one and travels on "Next" (500 ms). One question per screen in `display-2`; choices as chips; the "How much time do you have?" options as three cards. "This becomes your Voiceprint" shows the applicant's own line (flat until they have spoken) instead of the orb. The résumé upload step keeps its behaviour                                                                                                                                                                                                                                                                                                                                                                                 |
| `/goodbye`, not-found, root error | Dark, centred: a flat line with a gap in it, one sentence in `display-2`, one button. `app/error.tsx` uses `buttonStyles()` on a plain element, as now                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

---

## 6. App: composition sketches

### 6.1 Shell

| Part                                | Sketch                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Casing**                          | Always dark (§1.2). At `lg`+: sidebar 256 px, and the working area is a **bay**: inset 8 px from the top, right and bottom, `--radius-card` (24 px), painted `--space` (Day desk or Night). The app looks like a dark instrument holding a lit page. Below `lg`: the bay is full-bleed, with a top bar and a floating dock                                                                                                                                                                                                                              |
| **Sidebar**                         | `frost-flat` on `--bg`. Top: wordmark 17 px. "New story": primary button `md`, full width, plus glyph. Search: a 36 px `frost-flat` pill, "Search" and a `⌘K` key hint in mono. A `label` head ("Workspace"), then the seven destinations: 40 px rows, icon 18 px (Phosphor regular), `ui` text at `--fg-64`; current: `--fg`, `--surface-2` pill. No brass. Bottom: Settings, then the account row (initials in a 28 px circle, name `ui-sm`, email in mono 11 px at `--fg-64`) opening the same account menu (Dossier stays there and under Settings) |
| **Top bar** (below `lg`)            | 52 px, `frost`, safe-area padded: mark, page title in `ui`, search and account buttons (44 px)                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Dock** (below `lg`)               | A floating `frost` pill, 56 px tall, 12 px from the edges plus `env(safe-area-inset-bottom)`; seven icons, 44 px targets; current: `--fg` with a 4 px dot beneath                                                                                                                                                                                                                                                                                                                                                                                       |
| **Command palette**                 | 560 px, `frost`, 24 px radius; input 52 px in Geist 17; rows 44 px; shortcuts in mono; same actions and loading behaviour (lazy)                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Account menu, toasts**            | Menu: `frost` card, 24 px radius, rows 40 px. Toasts: `frost` pills, bottom centre, above the dock on phones                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Page header** (`page-header.tsx`) | `label` eyebrow, title in `display-2`, one `body` line in `--text-soft`, 48 px above the content                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

### 6.2 Screens

| Screen                                                 | Sketch (layout · key type · states that must survive)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Home** `/home`                                       | One column, max 880 px. (1) The next step: a single wide card with the action in `display-3` and one primary button. (2) The path: the four stages as one Voiceline with four stops, brass up to where the applicant is, the peak on the current stop; labels beneath in `ui-sm`. (3) Schools: a table on hairlines (school, where it stands, next deadline in mono, "Open"). Calm and scannable: no cards inside cards                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Story Studio** `/studio`                             | Night, immersive: the bay is `--bg` edge to edge and the sidebar collapses to a 64 px icon rail at `lg`+. Chapter tabs across the top as `label` text tabs. The question: Geist `display-2` (up to 48 px), left-aligned in columns 2–9, the words not yet reached at `--fg-48`. Under it the live transcript in `transcript` type, newest words `--fg`, older `--fg-64`. A horizon Voiceline crosses the bay at 68 % of its height in the applicant's hue; the record button sits on it, centred: an 88 px circle, `frost-flat` with a mic glyph at rest, brass-filled while listening, and the line comes alive from the button outwards with the real microphone signal. Under the button: "Tap to talk, or hold Space" in `label`. A Speak / Write segmented control top right (typing swaps the transcript for a paper-raise text area on the same line). Shelf and coverage: a 320 px `frost-flat` panel on the right at `xl`, a sheet below that; coverage is six thin lines. Keeps: every capture state, space-to-talk, voice notices, skip / short on time / finish, the session summary, the "N answers left" count from five, and the 30-answer gate (three option cards)                                                                      |
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
| `/home`                    | The path line draws to where you are                                                                  | 0                                                                                    | CSS, 900 ms, once per visit                                   |
| `/studio`                  | **The line answers your voice** from the record button outwards                                       | replaces the OGL renderer: about −20 KB lazy net; shared `voiceline` module ≤ 2.5 KB | canvas ≤ 2 ms; 0 when not listening                           |
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

Hard caps for the gates: no route preloads more than 110 KB of fonts; the build carries no more
than 5 font files (the OG image's `.ttf` aside). Source Serif is declared once without preload in
the root layout (so `--font-reading` exists everywhere and lazy uses just work) and declared again
with preload in the layouts of the reading routes; both resolve to the same two files (Phase 1
verifies the URLs match, or the reading routes get their own font module). CLS from fonts: 0,
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

| Removed                                                      | When                                 | Why                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gsap`                                                       | Phase 3                              | its one user, `_follow/follow-sequence.ts`, folds into the stepped "How it works" scene (CSS transitions)                                                                                                                                                                                               |
| `lenis`                                                      | Phase 3 (**recommendation: remove**) | With stepped scenes there is nothing for smooth scrolling to smooth. It is desktop-only today, starts on the first wheel event, and adds input latency and a second scroll model that fights `position: sticky`, anchor links and the phone's native scroll. Anchor jumps use `scroll-behavior: smooth` |
| `ogl`, `detect-gpu`, `public/detect-gpu`                     | after Phase 5, with a yes (§9.1)     | the brief says no WebGL anywhere; they stay only as long as `/prototype/*` uses them                                                                                                                                                                                                                    |
| `next/font` faces Newsreader, Hanken Grotesk, JetBrains Mono | Phase 1                              | replaced                                                                                                                                                                                                                                                                                                |

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
