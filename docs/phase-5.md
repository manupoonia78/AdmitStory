# Phase 5: Form Advisor, Résumé Pass and the consistency check

Built 1 November 2026 on branch `phase-0`, on top of the Phase 3–4 commit. The build spanned two
sessions: the first ran out of usage partway through the app layer, and the second finished it.
Spec: `AdmitStory_Build_Spec.md`, §16 Phase 5, with §5.7 (stage 9), §5.8, §5.10, §6, §8.5.12,
§9.2, §10, §11, §14.2, canon A9 (FORM-01) and A10 (RES-01).

Decisions you made for this phase (1 November):

- **Form rewrites follow the school's essay authorship mode.** A `limited` or `prohibited` school
  gets the recommendations, reasons, pointers and the applicant's own facts for each item, but no
  rewritten entry.
- **The Résumé Pass is per applicant, not per school.** Owning any active kit unlocks it. There is
  one review per uploaded résumé, shared by every kit. Each school's page limit is checked in code,
  so a second kit never pays for a second review.
- **Form fields get a counting rule.** The pack's `FormSection` gains an optional `limit_kind`. It
  defaults to characters including spaces, which is how most portals count.
- **The consistency check is plain code, not a model call.** It is recomputed on every read and
  compares employers, titles, dates, team sizes and numbers. Recommender briefs are an input that
  stays empty until Phase 6.

## What was built

### `packages/shared` and `packages/kb`

- `shared/kit/forms.ts` holds the plain types and constants for both tasks:
  - `FormAdvice` and `FormItem`, plus the six recommendations in screen order and their labels;
  - `ResumeReview` and `BulletDecision`, plus the issue labels and the `[?n]` placeholder pattern.

  It is free of Zod, so client components can import it.

- The pack schema's `FormSection` has an optional `limit_kind`. The compiler prints the counting
  rule only when the pack gives one, so packs already published compile byte for byte as before.

### `packages/linters`

- **`consistency/`**: `checkConsistency(input)` → `ConsistencyFinding[]`. It is pure and
  deterministic, with no dependencies, and is safe in the browser.
  - It compares the Fact Sheet with every résumé bullet and role, every form entry, every essay and
    short-answer paragraph, and (from Phase 6) the recommender briefs.
  - Every finding is a _Must fix_. It lists each place that disagrees, the Fact Sheet first, plus
    the Fact Sheet's value for the one-click fix, one plain sentence, and a stable id that a
    dismissal keys on.
  - It is split by subject: `employers.ts`, `titles.ts`, `dates.ts`, `team.ts` and `numbers.ts`,
    plus the text helpers in `text.ts`. Each finding's id is `"<subject>:<FNV-1a hash>"`, so it
    doesn't change with document order.
  - When the Fact Sheet is involved, `expected` is the value as it should appear in place ("13"),
    even when the approved phrasing is a whole sentence. Only the places that disagree are listed,
    so "a team of thirteen" isn't marked wrong next to "13".
  - **What it can't see** (heuristic limits):
    - **Employers:** a short form ("Meridian Health" for "Meridian Health Systems") is flagged.
      Differences in case, punctuation, possessive, accent or legal form ("GmbH") are not. Names
      with no distinctive word ("Independent consultant") are never checked in prose. A region that
      shares an employer's first words ("Great Lakes" for "Great Lakes Provision Company") would be
      flagged.
    - **Titles:** a title counts only after a trigger ("as", "promoted to", "became", "I was"), in
      a résumé role field, or at the start of a form entry before a known employer. Other people's
      titles, goals, and titles at an unknown organisation are ignored. A real earlier title that
      isn't on the Fact Sheet ("Consultant" before "Senior Consultant") is flagged on the résumé.
    - **Dates:** each date is tied to the nearest title or employer in the same clause, and compared
      at the precision both share, so "2024" matches "Apr 2024".
    - **Team sizes:** a number counts only with a leading verb ("led 13 engineers"), "my team",
      "reporting to me", or "the team was 13". A different team led in the past is still compared
      with the Fact Sheet. That is the main false-positive risk, and "These are different things"
      covers it. "About N" allows 5%; "N+" allows 10% above N.
    - **Numbers:** two numbers are matched by kind, unit, scale and the words of their clause. A
      metric stated only once has nothing to compare against.
