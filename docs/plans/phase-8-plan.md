# Phase 8 plan: Experts, Connect, Tracker, Notifications, After decisions

Written 2 November 2026 (planning stage, no product code). Spec sections: §5.13 (expert mocks),
§5.14 (Connect), §5.15 (Tracker), §5.16 (After decisions), §5.17 (Notifications), §5.18 (Experts and
Guides admin), §6.7 (Tracker row), §6.10 L, §7.1 (Cal.com, Resend), §7.2 (`/api/webhooks/cal`), §7.4
(`notify/*`), §8.3 (`connect.outreach`), §8.5.16, §10 (Experts, Guides, Connect; Tracker and
system), §11 (Experts, Connect, Tracker rows), §12.4, §13 (`expert_session`, payouts), §14.3 (expert
brief consent), §14.4, §14.6, §15 (`expert_booked`, `application_marked_submitted`), §16 Phase 8,
Appendix A14 (`knowledge/canon/decisions.md`, DEC-01…04), Appendix E (rubric).

Read with it: `HANDOFF.md` (Decisions), `docs/plans/phase-6-plan.md` (layering and stub rules this
plan copies), `docs/design/phase-3-4-direction.md` (design rules), `docs/decisions/0002-test-email-outbox.md`.

**Ordering.** Phase 8's foundation starts only after Phase 6's integration stage has finished: it
edits files Phase 6 is still changing (`inngest/index.ts`, `lib/kit/pipeline.ts`, `lib/email.ts`,
`apps/web/lib/home/**`, `packages/emails/src/index.ts`, the AppShell). Everything below assumes
Phase 6 landed as its plan says (`apps/web/lib/idempotency.ts`, `sendAtFor`, `OutgoingEmail.replyTo`
and `fromName`, `listRecommenderStatuses`, `recommenderSummary`).

**Testing.** Manu, 2 Nov: no new tests until after launch. Nobody in this phase writes a test file.
Existing unit tests must keep passing; a stage that breaks one fixes it. §10 maps acceptance
criteria to tests to write after launch.

Hooks earlier phases left for this phase (verified in code):

| Hook                                                                                                | Where                                                                                  |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Dock items `connect` and `tracker` with placeholder pages                                           | `packages/ui/src/shell/nav-items.ts`; `app/(app)/connect/page.tsx`, `tracker/page.tsx` |
| Route group for the expert console (README only)                                                    | `apps/web/app/(expert)/README.md`                                                      |
| Roles `expert`, `guide`, `admin`                                                                    | `packages/db/src/schema/profiles.ts` `appRoles`; `repos/roles.ts`                      |
| Entitlement kind `expert_session`                                                                   | `packages/db/src/schema/commerce.ts` `entitlementKinds`                                |
| Payments provider interface, fake with signed webhooks, `refund()`                                  | `packages/payments/src/*`; `apps/web/lib/payments/server.ts`                           |
| Local fake checkout overlay                                                                         | `app/(app)/schools/[userSchoolId]/unlock/fake-checkout.tsx`, `api/dev/fake-checkout`   |
| Source kind `conversation_note` (encrypted text)                                                    | `packages/db/src/schema/studio.ts`                                                     |
| Code kind `conversation` (`C#`), dossier `DossierEngagement` and the `ENGAGEMENT(this school)` line | `packages/shared/src/codes.ts`, `dossier/types.ts`, `dossier/compile.ts`               |
| Provenance already reads `ENGAGEMENT` people and treats `C` codes as the applicant's own words      | `packages/ai/src/tasks/provenance.ts`                                                  |
| Route `connect.outreach` (Haiku, low, thinking off, 600)                                            | `packages/ai/src/routing.ts`                                                           |
| Canon `decisions.md` (DEC-01…04), `interview.md`                                                    | `knowledge/canon/`                                                                     |
| `user_schools.status` covers `submitted`…`withdrawn`, set by `PATCH /api/user-schools/:id`          | `schema/applications.ts`, `app/api/user-schools/[id]/route.ts`                         |
| Strategy horizon primitives (time scale, lanes, matrix)                                             | `packages/ui/src/strategy/time-scale.ts`, `horizon-parts.tsx`, `matrix-table.tsx`      |
| `profiles.timezone` (captured at first run)                                                         | `schema/profiles.ts`, `app/first-run/actions.ts`                                       |
| 09:00-local scheduling helper and the claim-then-send pattern (Phase 6)                             | `@admitstory/shared/kit` `sendAtFor`; `claimDueReminders`                              |
| `CALCOM_API_KEY`, `CALCOM_WEBHOOK_SECRET` in `.env.example` (not yet in `lib/env.ts`)               | `.env.example`                                                                         |
| `kb/pack.published` event                                                                           | `apps/web/inngest/events.ts`                                                           |
| Interview coming-soon page and copy (`COMING_SOON`)                                                 | `app/(app)/interview/page.tsx`, `lib/interview/coming-soon.ts`                         |
| Admin console shell, `adminRoute()`, `requireAdminPage()`, audited admin repos                      | `app/(admin)/admin/layout.tsx`, `lib/admin/guard.ts`                                   |

---

## 1. Decisions

Manu's (HANDOFF.md, 2 Nov):

1. Expert mocks are **45 minutes, $100**. Rescheduling or cancelling is free up to 24 h before the
   start. A no-show is charged. Experts' prices are set in admin (allowed range $50–$100, §5.13).
2. **Cal.com sits behind an interface with a fake** used whenever `CALCOM_API_KEY` is missing.
3. **Paddle is already faked** (Phase 4). Expert sessions reuse that provider.
4. **Resend with the dev outbox** (`.outbox/` when `RESEND_API_KEY` is missing and `APP_URL` is localhost).
5. **Expert payouts are manual and monthly**, recorded in a `payouts` table (§13).
6. Interview Studio (AI practice) is deferred and shows "Coming soon". **Expert mocks (a human) ship.**
7. No new tests. No API keys exist: every model task runs in replay mode on synthetic recordings.

Mine (each is a gap the spec leaves open or a deviation; recorded in `docs/phase-8.md`):

8. **Our own slot picker, not the Cal.com embed.** The app lists slots from Cal.com API v2 and books
   through it (`GET /v2/slots`, `POST /v2/slots/reservations`, `POST /v2/bookings`, cancel and
   reschedule; verify endpoint names and `cal-api-version` headers against cal.com/docs at build
   time). The embed is a third-party iframe and script: it breaks the design system, costs bundle
   and needs a CSP exception. Cal.com still creates the meeting link (Google Meet or Zoom via the
   expert's Cal.com integration) and sends its own calendar invite.
9. **Booking sequence: hold, pay, confirm.** Choosing a slot creates a `held` booking (15-minute
   hold, a Cal.com reservation when live) and opens checkout for product `expert_session:{bookingId}`.
   The payment webhook marks it `paid`, then the app creates the Cal.com booking and marks it
   `confirmed` with the meeting link. If the slot was taken meanwhile, the booking becomes
   `needs_time`: the payment stays as a credit and the applicant picks another time without paying
   again (or asks for a refund).
10. **Policies in code** (`changePolicy`): earliest bookable slot is 24 h ahead; reschedule up to 2
    times, only ≥ 24 h before the start; cancel ≥ 24 h before → full refund through `payments().refund`;
    cancel < 24 h → no refund (`cancelled_late`, charged); the expert marks an applicant no-show
    from 15 minutes after the start (`no_show`, charged); the expert cancelling, or an expert
    no-show reported by the applicant and confirmed by admin, → full refund. A session nobody marks
    becomes `completed` 24 h after it ends.
11. **The pre-session brief is built by code, not a model.** It holds: the applicant's first name,
    the target school, round and deadline, the school's interview format from the pack, the kit's
    positioning headline, the file map as "deliverable: story title", up to six story titles with
    one-line results and traits, the pack's likeliest questions, and the applicant's own focus note.
    No essays, no transcripts. "Recent AI-mock weak spots" is omitted (Phase 7 is deferred).
    Consent is per booking, **off by default**, shown with a preview of exactly what the expert
    will see, and revocable until the session starts (revoking hides it from the expert). The brief
    is a snapshot taken at consent time, encrypted, with "Refresh the brief" for the applicant.
12. **The debrief lives at `/interview/expert/[bookingId]`** and is listed on `/interview`, which keeps
    AI practice marked "Coming soon". The debrief form uses Appendix E's eight criteria (1–5 each,
    "Not covered" allowed), top 3 strengths, top 3 fixes, free notes.
13. **AdmitStories never records sessions.** Both sides see "Recording only if you both agree at the
    start of the call, using the meeting tool." The applicant's advance answer is stored.
14. **Experts are added by admin** (by the email of an existing account), not by self sign-up. Admin
    sets price ($50–$100), payout share (default 80% of the price, `payout_share_bps = 8000`),
    schools, languages, Cal.com username and event type id, and switches them on. The launch expert
    is Manu: "Mock interview with an admissions expert".
15. **Payouts**: per expert per calendar month (UTC), the sum of `price × share` over bookings that
    started that month and ended `completed`, `debriefed`, `no_show` or `cancelled_late`. Admin
    creates a draft for a month, then "Mark paid" with method, reference and date. A booking belongs
    to at most one non-void payout. USD only.
16. **Guides offer free chats only at launch.** The data model keeps `chat_type` and `price_cents`
    (§10), but paid chats need a second payout flow, so they come after launch. A Guide is verified
    by a link sent to a school address whose domain ends in the school's website domain
    (`halvorsen.edu` → `*.halvorsen.edu`), or by admin by hand. Chats are 20 minutes; each Guide
    sets a weekly capacity (default 2); an applicant may have 3 open requests.
17. **Guide requests are introductions, not messaging.** The applicant sends a short note and three
    time windows. The Guide accepts one window and pastes a meeting link, or declines. On acceptance
    both get an introduction email with each other's address; before that neither address is shown.
    There is no in-app chat.
18. **Engagement evidence.** A conversation note (voice or text) is a `conversation_note` source.
    `connect.insights` pulls insights from it. Each conversation gets a `C` code (per user). Its
    summary enters the dossier layer **only for that school's kit** as the existing
    `ENGAGEMENT(this school)` line, and only while `use_in_essays` is on; the person is named only
    when `may_name` is true. The kit pipeline and the reviser append these lines to the snapshot
    text at load time (the stored snapshot is unchanged).
19. **Official channels come from the pack.** The pack gains an optional `connect` section:
    `channels: CitedThing[]` (ambassador programme, admissions contact page) and
    `events: OfficialEvent[]` (`{ id, name, kind, starts_at, ends_at?, url, verified_at, source_ids }`).
    Unverified items are hidden from applicants. "Add to calendar" downloads a one-event `.ics`;
    "Remind me" creates a tracker task. The compiler does not render the new section, so compiled
    packs and every existing replay are unchanged.
20. **Waitlist instructions** come from a new optional pack field `waitlist: PackItem[]` (also not
    compiled). Without it, the waitlist plan says the school publishes none and shows DEC-01.
21. **Outreach is never sent by AdmitStories.** Drafts have "Copy message" only. Outreach drafts and
    conversation insights are free for every signed-in user (Haiku; 10 of each per day), counted
    against the §12.4 free-user AI cap like any call.
