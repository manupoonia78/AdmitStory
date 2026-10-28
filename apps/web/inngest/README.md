# Inngest (`apps/web/inngest/`)

Durable background functions (spec §7.4), served at `/api/inngest`.

| File                            | What it is                                                               |
| ------------------------------- | ------------------------------------------------------------------------ |
| `client.ts`                     | The Inngest client (id from `APP_NAME`) and typed events.                |
| `events.ts`                     | `emitUserCreated`: sends `user/created`; never throws or blocks sign-up. |
| `functions/signup-completed.ts` | `analytics/signup-completed`: PostHog `signup_completed` (spec §15).     |
| `index.ts`                      | Every function served by `app/api/inngest/route.ts`.                     |

Phase 0 wires the client, one event and one function. The workflow functions in §7.4
(`dossier/consolidate`, `kit/generate`, `mock/evaluate`, …) are added by the phases that build
those features, starting with **Phase 1**.

Locally, run the Inngest Dev Server (`npx inngest-cli@latest dev`) and set `INNGEST_DEV=1`.
Without `INNGEST_EVENT_KEY` or dev mode, events are skipped (and logged) rather than sent.

`INNGEST_DEV` is read by the SDK itself (the client passes no `isDev`): `1`/`true` or a Dev Server
URL turn dev mode on, `0`/`false` (or unset) keep cloud mode. Dev mode skips request signing, so
`lib/env.ts` fails closed: when `APP_URL` is not localhost it rejects a dev-mode `INNGEST_DEV` and
requires `INNGEST_SIGNING_KEY`, which verifies that requests to `/api/inngest` come from Inngest.
The route validates the environment on its first request. Any other `INNGEST_DEV` value (such as
`yes`, which the SDK would read as a URL) is rejected.
