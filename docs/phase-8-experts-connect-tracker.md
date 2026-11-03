# Phase 8: Experts, Connect, Tracker, Notifications, After decisions (deferred, build spec)

**Status: not built. Deferred by Manu on 2 November 2026 ("skip phase 8 — the whole mock
interview / interview-with-an-expert feature — for now").** Nothing in this phase ships at launch.

The deferral was asked for in terms of the **expert mock interview**. Phase 8 in the spec bundles
four more features with it, and all five are deferred together because they share one migration,
one set of repos and one notification spine:

| Deferred with it      | Spec  | What the applicant loses at launch                                        |
| --------------------- | ----- | ------------------------------------------------------------------------- |
| Expert mock interview | §5.13 | No human mock interview, no booking, no debrief                           |
| Connect               | §5.14 | No alumni/student outreach drafts, no Guides, no conversation notes       |
| Tracker (screen L)    | §5.15 | No per-school component grid, no deadline countdowns, no auto tasks       |
| After decisions       | §5.16 | No decision matrix, no waitlist plan, no scholarship/waitlist letters     |
| Notifications         | §5.17 | No digests, countdowns, in-app notification centre, ICS feed, unsubscribe |

Any of these can be pulled forward on its own; see §6 "Pulling one piece forward". The **Tracker**
is the one most likely to be missed, because the kit's value is partly "nothing slips", and the
marketing pricing list named it (now removed — §2).

**The full build plan already exists and is still accurate:** `docs/plans/phase-8-plan.md` (873
lines: migration `0008_experts_connect_tracker` with 14 tables, repos, `@admitstory/shared/apply`,
AI tasks, routes, jobs, UI, six work packages). This file is the wrapper around it: why it is
deferred, what the app and the marketing site say instead, what must be undone when it ships, and
the arguments to feed the build workflow. Read both.

Spec sections: §5.13–§5.18, §6.7, §6.10 L, §7.1, §7.2, §7.4, §8.3, §8.5.16, §10, §11, §12.4, §13,
§14.3, §14.4, §14.6, §15, §16 Phase 8, Appendix A14, Appendix E.

---

## 1. What launch promises instead

Nothing. Unlike Interview Studio (`docs/phase-7-interview-studio.md`), which carries a paid-for
promise ("kit owners get it free when it opens"), **Phase 8 is not sold at launch**: it is removed
from the pricing list and the feature copy rather than marked "Coming soon" with a commitment.

Two surfaces are the exception, because the app already has the dock entries and users will look
for them:

- **Connect** and **Tracker** keep their dock entries, and their pages say **"Coming soon"** and
  describe what they will do, in the Phase 7 pattern. No date, no price promise. The dock itself is
  unchanged: three muted entries out of seven would read as an unfinished product, and a visitor
  learns the same thing one click later, at the destination.
- `/interview` keeps its existing coming-soon page. Its copy must no longer say that an **expert
  mock** is bookable now (it was written when Phase 8 shipped at launch).

Everything else in this phase (After decisions, notifications settings, the ICS feed, the expert
and guide consoles, the admin experts/payouts/guides screens) has **no entry point at all** at
launch. Do not ship empty pages for them.

## 2. The coming-soon sweep this deferral requires

These are the exact places that mention Phase 8 features. All of them are part of the
"Coming-soon sweep" item in `HANDOFF.md`, and every one must be done before launch.

| Where                                                               | What to change                                                                                  | State                                    |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `apps/web/lib/deferred/coming-soon.ts`                              | The Phase 8 copy (`CONNECT_COMING_SOON`, `TRACKER_COMING_SOON`) and the shared `COMING_SOON`    | **Done** 2 Nov                           |
| `apps/web/components/coming-soon-page.tsx`                          | The shared server-rendered page the three deferred areas use                                    | **Done** 2 Nov                           |
| `apps/web/app/(app)/connect/page.tsx`, `app/(app)/tracker/page.tsx` | Coming-soon pages instead of the generic placeholder                                            | **Done** 2 Nov                           |
| `apps/web/app/(app)/interview/page.tsx`                             | Same component; keeps its own promise line. It never mentioned expert mocks, so nothing removed | **Done** 2 Nov                           |
| `apps/web/app/(marketing)/_data/pricing.ts`                         | Dropped `"The application tracker"` from the free list; deleted the `EXPERT_MOCK` block         | **Done** 2 Nov (marketing worktree)      |
| `packages/ui/src/shell/nav-items.ts`                                | Nothing: the dock is deliberately unchanged (§1)                                                | n/a                                      |
| `apps/web/app/(marketing)/_copy/*`                                  | Checked: no expert, tracker, Connect, waitlist or notification claim                            | **Clean** 2 Nov                          |
| `docs/design/marketing-direction.md`                                | The override note at the top gains Phase 8 next to Phase 7                                      | Pending (do it with the marketing patch) |
| `apps/web/lib/strategy/deliverables.ts`, `lib/workspace/view.ts`    | Leave the `interview_question` rows as Phase 7 already handles them; no expert surfaces         | n/a                                      |
| `apps/web/app/(expert)/README.md`, `(guide)` group                  | Stay as placeholders; no routes                                                                 | n/a                                      |
| `apps/web/components/placeholder-copy.ts`, `placeholder-page.tsx`   | Now unused. Left in place; delete them if nothing claims them by launch                         | Pending                                  |

Grep before declaring it done: `rg -i "expert mock|application tracker|/tracker|/connect|/decisions|expert_session"`.

## 3. What is already in the tree for it (do not delete)

These hooks were put in by Phases 1–6 and cost nothing while the phase is deferred. The plan's
"Hooks earlier phases left for this phase" table lists them all; the ones a reader trips over:

- Dock items `connect`, `tracker` and their placeholder pages.
- Route groups `(expert)` and `(guide)` (README only).
- Roles `expert`, `guide`, `admin` (`packages/db/src/schema/profiles.ts`), `repos/roles.ts`.
- Entitlement kind `expert_session` (`packages/db/src/schema/commerce.ts`).
- Source kind `conversation_note`, code kind `conversation` (`C#`), `DossierEngagement` and the
  `ENGAGEMENT(this school)` dossier line, which the provenance task already reads.
- Route `connect.outreach` in `packages/ai/src/routing.ts` (priced, no prompt or replay).
- Canon `knowledge/canon/decisions.md` (DEC-01…04).
- `CALCOM_API_KEY`, `CALCOM_WEBHOOK_SECRET` in `.env.example` (not in `lib/env.ts`).
- `user_schools.status` values through `withdrawn`, `profiles.timezone`, `sendAtFor`,
  `claimDueReminders` (Phase 6).

Because nothing in Phase 8 is built, **no migration numbered 0008 exists**. Phase 9b's hardening
migration takes `0008` instead of `0009`; when Phase 8 is built later its migration takes the next
free number and the plan's name `0008_experts_connect_tracker` is read as `000N_...`.

## 4. Ordering when it is built

1. Phase 6 (Recommender Kit) must be integrated — the plan assumes `lib/idempotency.ts`,
   `sendAtFor`, `OutgoingEmail.replyTo`/`fromName`, `listRecommenderStatuses`,
   `recommenderSummary`, and it edits `inngest/index.ts`, `lib/kit/pipeline.ts`, `lib/email.ts`,
   `apps/web/lib/home/**`, `packages/emails/src/index.ts` and the AppShell.
2. Phase 9b (hardening) will by then own kill switches, Upstash rate limits, the nonce CSP and the
   admin console's ops screens. Phase 8's new routes must adopt those, not re-invent them:
   `checkRateLimit` and `idempotent()` from Phase 9b, feature switches for `connect.*`, and the
   admin shell's `adminRoute()` / `requireAdminPage()`.
3. Decision 35 of the plan ("rate limits and Idempotency-Key stay in-process") is **void** once
   Phase 9b lands. Use the Upstash helpers.
4. Marketing copy changes are a second pass on the live site, not a new build.

## 5. What Manu must provide before it can ship

From `docs/plans/phase-8-plan.md` §11, plus the launch list in `docs/LAUNCH.md`:

- **Cal.com** account, API key and webhook secret; a 45-minute event type per expert, with Google
  Meet or Zoom connected.
- **Paddle** `expert_session` product and seller verification (already needed for kits).
- The **expert roster**: for each, the account email, price ($50–$100), payout share (default
  8000 bps), schools, languages, Cal.com username and event type id. The launch expert is Manu.
- **Payout** method and reference format (manual, monthly, USD).
- Verified pack `connect` sections (channels, official events) and `waitlist` instructions for the
  12 launch schools, or they stay hidden.
- Sign-off on the booking policies (24 h, two reschedules, no-show charged) as customer-facing terms.

## 6. Pulling one piece forward

The plan's packages are already disjoint, so one can be built without the others. Dependencies:

| Piece                    | Needs from the rest of Phase 8                                                                   | Rough size                          |
| ------------------------ | ------------------------------------------------------------------------------------------------ | ----------------------------------- |
| **Tracker** (package D)  | Migration tables `tasks`, plus `user_schools.deadline_override`; nothing else. No Cal.com, no AI | Smallest useful slice               |
| After decisions (F)      | `decisions.letter` task + replay; the decision tables                                            | Small; needs one AI task            |
| Notifications (E)        | The whole notification spine (preferences, deliveries, cron, unsubscribe, ICS)                   | Medium; everything else leans on it |
| Connect (B) + Guides (C) | `connect.outreach`/`connect.insights` tasks, guide verification, intro emails                    | Large                               |
| Expert mocks (A)         | Cal.com, payments, payouts, consent brief, debrief, expert + admin consoles                      | Largest; the piece deferred         |

A Tracker-only build ("Phase 8-lite") is the recommended first slice if launch feedback asks for
it: take the plan's §2 `tasks` table, §3 `@admitstory/shared/apply` helpers, §6 tracker routes and
§8 screen L, and skip the other thirteen tables.

## 7. How to build it later

Use `docs/plans/build-phase.workflow.md` with these arguments:

```json
{
  "phase": "8",
  "title": "Experts, Connect, Tracker, Notifications, After decisions",
  "date": "<the day you run it>",
  "sections": "§5.13–§5.18, §6.7, §6.10 L, §7.1, §7.2, §7.4, §8.3, §8.5.16, §10, §11, §12.4, §13, §14.3, §14.4, §14.6, §15, §16 Phase 8, Appendix A14, Appendix E",
  "brief": "The plan is already written: docs/plans/phase-8-plan.md. Skip the Plan stage and start at Foundation, using that plan's foundation scope and its six packages A–F verbatim. Read docs/phase-8-experts-connect-tracker.md first: it lists the coming-soon surfaces to remove, the hooks already in the tree, and the decisions that Phase 9b made void.",
  "decisions": "docs/plans/phase-8-plan.md §1, decisions 1–36, EXCEPT decision 35 (rate limits and Idempotency-Key in-process), which Phase 9b replaced with Upstash. Add: every new route registers a feature switch and uses Phase 9b's checkRateLimit and idempotent(); the migration takes the next free number, not 0008."
}
```

Verify before building: Cal.com API v2 endpoint names and the `cal-api-version` header against
cal.com/docs (the plan's decision 8 was written against the November 2026 docs), and the Paddle
product id for `expert_session`.
