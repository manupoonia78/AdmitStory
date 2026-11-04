# Phase 6 plan: Recommender Kit and the recommender portal

Written 2 November 2026 (planning stage, no product code). Spec sections: §5.11, §6.7 (portal row),
§6.10 H, §10 Recommenders, §11 Recommenders, §8.3 (lor routes), §8.5.12, §8.7, §8.8 (`lorOverlap`),
§7.4 (`lor/brief`, `notify/*`), §7.6, §12.2, §12.4, §14.1–14.4, §14.6, §15 (contract test),
§16 Phase 6, Appendix A11 (`knowledge/canon/lor.md`), Appendix F, Appendix I (`LorBrief`).

Read with it: `docs/phase-5.md` (the template for layering), `docs/design/phase-3-4-direction.md`
(design rules), `docs/decisions/0002-test-email-outbox.md`.

Hooks earlier phases left for this phase (all verified in code):

| Hook                                                                                                                    | Where                                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LorBrief` type and Zod (Appendix I, no letter field)                                                                   | `packages/shared/src/kit/types.ts`, `kit/schemas.ts`                                                                                                                |
| Routes `lor.brief`, `lor.recommender_assist`                                                                            | `packages/ai/src/routing.ts` (+ `routing.test.ts` SPEC)                                                                                                             |
| `lor.brief` in the kit cost estimate                                                                                    | `packages/ai/src/cost.ts`                                                                                                                                           |
| `kit.positioning_filemap` takes `recommenders` (passed `[]` today)                                                      | `apps/web/lib/kit/pipeline.ts` positioning stage                                                                                                                    |
| Stage 9 `later: ["recommenders", "interview_plan"]`                                                                     | `apps/web/lib/kit/pipeline.ts` `formsStage`                                                                                                                         |
| Consistency docs of kind `"brief"` ("join in Phase 6")                                                                  | `apps/web/lib/forms/consistency.ts` line ~155                                                                                                                       |
| Consistency checker already handles third-person brief text                                                             | `packages/linters/src/consistency/*`                                                                                                                                |
| Files pane group `recommenders`; `lor_question` deliverables map there                                                  | `packages/ui/src/workspace/files-pane.tsx`, `lib/workspace/view.ts`                                                                                                 |
| `WhyThisDraft.recommenderCovers` prop (not wired)                                                                       | `packages/ui/src/workspace/coach/why-this-draft.tsx`                                                                                                                |
| `lorOverlap` linter (embedding similarity, injected)                                                                    | `packages/linters/src/linters/file.ts`                                                                                                                              |
| Encryption for "recommender workspaces"                                                                                 | `packages/db/src/crypto/content.ts`                                                                                                                                 |
| Portal placeholder                                                                                                      | `apps/web/app/r/[token]/README.md`                                                                                                                                  |
| Dictation client with injectable `fetchToken`                                                                           | `@admitstory/voice/client` `useDictation({ fetchToken })`                                                                                                           |
| Email with dev outbox                                                                                                   | `apps/web/lib/email.ts` (Resend or `.outbox/`)                                                                                                                      |
| Canon `lor.md` (LOR-01…LOR-10)                                                                                          | `knowledge/canon/lor.md`                                                                                                                                            |
| Pack `application.recommendations` (count, format, questions, notes) and `ai_policy.applies_to` incl. `recommendations` | `packages/kb/src/schema/school-pack.ts`; fixtures `marrowgate` (school-specific questions, prohibited), `quillfeather` (limited, K41 "Recommenders may not use AI") |

---

## 1. Decisions (Manu's, plus mine; recorded as deviations in `docs/phase-6.md`)

Manu's (2 Nov, requirements):

1. The recommender portal ships at launch (§18.8).
2. The product never writes a letter for the applicant. The portal assistant works only from the
   recommender's own notes and speech.
3. Reminder emails go only after the applicant has previewed and switched each one on. From:
   `EMAIL_FROM` (display name "{Applicant} via AdmitStories"), Reply-To: the applicant.
4. Portal links expire 14 days after the latest deadline among the recommender's schools, at most
   180 days after issue; the applicant can revoke and reissue.
5. No raw audio retention, the portal included.
6. Without `RESEND_API_KEY`, email goes to the dev outbox (`.outbox/`).

Mine (each is a deviation or a gap the spec leaves open):

7. **The invite link is never shown to the applicant.** It exists only in emails sent to the
   recommender's address. Otherwise the applicant could open the portal and read the
   recommender's notes, which breaks §5.11/§14.3. The applicant may not add their own account
   email as a recommender (422).
8. **The workspace is bound to the recommender's email.** Reissuing to the same address keeps the
   workspace; changing the address (after a confirm) revokes the link and deletes the old
   workspace, so a changed address can never reveal what the first person wrote.
9. **Check-in emails carry a fresh link** (the token rotates on each send; the previous hash is
   kept so an old link says "replaced by a newer one"). `/r` offers "Send me a fresh link" to the
   invited address only, with a constant response. Tokens stay hashed-only (§14.6).
10. **Expiry** (Manu's rule): `min(issue + 180 d, max(latest deadline + 14 d, issue + 14 d))`;
    with no known deadline, issue + 30 d (§14.6 default).
11. **Intake is a guided list of the Appendix F questions** (voice or text, one answer each, story
    question repeatable), then one `lor.extract` call. Appendix F's "Studio-style interviewer" is
    not built: the applicant is describing someone else's view of them, the fixed questions cover
    it, and it saves a model turn per answer.
12. **Two new AI tasks**: `lor.extract` (Haiku, medium, 4,000) and `lor.plan` (Sonnet, medium,
    3,000). §8.3 has no rows for them.
13. **`LorBrief` grows** (Appendix I): `question_id`, per talking point `story` and `facet`,
    `traits_to_reinforce`, `development_arc.cites`, and `key_facts` become `{text, cites}`. Still no
    field for letter prose.
14. **Deterministic parts of the brief are code**, not model output: deadlines, how to submit,
    the questions verbatim, "What admissions look for", the own-words reminder, the timeline.
15. **School groups**: every common-form school (GMAC common format, or a pack with no published
    questions) shares one brief (`group_key = "common"`); each school with its own questions gets
    its own brief (`group_key = school_cycle_id`).
16. **Common-form questions live in code** (`COMMON_LOR_QUESTIONS`, `verifiedAt: null`) because
    packs with `format: "gmac_common"` list none. Manu must verify the wording before launch.
17. **Overlap check is deterministic** (story identity + trait + content-word similarity), run on
    read like the consistency check. The embedding-based `lorOverlap` linter stays as written and
    is not wired in Phase 6 (needs Voyage live).
18. **Reminders**: `ask` (the invitation itself, scheduled 7 weeks before the earliest deadline,
    the middle of 6–8; or sent now), `checkin_3w` and `checkin_1w` before each distinct deadline.
    All start off ("suggested"). A reminder whose text changed since it was previewed (new date,
    new note) switches back to "changed" and is not sent. Sent at 09:00 in the applicant's time
    zone. Check-ins are skipped once every school with that deadline is marked submitted, or when
    no invite was ever sent.
19. **Cost**: the first brief per recommender per school group is part of the kit; rebuilding a
    brief whose inputs changed costs one refinement of the group's first paid kit (released on
    failure); an unchanged rebuild returns the existing brief. The plan rebuild is free and
    rate-limited. Intake extraction needs any active kit (like the Résumé Pass).
20. **Portal AI mode**: `coach` when any school in the group has an AI policy whose `applies_to`
    includes `recommendations` with stance `limited` or `prohibited`; else `assist`. The
    recommender can always choose coach for themselves. The portal's model calls are metered to
    the applicant's user id with no content (`contentLoggingAllowed: false`).
21. **Portal limits**: 10 assists/hour and 40 per invite; 60 minutes of dictation per invite;
    STT tokens 10/minute per invite.
22. **Navigation**: no new dock item (seven destinations is the mobile maximum). Entry points: the
    Workspace Files pane ("Recommender briefs"), the Home schools list ("Recommenders: 1 of 2
    invited"), ⌘K ("Open your recommenders"). `/workspace/<lor_question id>` redirects to
    `/recommenders`.
23. Rate limits and Idempotency-Key stay in-process (as Phases 1–5); Upstash comes in Phase 9.

---

## 2. Data model: migration `0007_recommender_kit`

New schema file `packages/db/src/schema/recommenders.ts`, exported from `schema/index.ts`.
Generated with `pnpm --filter @admitstory/db generate --name recommender_kit` (gives
`migrations/0007_recommender_kit.sql` + `meta/0007_snapshot.json`), applied with `pnpm db:migrate`.
All tables have `baseColumns()` and `user_id uuid not null → users.id on delete cascade` with an
index, like Phase 5. Status columns are `text` with a TS `$type<>()` (Phase 5 style), not pgEnums.

Plus: `sourceKinds` gains `"recommender_intake"` (`ALTER TYPE source_kind ADD VALUE`). Dossier
consolidation already lists kinds explicitly, so intake answers never feed the Dossier.

| Table                    | Columns (beyond id/created_at/updated_at/user_id)                                                                                                                                                                                                                                                                                                                                                                                                                              | Keys and indexes                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `recommenders`           | `ref text` ("rec1", stable per user, used in model I/O), `name text`, `email text` (lower-cased, trimmed), `title text null`, `organisation text null`, `relationship text $type<Relationship>`, `duration_text text null`, `frequency_text text null`, `user_school_ids uuid[] default {}`, `intake jsonb $type<StoredIntake> null`, `intake_source_ids uuid[] default {}`, `sort_order int default 0`, `archived_at timestamptz null`                                        | unique(user_id, ref); index(user_id)                                  |
| `lor_stories`            | `recommender_id uuid → recommenders cascade`, `code text` ("R01", unique per user), `fields jsonb $type<LorStoryFields>`, `origin text $type<"extracted"\|"edited"\|"manual">`, `source_ids uuid[] default {}`, `sort_order int`                                                                                                                                                                                                                                               | unique(user_id, code); index(recommender_id)                          |
| `lor_plans`              | `content jsonb $type<LorPlan>`, `input_hash text`, `version int default 1`, `dossier_snapshot_version int`                                                                                                                                                                                                                                                                                                                                                                     | unique(user_id)                                                       |
| `lor_briefs`             | `recommender_id → recommenders cascade`, `group_key text`, `school_cycle_ids uuid[]`, `status text $type<"building"\|"ready"\|"failed">`, `content jsonb $type<LorBrief> null`, `meta jsonb $type<BriefMeta> null`, `input_hash text null`, `plan_version int null`, `dossier_snapshot_version int null`, `version int default 0`, `charged_ref_id uuid null` (school cycle whose refinement was consumed), `error text null`, `built_at timestamptz null`                     | unique(recommender_id, group_key)                                     |
| `recommender_invites`    | `recommender_id → recommenders cascade`, `email_hash text`, `token_hash text`, `previous_token_hash text null`, `status text $type<"active"\|"revoked"\|"expired">`, `sent_at timestamptz`, `expires_at timestamptz`, `last_opened_at timestamptz null`, `revoked_at timestamptz null`, `send_count int default 1`                                                                                                                                                             | unique(token_hash); index(previous_token_hash); index(recommender_id) |
| `recommender_workspaces` | `recommender_id → recommenders cascade`, `invite_id uuid → recommender_invites set null`, `email_hash text`, `private_notes_encrypted text null`, `letter_draft_encrypted text null`, `voice_encrypted text null`, `opened_at timestamptz null`, `progress_at timestamptz null`, `submitted jsonb $type<Record<string,string>> default {}` (school_cycle_id → ISO time), `assist_count int default 0`, `voice_seconds int default 0`, `prefer_coach boolean default false`     | unique(recommender_id, email_hash)                                    |
| `recommender_reminders`  | `recommender_id → recommenders cascade`, `kind text $type<ReminderKind>`, `deadline date`, `school_cycle_ids uuid[]`, `send_on date`, `send_at timestamptz`, `status text $type<"suggested"\|"on"\|"sending"\|"sent"\|"skipped"\|"changed"\|"off">`, `note text null` (applicant's own line, ≤ 300), `preview_hash text null`, `previewed_at timestamptz null`, `enabled_at timestamptz null`, `sent_at timestamptz null`, `skipped_reason text null`, `delivery_id text null` | unique(recommender_id, kind, deadline); index(status, send_at)        |

`user_id` on workspaces is the applicant's id (for cascade on account deletion and for the status
select); applicant repositories never select the three `*_encrypted` columns.

Encrypted (AES-256-GCM, `encryptContent`): `private_notes_encrypted` (JSON `PortalNote[]`),
`letter_draft_encrypted` (JSON `Record<letterKey, PortalLetter>`), `voice_encrypted` (JSON
`RecommenderVoice`). Intake answers are `sources` rows (`text_encrypted`, kind
`recommender_intake`, `meta: { recommenderId, questionId }`).

### `packages/db/src/crypto/tokens.ts` (new)

```ts
export function newPortalToken(): { raw: string; hash: string }; // 32 random bytes, base64url raw; sha256 hex hash
export function hashPortalToken(raw: string): string; // sha256 hex; rejects non-base64url / wrong length → ""
export function hashEmail(email: string): string; // sha256 hex of trim().toLowerCase()
```

### Repositories

`packages/db/src/repos/recommenders.ts` — applicant side, every function `(db, userId, …)` and
scoped by owner (`assertId`), returning null/[] for rows that aren't theirs:

```ts
NewRecommender, RecommenderPatch (Zod)          createRecommender, getRecommender, listRecommenders(db, userId, { userSchoolId? }),
updateRecommender, archiveRecommender
saveIntake(db, userId, recommenderId, { intake: StoredIntake, sourceIds: string[] })
listLorStories(db, userId, { recommenderId? }) → LorStoryRow[]
replaceExtractedStories(db, userId, recommenderId, stories: LorStoryFields[], sourceIds) → LorStoryRow[]  // keeps edited/manual rows, assigns next R codes
createManualLorStory, updateLorStory (sets origin "edited"), deleteLorStory
getLorPlan, saveLorPlan(db, userId, { content, inputHash, dossierSnapshotVersion }) → bumps version
getLorBrief(db, userId, recommenderId, groupKey), listLorBriefs(db, userId, { recommenderId? })
markLorBriefBuilding(db, userId, recommenderId, { groupKey, schoolCycleIds, inputHash, chargedRefId }),
saveLorBrief(db, userId, recommenderId, groupKey, { content, meta, planVersion, dossierSnapshotVersion }) → version+1, status ready,
failLorBrief(db, userId, recommenderId, groupKey, error)
// invites, applicant side (never returns a raw token; the caller supplies the hash)
issueInvite(db, userId, recommenderId, { tokenHash, emailHash, expiresAt, now }) → InviteRow   // revokes any active invite; binds/creates the workspace for emailHash; moves workspace.invite_id
rotateInviteToken(db, userId, inviteId, { tokenHash }) → InviteRow    // previous_token_hash = old; send_count+1
revokeInvite(db, userId, recommenderId, now)
getInviteStatus(db, userId, recommenderId) → { status, sentAt, expiresAt, lastOpenedAt } | null   // marks expired lazily
deleteWorkspacesForRecommender(db, userId, recommenderId, { exceptEmailHash? })
listRecommenderStatuses(db, userId) → RecommenderStatusRow[]  // EXPLICIT select list: invite status/dates, workspace opened_at, progress_at, submitted. Never the *_encrypted columns.
// reminders
listReminders(db, userId, recommenderId), syncPlannedReminders(db, userId, recommenderId, planned: PlannedReminder[] & { sendAt: Date }[])
  // inserts missing; deletes "suggested"/"off" rows no longer planned; a planned row whose send_on/school ids changed while "on" → "changed"
setReminderNote, previewReminder(…, previewHash, now), enableReminder(…, previewHash) → "ok" | "stale", disableReminder
// system (cron), take an AdminContext from systemContext(db, job):
claimDueReminders(ctx, now, limit) → ReminderClaim[]   // UPDATE … SET status='sending' WHERE status='on' AND send_at <= now … RETURNING (single statement, so two runs never claim the same row)
finishReminder(ctx, id, { status: "sent" | "skipped" | "changed", deliveryId?, skippedReason? })
```

`packages/db/src/repos/recommender-portal.ts` — token side. The only module that reads or writes the
`*_encrypted` columns:

```ts
export type PortalAccess = { inviteId, recommenderId, userId, workspaceId, expiresAt: Date };
export type PortalResolution = { ok: true; access: PortalAccess } | { ok: false; reason: "unknown" | "expired" | "revoked" | "replaced" };
resolvePortalToken(db, rawToken, now) → PortalResolution     // hash lookup; previous_token_hash → "replaced"; expiry flips status to expired
markPortalOpened(db, access, now)                             // sets workspace.opened_at once, invite.last_opened_at every time
readPortalWorkspace(db, access) → { notes: PortalNote[]; letters: Record<string, PortalLetter>; voice: RecommenderVoice | null; submitted: Record<string,string>; assistCount; voiceSeconds; preferCoach }
writePortalNotes(db, access, notes, now)                      // encrypts, sets progress_at
writePortalLetter(db, access, key, letter, now)
writePortalVoice(db, access, voice)
setPortalSubmitted(db, access, schoolCycleId, submitted: boolean, now)
setPortalPreferCoach(db, access, value)
claimPortalAssist(db, access, max) → { ok: boolean; count }   // atomic increment with cap
addPortalVoiceSeconds(db, access, seconds, max) → { ok, total }
wipePortalWorkspace(db, access)                               // nulls the encrypted columns, clears progress_at and submitted
findInviteForResend(db, emailHash, now) → { inviteId, userId, recommenderId } | null   // active and unexpired only
rotatePortalToken(db, inviteId, tokenHash)                    // system side of a resend
portalOwner(db, access) → { userId, recommenderId, recommenderName, recommenderEmail }
```

Both are exported from `repos/index.ts` and `src/index.ts` (portal functions under their own names).

---

## 3. Shared types and pure helpers (`@admitstory/shared/kit`, Zod-free)

New file `packages/shared/src/kit/recommenders.ts` (types, constants, pure helpers) and
`packages/shared/src/kit/recommender-views.ts` (JSON view shapes the routes return and the UIs
render). Both re-exported from `kit/index.ts`. `codes.ts` gains the kind `lor_story` with prefix
`R`, 2 digits ("R01").

```ts
// relationships (§5.11 list)
export const RELATIONSHIPS = [
  "manager",
  "former_manager",
  "client",
  "cross_functional_partner",
  "extracurricular_leader",
  "other",
] as const;
export const RELATIONSHIP_LABELS: Record<Relationship, string>; // "Manager", "Former manager", "Client", "Cross-functional partner", "Extracurricular leader", "Someone else"

// Appendix F intake, in order; prompt takes the recommender's first name
export const INTAKE_QUESTIONS: readonly {
  id: IntakeQuestionId;
  prompt: (first: string) => string;
  hint: string;
  repeatable: boolean;
}[];
export type IntakeQuestionId =
  | "how_you_know"
  | "strengths"
  | "stories"
  | "feedback"
  | "said_to_others"
  | "background"
  | "logistics";
export const LOR_STORIES_MIN = 5,
  LOR_STORIES_MAX = 7,
  LOR_STRENGTHS_MIN = 2,
  LOR_STRENGTHS_MAX = 4;

export interface LorStoryFields {
  title: string;
  what_happened: string;
  what_they_saw: string;
  your_actions: string[];
  result: string;
  numbers: string[];
  what_they_said: string | null;
  traits: TraitId[];
  cites: Cite[];
}
export interface LorGrowthArc {
  feedback: string;
  response: string;
  steps: string[];
  evidence: string;
  cites: Cite[];
}
export interface LorIntake {
  // lor.extract output
  relationship: { summary: string; chose_you_for: string | null; cites: Cite[] };
  strengths: { trait: TraitId; moment: string; story_ref: string | null }[];
  stories: (LorStoryFields & { ref: string })[]; // "s1", "s2"…
  growth: LorGrowthArc | null;
  said_to_others: string[];
  background: { knows_mba: "yes" | "no" | "unknown"; note: string | null };
  logistics: { prefers: string | null; remind_when: string | null };
  missing: { question_id: IntakeQuestionId; ask: string }[];
}
export type StoredIntake = Omit<LorIntake, "stories" | "strengths"> & {
  strengths: { trait: TraitId; moment: string; story: string | null /* R code */ }[];
};

