// The Recommender Kit (spec §5.11, §10 Recommenders), Phase 6. Migration 0007_recommender_kit.
//
// The applicant's side: who their recommenders are, the stories each one saw (R codes), the
// coverage plan across recommenders, and one brief per recommender per school group. The
// recommender's side: an invite (a hashed portal token, never stored raw, §14.6) and a workspace
// bound to the invited email address, whose notes, letter drafts and voice profile are encrypted
// and readable only through the token-side repository (repos/recommender-portal.ts). The applicant
// sees status, never content (§14.3).
//
// Like the kit tables, every table carries `user_id` (the applicant) so each read and write is
// scoped by owner and everything cascades when the account is deleted. Status columns are text
// with a TypeScript type, as in Phase 5, not pgEnums.

import type {
  BriefMeta,
  LorBrief,
  LorPlan,
  LorStoryFields,
  Relationship,
  ReminderKind,
  StoredIntake,
} from "@admitstory/shared/kit";
import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { baseColumns } from "./columns";

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

const owner = () =>
  uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" });

const uuids = (name: string) =>
  uuid(name)
    .array()
    .notNull()
    .default(sql`'{}'::uuid[]`);

export type LorStoryOrigin = "extracted" | "edited" | "manual";
export type LorBriefStatus = "building" | "ready" | "failed";
export type InviteStatus = "active" | "revoked" | "expired";
export type ReminderStatus =
  "suggested" | "on" | "sending" | "sent" | "skipped" | "changed" | "off";

/* Recommenders --------------------------------------------------------------------------------- */

export const recommenders = pgTable(
  "recommenders",
  {
    ...baseColumns(),
    userId: owner(),
    /** "rec1": stable per user, used in model input and output instead of the uuid. */
    ref: text("ref").notNull(),
    name: text("name").notNull(),
    /** Lower-cased and trimmed. Where invites go; never shown on the portal to anyone else. */
    email: text("email").notNull(),
    title: text("title"),
    organisation: text("organisation"),
    relationship: text("relationship").$type<Relationship>().notNull(),
    durationText: text("duration_text"),
    frequencyText: text("frequency_text"),
    /** The applicant's schools (user_schools ids) this recommender writes for. */
    userSchoolIds: uuids("user_school_ids"),
    intake: jsonb("intake").$type<StoredIntake>(),
    /** The intake answers, stored as encrypted `sources` rows of kind `recommender_intake`. */
    intakeSourceIds: uuids("intake_source_ids"),
    sortOrder: integer("sort_order").notNull().default(0),
    archivedAt: timestamptz("archived_at"),
  },
  (t) => [
    unique("recommenders_user_ref_unique").on(t.userId, t.ref),
    index("recommenders_user_id_idx").on(t.userId),
  ],
);