22. **After decisions lives at `/decisions`** (not a dock item). The decision matrix, the waitlist
    checklist and the feedback-call prep sheet are deterministic and free. AI letters (waitlist
    update, scholarship note) need any active kit, like the Résumé Pass, 10 per day.
23. **Tracker components are a fixed list**: essays, short answers, video, form, résumé, test scores,
    transcripts, recommender 1–3 (as many columns as the pack's count; default 2), fee or waiver,
    submitted, interview, decision. Each cell is derived from data where possible and can be
    overridden by hand; the override wins and is labelled "Marked by you".
24. **Deadlines**: the pack's deadline for the applicant's chosen round, overridable per school
    (`user_schools.deadline_override`). A deadline is a date, counted as the applicant's local day.
25. **"Ready to submit"** lights when every needed component except submitted, interview and decision
    is done, the kit has no open Verify item and no open must-fix check. Otherwise it lists what blocks it.
26. **Auto tasks** are planned by code and synced idempotently (`auto_key`): send test scores
    (deadline − 14 d), request transcripts (− 28 d), pay the fee or ask for a waiver (− 7 d), answer
    open questions (when any), ask a recommender (Phase 6's ask date), submit (deadline). Done
    components complete their task. Auto tasks can be dismissed, not deleted.
27. **Notifications**: categories `kit`, `deadlines`, `tasks`, `bookings`, `connect`, `packs`,
    `decisions`; each set to "Every time", "Daily summary" or "Off" (defaults in §3). Booking
    confirmations, changes and introductions are transactional and always sent. No marketing email
    is sent at launch; `marketing_opt_in` exists and defaults to false.
28. **Timing**: one cron every 15 minutes. Countdowns (14/7/3/1 days), task reminders and digests go
    at 09:00 and 08:00 local (`sendAtFor` with `profiles.timezone`, UTC when unknown). Booking
    reminders go 24 h and 1 h before the start.
29. **In-app notifications** live at `/notifications`, reached from the account menu ("Notifications"
    with an unread count; the avatar carries a small dot with screen-reader text). No new dock item.
30. **Unsubscribe**: every non-transactional email carries `List-Unsubscribe` and
    `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (RFC 8058) with a per-user random token
    (hashed) naming the category.
31. **"Pack updated" is a code diff** of the published pack against the previous version: essay
    prompts and limits, short answers, rounds and deadlines, recommendation questions and AI policy.
    One notification per school per publish ("Halvorsen changed Essay 2's limit to 250 words").
32. **ICS feed** `GET /api/calendar.ics?token=` (§11): a random 32-byte token, stored hashed, shown
    once when created or replaced. It lists deadlines and tasks (all-day), expert sessions and
    accepted Guide chats (timed). Titles only; no essay content.
33. The scheduling provider lives in `apps/web/lib/scheduling/` (server-only), not a new package.
34. `bookings.user_id` replaces §10's `applicant_id`, so the ownership-scoped repo pattern holds.
    `checkouts.school_cycle_id` becomes nullable and `checkouts.booking_id` is added.
35. Rate limits and `Idempotency-Key` stay in-process (Phases 1–6); Upstash comes in Phase 9b.
36. Console route groups `(expert)` and `(guide)` require a session and the welcome gate (18+ and the
    integrity terms), not the applicant first run, and render without the applicant dock.

---

## 2. Data model: migration `0008_experts_connect_tracker`

New schema files in `packages/db/src/schema/`: `experts.ts`, `connect.ts`, `tracker.ts`,
`notifications.ts`, `decisions.ts`, exported from `schema/index.ts` (relations in `relations.ts`).
Generated with `pnpm --filter @admitstory/db generate --name experts_connect_tracker`, applied with
`pnpm db:migrate`. Every table has `baseColumns()`. User-owned tables have `user_id uuid not null →
users.id on delete cascade` with an index. Status columns are `text` with `$type<>()` (Phase 5/6
style), not pgEnums.

Changes to existing tables:

- `user_schools`: `deadline_override date null`.
- `checkouts`: `school_cycle_id` drops `not null`; `booking_id uuid null` (no foreign key: bookings
  reference checkouts by provider id). A check: exactly one of `school_cycle_id`, `booking_id` is set.

| Table                      | Columns (beyond id/created_at/updated_at)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Keys and indexes                                                                                                                                           |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `experts`                  | `user_id → users restrict` (unique), `slug text`, `display_name`, `headline` (one line), `bio text`, `school_ids uuid[]` (schools.id), `languages text[]`, `price_cents int` (check 5000–10000), `currency text default 'USD'`, `duration_min int default 45`, `payout_share_bps int default 8000`, `timezone text`, `cal_username text null`, `cal_event_type_id text null`, `availability jsonb $type<ExpertAvailability>` (fake scheduler + display line), `active bool default false`, `approved_at`, `approved_by uuid null`                                                                                                                                                                                                                                                                                                                                                                                             | unique(slug), unique(user_id)                                                                                                                              |
| `bookings`                 | `user_id` (applicant, cascade), `expert_id → experts restrict`, `user_school_id → user_schools set null`, `starts_at`, `ends_at`, `applicant_timezone text`, `status text $type<BookingStatus>`, `hold_expires_at null`, `price_cents`, `currency`, `checkout_id text null` (provider checkout id), `purchase_id → purchases set null`, `provider text` ('calcom'\|'fake'), `provider_booking_id text null`, `provider_reservation_id text null`, `meeting_url text null`, `consent_share_brief bool default false`, `consent_at null`, `brief_encrypted text null`, `focus_encrypted text null`, `recording_ok bool null`, `debrief_encrypted text null`, `debriefed_at null`, `outcome_marked_at null`, `cancelled_at null`, `cancel_reason text null`, `reschedule_count int default 0`, `refund_status text null` ('pending'\|'refunded'\|'rejected'), `payout_id → payouts set null`, `reminders_sent text[] default {}` | index(user_id); index(expert_id, starts_at); unique(provider_booking_id); partial unique(expert_id, starts_at) where status in ('held','paid','confirmed') |
| `payouts`                  | `expert_id → experts restrict`, `period text` ('2026-11'), `amount_cents`, `currency`, `booking_count int`, `status text` ('draft'\|'paid'\|'void'), `paid_at null`, `method text null`, `reference text null`, `note text null`, `recorded_by uuid null`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | partial unique(expert_id, period) where status <> 'void'                                                                                                   |
| `guides`                   | `user_id` (cascade, unique), `school_id → schools`, `class_year int`, `role_line text` ("2nd-year, product club"), `bio text`, `languages text[]`, `availability_text text`, `chat_type text default 'free'`, `price_cents int null`, `weekly_capacity int default 2`, `verification text $type<'pending'\|'email_sent'\|'verified'\|'rejected'>`, `verified_via text null` ('school_email'\|'manual'), `verified_email_hash text null`, `verify_token_hash text null`, `verify_expires_at null`, `verified_at null`, `active bool default false`                                                                                                                                                                                                                                                                                                                                                                             | unique(user_id); index(school_id, active); unique(verify_token_hash)                                                                                       |
| `guide_requests`           | `user_id` (applicant, cascade), `guide_id → guides cascade`, `user_school_id → user_schools set null`, `message_encrypted text`, `windows jsonb $type<string[]>` (3 ISO starts), `status text` ('pending'\|'accepted'\|'declined'\|'cancelled'\|'expired'\|'completed'), `accepted_start null`, `meeting_url text null`, `responded_at null`, `decline_reason text null` (≤ 200), `contact_id → contacts set null`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | index(user_id); index(guide_id, status)                                                                                                                    |
| `contacts`                 | `user_id`, `school_id → schools set null`, `name text`, `class_year int null`, `role text null`, `how_met text $type<HowMet>`, `may_name bool default false`, `guide_id → guides set null`, `archived_at null`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | index(user_id)                                                                                                                                             |
| `conversations`            | `user_id`, `contact_id → contacts cascade`, `school_id → schools set null` (denormalised), `code text` ("C1"), `held_on date`, `source_id → sources set null`, `status text` ('extracting'\|'ready'\|'failed'), `insights jsonb $type<ConversationInsights> null`, `use_in_essays bool default true`, `error text null`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | unique(user_id, code); index(user_id, school_id)                                                                                                           |
| `outreach_drafts`          | `user_id`, `contact_id → contacts set null`, `school_id → schools set null`, `recipient jsonb $type<OutreachRecipient>`, `learn text` (≤ 300), `content jsonb $type<OutreachDraftContent>`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | index(user_id)                                                                                                                                             |
| `tasks`                    | `user_id`, `user_school_id → user_schools cascade null`, `title text` (≤ 140), `due_on date null`, `status text` ('open'\|'done'\|'dismissed'), `kind text $type<TaskKind>`, `auto bool default false`, `auto_key text null`, `done_at null`, `note text null`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | index(user_id, status); partial unique(user_id, auto_key) where auto_key is not null                                                                       |
| `tracker_cells`            | `user_id`, `user_school_id → user_schools cascade`, `component text $type<TrackerComponent>`, `status text $type<CellStatus>`, `note text null` (≤ 200)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | unique(user_school_id, component)                                                                                                                          |
| `calendar_feeds`           | `user_id` (unique), `token_hash text` (unique), `rotated_at`, `last_fetched_at null`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |                                                                                                                                                            |
| `notifications`            | `user_id`, `kind text $type<NotifyKind>`, `category text $type<NotifyCategory>`, `payload jsonb $type<NotifyPayload>` (names, dates, counts, ids; never content), `dedupe_key text`, `read_at null`, `email_status text` ('none'\|'pending'\|'sending'\|'sent'\|'digest'\|'digested'\|'skipped'\|'failed'), `email_due_at null`, `emailed_at null`, `delivery_id text null`, `error text null`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | unique(user_id, dedupe_key); index(email_status, email_due_at); index(user_id, created_at)                                                                 |
| `notification_preferences` | `user_id` (unique), `categories jsonb $type<Record<NotifyCategory, Frequency>>`, `digest_hour int default 8`, `marketing_opt_in bool default false`, `unsubscribe_token_hash text` (unique), `last_digest_on date null`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |                                                                                                                                                            |
| `decision_plans`           | `user_id`, `user_school_id → user_schools cascade null`, `kind text $type<DecisionKind>`, `scope_key text` (user_school_id, or `"offers"`), `data_encrypted text` (JSON of the plan), `version int default 1`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | unique(user_id, kind, scope_key)                                                                                                                           |

Encrypted (AES-256-GCM, `encryptContent`): `bookings.brief_encrypted` (`ExpertBrief`),
`focus_encrypted` (string), `debrief_encrypted` (`ExpertDebrief`), `guide_requests.message_encrypted`,
`decision_plans.data_encrypted`. Conversation notes are `sources` rows (`text_encrypted`, kind
`conversation_note`, `meta: { conversationId }`). Expert and guide repositories never select the
applicant's other tables.

### Repositories (all by foundation; packages only call them)

Every applicant function is `(db, userId, …)` and owner-scoped (`assertId`), returning null/[] for
rows that aren't theirs. Expert and guide functions take an `expertId`/`guideId` resolved from the
session by the console guard and scope by it. Admin functions take `AdminContext` and write
`audit_log`. System functions (cron, webhooks) take `systemContext(db, job)`.

```ts
// repos/experts.ts
listActiveExperts(db) → ExpertRow[]; getExpertBySlug(db, slug); getExpertForUser(db, userId) → ExpertRow | null
updateExpertProfile(db, expertId, patch /* bio, headline, languages, availability, timezone */)
adminListExperts(admin), adminCreateExpert(admin, { email, … }) /* grants role expert */, adminUpdateExpert(admin, id, patch /* price, share, active, schools, cal ids */)
// repos/bookings.ts
createHeldBooking(db, userId, input) → BookingRow | "slot_taken"     // partial unique index guards the race
attachCheckout(db, userId, bookingId, checkoutId); getBooking(db, userId, id); listBookings(db, userId)
readBookingSecrets(db, userId, id) → { brief, focus, debrief }      // decrypts; applicant side
setBookingConsent(db, userId, id, { consent, brief: ExpertBrief | null, now }); setBookingFocus(…)
markBookingPaid(tx, bookingId, purchaseId)                          // called inside applyExpertSessionPaid
confirmBooking(ctx, id, { providerBookingId, meetingUrl, startsAt, endsAt }); markNeedsTime(ctx, id)
rescheduleBooking(db, userId, id, { startsAt, endsAt, providerBookingId? }); cancelBooking(db, userId, id, { status, reason, now })
// expert side
listExpertBookings(db, expertId, { from?, to? }); getExpertBooking(db, expertId, id) → row + brief only when consent
saveDebrief(db, expertId, id, debrief, now); markOutcome(db, expertId, id, "completed" | "no_show", now); expertCancel(db, expertId, id, now)
// system
expireHolds(ctx, now) → ids; autoComplete(ctx, now) → ids; findBookingByProvider(ctx, providerBookingId)
listBookingsStartingBetween(ctx, from, to) → reminder candidates; markReminderSent(ctx, id, key)
applyCalEvent(ctx, { providerBookingId, kind: "rescheduled" | "cancelled", startsAt?, endsAt? })
// repos/payouts.ts
adminPayableBookings(admin, expertId, period); adminCreatePayout(admin, { expertId, period }) /* computes with payoutFor, links bookings */
adminMarkPayoutPaid(admin, id, { method, reference, paidAt }); adminVoidPayout(admin, id); adminListPayouts(admin, { period? })
// repos/guides.ts
applyAsGuide(db, userId, input) → GuideRow; setGuideVerifyToken(db, userId, { tokenHash, emailHash, expiresAt }); verifyGuideToken(db, tokenHash, now) → GuideRow | null
getGuideForUser(db, userId); updateGuideProfile(db, guideId, patch); listGuidesForSchool(db, schoolId) /* verified + active only */
createGuideRequest(db, userId, { guideId, userSchoolId, message, windows }) → row | "too_many_open" | "guide_full"
listMyGuideRequests(db, userId); cancelGuideRequest(db, userId, id); completeGuideRequest(db, userId, id, contactId)
listGuideInbox(db, guideId); readGuideRequest(db, guideId, id) /* decrypts message */; acceptGuideRequest(db, guideId, id, { start, meetingUrl }); declineGuideRequest(…)
listAcceptedGuideChats(db, userId) /* both sides, for the ICS feed */
adminListGuides(admin, { verification? }); adminSetGuideVerification(admin, id, "verified" | "rejected"); adminSetGuideActive(admin, id, active)
// repos/connect.ts
createContact, updateContact, archiveContact, listContacts(db, userId)
createConversation(db, userId, { contactId, heldOn, sourceId }) → row with next C code; saveInsights(…); failInsights(…); updateConversation(… useInEssays, insights edits); deleteConversation
listConversations(db, userId, { schoolId? }); engagementRows(db, userId, schoolId) → for the dossier line
saveOutreachDraft, listOutreachDrafts, deleteOutreachDraft
// repos/tracker.ts
listTrackerCells(db, userId); setTrackerCell(db, userId, { userSchoolId, component, status | null, note })
setDeadlineOverride(db, userId, userSchoolId, date | null)
listTasks(db, userId, { status? }); createTask, updateTask, deleteTask (manual only), dismissTask
syncAutoTasks(db, userId, planned: PlannedTask[])     // inserts missing; updates title/due; completes when planned.done; never resurrects dismissed
listTasksDueOn(ctx, date range) → reminder candidates (system)
// repos/calendar.ts
createOrRotateFeed(db, userId, tokenHash); revokeFeed(db, userId); resolveFeed(db, tokenHash, now) → userId | null
// repos/notifications.ts
insertNotification(db, userId, { kind, category, payload, dedupeKey, emailStatus, emailDueAt }) → row | null (dedupe)
listNotifications(db, userId, { before?, limit }); unreadCount(db, userId); markRead(db, userId, ids | "all")
getPreferences(db, userId) → prefs (created with defaults and a token hash on first read); updatePreferences(db, userId, patch)
resolveUnsubscribe(db, tokenHash) → userId | null
claimDueEmails(ctx, now, limit) → rows   // UPDATE … SET email_status='sending' WHERE email_status='pending' AND email_due_at <= now … RETURNING
finishEmail(ctx, id, { status: "sent" | "failed", deliveryId?, error? })
claimDigest(ctx, userId, localDate) → rows   // 'digest' → 'digested', sets last_digest_on; single statement
usersDueForDigest(ctx, now) → { userId, timezone, digestHour }[]
// repos/decisions.ts
getDecisionPlan(db, userId, kind, scopeKey) → decrypted | null; saveDecisionPlan(db, userId, kind, scopeKey, data) → version+1; listDecisionPlans(db, userId)
// repos/commerce.ts (edits)
recordExpertCheckout(db, userId, { provider, providerCheckoutId, bookingId, amountCents, currency })
applyExpertSessionPaid(db, event) → { outcome: "applied", bookingId, userId, purchaseId } | duplicate | mismatch   // one transaction: claim event, check checkout, insert purchase, entitlement (kind expert_session, refId bookingId, zero limits), markBookingPaid
RefundOutcome "revoked" gains { entitlementKind, refId }
```

All exported from `repos/index.ts` and `src/index.ts`. Tokens reuse `crypto/tokens.ts`
(`newPortalToken` is renamed-aliased as `newSecretToken`; `hashPortalToken` as `hashSecretToken`).

---

## 3. Shared types and pure helpers (`@admitstory/shared/apply`, Zod-free)

New folder `packages/shared/src/apply/` with `experts.ts`, `connect.ts`, `tracker.ts`, `notify.ts`,
`decisions.ts`, `ics.ts`, `views.ts`, `index.ts`; new export `"./apply"` in
`packages/shared/package.json`. Request validators stay inline in the route files (server only), so
no Zod reaches the browser.

```ts
// experts.ts
export const EXPERT_SESSION_MINUTES = 45, EXPERT_PRICE_MIN_CENTS = 5_000, EXPERT_PRICE_MAX_CENTS = 10_000, EXPERT_DEFAULT_PRICE_CENTS = 10_000;
export const FREE_CHANGE_HOURS = 24, BOOKING_LEAD_HOURS = 24, HOLD_MINUTES = 15, NO_SHOW_AFTER_MINUTES = 15, MAX_RESCHEDULES = 2, AUTO_COMPLETE_HOURS = 24;
export const BOOKING_STATUSES = ["held","paid","confirmed","needs_time","completed","debriefed","cancelled","cancelled_late","cancelled_by_expert","no_show","expert_no_show","expired"] as const;
export const BOOKING_STATUS_LABELS: Record<BookingStatus, string>; // "Waiting for payment", "Paid, confirming", "Booked", "Pick a new time", "Done", "Debrief ready", "Cancelled, refunded", "Cancelled late (charged)", "Cancelled by the expert, refunded", "Missed (charged)", "The expert missed it, refunded", "Hold expired"
export const PAYABLE_STATUSES: readonly BookingStatus[];  // completed, debriefed, no_show, cancelled_late
export function changePolicy(b: { startsAt: string; status: BookingStatus; rescheduleCount: number }, now: Date): { canReschedule: boolean; canCancelFree: boolean; canCancel: boolean; freeUntil: string; line: string };
  // line: "Free to move or cancel until Thu 13 Nov, 18:30. After that, cancelling is charged."
export interface ExpertAvailability { timeZone: string; weekly: { day: 0|1|2|3|4|5|6; from: string /* "18:00" */; to: string }[]; note: string }
export interface Slot { start: string; end: string }
export function slotsFromAvailability(a: ExpertAvailability, o: { from: Date; to: Date; durationMin: number; taken: readonly Slot[]; now: Date }): Slot[];  // the fake scheduler; deterministic; respects BOOKING_LEAD_HOURS; 15-min boundaries
export function payoutFor(rows: readonly { priceCents: number; status: BookingStatus }[], shareBps: number): number;
export type RubricId = "answered" | "structure" | "specificity" | "ownership" | "self_awareness" | "school_fit" | "consistency" | "delivery";
export const INTERVIEW_RUBRIC: readonly { id: RubricId; label: string; anchors: { 1: string; 3: string; 5: string } }[];  // Appendix E, verbatim anchors
export interface ExpertDebrief { scores: Partial<Record<RubricId, 1|2|3|4|5>>; strengths: string[] /* ≤3, ≤200 chars */; fixes: string[]; notes: string /* ≤4000 */; submittedAt: string }
export interface ExpertBrief { builtAt: string; applicant: { firstName: string }; school: { name: string; round: string | null; deadline: string | null } | null;
  interview: { invitation: string; who: string[]; blind: boolean | null; lengthMin: number | null; location: string[]; notes: string[] } | null;
  positioning: string | null; fileMap: { deliverable: string; story: string }[]; stories: { title: string; result: string; traits: string[] }[];
  likelyQuestions: string[]; focus: string | null }

// connect.ts
export const HOW_MET = ["guide","linkedin","ambassador","club","event","alumni_network","other"] as const; HOW_MET_LABELS
export const INSIGHT_KINDS = ["club","course","culture","recruiting","other"] as const; INSIGHT_KIND_LABELS  // "Clubs", "Courses", "Culture", "Recruiting", "Other"
export interface ConversationInsights { summary: string /* ≤40 words, the ENGAGEMENT "taught" text */; items: { kind: InsightKind; text: string; quote: string | null }[]; follow_ups: string[] }
export interface OutreachRecipient { name: string | null; role: string; school: string; foundVia: HowMet }
export interface OutreachDraftContent { subject: string; body: string; proof_points: { text: string; cites: string[] }[]; question: string; ask: string }
export const CONNECT_LIMITS = { outreachPerDay: 10, insightsPerDay: 10, noteChars: 6_000, voiceSeconds: 180 } as const;
export const GUIDE_CHAT_MINUTES = 20, GUIDE_OPEN_REQUESTS_MAX = 3, GUIDE_WEEKLY_CAPACITY_DEFAULT = 2, GUIDE_VERIFY_HOURS = 48, GUIDE_REQUEST_EXPIRY_DAYS = 7;
export const GUIDE_REQUEST_STATUSES, GUIDE_VERIFICATION_STATUSES (+ labels)
export function schoolEmailMatches(email: string, website: string): boolean;   // host suffix of the website's registrable domain
export const OFFICIAL_EVENT_KINDS = ["info_session","ambassador","admissions_event","webinar","campus_visit","other"] as const; labels

// tracker.ts
export const TRACKER_COMPONENTS = ["essays","short_answers","video","form","resume","test_scores","transcripts","recommender_1","recommender_2","recommender_3","fee","submitted","interview","decision"] as const;
export const COMPONENT_LABELS: Record<TrackerComponent, string>;  // "Essays", "Short answers", "Video essay", "Form", "Résumé", "Test scores sent", "Transcripts", "Recommender 1"…, "Fee or waiver", "Submitted", "Interview", "Decision"
export const CELL_STATUSES = ["not_started","in_progress","done","not_needed"] as const; CELL_STATUS_LABELS
export interface TrackerCell { component: TrackerComponent; status: CellStatus; detail: string /* "2 of 3 final", "Invited 12 Oct" */; source: "derived" | "manual"; note: string | null; href: string | null }
export interface DeriveInput { status: UserSchoolStatus; pack: { shortAnswers: number; video: boolean; recommenders: number } | null;
  kit: { unlocked: boolean; essays: { total: number; final: number; drafted: number }; shortAnswers: { total: number; final: number; drafted: number }; video: { total: number; final: number }; form: { advised: boolean } } | null;
  resume: { reviewed: boolean }; recommenders: { name: string; status: RecommenderStatus; at: string | null }[]; manual: readonly { component: TrackerComponent; status: CellStatus; note: string | null }[] }
export function deriveCells(input: DeriveInput): TrackerCell[];
export function readyToSubmit(cells: readonly TrackerCell[], kit: { openVerify: number; openMustFix: number } | null): { ready: boolean; blocking: string[] };
export const TASK_KINDS = ["manual","send_scores","transcripts","fee","answer_needs","invite_recommender","submit","event"] as const; TASK_STATUSES
export interface PlannedTask { autoKey: string; kind: TaskKind; title: string; dueOn: string | null; userSchoolId: string | null; done: boolean }
export function planAutoTasks(input: { today: string; schools: { userSchoolId; name; deadline: string | null; cells: readonly TrackerCell[]; openNeeds: number }[]; asks: { recommender: string; userSchoolId: string | null; sendOn: string; sent: boolean }[] }): PlannedTask[];
export const COUNTDOWN_DAYS = [14, 7, 3, 1] as const;
export function localDate(now: Date, timeZone: string | null): string;  // "2026-11-02"
export function daysBetween(from: string, to: string): number;

// ics.ts
export interface IcsItem { uid: string; title: string; allDay?: { date: string }; timed?: { start: string; end: string }; url?: string; description?: string }
export function buildIcs(items: readonly IcsItem[], opts: { calendarName: string; now: Date }): string;  // RFC 5545: CRLF, 75-octet folding, escaping, DTSTAMP

// notify.ts
export const NOTIFY_CATEGORIES = ["kit","deadlines","tasks","bookings","connect","packs","decisions"] as const; NOTIFY_CATEGORY_LABELS + descriptions
export const FREQUENCIES = ["instant","daily","off"] as const; FREQUENCY_LABELS  // "Every time", "Daily summary", "Off"
export const DEFAULT_FREQUENCIES: Record<NotifyCategory, Frequency> = { kit: "instant", deadlines: "instant", tasks: "daily", bookings: "instant", connect: "instant", packs: "daily", decisions: "instant" };
export const NOTIFY_KINDS = {  // kind → { category, transactional }
  kit_ready, deadline_countdown, task_due, booking_confirmed*, booking_changed*, booking_needs_time*, booking_reminder, debrief_ready,
  expert_new_booking*, expert_booking_changed*, guide_request, guide_accepted*, guide_declined, guide_intro*, pack_updated, conversation_ready } as const;  // * transactional
export type NotifyPayload = /* discriminated by kind: school names, ISO dates, counts, ids and the in-app href; never essay, note or letter text */;
export function notificationCopy(kind, payload, audience: { timeZone: string | null }): { title: string; line: string; cta: { label: string; href: string } | null };
  // the single source of wording for the in-app list, emails and the digest, e.g.
  // deadline_countdown → "Halvorsen is due in 7 days" / "R2 closes on Tue 6 Jan. 3 parts still open." / "Open your tracker"
export const DIGEST_HOUR_DEFAULT = 8, NOTIFY_HOUR = 9;

// decisions.ts
export const DECISION_KINDS = ["waitlist","scholarship","feedback","offers"] as const;
export const OFFER_CRITERIA = [ { id: "outcomes", label: "Outcomes in your target role and city" }, { id: "net_cost", label: "Net cost after aid" }, { id: "fit", label: "Fit with how you work" }, { id: "programmes", label: "Specific programmes you'd use" }, { id: "location", label: "Location and life" } ] as const;
export interface OfferMatrix { weights: Record<CriterionId, 0|1|2|3|4|5>; schools: { userSchoolId: string; costUsd: number | null; aidUsd: number | null; scores: Partial<Record<CriterionId, 1|2|3|4|5>>; note: string }[] }
export function rankOffers(m: OfferMatrix): { userSchoolId: string; total: number; netCostUsd: number | null; parts: Record<CriterionId, number | null> }[];  // net_cost scored by code (cheapest 5, linear); ties keep input order
export const WAITLIST_ACTIONS: readonly { id: string; label: string }[];   // DEC-01, plain
export const NEWS_KINDS = ["promotion","new_score","new_responsibility","new_result","other"] as const; labels
export interface WaitlistPlan { news: { id: string; kind: NewsKind; text: string; on: string | null }[]; done: string[] /* action ids */; letter: DecisionLetterContent | null }
export const SCHOLARSHIP_ETIQUETTE: readonly string[];                      // DEC-02
export interface ScholarshipPlan { offer: { school: string; amountUsd: number | null; genuine: boolean } | null; reasons: string[]; letter: DecisionLetterContent | null }
export const FEEDBACK_AREAS = ["academics","leadership","goals","engagement","pool"] as const; FEEDBACK_AREA_LABELS; FEEDBACK_QUESTIONS: readonly string[];  // DEC-04
export interface FeedbackPlan { callOn: string | null; questions: string[]; gaps: { area: FeedbackArea; theySaid: string; weThink: string; change: string }[] }
export interface DecisionLetterContent { subject: string; paragraphs: { text: string; cites: string[] }[]; notes: string[]; builtAt: string }
```

View shapes (`views.ts`), shared by routes and UIs:

```ts
ExpertCard { id; slug; name; headline; bio; languages: string[]; schools: string[]; priceCents; currency; durationMin; nextSlot: string | null; availabilityNote }
SlotsView { expertId; timeZone /* applicant */; expertTimeZone; days: { date: string; slots: Slot[] }[] }
BookingView { id; expert: { name; headline }; school: string | null; startsAt; endsAt; status; statusLabel; meetingUrl: string | null; policy: ReturnType<typeof changePolicy>; consentShareBrief: boolean; hasDebrief: boolean; priceCents; currency }
BookingDetailView BookingView & { brief: ExpertBrief | null /* the applicant's own preview */; focus: string | null; debrief: ExpertDebrief | null; recordingOk: boolean | null }
InterviewPageView { experts: ExpertCard[]; upcoming: BookingView[]; past: BookingView[] }
ExpertConsoleView { expert: { name; timeZone; priceCents }; upcoming: ExpertBookingRow[]; awaiting: ExpertBookingRow[] /* needs outcome or debrief */; past: ExpertBookingRow[] }
ExpertBookingRow { id; applicantFirstName; school: string | null; startsAt; endsAt; status; meetingUrl; brief: ExpertBrief | null /* only with consent */; focus: string | null /* only with consent */; debrief: ExpertDebrief | null; canMarkOutcome: boolean }
AdminExpertsView, AdminPayoutsView { period; rows: { expertId; name; bookings: number; amountCents; payout: { id; status; paidAt; reference } | null }[] }
ConnectPageView { schools: { schoolId; userSchoolId; name }[]; contacts: ContactView[]; conversations: ConversationView[]; outreach: OutreachView[]; channels: OfficialChannelsView[]; guides: GuidesSummary }
ContactView { id; name; school: string | null; classYear; role; howMet; mayName; conversations: number }
ConversationView { id; code; contactId; contactName; school: string | null; heldOn; status; insights: ConversationInsights | null; useInEssays: boolean; spoken: boolean }
OutreachView { id; recipient: OutreachRecipient; learn; content: OutreachDraftContent; createdAt }
OfficialChannelsView { schoolId; school; channels: { id; name; whatItIs; url }[]; events: { id; name; kind; startsAt; endsAt: string | null; url }[] }
GuidesSummary { open: number; accepted: number; schoolsWithGuides: { schoolId; name; guides: number }[] }
GuideCard { id; firstName; school; classYear; roleLine; bio; languages; availabilityText; full: boolean }
GuideRequestView { id; guide: GuideCard; status; windows: string[]; acceptedStart: string | null; meetingUrl: string | null; declineReason: string | null }
GuideConsoleView { guide: { verification; active; school; capacity }; inbox: { id; applicantFirstName; school: string | null; message: string; windows: string[]; status; acceptedStart }[] }
TrackerView { today; timeZone; rows: TrackerRow[]; components: TrackerComponent[] /* visible columns */; tasks: TaskView[]; feed: { exists: boolean } ; events: HorizonEvent[] }
TrackerRow { userSchoolId; school; round: string | null; deadline: string | null; deadlineSource: "pack" | "override" | null; daysLeft: number | null; status: UserSchoolStatus; cells: TrackerCell[]; ready: { ready: boolean; blocking: string[] }; kitHref: string | null }
TaskView { id; title; dueOn: string | null; status; kind; auto: boolean; school: string | null; href: string | null }
HorizonEvent { date: string; kind: "deadline" | "task" | "session" | "chat" | "event"; userSchoolId: string | null; label: string }
TrackerSummary { next: { text; href; due: string | null } | null; dueThisWeek: number; ready: string[] /* school names */ }   // for Home
NotificationsView { items: { id; kind; title; line; cta; createdAt; read: boolean }[]; nextCursor: string | null; unread: number }
PreferencesView { categories: { id: NotifyCategory; label; description; frequency: Frequency; transactionalNote: string | null }[]; digestHour: number; timeZone: string | null }
DecisionsView { schools: { userSchoolId; name; status: "admitted" | "waitlisted" | "denied" }[]; waitlist: Record<string, WaitlistPlan & { instructions: { text; verifiedAt }[] }>; scholarship: Record<string, ScholarshipPlan>; feedback: Record<string, FeedbackPlan>; offers: (OfferMatrix & { ranked: ReturnType<typeof rankOffers>; evidence: Record<string /*userSchoolId*/, { criterion: CriterionId; text: string; source: string }[]> }) | null; canDraft: boolean; lockedReason: string | null }
```

---

## 4. AI tasks (`packages/ai`)

Each has a v1 prompt in `packages/ai/src/prompts/<task>/v1.md` (front matter `agent`, `version: 1`,
`canon: [...]`, `output`, `notes`; prettier-ignored), a Zod schema (new `src/schemas/connect.ts` and
`src/schemas/decisions.ts`, exported from `schemas/index.ts`), a task in `src/tasks/connect.ts` or
`src/tasks/decisions.ts` registered in `tasks/index.ts`, a route in `routing.ts` (two new, with
`routing.test.ts` SPEC rows "Added in Phase 8" if that test enumerates routes), and `check()` rules
that get the one repair. Untrusted text (conversation notes, news items, the applicant's "what I want
to learn") goes in `untrustedBlock(...)`. All three join `AFTER_GENERATION` in `cost.ts`.

| Task                              | Route                           | Layers               | Canon                                            |
| --------------------------------- | ------------------------------- | -------------------- | ------------------------------------------------ |
| `connect.outreach` (route exists) | haiku, low, thinking off, 600   | dossier              | `story-craft`, `truth-discipline`                |
| `connect.insights` (new)          | haiku, low, thinking off, 1,500 | none                 | `truth-discipline`                               |
| `decisions.letter` (new)          | sonnet, medium, adaptive, 2,000 | dossier, school pack | `decisions`, `truth-discipline`, `anti-ai-tells` |

### `connect.outreach` (§8.5.16)

Input: `{ recipient: { name: string | null, role, school, found_via }, learn: string (≤ 300, untrusted), school_values: string[] (≤ 5 short lines from the pack's stated values, may be empty) }`.
Output: `OutreachDraftContent`. Checks: subject ≤ 70 chars; body ≤ 110 words (readable in 20 seconds);
2–3 proof points, each citing ≥ 1 F/S/L code present in the dossier; every number in the body is in
the cited dossier lines; no proper name absent from the dossier, the recipient and the school
(`newNames`); exactly one question sentence in `question` and it appears in the body; the body asks
for a 15-minute call; banned openers and flattery (`/hope this (email|message) finds you/i`,
`/\b(huge fan|big fan|inspir(ing|ed by)|passionate|admire)\b/i`, `/^dear sir|madam/im`); no claim the
applicant has been admitted or interviewed.

### `connect.insights`

Input: `{ school: { name, short_name }, contact: { role: string | null, class_year: number | null }, note: string (≤ 6,000, untrusted) }`.
Output: `ConversationInsights`. Checks: 1–8 items; `summary` ≤ 40 words; each `quote` appears
(normalised) in the note, else must be null; no number or proper name absent from the note
(`newNumbers`, `newNames` from `tasks/forms.ts`); no item that frames the person as choosing the
applicant's goal (`/\b(told|convinced) me to (pursue|become|switch)\b/i`, canon §5.14 rule); ≤ 3
follow-ups, each a question.

### `decisions.letter`

Input: `{ kind: "waitlist_update" | "scholarship_note", applicant_first_name, school: { name }, news: { kind, text, on }[] (waitlist: 1–5, untrusted), competing_offer: { school, amount_usd: number | null } | null (scholarship: required, the applicant confirmed it is genuine), reasons: string[] (≤ 4, why this school, from the kit positioning or typed), instructions: string[] (the pack's waitlist items, verified only) }`.
Output: `DecisionLetterContent` (without `builtAt`, which code adds). Checks: waitlist ≤ 250 words,
scholarship ≤ 200; 2–4 paragraphs; every paragraph cites ≥ 1 code (F/S/L from the dossier, K from
the pack, or `N1…` for a news item); every number appears in the news, the offer or the cited
material; no school named except the target and the competing school; scholarship mentions the
competing school once and never implies a fallback (`/\b(safety|backup|back-up|second choice|fallback|plan b)\b/i`)
or demands (`/\b(must|demand|insist|match (my|this) offer or)\b/i`); waitlist reflects every news
item and asks for nothing the instructions forbid (if an instruction says "no letters", the task is
refused before the call: code returns "This school asks waitlisted applicants not to send updates.").

### Replays (`record:phase8 --synthetic`)

`packages/ai/scripts/samples/phase8.ts` (inputs) + `phase8-replies.ts` (hand-authored replies) +
`scripts/record-phase8.ts` (copy of record-phase6) + `"record:phase8"` in package.json. Cast: the
`engineer-to-product` applicant (`ENGINEER_DOSSIER`), the synthetic Halvorsen pack, a fictional
second-year "Maya Okafor" (product club) and a fictional alumna "Lena Brandt".

| Sample                                                                | First reply breaks                                                       |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `connect.outreach` to Maya (found via the product club)               | opens with "I hope this message finds you well" → repaired               |
| `connect.outreach` to an unnamed alum (LinkedIn)                      | clean                                                                    |
| `connect.insights` from a 2-minute note about Maya's chat             | invents "40 members" → repaired                                          |
| `decisions.letter` waitlist_update (promotion + new GMAT)             | clean                                                                    |
| `decisions.letter` scholarship_note (competing offer from Marrowgate) | calls Halvorsen "my first choice, not a backup" with "backup" → repaired |

`scripts/check-tasks.ts` gets the five sample inputs.

---

## 5. Deterministic code (who builds it)

| Code                                                                                                                                                                                                       | Owner                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Everything in §3 (`changePolicy`, `slotsFromAvailability`, `payoutFor`, `deriveCells`, `readyToSubmit`, `planAutoTasks`, `rankOffers`, `buildIcs`, `notificationCopy`, `schoolEmailMatches`, date helpers) | Foundation                          |
| `notify()` core: preference lookup, dedupe insert, email status and due time; `sendDirectEmail` signature                                                                                                  | Foundation (notify.ts), E (sending) |
| Payments: product key union, expert custom data, `expert_session_paid` event, expert checkout record, `applyExpertSessionPaid`, refund outcome kind                                                        | Foundation                          |
| Pack schema optional `connect` and `waitlist`; synthetic fixture data                                                                                                                                      | Foundation                          |
| Scheduling provider (Cal.com v2 + fake), Cal webhook verification, brief builder, booking state machine, payouts computation wiring                                                                        | A                                   |
| Engagement lines for the dossier layer; insight extraction flow; official channels view                                                                                                                    | B                                   |
| Guide verification links, capacity and expiry rules                                                                                                                                                        | C                                   |
| Tracker derivation inputs, auto-task sync, ICS feed assembly, deadline resolution, Home summary                                                                                                            | D                                   |
| Email rendering, instant send, digest, countdown/task/booking reminder scheduling, pack diff, unsubscribe                                                                                                  | E                                   |
| Plan storage, letter drafting flow, matrix evidence from the pack                                                                                                                                          | F                                   |

---

## 6. Routes

All under `apps/web/app/api`. Applicant routes: `requireUser()`, Zod (`readJson`, strict objects),
ownership through repos (404 for others), `checkRateLimit`, `Idempotency-Key` through
`apps/web/lib/idempotency.ts` on creating or costly POSTs, `handle()`. Expert routes:
`requireExpertApi()` (A, `lib/experts/guard.ts`); guide routes: `requireGuideApi()` (C,
`lib/guides/guard.ts`); both 404 for anyone else. Admin: `adminRoute()`.

| Method + path                                                                               | Input                                                                                           | Output                                                                                                | Owner |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----- |
| `GET /api/experts` (§11)                                                                    | —                                                                                               | `ExpertCard[]`                                                                                        | A     |
| `GET /api/experts/:slug/slots?from=&to=`                                                    | ISO dates (≤ 21 days)                                                                           | `SlotsView`                                                                                           | A     |
| `POST /api/bookings` (§11, idem)                                                            | `{ expertId, start, userSchoolId?, focus?, consentShareBrief, recordingOk?, timeZone }`         | 201 `{ booking: BookingView, checkout: CheckoutClientConfig }` (409 slot taken; 422 inside lead time) | A     |
| `GET /api/bookings`                                                                         | —                                                                                               | `InterviewPageView`                                                                                   | A     |
| `GET /api/bookings/:id`                                                                     | —                                                                                               | `BookingDetailView`                                                                                   | A     |
| `PATCH /api/bookings/:id`                                                                   | `{ consentShareBrief?, focus?, refreshBrief?: true, recordingOk? }`                             | `BookingDetailView`                                                                                   | A     |
| `POST /api/bookings/:id/reschedule` (idem)                                                  | `{ start }`                                                                                     | `BookingView` (409 outside policy)                                                                    | A     |
| `POST /api/bookings/:id/cancel` (idem)                                                      | `{ reason? }`                                                                                   | `BookingView` (refund when ≥ 24 h)                                                                    | A     |
| `POST /api/bookings/:id/checkout` (idem)                                                    | — (a `held` or `needs_time` booking whose checkout lapsed)                                      | `{ checkout }`                                                                                        | A     |
| `POST /api/bookings/:id/report`                                                             | `{ kind: "expert_no_show" }` (after start + 15 min)                                             | `{ reported: true }` (admin alert)                                                                    | A     |
| `GET /api/bookings/:id/ics`                                                                 | —                                                                                               | `text/calendar`                                                                                       | A     |
| `POST /api/webhooks/cal` (§11)                                                              | raw body, `X-Cal-Signature-256`                                                                 | 200 / 401                                                                                             | A     |
| `GET /api/expert/console` (§11)                                                             | —                                                                                               | `ExpertConsoleView`                                                                                   | A     |
| `GET /api/expert/bookings/:id`                                                              | —                                                                                               | `ExpertBookingRow`                                                                                    | A     |
| `POST /api/bookings/:id/debrief` (§11)                                                      | `ExpertDebrief` minus `submittedAt` (expert of the booking; after start)                        | `ExpertBookingRow` (notifies the applicant)                                                           | A     |
| `POST /api/expert/bookings/:id/outcome`                                                     | `{ outcome: "completed" \| "no_show" }`                                                         | `ExpertBookingRow`                                                                                    | A     |
| `POST /api/expert/bookings/:id/cancel`                                                      | `{ reason }`                                                                                    | `ExpertBookingRow` (full refund)                                                                      | A     |
| `PATCH /api/expert/profile`                                                                 | `{ headline?, bio?, languages?, availability?, timezone? }`                                     | profile                                                                                               | A     |
| `GET/POST /api/admin/experts`, `PATCH /api/admin/experts/:id`                               | create by email; price, share, active, schools, Cal ids                                         | admin views                                                                                           | A     |
| `POST /api/admin/bookings/:id/refund`                                                       | `{ reason }` (expert no-show, goodwill)                                                         | booking                                                                                               | A     |
| `GET /api/admin/payouts?period=`, `POST /api/admin/payouts`, `PATCH /api/admin/payouts/:id` | `{ expertId, period }`; `{ status: "paid", method, reference, paidAt }` or `{ status: "void" }` | `AdminPayoutsView`                                                                                    | A     |
| `GET /api/connect`                                                                          | —                                                                                               | `ConnectPageView`                                                                                     | B     |
| `POST /api/contacts` (§11)                                                                  | `{ name, schoolId?, classYear?, role?, howMet, mayName }`                                       | `ContactView`                                                                                         | B     |
| `PATCH/DELETE /api/contacts/:id`                                                            | partial / —                                                                                     | `ContactView` / `{ archived: true }`                                                                  | B     |
| `POST /api/contacts/:id/conversations` (§11, idem)                                          | `{ heldOn, text, spoken?: { seconds, language } }`                                              | `ConversationView` (insights run in the request; 10/day)                                              | B     |
| `PATCH/DELETE /api/conversations/:id`                                                       | `{ useInEssays?, items?, summary? }` / —                                                        | `ConversationView`                                                                                    | B     |
| `POST /api/connect/outreach` (§11, idem)                                                    | `{ contactId?, schoolId, recipient, learn }`                                                    | `OutreachView` (10/day)                                                                               | B     |
| `DELETE /api/connect/outreach/:id`                                                          | —                                                                                               | `{ deleted: true }`                                                                                   | B     |
| `GET /api/schools/:id/events` (§11)                                                         | — (`:id` = school id)                                                                           | `OfficialChannelsView`                                                                                | B     |
| `GET /api/schools/:id/events/:eventId/ics`                                                  | —                                                                                               | `text/calendar`                                                                                       | B     |
| `GET /api/guides?schoolId=`                                                                 | —                                                                                               | `GuideCard[]`                                                                                         | C     |
| `POST /api/guides/:id/requests` (idem)                                                      | `{ userSchoolId?, message (≤ 600), windows: string[3] }`                                        | `GuideRequestView` (409 full or too many open)                                                        | C     |
| `GET /api/guide-requests`                                                                   | —                                                                                               | `GuideRequestView[]`                                                                                  | C     |
| `POST /api/guide-requests/:id/cancel`, `/complete`                                          | —                                                                                               | `GuideRequestView` (complete creates a contact, `how_met: "guide"`)                                   | C     |
| `POST /api/guide/apply` (idem)                                                              | `{ schoolId, classYear, roleLine, bio, languages, availabilityText, schoolEmail }`              | `{ verification: "email_sent" \| "pending" }` (manual when the domain doesn't match)                  | C     |
| `POST /api/guide/verify`                                                                    | `{ token }`                                                                                     | `{ verified: true }` / 410                                                                            | C     |
| `GET /api/guide/console`, `PATCH /api/guide/profile`                                        | — / profile fields, capacity, active                                                            | `GuideConsoleView`                                                                                    | C     |
| `POST /api/guide/requests/:id/accept` / `decline`                                           | `{ start, meetingUrl }` / `{ reason? }`                                                         | inbox row (intro emails on accept)                                                                    | C     |
| `GET /api/admin/guides`, `PATCH /api/admin/guides/:id`                                      | `{ verification?, active? }`                                                                    | admin view                                                                                            | C     |
| `GET /api/tracker` (§11)                                                                    | —                                                                                               | `TrackerView` (syncs auto tasks first)                                                                | D     |
| `PATCH /api/tracker/cells`                                                                  | `{ userSchoolId, component, status: CellStatus \| null, note? }`                                | `TrackerRow`                                                                                          | D     |
| `PATCH /api/tracker/deadlines`                                                              | `{ userSchoolId, deadline: string \| null }`                                                    | `TrackerRow`                                                                                          | D     |
| `POST /api/tasks` (§11)                                                                     | `{ title, dueOn?, userSchoolId?, kind?: "manual" \| "event" }`                                  | `TaskView`                                                                                            | D     |
| `PATCH /api/tasks/:id` (§11), `DELETE /api/tasks/:id`                                       | `{ title?, dueOn?, status? }`                                                                   | `TaskView` / `{ deleted }` (auto → dismissed)                                                         | D     |
| `POST /api/tracker/calendar`                                                                | `{ action: "create" \| "rotate" \| "revoke" }`                                                  | `{ url: string \| null }` (shown once)                                                                | D     |
| `GET /api/calendar.ics?token=` (§11)                                                        | — (no session; 60/hour per token)                                                               | `text/calendar`, `Cache-Control: private, max-age=900`                                                | D     |
| `GET /api/notifications?before=`                                                            | —                                                                                               | `NotificationsView`                                                                                   | E     |
| `POST /api/notifications/read`                                                              | `{ ids?: string[], all?: true }`                                                                | `{ unread }`                                                                                          | E     |
| `GET/PATCH /api/notifications/preferences`                                                  | `{ categories?, digestHour? }`                                                                  | `PreferencesView`                                                                                     | E     |
| `GET/POST /api/notifications/unsubscribe?token=&category=`                                  | — (no session; POST is RFC 8058 one-click)                                                      | page redirect / 200                                                                                   | E     |
| `POST /api/dev/notify`                                                                      | `{ now?: ISO }` (localhost only)                                                                | `{ sent, digests, countdowns, reminders }`                                                            | E     |
| `GET /api/decisions`                                                                        | —                                                                                               | `DecisionsView`                                                                                       | F     |
| `PUT /api/decisions/:kind/:scope`                                                           | the plan for that kind (`scope` = userSchoolId, or `offers`)                                    | `DecisionsView`                                                                                       | F     |
| `POST /api/decisions/:kind/:scope/letter` (idem)                                            | `{}` (uses the saved plan)                                                                      | `DecisionLetterContent` (402 no active kit; 10/day)                                                   | F     |

Pages: A `app/(app)/interview/page.tsx` (adds the live expert section), `interview/expert/page.tsx`,
`interview/expert/[expertSlug]/page.tsx` (booking), `interview/expert/bookings/[bookingId]/page.tsx`,
`app/(expert)/expert/layout.tsx`, `expert/page.tsx`, `expert/bookings/[bookingId]/page.tsx`,
`expert/profile/page.tsx`, `app/(admin)/admin/experts/**`, `admin/payouts/page.tsx`.
B `app/(app)/connect/page.tsx` (`?tab=people|outreach|official&school=`). C
`app/(app)/connect/guides/page.tsx`, `app/(guide)/guide/layout.tsx`, `guide/page.tsx`,
`guide/join/page.tsx`, `guide/verify/page.tsx`, `app/(admin)/admin/guides/page.tsx`. D
`app/(app)/tracker/page.tsx` (`?view=horizon|matrix|tasks`). E `app/(app)/notifications/page.tsx`,
`app/(app)/settings/notifications/page.tsx`, `app/unsubscribe/page.tsx`. F `app/(app)/decisions/page.tsx`
(`?school=&tab=`).

---

## 7. Background jobs and emails

| Function                                      | Trigger                                                  | Does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Owner |
| --------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| `notify/dispatch` (`notifyDispatchFn`)        | cron `TZ=UTC */15 * * * *` + event `notify/dispatch.run` | (1) countdowns: for each user school with a deadline in the next 15 days and not submitted, each `COUNTDOWN_DAYS` threshold whose `sendAtFor(deadline − n, tz)` has passed → `notify(deadline_countdown, dedupe "deadline:{usId}:{deadline}:{n}")`; (2) tasks due today at 09:00 local → `task_due`; (3) bookings starting in 24 h ± 15 min and 1 h ± 15 min → `booking_reminder` to applicant and expert; (4) `claimDueEmails` and send; (5) digests for users at their digest hour | E     |
| `notify/send` (`notifySendFn`)                | event `notify/send.requested { notificationId }`         | sends one instant email now (so confirmations don't wait for the cron)                                                                                                                                                                                                                                                                                                                                                                                                               | E     |
| `notify/pack-updated` (`notifyPackUpdatedFn`) | event `kb/pack.published`                                | diffs against the previous published version; `pack_updated` to every user with that cycle on their list (dedupe by cycle + version)                                                                                                                                                                                                                                                                                                                                                 | E     |
| `experts/sweep` (`expertsSweepFn`)            | cron `TZ=UTC */10 * * * *`                               | `expireHolds` (releases Cal.com reservations), `autoComplete`                                                                                                                                                                                                                                                                                                                                                                                                                        | A     |

Without Inngest (local), `notify()` sends instant emails inline after the response (`dispatch()`),
and `POST /api/dev/notify` runs the dispatch loop with an optional `now`. The sweep runs lazily
when a booking or the console is read.

Email templates (`packages/emails`, React Email, inline Day palette like the magic-link email), E:

| Template            | Use                                                                                                                                                                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NotificationEmail` | every single notification: title (Newsreader), line, optional detail rows (label, value, tabular dates), one button named by `notificationCopy().cta.label`, footer with "Change what we email you" and, when not transactional, the unsubscribe line |
| `DigestEmail`       | "Today in AdmitStories": grouped notification lines plus "Questions waiting: 3 in Halvorsen" computed at send time; nothing when empty                                                                                                                |

`renderNotificationEmail(input) → { subject, html, text }` and `renderDigestEmail(input)` are the
exported renderers (foundation stubs, E implements). C's guide verification and intro emails and A's
booking emails all go through `notify()` or `sendDirectEmail()` (`lib/notify/direct.ts`, E) with a
`NotificationEmail`.

`apps/web/lib/email.ts` gains optional `headers` on `OutgoingEmail` (`List-Unsubscribe`,
`List-Unsubscribe-Post`), passed to Resend and recorded in the outbox JSON.

---

## 8. UI

Rules for every screen: §6 tokens and springs only, Night and Day, sentence case, no new colours,
status always as icon + word, 44 px targets, visible `--signal` focus ring, designed empty, loading
(placeholders with the exact shape, no shimmer, no spinner) and error states, reduced-motion
variants. Each big client screen loads behind a `next/dynamic` host (`<screen>-host.tsx`, the
`resume-host.tsx` pattern) so every route stays ≤ 160 KB gz. No Radix Tooltip/popper; menus are
`Sheet`s or disclosure buttons.

### Tracker, `/tracker` (screen L, package D)

Header: the next step as the headline ("Halvorsen is due in 6 days. Send your test scores.") and a
quiet line ("3 schools · 2 deadlines this month · 4 tasks open"). Tabs **Horizon · Matrix · Tasks**
(`?view=`, remembered per viewer in `localStorage`, wrapped in try/catch).

**Hero: the deadline horizon you can scrub (Horizon tab).** One shared time axis from a week ago to
two weeks after the last deadline (the strategy `time-scale.ts`). Each school is a lane: its name and
round on the left, then a ring of segments (one per needed component; filled = done, in chrome
`--text`; empty = `--edge` track), the deadline as a filled mark labelled "R2 · 6 Jan", task ticks,
session and chat marks. A vertical "Now" playhead crosses every lane. Drag it, or focus it and use
Left/Right (a day), Shift+Left/Right (a week), Home (today). As it moves, each lane says in words what
is due by that date ("By 12 Dec: test scores, fee"), and segments due before the playhead but not
done take a `--needs` outline with the warning icon. Choreography: on the first view per visit
(`sessionStorage`), each ring fills from empty to its current state, segment by segment, 30 ms apart,
on `drift`, lanes 60 ms apart; the playhead then settles on today (`glide`). Interruptible: any input
jumps to the end state. Reduced motion: rings drawn complete, playhead moves instantly. Accessible
equivalent: each lane is a list item ("Halvorsen, R2, due Tue 6 Jan, 23 days left. 7 of 11 parts
done. Due by 12 Dec: test scores, fee."), and the playhead is a slider with `aria-valuetext` naming the
date. Mobile: lanes stack; the axis scrolls sideways inside a focusable region; the playhead becomes
a date stepper.

**Everything else quiet.**

- **Matrix**: a dense table (schools as rows, components as columns, sticky first column, sideways
  scroll in its own focusable region). Cells: icon + word ("Done", "2 of 3", "Not needed",
  "Invited 12 Oct"); "Marked by you" in `--text-soft` for overrides. Activating a cell opens a
  `Sheet` with the four statuses as radio rows, a note (≤ 200), "Use what AdmitStories sees" (clears the
  override), and a link to where the work lives (the kit, `/recommenders`, `/resume`). The last
  column is "Ready to submit": `--verified` check + "Ready", or "Not yet" with the blocking list in
  the sheet. Deadline cells take an inline date field with "Use the school's date".
- **Tasks**: grouped Overdue / This week / Later / Done. Rows: checkbox (snap), title, school, due
  date (tabular, local), "Auto" tag for planned tasks with "Dismiss". "Add a task" opens an inline
  row (title, date, school). "Calendar feed" at the bottom: "Add your deadlines, tasks and sessions to
  your calendar." → "Create my calendar link" → the URL once with "Copy link" (toast "Calendar link
  copied") and "Get a new link" (dialog: "Your old link will stop working.").
- **Empty**: "Nothing to track yet. Add a school and its deadlines appear here." + "Add a school".
  **Error**: "Your tracker didn't load. Your schools and tasks are safe. Try again?" + "Load my tracker again".
- Keyboard: 1–3 switch tabs; in the matrix, arrows move between cells, Enter opens one.

### Connect, `/connect` (package B; the Guides tab is C)

Tabs **People · Guides · Outreach · Official** with a school filter. Layout: list plane on the left
(contacts grouped by school), work plane on the right.

**Hero: a conversation becomes evidence (People tab, logging a conversation).** "Log a conversation"
opens a sheet with the record button (dictation via `useDictation` and the applicant's
`/api/stt/token`, loaded on first press; 3-minute cap) or "Type it instead". While extraction runs,
the transcript stays on screen and the sheet says "Pulling out what you learned from Maya"
(`aria-live="polite"`). When insights land, the phrases they came from (`quote`) brighten in the
transcript in `--voice` (the applicant's own words), condense into insight rows, and fly along a
gentle curve into the school's "What you learned at Halvorsen" list (`drift`, `layoutId`, 50 ms
apart), echoing the Studio capture. Each row carries its kind as a word (Clubs, Culture…). Plays
once per conversation. Reduced motion: rows fade in over 120 ms, no flight. Screen readers: "4
things you learned added to Halvorsen."

**Everything else quiet.**

- Contact rows: name (or role when not nameable), school, class year, how met, conversations count.
  Contact detail: conversations as dated rows; each with its insights, the summary in Newsreader,
  "Use in my Halvorsen essays" switch (on by default) with the line "Drafts may mention what Maya
  taught you, as part of your story, never as a credential.", "May we name Maya?" switch.
- **Outreach**: a form (who, their role, where you found them, what you want to learn) → "Draft my
  message" → a paper sheet: subject, body (Newsreader 19/32), proof points listed under it with
  "from The night-shift fix", "Copy message" (toast "Message copied"), "Draft it again". The line
  "AdmitStories never sends messages for you." stays under the button.
- **Official**: per school, the channels (ambassador programme, admissions contact) and upcoming
  events (date and time in the applicant's zone, tabular; kind as a word), each with "Add to
  calendar" and "Remind me". "Admissions staff are reached only through these official channels."
- **Empty**: "No conversations yet. Talk to a student or alum, then tell us what you learned in two
  minutes." + "Log a conversation". Official with no verified events: "Halvorsen hasn't published
  events we've checked yet. Their admissions page is here." + link.
- **Errors**: insights failed: "We couldn't pull insights from this note. Your note is saved. Try
  again?" + "Pull out insights again".

### Guides (package C): `/connect/guides`, `/guide/**`

- Applicant (`/connect/guides`, also the Guides tab content): Guide rows per school (first name,
  class year, role line, languages, availability text; "Full this week" as a word). "Ask for a
  20-minute chat" opens a sheet: a short note (≤ 600) and three time windows (date + time pickers in
  the applicant's zone). Requests list with status words and icons; accepted shows the time and the
  meeting link, plus "After your chat: log what you learned" (→ B's conversation sheet via
  `?log=contactId`). Empty: "No Guides for Halvorsen yet. You can still reach students through the
  school's ambassador programme." + link to Official.
- Guide join (`/guide/join`): one question per screen (school, class year, role line, bio, languages,
  availability, school email) → "We sent a link to m.okafor@halvorsen.edu. It works for 48 hours."
  When the domain doesn't match: "We'll check this by hand and email you within a few days."
- Guide console (`/guide`, admin-style, no hero): inbox rows (applicant first name, school, note,
  three windows as radio rows), "Accept and send the introduction" (needs one window + a meeting link),
  "Decline" (optional reason). Profile and capacity form; "Pause new requests" switch.
- Verify (`/guide/verify?token=`): posts the token, then "You're verified as a Halvorsen Guide."

### Expert mocks (package A): `/interview`, `/interview/expert/**`, `/expert/**`, admin

- `/interview`: keeps the "Coming soon" block for AI practice exactly as now (`COMING_SOON`). Above
  it, a live section "Mock interview with an admissions expert": one line ("45 minutes on video with
  someone who has read applications. You get a written debrief."), the price ("$100"), "Book a mock"
  and the applicant's upcoming and past sessions as rows (status word + icon, local time, tabular).
- **Hero: choosing a time (booking page `/interview/expert/[expertSlug]`).** The expert's profile in
  a quiet left column (name, headline, bio in Newsreader, schools, languages, price). On the right,
  the next three weeks as a ribbon of day columns; available slots are short hairline ticks on each
  day's 24-hour track, times shown in the applicant's zone (the expert's zone small beside). Choosing
  a tick grows it into a 45-minute block that lifts into a confirm plane (`drift`, shared layout):
  date and time in both zones, the policy line, the school select, "What do you want to practise?"
  (≤ 600), the consent checkbox "Share a short brief with Manu before the session: your target
  school, positioning and story titles. Not your essays or transcripts." with "See exactly what Manu
  will see" (opens the brief preview sheet), the recording line, and "Book and pay $100". Payment
  uses the Phase 4 flow (Paddle overlay, or the local `FakeCheckout`); the plane then waits in place:
  "Payment received. Confirming your time with Manu." → "Booked for Thu 13 Nov, 18:30. The video link
  is in your email and below." Reduced motion: no growth or lift, the plane appears with a 120 ms
  fade. Keyboard: days are a roving list (Left/Right), slots a listbox (Up/Down), Enter selects.
  Mobile: one day at a time with a day stepper. Empty: "Manu has no open times in the next three
  weeks. New times usually open on Mondays." Error (slot taken): "Someone just booked that time. Pick
  another one." with the ribbon refreshed.
- Booking detail (`/interview/expert/bookings/[id]`): time, link ("Join the call" from 10 minutes
  before), policy line, "Move this session" (same ribbon, inside a sheet), "Cancel" (dialog naming
  the consequence: "Cancel and get a full refund" or "Cancel. This is within 24 hours, so it's still
  charged."), consent switch with the brief preview, "Refresh the brief". `needs_time`: "That time
  was taken while you paid. Your payment is kept. Pick another time." The debrief, once present: a
  paper sheet with the eight criteria as rows (label, score in words and a short bar, the anchor
  sentence for that score in `--text-soft`), strengths and fixes as numbered lists, notes in
  Newsreader. Hero on this screen: the first time a new debrief is viewed, the bars fill to their
  scores on `drift`, 40 ms apart (once; reduced motion: drawn complete).
- Expert console (`/expert`, admin-style, no hero): Upcoming / Needs you (outcome or debrief) /
  Past. Session detail: the consented brief (or "Asha didn't share a brief."), focus note, "Join the
  call", "Asha didn't join" (from 15 minutes after the start), "Cancel this session" (refunds), and
  the debrief form (eight criteria as 1–5 radio rows with "Not covered", three strengths, three
  fixes, notes, "Send the debrief to Asha"). Profile page: headline, bio, languages, time zone,
  weekly availability (used by the fake; with Cal.com, "Manage your times in Cal.com").
- Admin `/admin/experts` (list; add by email; edit price within $50–$100, share, schools, Cal ids,
  active; bookings with refunds) and `/admin/payouts` (month picker; per expert: sessions, amount;
  "Create the payout" → draft; "Mark paid" with method, reference and date; "Void").

### After decisions, `/decisions` (package F)

One page, a section per school by status, ordered admitted → waitlisted → denied. Tabs inside a
school when more than one tool applies.

**Hero: weighing offers (when two or more schools are admitted).** Criteria weights are five
segmented controls (0–5); each school is a row with its total as a bar and its net cost (tabular).
When weights change (debounced 150 ms), totals recompute and rows re-order with Motion `layout` on
`drift`; the bar lengths glide. The pack evidence for each criterion sits under each school, with
source marks (employment report by function, scholarships), and the applicant's own 1–5 scores
beside it. Reduced motion: rows swap instantly. Accessible equivalent: a ranked list with totals in
words ("Halvorsen first, 4.1 of 5; Marrowgate second, 3.8").

**Everything else quiet.**

- Waitlisted: the school's instructions (verified pack items, with source marks) or "Halvorsen
  doesn't publish waitlist instructions we've checked."; the DEC-01 checklist (checkbox rows);
  "What's new since you applied?" (news rows: kind, one line, date); "Draft my update" (needs a kit;
  disabled with the reason otherwise) → paper sheet with the letter, cites as "from your promotion
  news", "Copy letter". With no news: "Only send an update when something real has changed."
- Admitted: scholarship etiquette (DEC-02 as plain bullets), the competing offer form with the
  checkbox "This offer is real and I can show it", reasons (pre-filled from the kit positioning,
  editable), "Draft my note" → sheet, "Copy note".
- Denied: "Feedback call" prep: the DEC-04 questions to ask, the five-area gap sheet (what they said,
  what you think, one change you can prove), saved as you type (debounced), "Copy as text".
- Empty (no decisions yet): "When a school decides, plan your next step here. Mark a decision in your
  tracker." + "Open your tracker".

### Notifications (package E): `/notifications`, `/settings/notifications`, `/unsubscribe`

No hero. `/notifications`: a dated list (Today, This week, Earlier), each row icon + title + line +
action, unread marked by a 6 px `--signal` dot and the word "New" for screen readers; "Mark all as
read". Empty: "Nothing new. We'll tell you when a kit is ready, a deadline is close, or a session
is booked." Settings: one row per category with a three-way segmented control ("Every time", "Daily
summary", "Off"), the transactional note on Bookings ("Confirmations and changes always come."), the
digest hour select, and the time zone shown with a link to change it. `/unsubscribe`: "You won't get
deadline emails any more." + "Change what we email you".

### Entry points (foundation unless noted)

- Account menu: "Notifications" with the unread count (server-rendered); "Expert console" and "Guide
  console" when the user holds those roles. The avatar shows a small dot when unread > 0
  (`VisuallyHidden` "3 unread notifications").
- ⌘K (`AppShell actions` from the layout): "Book an expert mock", "Open your tracker", "Add a task",
  "Log a conversation", "Draft an outreach message", "Plan after decisions" (only when a school is
  admitted, waitlisted or denied).
- Admin nav: "Experts", "Payouts", "Guides".
- Home (D): next-step candidates from `trackerSummary` (a deadline within 7 days that isn't ready, a
  task due today, a debrief ready, a decision to plan), and a "Tracker" line under the schools list.
- `/interview` (A) links to expert booking; Tracker decision cells (D) link to `/decisions`; Connect
  Guides tab (C) links into the conversation sheet (B) with `?log=`.

---

## 9. Work split

Foundation first (one agent), then six packages in parallel with disjoint paths. The integration
stage runs the full gates once (`pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build
&& pnpm --filter @admitstory/web bundle:check`), removes the now-unused `connect` and `tracker`
entries from `apps/web/components/placeholder-copy.ts` (and its existing test's expectations), and
writes `docs/phase-8.md` (built, performance, deviations above, needs-Manu list). Every stage appends
exactly one line to `HANDOFF.md` under "## Log" with a shell append. **Packages must not run
`pnpm build`** (parallel builds corrupt `.next`). Nobody writes tests.

Foundation stubs: every module a package implements but someone else imports is created by the
foundation with its final signature and a **safe empty body** (returns `[]`, `null`, `0`, a minimal
valid view, or a no-op), never a throw. Each stub starts with
`// STUB (Phase 8 foundation): package <X> implements this.` The owning package replaces the body and
removes the line without changing the exported signature.

| Package | Title                                                                                               | Owns                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A       | Expert mocks: scheduling, booking, payments hand-off, console, admin, payouts                       | `apps/web/lib/scheduling/**`, `apps/web/lib/experts/**`, `apps/web/app/api/experts/**`, `apps/web/app/api/bookings/**`, `apps/web/app/api/expert/**`, `apps/web/app/api/webhooks/cal/**`, `apps/web/app/api/admin/experts/**`, `apps/web/app/api/admin/bookings/**`, `apps/web/app/api/admin/payouts/**`, `apps/web/app/(app)/interview/**`, `apps/web/app/(expert)/**`, `apps/web/app/(admin)/admin/experts/**`, `apps/web/app/(admin)/admin/payouts/**`, `packages/ui/src/experts/**`, `apps/web/inngest/functions/experts-sweep.ts` |
| B       | Connect: contacts, conversation log and insights, engagement in drafts, outreach, official channels | `apps/web/lib/connect/**`, `apps/web/app/(app)/connect/**` except `guides/**`, `apps/web/app/api/connect/**`, `apps/web/app/api/contacts/**`, `apps/web/app/api/conversations/**`, `apps/web/app/api/schools/[id]/events/**`, `packages/ui/src/connect/**`                                                                                                                                                                                                                                                                             |
| C       | Guides network                                                                                      | `apps/web/lib/guides/**`, `apps/web/app/(app)/connect/guides/**`, `apps/web/app/(guide)/**`, `apps/web/app/api/guides/**`, `apps/web/app/api/guide/**`, `apps/web/app/api/guide-requests/**`, `apps/web/app/api/admin/guides/**`, `apps/web/app/(admin)/admin/guides/**`, `packages/ui/src/guides/**`                                                                                                                                                                                                                                  |
| D       | Tracker, tasks, calendar feed, Home                                                                 | `apps/web/lib/tracker/**`, `apps/web/app/(app)/tracker/**`, `apps/web/app/api/tracker/**`, `apps/web/app/api/tasks/**`, `apps/web/app/api/calendar.ics/**`, `packages/ui/src/tracker/**`, `apps/web/app/(app)/home/**`, `apps/web/lib/home/**`                                                                                                                                                                                                                                                                                         |
| E       | Notifications: delivery, digest, reminders, emails, preferences                                     | `apps/web/lib/notify/**` except `notify.ts`, `apps/web/app/(app)/notifications/**`, `apps/web/app/(app)/settings/notifications/**`, `apps/web/app/(app)/settings/page.tsx`, `apps/web/app/unsubscribe/**`, `apps/web/app/api/notifications/**`, `apps/web/app/api/dev/notify/**`, `apps/web/inngest/functions/notify-*.ts`, `packages/emails/src/notification-*.tsx`, `packages/emails/src/digest-*.tsx`, `packages/emails/src/notification-render.ts`, `packages/ui/src/notifications/**`                                             |
| F       | After decisions                                                                                     | `apps/web/lib/decisions/**`, `apps/web/app/(app)/decisions/**`, `apps/web/app/api/decisions/**`, `packages/ui/src/decisions/**`                                                                                                                                                                                                                                                                                                                                                                                                        |

Cross-package calls go only through foundation-created signatures:

| Caller                                                                                | Callee (stub by foundation)                                                                                                                                         | Owner                 |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `lib/payments/server.ts` webhook (foundation edit)                                    | `onExpertSessionPaid(event)`, `onExpertRefund({ bookingId, purchaseId })` in `lib/experts/payments.ts`                                                              | A                     |
| kit pipeline `load()` and the reviser in `lib/workspace/server.ts` (foundation edits) | `engagementForSchool(db, userId, schoolCycleId) → DossierEngagement[]` in `lib/connect/engagement.ts`; foundation appends with `engagementLines()` (shared)         | B                     |
| B (Connect page Guides tab, summary)                                                  | `guidesSummary(db, userId)` in `lib/guides/summary.ts`; `GuidesTab` component in `packages/ui/src/guides/guides-tab.tsx`                                            | C                     |
| C (after a chat)                                                                      | B's conversation sheet opened by URL `?tab=people&log=<contactId>` (runtime link only)                                                                              | B                     |
| E (countdowns, digest)                                                                | `schoolDeadlines(db, userId) → { userSchoolId, school, deadline, submitted, openParts }[]` in `lib/tracker/deadlines.ts`                                            | D                     |
| A, C, D, F, foundation hooks                                                          | `notify(db, userId, { kind, payload, dedupeKey, at? })` in `lib/notify/notify.ts` (foundation, real) → E's `requestInstantEmail(id)` in `lib/notify/send.ts`        | E                     |
| C (verification email to a school address)                                            | `sendDirectEmail({ to, kind, payload })` in `lib/notify/direct.ts`                                                                                                  | E                     |
| E (rendering)                                                                         | `renderNotificationEmail`, `renderDigestEmail` in `packages/emails/src/notification-render.ts`                                                                      | E                     |
| D (ICS: sessions, chats)                                                              | `listCalendarBookings`, `listAcceptedGuideChats` (repos, foundation)                                                                                                | Foundation            |
| F (letters), B (outreach, insights)                                                   | `run("decisions.letter" \| "connect.outreach" \| "connect.insights", …)`                                                                                            | Foundation            |
| A (booking checkout)                                                                  | `payments()` from `lib/payments/server.ts`; `recordExpertCheckout` (repo); `FakeCheckout` imported from `app/(app)/schools/[userSchoolId]/unlock/fake-checkout.tsx` | Foundation / existing |
| inngest index (foundation)                                                            | `notify-dispatch.ts`, `notify-send.ts`, `notify-pack-updated.ts` (E), `experts-sweep.ts` (A), registered with no-op bodies                                          | E, A                  |
| `packages/ui/src/index.ts` (foundation)                                               | `export * from "./experts" \| "./connect" \| "./guides" \| "./tracker" \| "./notifications" \| "./decisions"` with stub `index.ts` files (`export {};`)             | A–F                   |

---

## 10. Post-launch test backlog (not written now)

| AC / requirement                                                                                           | Test to write after launch                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A full booking works in sandbox: pay → confirm → session link → debrief visible to the applicant** (§16) | int test with the fake scheduler and fake payments: hold, fake-checkout webhook, `confirmed` with a meeting URL, confirmation emails in the outbox for both sides, expert debrief, applicant `GET /api/bookings/:id` shows it; one e2e in Paddle + Cal.com sandbox |
| **Reminders send at the right local times** (§16)                                                          | `notify/dispatch` with fixed `now` across zones (Asia/Kolkata, America/New_York, UTC fallback): countdowns at 09:00 local on 14/7/3/1, digests at the digest hour, booking reminders 24 h and 1 h before, sent once across two concurrent runs                     |
| Cancellation and no-show policy                                                                            | `changePolicy` unit cases at 24 h ± 1 min; cancel ≥ 24 h refunds, < 24 h doesn't; reschedule cap; no-show only after +15 min                                                                                                                                       |
| Slot race and lost slot                                                                                    | two concurrent `POST /api/bookings` for one slot → one 409; paid booking whose slot vanished → `needs_time` without a second charge                                                                                                                                |
| Brief consent                                                                                              | expert sees no brief without consent; revoking hides it; brief holds no essay or transcript text                                                                                                                                                                   |
| Webhooks                                                                                                   | Cal.com signature failures → 401; replayed events idempotent; Paddle expert event mismatch → admin alert                                                                                                                                                           |
| Payouts                                                                                                    | `payoutFor` and `adminCreatePayout` counts only payable statuses; a booking in one non-void payout                                                                                                                                                                 |
| Guides                                                                                                     | verification only for a matching domain; tokens hashed and expiring; capacity and open-request caps; addresses revealed only after acceptance                                                                                                                      |
| Engagement                                                                                                 | a conversation with `use_in_essays` produces the `ENGAGEMENT` line only in that school's pipeline; `may_name=false` hides the name                                                                                                                                 |
| AI tasks                                                                                                   | replays for the five Phase 8 samples, repairs as listed in §4                                                                                                                                                                                                      |
| Tracker                                                                                                    | `deriveCells`, `readyToSubmit`, `planAutoTasks` units; ICS validates (RFC 5545 folding, escaping)                                                                                                                                                                  |
| Ownership                                                                                                  | generated per-route test: another user gets 404 on every Phase 8 applicant, expert and guide route                                                                                                                                                                 |
| Unsubscribe                                                                                                | one-click POST turns the category off; transactional emails unaffected                                                                                                                                                                                             |
| UI                                                                                                         | keyboard paths for the horizon playhead, slot ribbon, matrix; reduced-motion renders                                                                                                                                                                               |

---

## 11. What Manu must provide

- **Cal.com**: an account (a paid plan if the API needs it), `CALCOM_API_KEY`, a webhook with
  `CALCOM_WEBHOOK_SECRET` pointing at `/api/webhooks/cal`, a 45-minute event type with Google Meet or
  Zoom connected, and its event type id and username for his expert profile.
- **His expert profile**: headline, bio, schools, languages, time zone, weekly availability; confirm
  $100 / 45 min and the 24-hour policy wording in the Terms.
- **Payouts**: how other experts get paid (bank transfer, Wise) and the default 80% share.
- **Resend**: a verified sending domain (SPF, DKIM, DMARC) and `EMAIL_FROM`; Inngest Cloud for the
  15-minute cron.
- **School packs**: verify the new `connect` events/channels and `waitlist` items per launch school
  (synthetic data only in fixtures).
- **Guides**: seed Guides from his network; confirm the school email domains, and the Guide terms
  (free, 20 minutes, no admissions promises, privacy of introductions).
- **Legal**: expert and Guide terms (independent, no affiliation with any school), the privacy policy
  lines for Connect notes, expert briefs and the calendar feed.
