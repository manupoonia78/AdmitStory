# Phase 3: Schools, knowledge base and strategy

Built 31 October – 1 November 2026 on branch `phase-0`, together with Phase 4 (see
`docs/phase-4.md`). Spec: `AdmitStory_Build_Spec.md`, §16 Phase 3, with §5.4 (Profile Read),
§5.5 (School Strategy), §5.18 (admin), §8.5.4–8.5.5, §8.9, §9 (knowledge base), §10, §11, §14.2,
§14.5 and Appendices G and H.

Decisions you made for this phase (31 October):

- One free kit preview per school, counted against the $5 free AI cap. Its positioning and file map
  are reused when you unlock, as long as the dossier hasn't changed.
- There is no Voyage key yet, so embeddings run on a deterministic fake (localhost only).
- The Darden pack (Appendix G) and the §14.2 AI-policy seeds are drafts until you verify them.
  Nothing unverified is shown to applicants.

## What was built

### `packages/kb`: packs, ingestion, retrieval

- **Pack schema** (`schema/school-pack.ts`): §9.2 in Zod, plus `class_profile` (cited class medians)
  and `official_urls` (the pages the refresh checker watches).
- **Compiler** (`compiler.ts`): turns a pack into the compact L1 text with K-ids. It is
  deterministic, counts tokens, leaves out third-party raw text, and drops stale items from what
  applicants see.
- **Ingestion** (`ingest/`): pasted text, PDF, DOCX and URLs. URL fetching has an allowlist and an
  SSRF guard. Text is chunked at 600 tokens with an 80-token overlap.
- **Proposals** (`proposals.ts`): field-level diffs and conflicts. An official source wins by
  default, and a field with an unresolved conflict can't be published.
- **Retrieval** (`retrieval.ts`): hybrid search (pgvector and full text, fused by RRF), filtered by
  school and cycle, returning the top chunks within a token budget.

### `packages/db`: migration 0004

- New tables: schools, school_cycles, school_packs, kb_sources, kb_chunks (HNSW and GIN indexes),
  kb_proposals, kb_refresh_snapshots, canon_docs, prompt_versions, ai_policies, user_schools,
  school_interest_votes, profile_reads, audit_log, and kits (preview only for now).
- Admin repositories demand an `AdminContext` from `requireAdmin()` and write to `audit_log`.
- `pnpm --filter @admitstory/db seed:schools` seeds the Appendix H schools and the AI policies as
  unverified drafts.
- `pnpm --filter @admitstory/db admin:grant <email>` makes an account an admin.

### `packages/ai`

- New tasks, each with a prompt, a schema, a route and replay recordings: `profile.read`,
  `strategy.school_fit`, `kb.normalize`, `kb.refresh_check` and `kit.positioning_filemap`.
- A registry overlay: prompt versions and canon published in the admin console replace the files.
  It supports rollback, A/B weights and route overrides (by model key, never a model id).
- A Batch API transport for refresh checks and bulk work.
- `ai.embed()`: Voyage, with the fake when there's no key. Every call is metered in the ledger as
  `kb.embed`.

### `packages/slots`

`packNeed()` is the real `need()` term (§5.2). A slot that feeds an archetype your schools'
published prompts ask for is fully needed. Slots that only feed forms, the résumé, recommenders or
the interview keep their floor. Everything else drops to 30% of its typical need. In hurry mode,
`gapOnlySlots()` takes the same need function, so gap-only questioning follows your schools'
prompts.

### `apps/web`

- **Admin console (screen M, `/admin`)**: schools and cycles with a rounds editor; knowledge
  sources (paste, upload, or a URL on the allowlist) with ingestion status; pack review (source on
  the left, accept, edit or reject each field on the right, conflict badges); publish version N;
  the AI policy registry with "Mark verified"; the canon editor; the prompt registry; and "Import
  draft pack" for Darden. A non-admin, signed in or not, gets a plain 404 on every page and route.
- **Profile Read (screen D, `/profile-read`)**: the four-lens instrument as the hero, then each
  lens's findings (what helps, what may raise doubts, what to do), the strengthening plan with
  time estimates, and a brand preview. Every finding links to the stories and facts it rests on,
  which open in a side drawer. There are no scores and no odds. The read rebuilds on its own at most
  once a day after a significant dossier change, or whenever you press "Build my Profile Read
  again".
- **School Strategy (screen E, `/schools`)**: school search with rounds and deadlines in your time
  zone, essay counts, interview format, the AI policy (verified only) and pack freshness; the
  horizon timeline, which morphs into a side-by-side comparison when you pick two schools; honest
  flags; the round planner; and "Pack coming soon" with an interest vote.
- **Kit preview (`/schools/[id]/preview`)**: the positioning headline and the file map (titles
  only), with the drafts locked, and "Unlock {School} for $100".
