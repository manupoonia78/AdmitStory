# Accessibility audit (Phase 9b, package E)

Spec §6.12 and §16 Phase 9 ("keyboard, screen reader on Studio and Workspace"). Done on
3 November 2026 against a production build (`next start`) in Chrome, with axe-core
(`@axe-core/playwright`, tags `wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`) and the new
Content-Security-Policy turned on.

## Automated pass (signed out)

| Page            | Hydrates under the nonce CSP | CSP violations | axe violations |
| --------------- | ---------------------------- | -------------- | -------------- |
| `/`             | yes                          | 0              | 0              |
| `/pricing`      | yes                          | 0              | 0              |
| `/how-it-works` | yes                          | 0              | 0              |
| `/privacy`      | yes                          | 0              | 0              |
| `/terms`        | yes                          | 0              | 0              |
| `/sign-in`      | yes                          | 0              | 0              |
| `/goodbye`      | yes                          | 0              | 0              |
| `/r`            | yes                          | 0              | 0              |

The marketing pages also passed Lighthouse accessibility at 100 in Phase 9a (`docs/phase-9a.md`).

## What the code already does (checked by reading it)

- **Focus**: one `--signal` focus ring from `packages/ui` tokens on every interactive element; the
  admin console and new Phase 9b screens use the same `buttonStyles()` and inputs.
- **Live regions**: `AlertMessage` / `StatusMessage` (`apps/web/components/live-message.tsx`) stay
  in the tree while empty, so errors and confirmations are announced. New this phase: Settings ›
  Privacy (downloads, opt-in, delete), the feedback control ("Thanks. We read every one.",
  `aria-live="polite"`).
- **Targets**: the feedback control's thumbs and the privacy controls are 44 px (`min-h-11`).
- **Colour never alone**: switch states read "On" / "Paused" with an icon; feedback rows show the
  rating as icon + word; the delete section is `--needs`-toned with a warning icon and words.
- **Reduced motion**: the privacy inventory's count-up is skipped under `prefers-reduced-motion`
  (values present from the first frame); the marketing motion honours it (Phase 9a).
- **Keyboard**: Studio (Space to record), Workspace (J/K, Y, A/R), screen H (1–4, J/K) and the eval
  review queue (1–5, J/K) all have keyboard paths; none trap focus outside Radix dialogs.

## Not checked here: needs a signed-in session (Manu or the beta)

The audit environment could not reach the database, so these were not run. They are the spec's
Phase 9 requirement and belong on the go-live list (`docs/LAUNCH.md`):

1. **Studio, keyboard only**: start a session, record with Space, stop, read the transcript,
   switch to typing, end the session. VoiceOver (Safari) announces each new question and the
   transcript as it streams.
2. **Workspace, keyboard only**: move between files (J/K), open Refine, accept (Y) and reject
   (A/R), compare two options, export. VoiceOver reads the "Your words" legend and the limit
   counter.
3. **Recommender portal `/r/[token]`**: dictate a note, write an answer, mark submitted, delete
   everything.
4. axe over `/home`, `/studio`, `/workspace/[id]`, `/profile-read`, `/resume`, `/recommenders`,
   `/settings`, `/settings/privacy` and `/admin` in both themes (Day and Night), signed in with
   a seeded fixture account. Fix anything "serious" or "critical" before launch.

Post-launch (test backlog, `docs/plans/phase-9b-plan.md` §13): axe in Playwright on every main
screen, and a keyboard-only e2e for Studio and Workspace.
