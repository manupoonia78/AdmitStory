# Admin console (`app/(admin)/admin/`)

Spec §5.18, §9 and screen M. Every page calls `requireAdminPage()` and every `/api/admin/*` route
is wrapped in `adminRoute()` (`lib/admin/guard.ts`): a non-admin gets a 404 either way. Mutations
go through the packages/db admin repositories, which write `audit_log`.

- `/admin/schools`, `/admin/schools/[schoolId]`: identity, cycles, rounds and deadlines, status.
- `/admin/sources`, `/admin/sources/[sourceId]`: add by paste, file or URL; ingestion status.
- `/admin/review/[cycleId]`: screen M, proposals against the draft, publish, import the
  knowledge/ draft, edit the draft JSON.
- `/admin/ai-policies`: the AI policy registry, "Mark verified".
- `/admin/canon`, `/admin/canon/[slug]`: canon versions; publishing emits `evals/run`.
- `/admin/prompts`, `/admin/prompts/[agent]`: prompt versions, activation, rollback, A/B split.
