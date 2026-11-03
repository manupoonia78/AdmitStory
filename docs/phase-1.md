# Phase 1: Story Studio (text) and the Dossier

Built 30 October 2026 on branch `phase-0`. Spec: `AdmitStory_Build_Spec.md`, §16 Phase 1, plus
first-run onboarding (§5.1), which the spec assigns to no phase and which ends in the Studio.

## What was built

### `packages/shared` — the taxonomies and the compact dossier

Appendix D's 21 traits with the lenses each one evidences, the four admissions lenses (plus the two
extra coverage bars), Appendix A8's 16 prompt archetypes, the nine Studio chapters, and the §8.7
provenance codes (`F01`, `S03`, `L041`, `P2`) with allocation and parsing.

`dossier/compile.ts` is the §8.2 L2 compiler: a pure function from the dossier's rows to the
compact, ID-addressed text that is the only thing any drafting agent ever learns about the
applicant. Three rules live here as code rather than in a prompt, because a model must not be the
thing that enforces them:

1. **Nothing without consent enters the snapshot** (§8.7, §14.3). A withheld story takes its golden
   lines, its people and its brand evidence with it, and the snapshot states how many items were
   withheld so an agent knows to ask rather than guess.
2. **A person is named only when `may_name` is true**; otherwise their role stands in.
3. **A fact with an approved phrasing carries it**, since every draft is checked against that
   phrasing by the §8.8 `factMismatch` linter.

Output is deterministic — the same rows always compile byte-for-byte identically — so the
five-minute prompt cache keeps hitting across a kit pipeline. When a snapshot would exceed §8.5.3's
10K-token target it gives up detail from the least important stories first, never a fact, and says
on a `TRIMMED` line what it cut.

### `packages/slots` — the evidence slot model

Appendix C's 48 slots with their weights, chapters and archetypes; Appendix B's question bank and
its three Express openers; and the §5.2 selector:

```
weight × need × emptiness × chapter_affinity − fatigue
```

Deterministic and inspectable: the model never decides what to ask about, only how to phrase it.
`need` is injectable because the real term needs School Packs (Phase 3); until then it is how often
a typical top-20 application asks for the archetypes a slot feeds. Appendix C's "filled" rule — a
slot is filled by a confirmed story, or by confirmed facts for a factual slot — is derived from the
dossier on every read rather than trusted from the table, which is what makes "no question is ever
asked twice" (§2) hold even if the table drifts.

### `packages/db` — Story Studio and Dossier tables

Migration `0001_studio_and_dossier` adds §10's `sources`, `studio_sessions`, `studio_turns`,
`slots_state`, `facts`, `stories`, `golden_lines`, `people`, `brand`, `voice_profiles` and
`dossier_snapshots`, plus the §10 profile columns Phase 0 had not needed (`voiceprint`,
`voiceprint_hue`, `theme`, `ui_sounds`). `0002_story_people_codes` adds `stories.people_codes`.

`crypto/content.ts` is the §14.4 application-layer encryption: AES-256-GCM, keys from
`CONTENT_ENCRYPTION_KEYS`, the key id authenticated inside the envelope so a value can never be
paired with the wrong key, and a prefix a rotation sweep can match on. Only `sources.text_encrypted`
uses it — everything the applicant said or uploaded. The structured results are stored in the clear,
because every selector, linter and query has to read them.

Repositories are ownership-checked on every statement, and provenance codes are allocated inside
the same transaction as the insert, so two concurrent extractions cannot hand out the same code.
`upsertFacts` never silently overwrites: the same value confirms a fact, a different one raises a
conflict for the applicant to settle.

### `packages/ai` — the Studio agents

Five tasks, each with its prompt file, Zod schema and route: `studio.interviewer` (§8.5.1),
`studio.extract` (§8.5.2), `studio.consolidate` (§8.5.3), `import.parse`, and
`eval.applicant_simulator`. The §8.5 prompts are transcribed from the spec and extended only where
it left something unspecified (what counts as a fact rather than a story, what a golden line is,
how offsets are counted).

`ai.run()` gained the two per-request cache layers §8.2 specifies and Phase 0 had not needed: a
school pack (L1, one hour) and the compact dossier (L2, five minutes). The prompt and its canon
subset are still prepared once per version, so the long-lived prefix still caches.

### `apps/web` — first run, the Studio and the Dossier