export interface LorFacet {
  story: Cite;
  facet: string;
  evidence: string;
}
export interface LorAssignment {
  recommender: string /* ref */;
  strengths: TraitId[];
  stories: Cite[];
  facets: LorFacet[];
  avoid: { story: Cite; facet: string; because: "essay" | "other_recommender"; where: string }[];
}
export interface LorPlan {
  assignments: LorAssignment[];
  red_flags: { flag: string; recommender: string; how: string }[];
  warnings: string[];
}

// brief: deterministic meta (code), rendered with the model's LorBrief
export const COMMON_GROUP_KEY = "common";
export const COMMON_LOR_QUESTIONS: readonly { id: string; text: string }[]; // GMAC common form wording, to verify
export const COMMON_LOR_SOURCE: { label: string; url: string; verifiedAt: string | null };
export const LOR_ADMISSIONS_EXPLAINER: readonly string[]; // 5 plain bullets (LOR-09)
export const OWN_WORDS_REMINDER: string; // Appendix F wording
export interface BriefQuestion {
  id: string;
  text: string;
  limit: string | null;
  source: "pack" | "common_form";
}
export interface BriefSchoolMeta {
  schoolCycleId: string;
  school: string;
  round: string | null;
  deadline: string | null;
  format: "gmac_common" | "school_specific" | "unknown";
  howToSubmit: string;
  packNotes: string[];
  questions: BriefQuestion[];
}
export interface BriefMeta {
  applicant: { name: string; firstName: string };
  recommender: {
    name: string;
    firstName: string;
    title: string | null;
    organisation: string | null;
  };
  groupKey: string;
  schools: BriefSchoolMeta[];
  askBy: string | null;
  checkIns: string[];
  builtAt: string;
}
export type BriefSection =
  | { kind: "note"; heading: string; text: string }
  | { kind: "reminder"; heading: string; text: string }
  | { kind: "explainer"; heading: string; bullets: readonly string[] }
  | {
      kind: "school";
      heading: string;
      deadline: string | null;
      howToSubmit: string;
      packNotes: string[];
      questions: {
        id: string;
        text: string;
        limit: string | null;
        points: {
          point: string;
          evidence: string;
          trait: string /* label */;
          story: Cite | null;
          cites: Cite[];
        }[];
      }[];
    }
  | { kind: "traits"; heading: string; items: { trait: string; why: string; cites: Cite[] }[] }
  | { kind: "covers"; heading: string; items: string[] }
  | { kind: "arc"; heading: string; steps: { label: string; text: string }[] }
  | { kind: "facts"; heading: string; items: { text: string; cites: Cite[] }[] }
  | { kind: "timeline"; heading: string; items: { date: string; text: string }[] };
