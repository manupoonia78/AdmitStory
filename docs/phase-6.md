# Phase 6: Recommender Kit and the recommender portal

Built 2–3 November 2026 on branch `phase-0`, on top of the Phase 5 commit (`7f60232`), across
four sessions. The plan is `docs/plans/phase-6-plan.md`; it is still accurate and holds the
decisions (§1), the data model (§2), the routes (§6) and the UI direction (§8). Spec: §5.11, §6.7,
§6.10 H, §11, §14.3, §14.6, Appendix F, Appendix I.

How the build went: the foundation and five parallel packages (A–E) landed their libraries and UI
leaves, but the session that ran them ended before any of them wired their routes or pages. The
third session (3 November) found the tree red (three type errors), fixed it, and wrote the missing
layer: every API route, the pages, the intake extraction, the brief export and the status view.

## What was built

### Data and AI (foundation)

- Migration `0007_recommender_kit` (applied to Neon): recommenders, LOR stories (R codes), the
  coverage plan, briefs per school group, invites (token hashed only), the recommender's
  workspace (notes, letters and voice profile encrypted), and reminders.
- Four AI tasks: `lor.extract`, `lor.plan`, `lor.brief`, `lor.recommender_assist`, with v1
  prompts and synthetic replays (`record:phase6 --synthetic`). Brief cites and assist provenance
  are checked in code (`briefCiteIssues`, `assistProvenanceIssues`).
- Pipeline stage 9 builds the first briefs inside the kit job; the consistency check reads briefs
  as `brief` docs; the Workspace Files pane has one "Recommender briefs" entry.

### Applicant side (packages A, C, D)

- `apps/web/lib/recommenders/`: views for screen H, the coverage plan, brief requests and the
  brief job, the Home summary, and (new this session) `stories.ts` — the intake answers are
  stored as `sources` rows first, then `lor.extract` runs over every answer given so far.
  Edited and hand-written stories survive a new extraction.
- `apps/web/lib/reminders/`: invite issue, send, schedule, reissue and revoke; reminder sync,
  previews and their hashes; the hourly send loop; and `loadStatusView` (written this session).
- `apps/web/lib/brief-export/` (new): the brief as a PDF or as email text, both from
  `briefSections(…, "recommender")` so neither carries cite codes.
- Routes under `/api/recommenders`: list and create, summary, plan, one recommender (get, patch,
  archive), stories (intake or manual; patch, delete), brief (get, build), brief export, invite,
  reminders, plus `POST /api/dev/reminders` on localhost.
- Screen H: `/recommenders` (list, empty and locked states, the add sheet) and
  `/recommenders/[recommenderId]` with the tabs Stories, Brief, Coverage, and Status and
  reminders in the URL (`?tab=&group=`). Keys 1–4 switch tabs, J/K move between people. The
  Coverage board deals the facets out once per plan version.
- Home: each school shows "Recommenders: 1 of 2 invited", and a dated ask ("Ask Ravi for a
  recommendation by 18 Nov") becomes the headline step when it is within a week.

### Recommender portal (package B)

- `/r/[token]`: the reading half (the applicant's note, what each school asks, the talking
  points) is server rendered; the writing half (notes, one answer per question, the submitted
  marks, "Delete everything I wrote") loads behind `next/dynamic`, and dictation loads only on
  the first press of the record button.
- `/r`: "Send me a fresh link", which always gives the same answer.
- Routes under `/api/r/[token]`: view and wipe, notes, letter, assist, STT token, voice seconds,
  submitted, preferences; and `POST /api/r/resend`. Every response is `no-store`,
  `no-referrer` and `noindex`.

### Overlap check (package E)

`packages/linters/src/lor/`: a deterministic shared-facet check (brief against brief, brief
against essay) and the recommender's voice profile. No embeddings.

## How to run it

```sh
pnpm dev                                  # email goes to .outbox/ without RESEND_API_KEY
curl -X POST localhost:3000/api/dev/reminders -H 'content-type: application/json' -d '{}'
```

The invite email in `.outbox/` holds the portal link; open it in a private window, since the
portal has no session.

## Tests

None were written, by your rule (2 November): no new tests until after launch. The plan's §9 table
is the list to write then. Existing gates on 3 November: format, lint, typecheck, 174 test files
(2,327 tests) pass; `pnpm build` passes.

## Performance

First-load JS (gz, budget 160 KB): `/r` 142.3, `/r/[token]` 142.4, `/recommenders` 154.0,
`/recommenders/[recommenderId]` 154.0, `/home` 155.0. The portal pages were 162 and 188 KB before
their client islands moved behind `next/dynamic`.

## Decisions made this session

- **Home's headline**: a recommender ask date within seven days outranks the journey order. It is
  the only step with a date of its own, and it is someone else's time.
- **"Rebuild the plan" forces a fresh `lor.plan` call.** It is free, so the 6-an-hour limit is
  what bounds it.
- **"These are different" on an overlap finding** reuses the consistency check's dismissal
  (`POST /api/consistency`), so one dismissal list covers both checks.
- **Changing a recommender's address** needs `confirmEmailChange: true` while a link is live, and
  then revokes the link and deletes their workspace (plan decision 8).
- **The resend limit** is keyed by caller IP plus the hashed address, never the address itself.
- The applicant-side privacy helper is now `recommenderPrivacyLine` in `@admitstory/ui`, because
  the portal already exports a `privacyLine` written to the recommender.

## Not done, or needs you

- **Verify the common-form recommendation questions** (`COMMON_LOR_QUESTIONS`, `verifiedAt:
null`) before launch (plan decision 16).
- **Live keys**: Anthropic (all four tasks), Deepgram (dictation in the intake and the portal),
  Resend (invites and reminders), Inngest (the hourly reminder cron; locally use the dev route).
- **A real end-to-end pass**: nothing in this phase has been clicked through in a browser yet.
  The first run after launch testing opens should cover invite → portal → assist → submitted →
  status, and a reminder going out.
- The plan's integration and UI tests (§9), after launch.