- **`fit.ts`**: `fitToLimit(text, rule)` makes an entry fit its field by the portal's counting
  rule, and only ever removes text:
  1. it drops whole trailing sentences first;
  2. then it cuts inside the last clause and tidies the ending;
  3. it falls back to cutting characters for text written without spaces.
- **`resume.ts`**: the résumé as printed lines. It provides the bullet's current text after the
  applicant's decision, a page estimate, the line where the page limit falls, placeholder filling
  and the suggested section order. The page and the Word export use the same helpers, so they agree.

### `packages/db`: migration 0006

§10 names no tables for any of this, so the migration adds three. Each carries `user_id`, and every
repository function is scoped by owner.

| Table                    | Holds                                                                                                                              |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `form_advice`            | One row per kit: the advice, the mode, the applicant's own entry text (`edits`), which entries were shortened, and their versions. |
| `resume_reviews`         | One row per uploaded résumé (a `sources` row): the review, a decision per bullet, and whether to use the suggested order.          |
| `consistency_dismissals` | The findings the applicant marked "These are different things".                                                                    |

A refresh replaces the advice and bumps its version, but never touches `edits`. A new résumé gets
a new review row.

### `packages/ai`

Two tasks, each with a v1 prompt (canon A9 or A10 plus truth discipline), a Zod schema and a
`check()` that sends one repair:

- **`forms.advise`**: one call per school covers every verified form section.
  - Each candidate item gets _Lead with_, _Include_, _Combine with…_, _Move to resume_, _Move to an
    essay_ or _Leave out_. It also gets a one-sentence reason, its cites, an entry when it goes in
    the form, up to three "Make it stronger" pointers and NEED questions.
  - The section gets "What you could still do".
  - The check catches empty reasons, unknown cites, entries over the field's limit by the school's
    rule, more entries than the form takes, an entry in coach mode, an orphaned _Combine with_, and
    a move to an essay that doesn't exist.
- **`resume.review`**: splits the résumé into sections, roles and bullets.
  - Every original, heading, organisation, title and date must appear word for word in the upload.
  - Each bullet gets a verdict (achievement or activity), issue tags, one sentence of feedback and
    a rewrite.
  - A rewrite can't add a number or a name that is in neither the bullet nor the dossier. A missing
    detail becomes a `[?n]` placeholder with a question. Numbers are matched by kind, so "30
    seconds" in the dossier doesn't license "30%".

Replays: `pnpm --filter @admitstory/ai record:phase5 --synthetic` writes synthetic recordings for
the fictional engineer applicant and the Halvorsen pack (draft and coach modes), each first reply
deliberately repaired. `check:tasks` covers both tasks.

### `packages/ui` (`src/forms/`)

- **`FormAdvisor`**: the document plane for a form section.
  - It shows the section's limit, and the pack's guidance with its source and verified date.
  - Then come the recommendation lanes. Each item shows its reason and the applicant's facts. Items
    that go in the form also get an editable entry with a live count by the school's rule, "Copy
    for portal", pointers and NEED chips.
  - Coach mode shows "Your material" and an empty "Write your entry".
  - The section ends with "What you could still do".
  - **The hero moment:** when the pane opens, the candidates arrive as one loose stack and deal out
    into their lanes, 40 ms apart, on the `drift` spring. It is measured from the final layout, so
    nothing shifts, and reduced motion gets a 120 ms fade.