**First run** (`/first-run`, §5.1): four screens, one question each. Intake and program and rounds;
country and time zone and a one-line current role; "bring what you have"; how much time you have
today. The §6.7 hero is the Voiceprint being born — fainter at the start, brighter with each answer.
The one-line role becomes a Fact Sheet fact rather than a profile column, so the interviewer
confirms it in passing instead of asking again.

**Story Studio** (`/studio`, screen B): chapter tabs over one panel, the question in Newsreader, the
composer, the shelf with the §6.7 capture flight, the coverage meter and the facts counter. Hurry
mode, session resume, "skip for now", and the end-of-session summary card. A turn works as §7.3
describes, with one change: the question returns as soon as the Interviewer answers, and extraction
continues after the response is sent, so the applicant waits only for the question.

**The Dossier** (`/dossier`, screen C): Stories, Facts, Brand and Voice. The Stories tab's hero is
the §6.7 constellation — nodes by era, grouped by what they prove, lines between stories that share
a trait, with drag, zoom, arrow-key navigation and the list view one keystroke away. The links are
drawn on a canvas; every node is a real focusable button, so focus, hover and screen-reader names
come from the platform. The Facts tab is the dense table §6.7 asks for, with one-tap conflict
resolution and an editable approved phrasing.

**Uploads**: one route that takes a PDF, `.docx` or text file, extracts the text, stores it
encrypted and discards the file, then runs `import/parse-upload` in the background.

**Inngest**: `dossier/consolidate` (every ~8 turns, at chapter end, after an import, at session end;
concurrency keyed by user) and `import/parse-upload`.

### Fixtures and the simulator

`fixtures/applicants/` holds Appendix J's twelve synthetic applicants — `profile.json`,
`ground_truth.json` and `transcript_seed.md` each — across six countries and five speaking styles.
Nobody in them is real.

`packages/ai/src/fixtures/simulate.ts` runs automated Studio sessions in two modes. **Scripted** mode
uses no model at all: the answer to a question is the ground-truth material for the slot the
selector asked about. It drives the real selector and the real slot-state rule, so it can show
whether a filled slot is ever asked about again — §16's acceptance criterion — and it costs nothing:

```sh
pnpm --filter @admitstory/ai simulate        # 50 sessions
```

**Live** mode has the Haiku simulator answer in character and the real Interviewer phrase the
questions; it measures question quality and latency, and needs an API key.

## How to run it

```sh
pnpm install
pnpm db:migrate
pnpm dev                                      # http://localhost:3000
```

A new account lands on `/welcome`, then `/first-run`, then the Studio. Sign-in emails are written to
`.outbox/` locally.

`.env.local` needs two new variables for Phase 1, both already in `.env.example`:

```
CONTENT_ENCRYPTION_KEY_ID=dev
CONTENT_ENCRYPTION_KEYS={"dev":"<32 bytes, base64>"}
```

Generate a key with:

```sh
node -e 'console.log(require("node:crypto").randomBytes(32).toString("base64"))'
```

Without them, storing a Studio answer fails loudly rather than writing a transcript in the clear.

Other commands:

```sh
pnpm --filter @admitstory/ai simulate              # scripted Studio runs
pnpm --filter @admitstory/ai fixtures:resumes      # regenerate fixture resume PDFs
pnpm --filter @admitstory/web bundle:check         # per-route JS, after a build
```

## Performance

Phase 0.5 left every app route at 149.5 KB of first-load JavaScript against §6.11's 160 KB budget,
which leaves about 10 KB for a feature screen. Phase 1's first pass spent that and more — 18 routes
over budget, `/studio` at 252 KB — so a good part of this phase went on getting it back:

|                               | Before   | After    |
| ----------------------------- | -------- | -------- |
| Routes over the 160 KB budget | 18       | 2        |
| `/studio`                     | 252.1 KB | 161.0 KB |
| `/dossier`                    | 206.8 KB | 169.6 KB |
| `/home` (the shell floor)     | 180.6 KB | 151.7 KB |

What was wrong and what changed:

- **Zod was in the client bundle of every route** (31 KB gzipped). The taxonomy modules built their
  Zod enums at the top level, so importing them for their plain data — which client components do
  constantly — pulled Zod in, and a top-level `z.enum()` call cannot be tree-shaken. The validators
  now live on `@admitstory/shared/schemas`, built there from the plain arrays, and nothing in the
  browser imports that file. This is what took every route back under budget.
