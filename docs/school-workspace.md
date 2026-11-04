# School workspace and résumé builder (2026-11-04)

Manu's brief: schools you've paid for are there to open; inside each, a Claude-like window with
the drafts in the middle and a small chat on the right that molds them ("I don't want this, do it
this way"), for essays, application forms, LOR briefs, video scripts and the résumé. The résumé
is generated from the guidelines and the narrative the applicant chooses, with its own chat.

## What changed for the applicant

- **Schools page** (`/schools`): "Your schools" is now a grid of cards. Paid schools open into the
  school; the rest show the next deadline, essay count, **Unlock · $100** and **Free preview**.
  Search, the deadline horizon, compare, honest flags, the round planner and the round/reapplicant
  controls sit below under "Plan your rounds". The list's "Preview kit" button is gone.
- **Inside a school** (`/schools/:userSchoolId`):
  - Before the drafts are ready: three steps. Your stories (count, goals, nudge to Story Studio
    below 4 stories or without goals), questions for the school (the kit's gap questions, with
    "What {school} offers for your goal" from the School Strategy fit read), and the drafts
    assembling live. Old `/kits/:id` links redirect here; checkout lands here.
  - Ready: straight into the school's tabs: **Essays · Application · Video · Recommenders ·
    Résumé** (`SchoolHeader`). Each tab is the list on the left, the document in the middle and the
    chat on the right.
- **Chat** (`ChatPanel` in `@admitstory/ui`): the first Coach tab, replacing Refine. Every change
  is made before the reply lands, and the latest change has Undo. History is stored per thread.
- **Résumé** (`/resume`, also each school's Résumé tab, and now in the dock): first "What story
  should your résumé tell?" (goal, the one thread to remember, what to lead with or leave out,
  prefilled from the dossier goals), then build from your stories, a pasted CV, or your upload.
  After that: narrative left, the résumé as a page in the middle (Word export), chat right, plus
  "Details that would make it stronger". The old line-by-line Résumé Pass moved to `/resume/review`.

## How it's built

- `POST /api/chat {thread, message}`, `GET /api/chat?thread=`, `POST /api/chat/undo`
  (`lib/chat/server.ts`). Threads: `deliverable:<id>`, `brief:<recommenderId>:<groupKey>`, `resume`.
  - Essays, short answers and goal fields: the existing Reviser (`draft.revise` via `refineDraft`),
    so locked and hand-edited paragraphs stay safe. Undo restores the previous draft version.
  - Video talking points and form entries: new task **`chat.revise`** (Sonnet, low). Form edits are
    saved as the applicant's entry text; coach-mode schools get pointers, never entries.
  - Recommender briefs: `chat.revise` over the cover note and talking points; saved in place.
  - Résumé: new task **`resume.write`** (Sonnet, medium) builds and reshapes the whole document.
    Code checks: unique ids, and no number that isn't in the CV, the current résumé, the chat or
    the dossier.
  - Chat on a kit spends one of the kit's refinements, as Refine did, and releases it when nothing
    changed. Brief and résumé chats are rate-limited only.
- Kill switches: `chat.revise` joins **Refinements**, `resume.write` joins **Form advice and
  résumé pass**.
- Tables (migration `0009_chat_and_resume.sql`): `chat_messages` (turns plus what a coach turn
  replaced, for Undo) and `resumes` (one per applicant: narrative, document, origin, asks).

## Needed before it works live

1. `pnpm db:migrate` against the database (adds the two tables).
2. The Anthropic key: in replay mode the two new tasks have no recorded fixtures, so chat and the
   résumé builder answer with an error until the key is set (or fixtures are recorded).

## Left for later

- No browser pass of the signed-in screens yet (the sandbox can't reach Neon).
- Chat on a coach-mode essay returns a plain "write this one yourself" message rather than
  coaching on the beats.
- The prep page shows new stories since the kit started but doesn't rebuild drafts; the chat
  beside a draft can be asked to use one.
