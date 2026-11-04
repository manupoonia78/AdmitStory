# HANDOFF: read this first in a new chat

The restart point if a session runs out of usage. It is rewritten after every chunk of work. In a
new chat, say: "Read HANDOFF.md and continue from the first unchecked item."

The old handoff (Phases 0–9 launch push) was cleared on 2026-11-05. That history lives in git
(`git log -- HANDOFF.md`) and in `docs/phase-*.md`. Claude's memory notes are in
`~/.claude/projects/-Users-manu-Desktop-AdmitStory/memory/`.

## Gates (must stay green after every chunk)

Testing policy (Manu, 2026-11-02): write no new tests until after launch. Existing unit tests must
keep passing.

```sh
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
pnpm build && pnpm --filter @admitstory/web bundle:check   # ≤ 160 KB gz per route, marketing ≤ 155
```

**Footgun:** the repo-root `.env.local` `DATABASE_URL` is the **production** Neon database. Every
local DB script (`migrate`, `connect:import`, `seed:*`) writes to prod.

## Current batch: Manu's 2026-11-04 list

Status: `[x]` done · `[~]` in progress · `[ ]` not started. Everything below is **uncommitted** on
branch `phase-0`.

- [x] **1. Rename to AdmitStories.** `APP_NAME` (`packages/shared/src/brand.ts`) and every
      user-facing string, doc and comment now say AdmitStories. The wordmark reads
      Admit*Stories*. Possessives became `AdmitStories'`, and the three prompts that said
      `{{APP_NAME}}'s` now say "the {{APP_NAME}} …". The 20 replay fixtures that embedded the name
      were rewritten and rehashed (filenames are the sha256 of the request), and all 41 still
      match. Left alone on purpose: package scope `@admitstory/*`, lowercase identifiers, cookie
      and canary names, the repo folder and `AdmitStory_Build_Spec.md`'s filename.
      Also fixed a test that was already failing: `RED_FLAG_IDS` was missing the canon's FLAG-12
      and FLAG-13.
- [x] **2. Free half of Story Studio.** `apps/web/lib/studio/allowance.ts`: an account with no
      school pack gets 30 answers (half of a ~60-answer Deep Studio), counted across all sessions.
      `/api/studio/turns` and `/api/studio/sessions` return 402 `code: "studio_limit"` once they're
      used. The answer that uses the last one is stored and extracted, but no next question is
      asked. From 5 left, the Studio says how many remain. At the limit, the halfway prompt
      (`app/(app)/studio/studio-gate.tsx`) offers three ways forward: unlock a school, the free
      Profile Read, or the Dossier. Pack owners have no limit. The pricing lists now say
      "the first half free" and "the rest of Story Studio" comes with a kit.
- [x] **3. Landing "How it works" redesigned.** `_sections/how-it-works-lines.tsx`: three
      columns on a rail (Minute 0 → Minute 20 → Minutes later, with time and cost). Each column
      shows the thing that step hands you: a Studio transcript line with a waveform and "Story
      found", the first lines of a Profile Read, and a pack's file map. It's server markup and CSS
      only, with a scroll-driven rise where supported. Copy: `LINES_COPY` in `_copy/landing.ts`.
      Manu said he'd paste an example to improve on; none arrived, so this is our own design.
- [x] **4. Connect (alumni, students, admissions readers).** Built; needs the migration and data
      before anyone can use it (see "What Manu must do").
  - DB: `packages/db/src/schema/connect.ts`, migration `0010_connect.sql` (`connect_people`,
    `connect_threads`, `connect_messages`), repos `packages/db/src/repos/connect.ts`.
  - Access: Connect needs any active school pack (`lib/connect/server.ts`). Without one,
    `/connect` shows `connect-locked.tsx` (faces carousel, who you can talk to, how it works,
    "Unlock a school") and never shows the directory. A "guide" (a directory person linked to an
    AdmitStories account through `guide_user_id`) sees and answers their conversations at `/connect`.
  - UI (`app/(app)/connect/connect-screen.tsx`, behind `connect-host.tsx`): LinkedIn-style
    search on the left (name, company, role, topic; school filter with your schools first;
    Everyone / Alumni / Students / Admissions), a WhatsApp-style inbox tab, and the conversation
    or profile on the right. People who work with us carry a "Works with us" badge and sort first.
    A first message to anyone else is an **intro request** (`status = requested`) that our team
    passes on. Below 1024 px it's one column. It polls: 5 s for the open chat, 20 s for the
    inbox. It loads no Radix and no Motion; `/connect` is 147.8 KB.
  - API: `GET /api/connect/people`, `GET|POST /api/connect/threads`,
    `GET|POST /api/connect/threads/[id]` (`?after=` for polling). Every route goes through kill
    switch `connect` (new in `packages/shared/src/ops.ts`) and rate limits `connectSearch` and
    `connectMessages`. An applicant can start at most 10 new conversations per 24 h.
  - Data in: `pnpm --filter @admitstory/db connect:import people.csv [--dry-run]` (column list
    at the top of `packages/db/scripts/connect-import.ts`). Only rows with `consented=yes` are
    ever shown. `guide_email` links someone to their account.
  - CSP `img-src` now allows `https://media.licdn.com` for directory photos.
  - `CONNECT_COMING_SOON` was removed (`lib/deferred/coming-soon.ts`). The rest of Phase 8
    (Tracker, expert mocks, notifications, after-decisions) stays deferred.