- **`ResumeSheet`**: the Résumé page.
  - The résumé is drawn as a paper sheet. A hairline marks where the page limit falls ("End of page
    1"), and the lines beyond it are dimmed.
  - A live page estimate reads, for example, "About 1.3 pages · Your schools ask for 1".
  - **The hero moment:** accepting a rewrite morphs the words in place, and the overflow below the
    line recedes.
  - Beside the sheet is the review of the focused bullet: its verdict, issues, feedback, the rewrite
    as a word diff, and a field for each `[?n]`. "Keep rewrite" stays disabled until every field is
    answered.
  - Keys: J/K move between bullets, A keeps the rewrite, R keeps the original. There's also Edit,
    Undo, the three priorities, the suggested order switch and "Download Word file".
- **`ConsistencyList`**: the _Must fix_ rows. For a résumé or form value, the button reads "Use
  “13” here". For an essay, it offers "Open Essay 2", and every row has "These are different
  things". When nothing disagrees, it reads "Everything matches across your resume, forms and
  essays."

### `apps/web`

- **Pipeline stage 9** (`lib/kit/pipeline.ts`) runs the Form Advisor, plus the Résumé Pass when a
  résumé has been uploaded and not yet reviewed. Neither failing fails the kit, whose essays are
  ready by then; the form view and the Résumé page each ask again when opened. The stage's output
  records `later: ["recommenders", "interview_plan"]` for Phases 6 and 7. Screen F labels it "Form
  advisor and résumé pass".
- **`lib/forms/`**:

  | File             | Does                                                                                                                                              |
  | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `advise.ts`      | Runs `forms.advise`, decides the mode from the essays' authorship, and fits every entry with `fitToLimit` (a shortened entry gets a Verify line). |
  | `resume.ts`      | Runs `resume.review` and works out the strictest page limit across the applicant's schools.                                                       |
  | `consistency.ts` | Assembles the checker's input from what is stored, for one kit plus the résumé, or for every kit.                                                 |
  | `fix.ts`         | "Use “13” here": rewrites one value in a form entry or a résumé bullet, saved as the applicant's own edit.                                        |
  | `view.ts`        | The form view, including writing advice the first time for kits built before Phase 5.                                                             |
  | `resume-view.ts` | The Résumé page's view.                                                                                                                           |
  | `export.ts`      | The Word file: one column, standard headings, real bullet lists, Calibri, and no tables, text boxes or header or footer content.                  |

- **The Workspace** (`/workspace/[id]`): a form section opens the Form Advisor in the document
  plane. The right plane shows every mismatch across the school's file and the résumé. Entries save
  a second after typing stops. Each essay's Checks tab now lists its consistency findings above the
  linter findings, and they count in the tab's _Must fix_ badge. The Files pane gains "Resume pass",
  which links to `/resume`.
- **`/resume`**:
  - Without a kit, it shows the unlock note.
  - Without a résumé, it shows an upload button. The upload is stored as a résumé whatever its file
    name.
  - With a résumé that hasn't been read yet, it offers "Read my résumé".
  - Otherwise it shows the sheet, plus "Read the new one" when a newer upload exists.
- **Routes** (§11). Every input is checked with Zod, and every route checks ownership and access:

  | Route                                            | Does                                                                                                                                                                       |
  | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `GET /api/kits/:id/forms?deliverable=`           | One section's view.                                                                                                                                                        |
  | `POST /api/kits/:id/forms/refresh`               | New advice from the current Dossier, for one refinement. Free when the Dossier hasn't changed (it returns what's there) and for a kit's first advice; refunded on failure. |
  | `PATCH /api/kits/:id/forms/items/:itemId`        | The applicant's entry text; `null` restores the advice.                                                                                                                    |
  | `GET` and `POST /api/resume/review`              | The page's view; a review of the newest upload. Idempotent per upload.                                                                                                     |
  | `PATCH /api/resume/review/:id`                   | The suggested-order switch.                                                                                                                                                |
  | `PATCH /api/resume/review/:id/bullets/:bulletId` | Keep, keep mine, edit, or undo. Keeping is refused (422) until every placeholder is answered.                                                                              |
  | `POST /api/resume/export`                        | The DOCX, made on demand and stored nowhere.                                                                                                                               |
  | `GET` and `POST /api/consistency`                | The report; `use_expected`, `dismiss` and `restore`.                                                                                                                       |

  `POST /api/uploads` accepts `kind=resume` from the Résumé page.