- **Motion was in the Studio's first load.** It arrives through the story-capture flight and through
  `SpokenQuestion`, whose word-by-word brightening syncs to TTS word timestamps — a Phase 2 feature.
  Phase 1 sets the question in plain Newsreader and code-splits the shelf pane, which holds the
  capture flight and the live channel. Nothing can be captured until the first answer is in, so the
  flight is ready well before it is needed.
- The constellation, the story detail card, the three non-default Dossier tabs and the session
  summary are each code-split, with placeholders that hold the exact shape of what is coming (§6.1).

`/studio` is 1 KB over and `/dossier` is 9.6 KB over. Both are the shell floor plus genuinely
needed code, and the next real win is in the floor rather than in feature code: React and the
app-router runtime are 105 KB of it, and PostHog is a further 10.8 KB that is counted in first load
even though it only initialises when idle. Worth a pass of its own.

## What the review caught

One review pass over the finished phase, after it was building and running. Four things were real
and are fixed:

- **A golden line could have been attached to the wrong story.** The Extractor answers with a
  position in its own `story_candidates` array, and the code indexed the created rows by that
  position. If a row had not come back, every later index would have shifted and one of the
  applicant's verbatim sentences would have been filed under a story they did not say it about —
  silently, and in the one part of the system whose whole job is provenance. The position is now
  checked against the story's nickname before it is used, and an unresolvable position attaches the
  line to nothing rather than to a guess.
- **Factual slots were trusting the table they were meant to check.** `loadKnowledge` derives slot
  state from the dossier precisely so "we already know this" can never be stale — and then, for
  factual slots, copied the stored row straight back, which reintroduced the thing it was avoiding
  and did it for every slot rather than the three factual ones. Factual slots now derive from
  confirmed Fact Sheet entries, through `factKeys` on the slot itself, and a confirmed story still
  wins over a fact.
- **The offline queue re-registered its listener on every render,** because the effect had no
  dependency array. It now goes through `useEffectEvent`.
- **The Studio page read the profile twice,** once through the request-cached guard and once
  directly, for one field.

The §14.3 consent contract was then checked end to end against the real database, through the real
repositories and compiler: a sensitive story is private by default, its situation text, its golden
line, the person who appears only in it and the sensitive fact are all absent from the compiled
snapshot, the withheld count is stated, granting consent lets it in, and a second user sees none of
it.

## Deviations from the spec, and why

- **SSE tails the database instead of Redis pub/sub.** §7.3 publishes shelf events on a Redis
  channel; Upstash is not configured and is not part of Phase 1. `GET /studio/sessions/:id/events`
  polls two small user-scoped indexes every 800 ms and stops when the client disconnects. It swaps
  to pub/sub when Redis arrives for the kit pipeline.
- **Extraction runs after the response, not beside it.** §7.3 runs the Extractor and the Interviewer
  in parallel and streams the question over SSE. §8.3 gives the Extractor 2,000 output tokens, which
  takes seconds, against a 1.5 s median turn target — so the question is returned directly from
  `POST /studio/turns` and extraction continues in `after()`, with the SSE channel announcing stories
  as they land.
- **One upload route, not the signed pair.** §11 lists `POST /uploads/sign` and
  `/uploads/:id/complete` for a direct-to-R2 upload. By your decision there is no R2 in Phase 1, so
  one route extracts the text, stores it encrypted and discards the file. This also means §8.3's
  note about sending a PDF to the model as a document input does not apply yet: `import.parse`
  receives text.
- **The Consolidator decides; code formats.** §8.5.3 says the Consolidator "writes the compact
  dossier snapshot". The model returns the judgment — merges, statuses, nicknames, golden lines,
  brand, voice card — and `packages/shared` renders the §8.2 layout from the rows. That makes the
  consent rule and the layout testable code rather than prompt compliance.
- **`facts.consent_to_use` is an addition to §10.** Stories have consent per §5.3b; facts did not,
  which left no way to honour §14.3 for a sensitive fact. Sensitive facts are now private by default
  like sensitive stories.
- **A `goals` table is an addition to §10,** which carries goals only inside the dossier snapshot.
  That would make them unreadable and uneditable in the Dossier UI §5.3 requires.