/** One source of brief structure and copy for screen H, the portal, the PDF and the email text.
 *  audience "recommender" drops every cite and the stale/export affordances' data. */
export function briefSections(
  brief: LorBrief,
  meta: BriefMeta,
  audience: "applicant" | "recommender",
): BriefSection[];

export interface GroupableSchool {
  schoolCycleId: string;
  format: "gmac_common" | "school_specific" | "unknown";
  questions: number;
}
export function schoolGroups(
  schools: readonly GroupableSchool[],
): { key: string; schoolCycleIds: string[] }[];

// schedule
export const REMINDER_KINDS = ["ask", "checkin_3w", "checkin_1w"] as const;
export const REMINDER_LABELS: Record<ReminderKind, string>; // "Invitation", "Three-week check-in", "One-week check-in"
export const ASK_WEEKS_BEFORE = 7,
  CHECKIN_DAYS_BEFORE = { checkin_3w: 21, checkin_1w: 7 } as const;
export interface PlannedReminder {
  kind: ReminderKind;
  deadline: string;
  sendOn: string;
  schoolCycleIds: string[];
}
export function planReminders(input: {
  today: string;
  deadlines: readonly { schoolCycleId: string; date: string }[];
}): PlannedReminder[];
export function sendAtFor(sendOn: string, timeZone: string | null): Date; // 09:00 local, UTC fallback
export const INVITE_GRACE_DAYS = 14,
  INVITE_MAX_DAYS = 180,
  INVITE_DEFAULT_DAYS = 30;