## How to run it

```sh
pnpm db:migrate                                # applies 0006
pnpm --filter @admitstory/web seed:fixtures    # FICTIONAL schools (localhost only)
pnpm dev
```

1. Unlock a fictional school's kit (as in Phase 4) and let it build.
2. In the Workspace, pick "Form: …" in Files to see the Form Advisor.
3. Pick "Resume pass" to go to `/resume`. Upload a résumé, then press "Read my résumé".

Without an Anthropic key, model calls use the replay recordings. Those only match the fixture
applicants, so your own dossier needs `AI_MODE=live` and a key.

## Tests

- **Unit**: everything passes in `pnpm test` (2,241 across the repo, 170 files). The Phase 5 tests
  are:
  - `packages/linters/test/consistency.test.ts` (127 tests): **the seeded-mismatch AC**.
    `fixtures/consistency/` has one file per fictional applicant, all 12, each with a clean set
    (résumé, form entries, essay paragraphs and, for some, a recommender brief) and its seeds.
    - **87 seeded mismatches**: 14 employer, 15 title, 17 date, 18 team size and 23 number. They are
      spread over 30 résumé, 17 form, 21 essay and 19 brief documents.
    - **100% caught**, both when each seed is applied alone and when all of a file's seeds are
      applied together.
    - **Zero findings on the 12 clean sets.** A further set of tricky clean sentences (other
      people's promotions, possessives, an unrelated company) also gives no findings.
    - The last 27 seeds were written blind, after the first 60 passed. 20 of those 27 were caught
      before the heuristics were generalised, so the 100% isn't fitted to the seeds.
    - Unit cases: "thirteen" = 13, "$1.2M" = $1,200,000, month names, the id is stable across
      document order, dismissals are honoured, and the Fact Sheet comes first.
  - `packages/linters/test/fit.test.ts`: 20 sample texts with emoji, em dashes and curly quotes fit
    tight limits under every counting rule. Only text is removed, whole sentences go first, and text
    without spaces is cut by characters.
  - `packages/ai/test/phase5-tasks.test.ts` (21 tests): both tasks run in replay mode through
    `ai.run()`, in draft and coach modes.
    - Every recommendation has a reason, and every entry fits its field.
    - Coach mode writes no entries.
    - No number is invented in an entry or a rewrite.
    - Every rule checked in code is exercised, including the two recorded repairs (an orphaned
      _Combine with_, and an invented 30%).
  - `packages/ui/src/forms/*.test.tsx` (21 tests):
    - **FormAdvisor:** lanes in order, a reason on every item, a live count with an emoji and curly
      quotes, coach mode, and the note when there are more entries than the form takes.
    - **ResumeSheet:** "Keep rewrite" stays disabled until every placeholder is answered. A and R
      work from the keyboard; A does nothing while a detail is open; Undo; the hairline and the
      estimate appear only when the résumé runs over; the order switch and the export.
    - **ConsistencyList:** "Use … here" only on résumé bullets and form entries.
  - `apps/web/lib/forms/fix.test.ts`: the one-click fix replaces a value only where it stands alone,
    so "15" in "2015" is never touched.
  - `packages/db/test/schema.test.ts`: the three new tables, their owner columns and their unique
    keys.
- **Integration** (`pnpm test:integration`, 90 tests against Neon, all passing).
  `apps/web/lib/phase5-ac.int.test.ts` runs a bought kit on a FICTIONAL school with a résumé
  uploaded, using the fake model shared with Phase 4 (now in `apps/web/test/kit-support.ts`). It
  checks:
  - **stage 9** writes the advice and the review. The model's 336-character entry is cut to fit
    the 300-character field, at a sentence, keeping only its own words, and gets a Verify line;
  - **the routes**: the form view, then an edit that survives a refresh (the refresh is free
    because the Dossier didn't change). An entry saying "team of 15" is flagged against the Fact
    Sheet's 13 and fixed with one click. Keeping a rewrite with a placeholder unanswered gets 422.
    The Word export is a real DOCX;
  - **ownership**: all six Phase 5 routes that take an id answer 404, 403 or 402 to another
    applicant, whose own report holds nothing of the owner's;
  - **a refund** closes the form view (403).

  The Phase 4 acceptance test still passes now that stage 9 is real.

## Performance

First-load JS, gzipped:

| Route                        | Size     |
| ---------------------------- | -------- |
| `/workspace/[deliverableId]` | 154.1 KB |
| `/resume`                    | 154.0 KB |

Every route is within the 160 KB budget:

- The Form Advisor and the résumé sheet carry Motion, so each loads behind a `next/dynamic` host
  (`form-host.tsx`, `resume-host.tsx`), as the Workspace does. The server still renders them whole.
- The consistency checker runs on the server. Its types are all that reach the browser.

## What the review caught

One review pass, over the routes, the fix and the screens, found three problems, now fixed:

- **The one-click fix matched inside longer numbers.** Fixing "15" would also have turned "2015"
  into "2013". It now replaces a value only where it stands alone, and a unit test covers this.
- **A refresh cost a refinement for a kit's first advice.** That happened for kits built before
  Phase 5. The first advice is now free, as it would have been inside the pipeline.
- **"Use … here" showed on résumé role headings,** where it could only fail. Headings come from the
  uploaded file, so the button now appears only on bullets and form entries.

Two tests written in the first session expected the wrong value: a count of "19 characters over"
instead of 5, and a keyboard test that skipped past its bullet. The tests were wrong, not the
components.

## Deviations from the spec, and why

- **Three new tables** (`form_advice`, `resume_reviews`, `consistency_dismissals`), because §10 has
  none for this phase.
- **`FormSection.limit_kind`** is new (your decision 3).
- **Route shapes.** §11 doesn't list Phase 5 routes, so the routes above are mine. The form view is
  addressed by `?deliverable=` so it shares the Workspace's URLs.
- **Entries over the limit are trimmed, not rewritten.** After one repair, an entry still over its
  limit is cut at a sentence (`fitToLimit`) and gets a Verify line. That guarantees the AC "every
  entry fits its limit by the school's counting rule" without a second model call, and nothing is
  invented to fill the gap.
- **The one-click fix covers form entries and résumé bullets.** Résumé role headings (title,
  dates, organisation) and skills lines come from the uploaded file. The fix there answers "Edit it
  where it lives", and the applicant changes the file and uploads it again. Essays open instead,
  because a draft paragraph has its own history and checks.
- **No raw résumé file is kept.** The Phase 1 upload decision applies: the text is stored
  encrypted, and the file is discarded.

## Not done, or needs you

- **Live acceptance criteria**, once the Anthropic key exists:
  - re-record both tasks with `record:phase5` (`AI_MODE=live`) on the fixture applicants;
  - check that live replies still pass the verbatim and no-new-number rules without many repairs.
- **The Darden pack and AI-policy seeds** are still drafts until you verify them (carried over from
  Phase 3). Form advice only covers form sections with `verified_at`.

## Left for later phases

- **Recommender briefs** (Phase 6) join the consistency check as `kind: "brief"` docs. The checker
  and its fixtures already handle briefs, and stage 9 has the hook.
- **Interview plan** (Phase 7) joins stage 9.