- **`profiles.target_rounds` and `first_run_completed_at` are additions.** §5.1 asks for "rounds if
  known" before `user_schools` exists (Phase 3), so they are kept as a hint; first run needs a way to
  know it is done.
- **`eval.applicant_simulator` is a new route.** §8.11 and §16 name the simulator; §8.3's table has
  no row for it. Haiku, low effort, as §8.11 specifies.
- **Four routes §11 does not list:** `PATCH /dossier/lines/:id` (starring a golden line, §5.3b),
  `PATCH /dossier/people/:id` (the may-name choice, §8.7), `PATCH /dossier/voice` (the tone control,
  §5.3d) and `POST /uploads`. Each is behaviour the spec requires with no route named for it.
- **No record button in the Studio.** Screen B's wireframe centres it, but Phase 1 is the text path
  and voice is Phase 2. A disabled record button would be worse than none; the composer is primary,
  with "Done", "Skip for now" and "I'm short on time".
- **The question is not `SpokenQuestion` yet.** See Performance above: §6.4's word-by-word
  brightening is explicitly "while the question is read aloud", which does not happen until Phase 2.
- **The Dossier is a seventh dock item, and the mobile dock is now icon-only.** Your decision put the
  Dossier in the dock; seven labelled tabs do not fit a 375px screen at the 13px type minimum, so
  below 640px the bottom dock shows icons with their labels as accessible names. Labels return at
  640px and above. Touch targets stay at 48px.
- **Rate limits are in-process.** §12.4 specifies Upstash. The limiter protects a single instance,
  which is what a development and beta deployment needs; it is not a defence across instances.
  Phase 9 replaces it, as Phase 0 planned for the auth limiter.
- **`need()`, hurry mode and `reapp.changes` are stubbed where they need School Packs.** `need()`
  falls back to archetype prevalence; "gap-only" questioning falls back to the highest-weight
  unfilled slots rather than one school's prompts; `reapp.changes` is dropped unless the applicant is
  known to be a reapplicant, which nothing sets before Phase 3's `user_schools`.
- **The token estimate is uncalibrated.** `estimateTokens` guards the dossier budget with a local
  heuristic tuned to read high. It has not been checked against the real tokenizer because there is
  no API key; the ledger's numbers always come from the API, never from it.

## Not done, or needs you

- **The `ANTHROPIC_API_KEY`.** Everything here is built against the task registry and runs in replay
  mode; no Phase 1 call has been made live. These acceptance criteria need the key:
  - §5.2: a synthetic applicant completing Standard mode by text yields ≥ 10 stories, ≥ 60 facts and
    all four lenses at least "partial";
  - §16: 50 _live_ simulated sessions with zero repeated known-fact questions (scripted mode already
    shows zero);
  - §16: median turn latency ≤ 1.5 s by text;
  - §5.1: uploaded resume facts in the Fact Sheet within 20 seconds.

  When the key arrives: `AI_MODE=live pnpm --filter @admitstory/ai simulate`, then record replays so
  CI stays deterministic.

- **Phase 0.5's own sign-off** is still open (see `docs/phase-0.5.md`): your review of the four
  prototypes, and frame rates on a real mid-range Android and a recent MacBook.
- **The content-encryption key** has to be in `.env.local` before a Studio answer can be stored. In
  production it belongs in a managed secret store, rotated yearly (§14.4).
- **The shell's JS floor**, as above.

## Left for later phases

- **Phase 2** brings the record button back, `SpokenQuestion` with real TTS timestamps, dictation on
  `add-detail`, `voice_seconds` against the free tier's 120 minutes, and the Voiceprint computed
  from speech rather than seeded from writing.
- **Phase 3**: Profile Read (the Studio's summary card points at the Dossier until then), School
  Strategy, the real `need()` and gap-only questioning, and `user_schools.is_reapplicant`.
- **Phase 4**: `drafts`, which is what §5.3's "edits propagate stale flags to any draft that used
  them" needs — nothing can be marked stale while no draft exists. Also `stories.used_in`, which the
  dossier compiler already renders and which stays empty until kits exist.
- **Phase 9**: Upstash rate limits, R2 and the signed upload pair, and the full eval gates.
- `expected.json` for the fixtures (the properties a good kit must have) waits for Phase 4, and the
  six sample school packs wait for Phase 3.