export function inviteExpiry(issuedAt: Date, deadlines: readonly string[]): Date;

// status (what the applicant may see)
export const RECOMMENDER_STATUSES = [
  "not_invited",
  "invited",
  "opened",
  "in_progress",
  "submitted",
] as const;
export const RECOMMENDER_STATUS_LABELS: Record<RecommenderStatus, string>; // "Not invited yet", "Invited", "Opened", "In progress", "Marked submitted"
export function recommenderStatusOf(s: {
  invite: { status: string; sentAt: string } | null;
  openedAt: string | null;
  progressAt: string | null;
  submitted: Record<string, string>;
  schoolCycleIds: readonly string[];
}): RecommenderStatus;

// portal
export const PORTAL_MODES = ["assist", "coach"] as const;
export function recommenderModeFor(
  policies: readonly { stance: string; applies_to: readonly string[] }[],
): PortalMode;
export const PORTAL_LIMITS = {
  assistsPerHour: 10,
  assistsTotal: 40,
  sttPerMinute: 10,
  voiceSeconds: 3600,
  notesMax: 200,
  noteChars: 8000,
  letterChars: 12000,
} as const;
export interface PortalNote {
  id: string /* "n1"… */;
  text: string;
  at: string;
  spoken: { seconds: number; language: string } | null;
}
export interface AssistSentence {
  text: string;
  kind: "verbatim" | "adapted";
  notes: string[]; /* N# */
}
export interface RecommenderAssist {
  answer: { paragraphs: { sentences: AssistSentence[] }[] } | null;
  outline: { beat: string; your_notes: string[]; questions: string[] }[];
  missing: string[];
}
export interface PortalLetter {
  text: string;
  assisted: RecommenderAssist | null;
  mode: PortalMode | null;
  updatedAt: string;
}
export interface RecommenderVoice {
  sentences: number;
  meanWords: number;
  cv: number;
  contractions: number;
  firstPerson: number;
  register: "plain" | "formal";
  opener: "time" | "person" | "other";
  card: string;
}
export const letterKey = (groupKey: string, questionId: string) => `${groupKey}/${questionId}`;
```

`LorBrief` (types.ts + schemas.ts) after decision 13:

```ts
export interface LorBrief {
  cover_note: string;
  schools: {
    school_cycle_id: string;
    questions: {
      question_id: string;
      question_verbatim: string;
      talking_points: {
        point: string;
        evidence: string;
        trait: TraitId;
        story: Cite | null;
        facet: string;
        cites: Cite[];
      }[];
    }[];
  }[];
  traits_to_reinforce: { trait: TraitId; why: string; cites: Cite[] }[];
  other_recommender_covers: string[];
  development_arc: LorGrowthArc | null;
  key_facts: { text: string; cites: Cite[] }[];
}
```

View shapes (`recommender-views.ts`), shared by routes and UIs:

```ts
RecommendersPageView { state: "locked" | "ready"; recommenders: RecommenderListItem[]; schools: { userSchoolId; name; needed: number | null; paid: boolean }[]; suggestions: { name: string; role: string }[] }
RecommenderListItem { id; name; relationship: Relationship; title; organisation; schools: { userSchoolId; name }[]; stories: number; status: RecommenderStatus; statusLine: string }
RecommenderDetailView { recommender: { id; ref; name; email; title; organisation; relationship; durationText; frequencyText; userSchoolIds }; intake: { answers: { id; questionId: IntakeQuestionId; text; spoken: boolean; at }[]; extracted: StoredIntake | null; canExtract: boolean; lockedReason: string | null }; stories: (LorStoryFields & { id; code; origin })[]; briefs: BriefSummary[]; coverage: CoverageView }
BriefSummary { groupKey; schools: string[]; status: "none" | "building" | "ready" | "failed"; stale: boolean; builtAt: string | null; costsRefinement: boolean }
BriefView { groupKey; status; stale; builtAt; brief: LorBrief | null; meta: BriefMeta | null; sources: Record<Cite, { label: string }>; overlap: LorOverlapFindingView[] }
CoverageView { planVersion: number | null; planStale: boolean; lanes: { recommenderId; name; relationship; strengths: TraitId[]; facets: { story: Cite; storyTitle: string; facet: string; evidence: string }[] }[]; essays: { deliverableId; label; school; primaryStory: Cite | null; storyTitle: string | null; traits: TraitId[] }[]; findings: LorOverlapFindingView[] }
LorOverlapFindingView { id; kind: "brief_brief" | "brief_essay"; story: Cite; storyTitle: string; facet: string; places: { label: string; href: string }[]; explanation: string; dismissed: boolean }
EmailPreview { to: string; replyTo: string; subject: string; text: string; previewHash: string }
InviteView { status: "none" | "active" | "revoked" | "expired"; sentAt; expiresAt; lastOpenedAt; preview: EmailPreview | null; canSend: boolean; blockedReason: string | null; scheduled: { sendOn: string } | null }
ReminderView { id; kind: ReminderKind; sendOn; deadline; schools: string[]; state: "suggested" | "on" | "sent" | "skipped" | "changed" | "off"; preview: EmailPreview; note: string | null; previewed: boolean; sentAt: string | null; skippedReason: string | null }
StatusView { status: RecommenderStatus; timeline: { step: RecommenderStatus; at: string | null }[]; submitted: { schoolCycleId; school; at: string | null }[]; invite: InviteView; reminders: ReminderView[] }
RecommenderSummary { schools: { userSchoolId; needed: number | null; named; invited; opened; started; submitted; label: string }[]; next: { text: string; href: string; due: string | null } | null; recommenders: { id; name; status: RecommenderStatus; askBy: string | null }[] }
PortalView { applicant: { name; firstName }; recommender: { name; firstName }; expiresAt; groups: { key; schools: { schoolCycleId; name; deadline: string | null; submittedAt: string | null }[]; mode: PortalMode; policyNote: string | null; sections: BriefSection[]; questions: { id; text; limit: { kind: "words" | "chars_incl_spaces" | "chars_excl_spaces"; value: number } | null }[] }[]; notes: PortalNote[]; letters: Record<string, PortalLetter>; voiceSecondsLeft: number; assistsLeft: number; preferCoach: boolean }
PortalClosedView { reason: "unknown" | "expired" | "revoked" | "replaced"; applicantFirstName: string | null }
```

### Linters (types by foundation, implementation by package E)

`packages/linters/src/lor/` exported from the linters index:

```ts
export interface LorFacetPoint {
  recommenderId: string;
  recommenderLabel: string;
  groupKey: string;
  questionId: string;
  index: number;
  story: string | null;
  trait: string;
  facet: string;
  text: string; /* point + evidence */
}
export interface LorEssayFacet {
  deliverableId: string;
  label: string;
  primaryStory: string | null;
  traits: string[];
  paragraphs: { id: string; text: string; stories: string[] }[];
}
export interface LorOverlapInput {
  points: readonly LorFacetPoint[];
  essays: readonly LorEssayFacet[];
  dismissed?: ReadonlySet<string>;
}
export interface LorOverlapFinding {
  id: string /* "lor:<fnv1a>" */;
  kind: "brief_brief" | "brief_essay";
  severity: "should";
  story: string;
  facet: string;
  a: LorFacetPoint;
  b: LorFacetPoint | { deliverableId: string; label: string; paragraphId: string | null };
  explanation: string;
  fix_hint: string;
}
export const LOR_FACET_SIMILARITY = 0.5; // between two talking points on the same story
export const LOR_ESSAY_SIMILARITY = 0.35; // between a talking point and an essay paragraph on the same story
export function facetSimilarity(a: string, b: string): number; // content-word overlap, [0,1]
export function checkLorOverlap(input: LorOverlapInput): LorOverlapFinding[];
export function recommenderVoice(texts: readonly string[]): RecommenderVoice;
```

---

## 4. AI tasks (`packages/ai`)

All four have a v1 prompt in `packages/ai/src/prompts/<agent>/v1.md` (front matter `agent`,
`version: 1`, `canon: [...]`, `output`, `notes`; prettier-ignored), a Zod schema in
`src/schemas/lor.ts` (exported from `schemas/index.ts`), a task in `src/tasks/lor.ts` registered
in `tasks/index.ts`, routes in `routing.ts` (two new; `routing.test.ts` SPEC rows "Added in Phase
6"), and `check()` rules that get the one repair. Untrusted text (intake answers, recommender
notes) goes in `untrustedBlock(...)`.

| Task                     | Route                           | Layers  | Canon                                                         |
| ------------------------ | ------------------------------- | ------- | ------------------------------------------------------------- |
| `lor.extract` (new)      | haiku, medium, 4,000, adaptive  | dossier | `lor`, `truth-discipline`, `admissions-lens`                  |
| `lor.plan` (new)         | sonnet, medium, 3,000, adaptive | dossier | `lor`, `file-strategy`, `admissions-lens`                     |
| `lor.brief`              | sonnet, medium, 5,000 (exists)  | dossier | `lor`, `truth-discipline`, `admissions-lens`, `anti-ai-tells` |
| `lor.recommender_assist` | sonnet, medium, 3,000 (exists)  | none    | `lor`, `anti-ai-tells`                                        |

### `lor.extract`

Input: `{ recommender: { ref, name, relationship, title, organisation }, answers: { question_id, text }[] (1–40, ≤ 6,000 chars each), confirmed: { code, title }[] /* edited/manual stories not to repeat */ }`.
Output: `LorIntake`. Checks: ≤ 7 stories, ≤ 4 strengths; each story has non-empty `your_actions`
and `result`; every number in a story (`result`, `numbers`, `what_happened`) is in the answers or
the dossier (`newNumbers` from `tasks/forms.ts`); no new proper names (`newNames`);
`what_they_said` appears (normalised) in the answers, else must be null; every cite resolves to a
dossier F/S/L code; `strengths[].story_ref` names an output story; growth arc complete or null;
`missing[].question_id` valid.

### `lor.plan`

Input: `{ recommenders: { ref, relationship, title, duration, frequency, strengths: TraitId[], stories: { code, title, traits, cites }[] }[] (1–4), essays: { school, key, title, primary_story, traits_shown }[], kit_plans: RecommenderPlan[] (hints from file maps), red_flags: { flag, how }[] (address_in "recommender") }`.
Output: `LorPlan`. Checks: one assignment per input recommender; 2–3 strengths each, **no strength
in two assignments** (LOR-03); every story cited is an S code in the dossier or an R code of
**that** recommender; a story in two assignments must have different facets (normalised text
differs) and different evidence; `avoid[].story` resolves; no facet equal to an essay's primary
story with the same trait (`because: "essay"` must be listed instead).

### `lor.brief`

Input: `{ recommender: { ref, name, relationship, title, organisation, duration, frequency, knows_mba }, applicant_first_name, schools: { school_cycle_id, school, questions: { id, text_verbatim }[] }[], assignment: LorAssignment, others: { ref, relationship, strengths, facets: string[] }[], stories: (LorStoryFields & { code })[], relationship_note: StoredIntake["relationship"] | null, growth: LorGrowthArc | null, red_flags: { flag, how }[], is_reapplicant: boolean }`.
Output: `LorBrief`. **Checks (the "briefs cite only dossier facts" rule, exported as
`briefCiteIssues(brief, { dossier, storyCodes, questions })` for the app to re-run on stored
briefs):**

1. every talking point, trait, arc and key fact has ≥ 1 cite;
2. every cite is a dossier F/S/L code present in the L2 snapshot or an R code of this
   recommender's stories; K, C and P codes are rejected ("A brief cites the applicant's own facts
   only");
3. every number in `point`, `evidence`, arc and key facts appears in the text of the material it
   cites (dossier lines for those codes, or the cited R story's fields);
4. `question_verbatim` equals the input question for `question_id` (normalised), every input
   question appears once with 2–5 talking points, every school appears once;
5. letter prose is refused: a talking point ≤ 35 words and ≤ 2 sentences; regex for letter
   openers and recommender first person (`/\bI (have|had)? ?(known|worked with|managed|supervised)\b/i`,
   `/\b(highly|strongly|wholeheartedly) recommend\b/i`, `/\bwithout reservation\b/i`,
   `/\bto whom it may concern\b/i`, `/^dear\b/im`) in any field except `cover_note`; `cover_note`
   ≤ 180 words and must not offer "a draft", "sample letter" or "template";
6. a talking point's `story` must be in this recommender's assignment (not the other's);
7. `development_arc` never about integrity, honesty, ethics, arrogance or personality (LOR-06).

### `lor.recommender_assist`

Input: `{ mode: "assist" | "coach", question: { text_verbatim, limit: LimitRule | null }, notes: { id /* N1… */, text }[] (1–60), voice_card: string, brief_points: string[] (context only), applicant_first_name, relationship }`.
Output: `RecommenderAssist`. Checks: coach ⇒ `answer` null; assist ⇒ `answer` non-null; every
sentence cites ≥ 1 existing note id; `verbatim` sentences appear (normalised) in a cited note;
`adapted` sentences have ≥ 60% of their content words in the cited notes; no number or proper
name absent from the notes (`newNumbers`, `newNames` against the notes); no 6-gram shared with
`brief_points` unless it is also in the notes (the brief's words are not theirs); within the
question's limit by its counting rule; outline `your_notes` exist. Exported
`assistProvenanceIssues(assist, notes, briefPoints)` for the portal to re-check stored output.

### Replays (`record:phase6 --synthetic`)

`packages/ai/scripts/samples/phase6.ts` (inputs) + `phase6-replies.ts` (hand-authored replies) +
`scripts/record-phase6.ts` (copy of record-phase5) + `"record:phase6"` in package.json. Fictional
cast: the `engineer-to-product` applicant (`ENGINEER_DOSSIER`), recommender `rec1` **Ravi Menon**
(engineering manager, Meridian Health Systems, P1 in the dossier) and `rec2` **Dr. Kavita Rao**
(director of clinical informatics at the 900-bed hospital client; fictional). Samples, each first
reply deliberately repaired where noted:

| Sample                                                             | First reply breaks                                       |
| ------------------------------------------------------------------ | -------------------------------------------------------- |
| `lor.extract` rec1 (7 answers)                                     | invents "40%" → repaired                                 |
| `lor.extract` rec2                                                 | clean                                                    |
| `lor.plan` rec1 + rec2 vs Halvorsen essays                         | same strength in both → repaired                         |
| `lor.brief` rec1, common group (Halvorsen, `COMMON_LOR_QUESTIONS`) | cites K18 and a number not in the cited story → repaired |
| `lor.brief` rec2, Marrowgate (school-specific questions)           | clean                                                    |
| `lor.recommender_assist` assist (rec1 notes, common q2)            | a sentence not in any note → repaired                    |
| `lor.recommender_assist` coach (Marrowgate, prohibited)            | clean                                                    |

`scripts/check-tasks.ts` gets the four sample inputs. `cost.ts`: add `"lor.plan": 0.02` to
`KIT_GENERATION_ESTIMATE_USD` (stage 9 may run it); `lor.extract` and `lor.recommender_assist` are
after-generation costs.

---

## 5. Deterministic code (who builds it)

| Code                                                                                                                                | Package    |
| ----------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `briefSections`, `schoolGroups`, `planReminders`, `sendAtFor`, `inviteExpiry`, `recommenderStatusOf`, `recommenderModeFor` (shared) | Foundation |
| Token and email hashing (`crypto/tokens.ts`)                                                                                        | Foundation |
| `briefCiteIssues`, `assistProvenanceIssues` (ai)                                                                                    | Foundation |
| `recommenderSchools`, `applicantIdentity` (`apps/web/lib/recommenders/schools.ts`)                                                  | Foundation |
| `checkLorOverlap`, `facetSimilarity`, `recommenderVoice` (linters)                                                                  | E          |
| Brief consistency docs (`kind: "brief"`), coverage/overlap inputs, input hashes, summary                                            | A          |
| Reminder sync, preview rendering + hash, due-send loop, invite issue/rotate/revoke                                                  | D          |
| PDF and email-ready text of a brief                                                                                                 | D          |
| Portal letter counting (reuses `@admitstory/linters` `count`)                                                                       | B          |

---

## 6. Routes

All under `apps/web/app/api`. Applicant routes: `requireUser()`, Zod (`readJson`, strict
objects), ownership through repos (404 for others), `checkRateLimit`, `Idempotency-Key` through the
new `apps/web/lib/idempotency.ts` on creating/costly POSTs, `handle()`. Portal routes: no session;
the token from the path is resolved with `resolvePortalToken`; unknown/expired/revoked/replaced →
404/410 with `PortalClosedView`; rate limits keyed by invite id; `Cache-Control: no-store`.

| Method + path                                       | Input                                                                                                                                | Output                                                                      | Owner |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | ----- |
| `GET /api/recommenders`                             | —                                                                                                                                    | `RecommendersPageView`                                                      | A     |
| `POST /api/recommenders` (idem)                     | `{ name, email, title?, organisation?, relationship, durationText?, frequencyText?, userSchoolIds[] }`                               | 201 `RecommenderDetailView` (422 own email)                                 | A     |
| `GET /api/recommenders/summary`                     | —                                                                                                                                    | `RecommenderSummary`                                                        | A     |
| `POST /api/recommenders/plan`                       | `{}`                                                                                                                                 | `CoverageView` (free; 6/hour)                                               | A     |
| `GET /api/recommenders/:id`                         | —                                                                                                                                    | `RecommenderDetailView`                                                     | A     |
| `PATCH /api/recommenders/:id`                       | partial fields; `confirmEmailChange?: true` (409 without it when an invite exists)                                                   | `RecommenderDetailView`                                                     | A     |
| `DELETE /api/recommenders/:id`                      | —                                                                                                                                    | `{ deleted: true }` (archives, revokes, wipes workspace, removes reminders) | A     |
| `POST /api/recommenders/:id/stories` (idem; §11)    | `{ kind: "intake", answers: { questionId, text, spoken?: { seconds, language } }[] }` or `{ kind: "manual", story: LorStoryFields }` | `RecommenderDetailView` (402 without any active kit; 10/hour)               | A     |
| `PATCH /api/recommenders/:id/stories/:storyId`      | partial `LorStoryFields`                                                                                                             | story                                                                       | A     |
| `DELETE /api/recommenders/:id/stories/:storyId`     | —                                                                                                                                    | `{ deleted: true }`                                                         | A     |
| `POST /api/recommenders/:id/brief` (idem; §11)      | `{ groupKey?: string }`                                                                                                              | 202 `BriefSummary[]` (402 no paid school / refinements used)                | A     |
| `GET /api/recommenders/:id/brief?group=`            | —                                                                                                                                    | `BriefView`                                                                 | A     |
| `POST /api/recommenders/:id/brief/export`           | `{ group, format: "pdf" \| "text" }`                                                                                                 | `application/pdf` or `{ text }`                                             | D     |
| `GET /api/recommenders/:id/invite`                  | —                                                                                                                                    | `InviteView`                                                                | D     |
| `POST /api/recommenders/:id/invite` (idem; §11)     | `{ action: "send", previewHash }` · `{ action: "schedule", previewHash }` · `{ action: "reissue" }` · `{ action: "revoke" }`         | `InviteView` (never the link; 409 stale preview; 422 no ready brief)        | D     |
| `GET /api/recommenders/:id/reminders`               | —                                                                                                                                    | `ReminderView[]` (syncs planned rows first)                                 | D     |
| `PATCH /api/recommenders/:id/reminders/:reminderId` | `{ previewed?: string /* hash */, on?: boolean, previewHash?: string, note?: string \| null }`                                       | `ReminderView` (409 when hash ≠ current)                                    | D     |
| `POST /api/dev/reminders`                           | — (localhost only, like `dev/fake-checkout`)                                                                                         | `{ sent, skipped }`                                                         | D     |
| `GET /api/r/:token` (§11)                           | —                                                                                                                                    | `PortalView` or `PortalClosedView`                                          | B     |
| `POST /api/r/:token/notes` (§11)                    | `{ op: "add", text, spoken? }` · `{ op: "update", id, text }` · `{ op: "delete", id }`                                               | `{ notes: PortalNote[] }`                                                   | B     |
| `PUT /api/r/:token/letter`                          | `{ groupKey, questionId, text }`                                                                                                     | `PortalLetter`                                                              | B     |
| `POST /api/r/:token/assist` (§11)                   | `{ groupKey, questionId, mode?: "coach" }`                                                                                           | `PortalLetter` (422 no notes; 429 limits)                                   | B     |
| `POST /api/r/:token/stt`                            | —                                                                                                                                    | `SttTokenResponse` or refusal                                               | B     |
| `POST /api/r/:token/voice`                          | `{ seconds, language }` after a dictated note (meters usage, caps)                                                                   | `{ voiceSecondsLeft }`                                                      | B     |
| `POST /api/r/:token/submitted`                      | `{ schoolCycleId, submitted: boolean }`                                                                                              | `{ submitted }`                                                             | B     |
| `POST /api/r/:token/preferences`                    | `{ preferCoach: boolean }`                                                                                                           | `{ preferCoach }`                                                           | B     |
| `DELETE /api/r/:token`                              | —                                                                                                                                    | `{ wiped: true }`                                                           | B     |
| `POST /api/r/resend`                                | `{ email }` (5/hour per IP+email hash)                                                                                               | 202 constant body always                                                    | B     |

Pages: `app/(app)/recommenders/page.tsx`, `app/(app)/recommenders/[recommenderId]/page.tsx`
(`?tab=stories|brief|coverage|status&group=`) (C); `app/r/[token]/page.tsx`, `app/r/page.tsx`
(B).

---

## 7. Background jobs and emails

| Function                                                  | Trigger                                                                                                                                     | Does                                                                                                                                                                                    | Owner |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `lor/brief` (`lorBriefFn`)                                | event `lor/brief.requested { userId, recommenderId, groupKeys[], reason: "applicant" \| "kit_stage" }`; concurrency key `event.data.userId` | `ensurePlan` (if its input hash changed) then `lor.brief` per group; saves; on failure marks failed and releases the refinement                                                         | A     |
| `notify/recommender-reminders` (`recommenderRemindersFn`) | cron `TZ=UTC 5 * * * *` + event `recommender/reminders.run`                                                                                 | `claimDueReminders`; for each: re-render, compare `preview_hash` (≠ → "changed"), skip rules, send (ask = mint token + `issueInvite`; check-in = `rotateInviteToken`), `finishReminder` | D     |

Without Inngest (local), `dispatch()` runs `lor/brief` inline after the response, and
`POST /api/dev/reminders` runs the reminder loop.

Email templates (`packages/emails`, React Email, inline Day palette like the magic-link email),
each with `render…(input) → { subject, html, text }`:

| Template                  | Subject (example)                                             | Notes                                                                                                    |
| ------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `RecommenderInviteEmail`  | "Asha Varma asked you for a recommendation"                   | cover note, schools and deadlines, the link, expiry date, privacy line, "Reply to reach Asha directly"   |
| `RecommenderCheckinEmail` | "Three weeks until Halvorsen's deadline" / "One week until …" | applicant's optional note, fresh link, "Already submitted? Mark it on your page and the reminders stop." |
| `RecommenderLinkEmail`    | "Your link to Asha's recommendation brief"                    | resend from `/r`                                                                                         |

`apps/web/lib/email.ts` gains optional `replyTo` and `fromName` on `OutgoingEmail` (Resend
`replyTo`, outbox JSON records both). The preview hash is `sha256(subject + "\n" + text)` with the
link replaced by `[your private link]`, so it is stable before a token exists.

---

## 8. UI

### Screen H, `/recommenders` (package C)

Layout (§6.10 H): the recommender list on the left (248 px plane, like the Files pane), the work
plane on the right with tabs **Stories · Brief · Coverage · Status and reminders**. Below 1024 px
the list becomes a select at the top. The page server-renders the view and the client screen loads
behind `recommenders-host.tsx` (`next/dynamic`), Phase 5 pattern.

**Hero: two vantage points (Coverage tab).** Each recommender is a lane (name, relationship,
duration in Geist; strengths as trait words). The essays are one band underneath. When the plan
lands, or the first time a viewer sees a new plan version (remembered per viewer in
`localStorage`, wrapped in try/catch), the facets start as one loose stack in the seam between the
lanes and deal out to their recommender, 40 ms apart, on `drift`, measured from the final layout
(Motion `layout`) so nothing shifts. Then each shared facet draws a hairline across the seam
(`glide`, `--needs`, with the warning icon and the words "Shared facet"); a facet that repeats an
essay gets the tag "Same as Essay 1". Story titles carry a 6 px `--voice` dot (the applicant's own
material); everything else is chrome colours. Plays once per plan version; interruptible.
Reduced motion: rows present from the first frame, 120 ms fade, hairlines immediate. Accessible
equivalent: each lane is a list under its heading, and the findings are a plain list under the
board ("Ravi and Kavita both cover how you persuaded the vendor. Give one of them another side of
it." with "Rebuild the plan" and "These are different"). Mobile: lanes stack, hairlines become
tags. 3+ recommenders: lanes scroll sideways in a focusable region.

**Everything else quiet.**

- **Stories tab**: a count line "5 of 5–7 stories" with five quiet ticks; story cards as rows
  (title, what they saw, your actions, result with numbers in tabular figures, what they said in
  Newsreader italics, traits as words), editable in place, delete with undo toast. "Tell Ravi's
  stories" opens the intake as a sheet: the seven Appendix F questions, one at a time, each with
  the record button (dictation via `useDictation` with the applicant's `/api/stt/token`, loaded
  only on first press) or a text box, "Skip for now", then "Pull out the stories". Missing items
  from extraction appear as `--needs` chips with an icon ("What did Ravi see you do himself?").
- **Brief tab**: one paper sheet (`--depth`, 720 px text column) rendered from `briefSections`:
  cover note in Newsreader 19/32; the own-words reminder; "What admissions look for" (5 bullets);
  per school: deadline (date + days left, tabular), how to submit, the questions verbatim in
  Newsreader, talking points as bullets (point in Geist 15, evidence in `--text-soft` with numbers
  tabular, trait as a word, source as "from The night-shift fix"); traits to reinforce; what the
  other recommender covers; the growth arc as four labelled steps; key facts; timeline. Group
  switcher (tabs) when there is more than one group. Toolbar: "Download PDF", "Copy email text"
  (toast "Email text copied"), "Build Ravi's brief again". Building state: the sheet with every
  heading in place and faint ruled lines where talking points will land (no shimmer), "Building
  Ravi's brief from 6 stories. About a minute." (`aria-live="polite"`). Failed: "Ravi's brief
  didn't finish. Your stories are saved. Build it again?" Stale: "Your stories changed since this
  brief was built on 12 Oct. Build it again? It uses one refinement." (or "It's free.").
- **Status and reminders tab**: the status as a stepped list with words and icons (Not invited
  yet → Invited 12 Oct → Opened 13 Oct → In progress → Marked submitted: Halvorsen 3 Jan); the
  privacy line, verbatim: "Ravi's notes and letter stay private to Ravi. You'll only see whether
  the brief was opened, whether Ravi has started, and when they mark it submitted."; the invitation
  as a paper preview (to, reply-to, subject, text) with "Send to ravi@…" or "Send on 18 Nov";
  after sending, "Send a fresh link" and "Turn off the link" (dialog naming the action).
  Reminders as rows: date (tabular), kind, state word with icon; "Read it" expands the preview and
  records the read; "Turn on" stays disabled until it has been read; a personal-note field (≤ 300)
  that, when changed, asks for a new read.
- **Add / edit recommender**: a sheet; fields name, email, title, organisation, relationship
  (select), how long, how often, schools (checkbox chips from the applicant's schools, with "needs
  2" from the pack). Suggestions from the Dossier ("Ravi Menon, engineering manager") as one-tap
  fills.
- **Empty**: "No recommenders yet. Add the two people who know your work best, and each gets a
  brief of their own." + "Add a recommender". **Locked** (no kit): "Recommender briefs come with
  a School Kit. Unlock a school and you can brief your recommenders." + "See your schools".
- Keyboard: J/K move between recommenders outside text fields; 1–4 switch tabs; every control
  44 px; visible `--signal` focus ring.

### Recommender portal, `/r/[token]` (package B)

No hero motion, maximum clarity (§6.7). Outside the app shell; no dock, no PostHog, no Voiceprint
(`--voice` belongs to the applicant). Follows the system theme, Day when unknown. One 680 px
column, phone-first, Newsreader for anything the applicant or the school wrote, Geist for the
page's own words. A quiet anchor list on wide screens.

1. Header: "{Recommendation for Asha Varma}", the schools and deadlines (tabular), "This page is
   private to you. Asha sees only whether you've opened it, started, and marked it submitted."
2. Asha's note to you (cover note).
3. What the schools ask: the brief from `briefSections(…, "recommender")`, one group per section.
4. Your notes: the record button (`useDictation` with `fetchToken: () =>
fetchSttToken({ endpoint: "/api/r/<token>/stt" })`), "Type a note", the notes list (Spoken,
   2 min / Typed; edit, delete). Transcript region `aria-live="polite"`.
5. Your letter, per question: assist mode "Organise my notes into an answer" → the answer, each
   sentence focusable; focus or hover shows the note it came from below it ("From your note, 14
   Oct"). The answer is an editable text box with a live count against the question's limit by
   its counting rule and "Copy for the school's form" (toast "Answer copied"). Coach mode: "Show
   me a structure" → beats with your notes listed under each and questions to answer; an empty
   "Write your answer" box; the line "Quillfeather asks that recommenders write without AI help,
   so this page only helps you plan. The words are yours." "Missing" items as `--needs` chips.
   "I'd rather write it myself" switch → coach for everything.
6. Submitted: one checkbox per school, "I've submitted my recommendation to Halvorsen".
7. Footer: "Delete everything I wrote" (dialog: "Delete your notes and letter"), "This link works
   until 20 Jan 2027".

Closed states (`PortalClosedView`): expired "This link has expired. Asha can send you a new one."
replaced "This link was replaced by a newer one. Use the latest email, or get a fresh link." (+
the `/r` form); revoked/unknown "This link no longer works." `/r` page: "Send me a fresh link"
with an email field; always answers "If that address has an invitation, a fresh link is on its
way."

Responses for `/r/**` and `/api/r/**` carry `Referrer-Policy: no-referrer`,
`Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow` (next.config).

### Entry points (foundation)

- Workspace Files pane: one entry "Recommender briefs" (key `recommenders`, group
  `recommenders`) replacing `lor_question` deliverables; status `draft_ready` when a ready brief
  covers this kit's school, else `waiting`; links to `/recommenders`.
- `WhyThisDraft.recommenderCovers` from the plan's facets for this kit's recommenders.
- ⌘K: "Open your recommenders" (`AppShell actions`).
- Home schools list (C): "Recommenders: 1 of 2 invited" per school, and the next step "Ask Ravi
  for a recommendation by 18 Nov" when an ask date is within 7 days and no invite has gone.

---

## 9. Tests mapped to acceptance criteria

| AC / requirement                                                        | Test                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Owner         |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| **No applicant-facing route returns letter prose or recommender notes** | `apps/web/lib/phase6-contract.int.test.ts`: seeds an applicant with a kit, two recommenders, stories, a brief, an invite; writes distinctive prose ("Quokka lantern 7741 marmalade" in notes, "Velvet abacus 0932" in the letter, a dictated note) through the portal repo; asserts the DB columns hold no plaintext; then globs every `app/api/**/route.ts` outside `app/api/r/**`, calls every exported method as the applicant (seeded ids for each dynamic segment, valid bodies for the recommender routes, `{}` otherwise; SSE read for 1 s; destructive routes last) and asserts no response body contains either marker; also the view loaders (`loadRecommendersPage`, `loadRecommenderDetail`, `loadBriefView`, `recommenderSummary`, D's `loadStatusView`, `loadWorkspaceView`, `consistencyReport`). An inventory check fails when a route appears that the test's map doesn't name. | A             |
| … structural guarantee                                                  | `packages/db/test/portal-boundary.test.ts`: the `*_encrypted` workspace columns are referenced only in the schema, the migration and `repos/recommender-portal.ts`; `recommender-portal` exports are imported only from `apps/web/lib/portal/**`, `apps/web/app/api/r/**`, `apps/web/app/r/**` and tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Foundation    |
| … repo                                                                  | `packages/db/test/recommenders.int.test.ts`: ownership on every function; `listRecommenderStatuses` returns no content keys; raw token never stored; revoke/expire/replace resolution; workspace bound to email hash                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Foundation    |
| **Briefs cite only dossier facts**                                      | `packages/ai/test/phase6-tasks.test.ts`: the rec1 brief replay repairs a K18 cite and an uncited number; `briefCiteIssues` unit cases (K/C/P codes, other recommender's R code, number not in cited material, letter-prose regex). `apps/web/lib/phase6-ac.int.test.ts`: every stored brief passes `briefCiteIssues` against the applicant's snapshot                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Foundation, A |
| **Overlap flags shared facets (brief↔brief, brief↔essay)**              | `packages/linters/test/lor-overlap.test.ts` over `fixtures/lor-overlap/*.json`: seeded shared facets between two briefs and between a brief and an essay are flagged 100%; clean sets give none; ids stable across order; dismissals honoured. A's int test: the coverage view shows the seeded findings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | E, A          |
| Coach-only under restrictive AI policy                                  | phase6-tasks (coach replay: `answer` null); `recommenderModeFor` unit; B's int test (Quillfeather group → coach, assist refuses prose)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Foundation, B |
| Assistant uses only the recommender's words                             | phase6-tasks (repair of a sentence not in notes); `assistProvenanceIssues` unit cases; B's int test with the fake model                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Foundation, B |
| Recommender content encrypted, never readable by applicant              | B's `phase6-portal.int.test.ts` (columns are v1 envelopes; applicant view shows status only) + the contract test                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | B, A          |
| Token: 32-byte random, hashed, single recipient, expiring               | tokens unit (`newPortalToken` length/entropy, hash), `inviteExpiry` unit (14-day grace, 180 cap, 30 default), B's int test (expired/revoked/replaced pages, resend only to the invited address with a constant response)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Foundation, B |
| Reminders only after preview and opt-in; Reply-To; outbox               | D's `phase6-reminders.int.test.ts`: suggested reminders never send; enabling without the current preview hash → 409; changed text → "changed", not sent; due `on` reminders send once (two concurrent runs) to the outbox with `replyTo` = applicant and From display name; skip after all schools submitted; the ask sends the invite with a working link; check-ins rotate the token and the old link says "replaced"                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | D             |
| Schedule defaults (ask 6–8 weeks, 3 w, 1 w)                             | `packages/shared/test/recommenders.test.ts` (`planReminders`, `sendAtFor`, `schoolGroups`, `recommenderStatusOf`, `briefSections` audience rules)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Foundation    |
| Exports                                                                 | D: PDF is a real PDF (`%PDF`, pdf-lib reload) with every question verbatim and no cite codes; email text has the questions and the own-words reminder                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | D             |
| Pipeline stage 9 and consistency                                        | A's int test: a kit with a recommender who has stories builds a brief in stage 9 (fake model); a brief saying "team of 15" is flagged against the Fact Sheet's 13 as a `brief` doc                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | A             |
| Ownership of every new applicant route                                  | A and D int tests: another applicant gets 404 from each                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | A, D          |
| No raw audio                                                            | B: notes/voice routes accept only text + seconds; nothing writes audio keys                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | B             |
| UI                                                                      | C: `packages/ui/src/recommenders/*.test.tsx` (brief renders questions verbatim and no letter field exists; Turn on disabled until read; keyboard J/K and tabs; reduced motion renders lanes without transforms; empty/locked/building/failed copy). B: `packages/ui/src/portal/*.test.tsx` (sentence → note reveal on focus; coach shows no generated sentences; count by rule; closed states)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | C, B          |

Gates (unchanged): `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`,
`pnpm test:integration`, `pnpm build && pnpm --filter @admitstory/web bundle:check` (≤ 160 KB gz
per route; `/recommenders/[recommenderId]` and `/r/[token]` must fit: Motion, the voice client and
the editor stay behind `next/dynamic`).

---

## 10. Work split

Foundation first (one agent), then five packages in parallel with disjoint paths. The integration
stage (after the packages) runs the full gates including `pnpm build` + `bundle:check` once,
writes `docs/phase-6.md` (built, tests, performance, deviations above, needs-Manu list). Every
stage (foundation, each package, integration) appends exactly one line to `HANDOFF.md` under
"## Log" with a shell append when it finishes. **Packages must not run `pnpm build`** (parallel
builds corrupt `.next`).

Foundation stubs: every module a package implements but someone else imports is created by the
foundation with its final signature and a **safe empty body** (returns `[]`, `null`, `"none"`, or
a minimal valid view), never a throw, so the app keeps working before the package lands. Each stub
starts with `// STUB (Phase 6 foundation): package <X> implements this.` The owning package
replaces the body and removes the line, without changing the exported signature.

| Package | Title                                                | Owns                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A       | Applicant server: lib, API, brief job, contract test | `apps/web/lib/recommenders/**` except `schools.ts`; `apps/web/app/api/recommenders/route.ts`, `summary/`, `plan/`, `[id]/route.ts`, `[id]/stories/**`, `[id]/brief/route.ts`; `apps/web/inngest/functions/lor-brief.ts`; `apps/web/lib/phase6-ac.int.test.ts`, `apps/web/lib/phase6-contract.int.test.ts`                                                                                                                                 |
| B       | Recommender portal                                   | `apps/web/app/r/**`, `apps/web/app/api/r/**`, `apps/web/lib/portal/**`, `packages/ui/src/portal/**`, `apps/web/lib/phase6-portal.int.test.ts`                                                                                                                                                                                                                                                                                             |
| C       | Screen H and Home                                    | `apps/web/app/(app)/recommenders/**`, `packages/ui/src/recommenders/**`, `apps/web/app/(app)/home/**`, `apps/web/lib/home/**`, `docs/design/phase-6-direction.md`                                                                                                                                                                                                                                                                         |
| D       | Invites, reminders, emails, exports, cron            | `packages/emails/src/recommender-*.tsx`, `packages/emails/src/recommender-render.ts`, `packages/emails/src/recommender-render.test.ts`, `apps/web/lib/reminders/**`, `apps/web/lib/brief-export/**`, `apps/web/app/api/recommenders/[id]/invite/**`, `[id]/reminders/**`, `[id]/brief/export/**`, `apps/web/app/api/dev/reminders/**`, `apps/web/inngest/functions/recommender-reminders.ts`, `apps/web/lib/phase6-reminders.int.test.ts` |
| E       | Deterministic overlap check and voice profile        | `packages/linters/src/lor/**` (except `types.ts`, foundation's), `packages/linters/test/lor-*.test.ts`, `fixtures/lor-overlap/**`                                                                                                                                                                                                                                                                                                         |

Cross-package calls go only through foundation-created signatures:

| Caller                                 | Callee (stub by foundation)                                                                                                                                         | Owner |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| pipeline (foundation edit)             | `briefsForKit(deps, ref, loaded)` in `lib/recommenders/stage.ts`                                                                                                    | A     |
| consistency (foundation edit)          | `briefConsistencyDocs(db, userId, scope)` in `lib/recommenders/consistency.ts`                                                                                      | A     |
| workspace view (foundation edit)       | `recommenderCoversFor(db, userId, userSchoolId)` in `lib/recommenders/covers.ts`; `recommenderFileStatus(db, userId, schoolCycleId)` in `lib/recommenders/files.ts` | A     |
| `lor-brief.ts` (A) and the brief route | `requestBriefs(...)`, `runBriefJob(...)` in `lib/recommenders/briefs.ts`                                                                                            | A     |
| C (Home, pages)                        | `recommenderSummary(db, userId)` (`lib/recommenders/summary.ts`); `loadRecommendersPage`, `loadRecommenderDetail`, `loadBriefView` (`lib/recommenders/view.ts`)     | A     |
| C (status tab)                         | `loadStatusView(userId, recommenderId)` (`lib/reminders/view.ts`)                                                                                                   | D     |
| A (coverage, brief views)              | `checkLorOverlap`, `facetSimilarity` (`@admitstory/linters`)                                                                                                        | E     |
| B (assist)                             | `recommenderVoice` (`@admitstory/linters`)                                                                                                                          | E     |
| B (resend)                             | `renderRecommenderLinkEmail` (`@admitstory/emails`)                                                                                                                 | D     |
| A (lor/brief job)                      | inngest function file `lor-brief.ts` (registered by foundation)                                                                                                     | A     |
| D (cron)                               | inngest function file `recommender-reminders.ts` (registered by foundation)                                                                                         | D     |