- [x] **5. Landing speed and the double blink.** Cause: `_chrome/page-transition.tsx` wrapped the
      page in `<ViewTransition update="route">`, so every lazy island that resolved during load
      (the pinned sequence, then the WebGL Voiceprint at idle) cross-faded the whole page.
      Measured at ~0.55 s and ~1.1 s. It's now keyed by pathname and animates on enter/exit only,
      so navigation still cross-fades but load doesn't. Re-measured: no blink. Also, Newsreader
      dropped its optical-size axis (`app/layout.tsx`), so the preloaded fonts went from 279 KB to
      123 KB. First paint locally went from 428 ms to 340 ms.
- [x] **6. Faces on the landing page and Connect.** 12 free-licence Unsplash portraits, cropped to
      400×500 WebP (`apps/web/public/people/p01–p12.webp`, 308 KB in all, lazy-loaded). Data and
      source ids are in `apps/web/lib/connect/illustrative.ts`; the CSS-only marquee is
      `components/people-carousel.tsx`. New landing section `_sections/connect-people.tsx`, right
      after How it works. **The faces have roles only, no names or schools, and always carry
      "Photos are illustrative…".** Never present them as real alumni.
- [ ] **7. Manu: review in a browser**, signed in, once the migration is run (below). None of the
      signed-in screens (Studio gate, Connect) could be opened against a real DB here. They were
      checked through a throwaway preview page with sample data, now deleted.

## What Manu must do

1. **Run migrations on Neon:** `pnpm --filter @admitstory/db migrate`. This applies 0009
   (chat + résumés, from 2026-11-04, if not done yet) and 0010 (Connect). Until then `/connect`
   errors for pack owners. The Studio cap needs no migration.
2. **Fill the directory.** Make a CSV and run `connect:import`. **On LinkedIn as the source:**
   LinkedIn's terms forbid scraping, and listing real people for strangers to message without
   their agreement is a privacy problem (GDPR, and their trust). So the import takes people you
   have contacted and who said yes (`consented=yes`). Use their public LinkedIn URL and headline,
   and preferably a photo they send you. Re-running updates rows on the same school + LinkedIn URL.
3. **Guides:** for people who work with us, have them sign up once, then put their email in
   `guide_email`. They answer from `/connect`.
4. **Intro requests:** a first message to a non-guide lands as `connect_threads.status =
'requested'`. There's no admin screen for these yet. For now, look them up in the DB and reply
   or introduce by email. An admin queue is the next obvious build (below).
5. **Landing claim:** the landing page and pricing now promise Connect with every pack. Don't
   deploy until there are people in the directory for the schools you sell, or soften
   `CONNECT_COPY` in `apps/web/app/(marketing)/_copy/landing.ts`.
6. **Cold start (speed):** live `/` took 1.2 s to first byte on a cold hit and 0.27 s warm. Every
   page renders per request because of the nonce CSP (`proxy.ts`) and the theme cookie. Options,
   in order of effort: make sure Vercel Fluid compute is on; serve marketing pages statically with
   a hash/`'unsafe-inline'` CSP for those routes only; or move marketing to the edge runtime.
   This is a security trade-off, so it's yours to choose.
7. Carried over: Anthropic key on Vercel Production (Studio 500s without it), admin role
   (`pnpm --filter @admitstory/db admin:grant manupoonia789@gmail.com`), and the rest of
   `docs/LAUNCH.md` §1.

## Decisions made this batch

- Brand is one word, **AdmitStories**, matching the domain admitstories.com and the old one-word
  "AdmitStory".
- "Half the Studio" means **30 answers**, counted server-side across sessions. Answer count
  tracks AI spend directly; slot coverage doesn't (vague answers never fill slots but still cost).
  Skips are blocked at the limit too.
- Connect unlocks with **any** pack, and search covers every school (yours first). Only consented
  people are listed. Non-guides get an intro request, not a live chat. New conversations are
  capped at 10/day.
- Stock faces are illustrative only: no names, no school claims.

## Next (not started)

- Admin queue for Connect intro requests and the directory (add, hide, edit, link guide).
- Email the guide or the applicant when a new message arrives (polling only works while the tab
  is open).
- Let applicants report or block a conversation.

## Log

- 2026-11-05: items 1–6 built; handoff rewritten. All gates green: format, lint, typecheck,
  2,462 unit tests, build, bundle (/ 154.4 of 155, /connect 147.8, /studio 156.9). Fixed on the
  way: the profile.read replay was rehashed after FLAG-12/13 joined RED_FLAG_IDS; the schema test
  lists the Connect tables; the Studio cap is read in parallel with the session so the turn
  latency budget holds.