/** A story one recommender saw, as the applicant told it. Code "R01", unique per applicant. */
export const lorStories = pgTable(
  "lor_stories",
  {
    ...baseColumns(),
    userId: owner(),
    recommenderId: uuid("recommender_id")
      .notNull()
      .references(() => recommenders.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    fields: jsonb("fields").$type<LorStoryFields>().notNull(),
    /** "extracted" is replaced by the next extraction; "edited" and "manual" are kept. */
    origin: text("origin").$type<LorStoryOrigin>().notNull(),
    sourceIds: uuids("source_ids"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    unique("lor_stories_user_code_unique").on(t.userId, t.code),
    index("lor_stories_recommender_id_idx").on(t.recommenderId),
  ],
);

/** The coverage plan across the applicant's recommenders (`lor.plan`, LOR-03). One per applicant. */
export const lorPlans = pgTable(
  "lor_plans",
  {
    ...baseColumns(),
    userId: owner(),
    content: jsonb("content").$type<LorPlan>().notNull(),
    inputHash: text("input_hash").notNull(),
    version: integer("version").notNull().default(1),
    dossierSnapshotVersion: integer("dossier_snapshot_version").notNull(),
  },
  (t) => [unique("lor_plans_user_unique").on(t.userId)],
);

/** One brief per recommender per school group ("common" or a school_cycle_id, decision 15). */
export const lorBriefs = pgTable(
  "lor_briefs",
  {
    ...baseColumns(),
    userId: owner(),
    recommenderId: uuid("recommender_id")
      .notNull()
      .references(() => recommenders.id, { onDelete: "cascade" }),
    groupKey: text("group_key").notNull(),
    schoolCycleIds: uuids("school_cycle_ids"),
    status: text("status").$type<LorBriefStatus>().notNull(),
    content: jsonb("content").$type<LorBrief>(),
    meta: jsonb("meta").$type<BriefMeta>(),
    inputHash: text("input_hash"),
    planVersion: integer("plan_version"),
    dossierSnapshotVersion: integer("dossier_snapshot_version"),
    version: integer("version").notNull().default(0),
    /** The school cycle whose refinement a rebuild consumed (released on failure, decision 19). */
    chargedRefId: uuid("charged_ref_id"),
    error: text("error"),
    builtAt: timestamptz("built_at"),
  },
  (t) => [
    unique("lor_briefs_recommender_group_unique").on(t.recommenderId, t.groupKey),
    index("lor_briefs_user_id_idx").on(t.userId),
  ],
);

/* The recommender's side ------------------------------------------------------------------------ */

/**
 * A portal link sent to the recommender's address. Only the sha256 of the 32-byte token is stored
 * (§14.6); the raw token exists only in the email. A check-in rotates it and keeps the previous
 * hash, so an old link can say it was replaced (decision 9).
 */
export const recommenderInvites = pgTable(
  "recommender_invites",
  {
    ...baseColumns(),
    userId: owner(),
    recommenderId: uuid("recommender_id")
      .notNull()
      .references(() => recommenders.id, { onDelete: "cascade" }),
    /** sha256 of the invited address (lower-cased, trimmed): binds the invite to its workspace. */
    emailHash: text("email_hash").notNull(),
    tokenHash: text("token_hash").notNull(),
    previousTokenHash: text("previous_token_hash"),
    status: text("status").$type<InviteStatus>().notNull(),
    sentAt: timestamptz("sent_at").notNull(),
    expiresAt: timestamptz("expires_at").notNull(),
    lastOpenedAt: timestamptz("last_opened_at"),
    revokedAt: timestamptz("revoked_at"),
    sendCount: integer("send_count").notNull().default(1),
  },
  (t) => [
    unique("recommender_invites_token_hash_unique").on(t.tokenHash),
    index("recommender_invites_previous_token_hash_idx").on(t.previousTokenHash),
    index("recommender_invites_recommender_id_idx").on(t.recommenderId),
    index("recommender_invites_user_id_idx").on(t.userId),
  ],
);

/**
 * What the recommender writes, bound to the invited address (decision 8): reissuing to the same
 * address keeps it, a new address starts empty. The three `*_encrypted` columns are AES-256-GCM
 * envelopes read and written only by repos/recommender-portal.ts; `user_id` is the applicant's,
 * for cascade and the status select, which never reads them.
 */
export const recommenderWorkspaces = pgTable(
  "recommender_workspaces",
  {
    ...baseColumns(),
    userId: owner(),
    recommenderId: uuid("recommender_id")
      .notNull()
      .references(() => recommenders.id, { onDelete: "cascade" }),
    inviteId: uuid("invite_id").references(() => recommenderInvites.id, { onDelete: "set null" }),
    emailHash: text("email_hash").notNull(),
    /** JSON PortalNote[]. */
    privateNotesEncrypted: text("private_notes_encrypted"),
    /** JSON Record<letterKey, PortalLetter>. */
    letterDraftEncrypted: text("letter_draft_encrypted"),
    /** JSON RecommenderVoice. */
    voiceEncrypted: text("voice_encrypted"),
    openedAt: timestamptz("opened_at"),
    progressAt: timestamptz("progress_at"),
    /** school_cycle_id → ISO time the recommender marked it submitted. */
    submitted: jsonb("submitted").$type<Record<string, string>>().notNull().default({}),
    assistCount: integer("assist_count").notNull().default(0),
    voiceSeconds: integer("voice_seconds").notNull().default(0),
    preferCoach: boolean("prefer_coach").notNull().default(false),
  },
  (t) => [
    unique("recommender_workspaces_recommender_email_unique").on(t.recommenderId, t.emailHash),
    index("recommender_workspaces_user_id_idx").on(t.userId),
  ],
);

/**
 * The invitation and check-in emails (decision 18). Every row starts "suggested" and is sent only
 * after the applicant has read its preview and switched it on (decision 3); a row whose text
 * changed since that read becomes "changed" and is not sent.
 */
export const recommenderReminders = pgTable(
  "recommender_reminders",
  {
    ...baseColumns(),
    userId: owner(),
    recommenderId: uuid("recommender_id")
      .notNull()
      .references(() => recommenders.id, { onDelete: "cascade" }),
    kind: text("kind").$type<ReminderKind>().notNull(),
    deadline: date("deadline", { mode: "string" }).notNull(),
    schoolCycleIds: uuids("school_cycle_ids"),
    sendOn: date("send_on", { mode: "string" }).notNull(),
    sendAt: timestamptz("send_at").notNull(),
    status: text("status").$type<ReminderStatus>().notNull().default("suggested"),
    /** The applicant's own line (≤ 300 characters). */
    note: text("note"),
    previewHash: text("preview_hash"),
    previewedAt: timestamptz("previewed_at"),
    enabledAt: timestamptz("enabled_at"),
    sentAt: timestamptz("sent_at"),
    skippedReason: text("skipped_reason"),
    deliveryId: text("delivery_id"),
  },
  (t) => [
    unique("recommender_reminders_recommender_kind_deadline_unique").on(
      t.recommenderId,
      t.kind,
      t.deadline,
    ),
    index("recommender_reminders_status_send_at_idx").on(t.status, t.sendAt),
    index("recommender_reminders_user_id_idx").on(t.userId),
  ],
);

export type RecommenderRow = typeof recommenders.$inferSelect;
export type LorStoryRow = typeof lorStories.$inferSelect;
export type LorPlanRow = typeof lorPlans.$inferSelect;
export type LorBriefRow = typeof lorBriefs.$inferSelect;
export type InviteRow = typeof recommenderInvites.$inferSelect;
export type ReminderRow = typeof recommenderReminders.$inferSelect;
