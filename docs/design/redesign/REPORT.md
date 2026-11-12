# Redesign report: "The Literary Instrument"

Evidence for each phase. Images are in `shots/before/` (taken in Phase 0) and `shots/after/` (as
each screen lands). Spec: `SPEC.md`. Running state: `PROGRESS.md`.

## Phase 0: read, capture, spec (2026-11-12) · awaiting review

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