- **Home (screen A, `/home`)**: the single most useful next step is the headline. It runs in order:
  talk in the Studio, read the Profile Read, add schools, preview a kit, unlock, then the kit's own
  work (for example "Answer 3 questions to finish your Kestrel Lake drafts"). Your schools are
  listed under it.
- **Studio**: `need()` comes from your schools' packs; hurry mode asks only for what their prompts
  need; reapplicant questions appear when any school on your list is a reapplication; dictation
  keyterms include your schools' names ahead of the Appendix H list.
- **Inngest**: `kb/ingest-source`, the `kb/refresh-check` cron (monthly, weekly from August to
  January), `profile/read`, `strategy/fit`, the fit fan-out on `kb/pack.published`, and
  `kit/preview`. Without Inngest configured, each job runs after the response instead.

## How to run it

```sh
pnpm db:migrate                                    # 0004 and 0005
pnpm --filter @admitstory/db seed:schools           # Appendix H schools, unverified AI policies
pnpm --filter @admitstory/web seed:fixtures         # six FICTIONAL schools, five published (localhost only)
pnpm --filter @admitstory/db admin:grant you@example.com
pnpm dev
```

Then add Kestrel Lake or Halvorsen on `/schools`, open its preview, and read `/profile-read` once
the Studio has two or more stories. Quillfeather shows "Pack coming soon".

## Tests

- **Unit**: everything passes in `pnpm test` (2,041 across the repo). The Phase 3 acceptance tests
  are:
  - `apps/web/app/api/admin/admin-routes.test.ts`: generated from the route files, so every
    `/api/admin` route is checked (19 today). Each one, signed in or signed out, answers 404
    without touching a repository.
  - `apps/web/lib/strategy/phase3-ac.test.ts`:
    - every number and median on the comparison carries a source, a year and a verified date
      across the fixture schools, and a figure stripped of its citation is caught;
    - the median comparison is computed in code;
    - "Pack coming soon" is never previewed;
    - a preview is reused while the snapshot and pack version are unchanged;
    - the Profile Read waits on a thin dossier, rebuilds at most once a day, and always rebuilds
      when you ask;
    - authorship modes follow §14.2.
  - `packages/slots/src/selector.test.ts`: `need()` comes from the packs, hurry mode asks for a
    school's archetype first, and reapplicant slots appear only for reapplicants.
  - The kb, db and ai package tests (proposals, compiler, retrieval, overlay, batch, embed and the
    Phase 3 tasks in replay mode).
- **Integration** (`pnpm test:integration`, 86 tests against Neon, all passing):
  - `packages/db/test/schools.int.test.ts` covers the Phase 3 repositories.
  - `apps/web/lib/phase4-ac.int.test.ts` covers two Phase 3 things: every user-scoped route refuses
    another applicant's ids, and a "Pack coming soon" school can't be previewed or bought.

## Performance

First-load JS, gzipped, after `pnpm build`:

| Route                   | Size           |
| ----------------------- | -------------- |
| `/schools`              | 153.9 KB       |
| `/profile-read`         | 153.9 KB       |
| `/home`                 | 154.9 KB       |
| `/schools/[id]/preview` | 159.0 KB       |
| Every admin page        | 160 KB or less |

`/dossier` (Phase 1) went from 169.7 KB to 153.9 KB. **Every route is now within the 160 KB
budget.** It took three changes:

- `CitationMark` no longer uses the Radix tooltip. Its hover label is drawn in CSS, and its
  footnote link still carries the source.
- The honest flags and the round planner render on the server and are passed into the client
  screen.
- Each large client screen (strategy, Profile Read, Dossier) loads as its own chunk behind a
  `next/dynamic` host, as the kit and workspace screens do. The server still renders it whole.

## Deviations from the spec, and why

- **Embeddings are fake** until a Voyage key exists. The fake is deterministic and refuses to run
  off localhost. Retrieval degrades to nothing rather than failing a task.
- **`kb.normalize` runs synchronously** for a source an admin just added, so review starts within a
  minute. Refresh checks and bulk re-ingestion use the Batch API.
- **There is no Redis.** Progress streams tail the database, as the Studio already does.
- **Additions to §10**: `profile_reads`, `user_schools.fit` with `fit_pack_version`,
  `school_interest_votes`, and `kb_refresh_snapshots`.
- **Fixture packs are short**: 1,200–2,200 tokens against the 4,000–10,000 target, because they
  are fictional test material. Real packs are checked against the target when they're published.

## Not done, or needs you

- **Verify and publish real packs.** Darden is a draft full of "TO FILL", and the AI-policy seeds
  come from a third-party summary. Until you verify and publish them, every real school shows
  "Pack coming soon".
- **Live acceptance criteria** need a Voyage key, an Anthropic key and live recordings: retrieval
  quality, the Profile Read on real dossiers, and a refresh check against real pages.
- OCR for scanned PDFs and audio-file ingestion are deferred.
- Publishing canon emits `evals/run`, which does nothing until Phase 9.
