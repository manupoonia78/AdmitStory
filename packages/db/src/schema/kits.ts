// The School Kit and the Workspace (spec §5.7, §5.8, §8.6–8.8, §10), Phase 4.
//
// §10's deliverables, angles, drafts, checks, need_items, verify_items, revision_requests and
// feedback, plus `kit_stages` (one row per pipeline stage, so the pipeline is resumable: each
// stage's output is persisted before the next starts, §5.7 AC).
//
// Ownership runs user → user_school → kit → deliverable → draft. Like `kits`, every table here also
// carries a denormalised `user_id`, copied from the parent that the repository has just checked, so
// every read and write is scoped by owner without a join and a forged child id finds nothing.

import type { Paragraph } from "@admitstory/shared/kit";
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { kits } from "./applications";
import { users } from "./auth";
import { baseColumns } from "./columns";
import { sources } from "./studio";

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });
const owner = () =>
  uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" });

/* Enums -------------------------------------------------------------------------------------- */

/** The ten stages of §5.7, in order. Stage 9 is a typed hook until Phases 5–7. */
export const kitStageKeys = [
  "context",
  "positioning",
  "file_map",
  "gaps",
  "angles",
  "drafts",
  "short_form",
  "checks",
  "forms",
  "verify",
] as const;
export const kitStageKeyEnum = pgEnum("kit_stage_key", kitStageKeys);
export type KitStageKey = (typeof kitStageKeys)[number];

export const kitStageStatuses = ["pending", "running", "done", "failed", "skipped"] as const;
export const kitStageStatusEnum = pgEnum("kit_stage_status", kitStageStatuses);
export type KitStageStatus = (typeof kitStageStatuses)[number];

export const deliverableTypes = [
  "essay",
  "short_answer",
  "goal_field",
  "video",
  "form_section",
  "lor_question",
  "interview_question",
] as const;
export const deliverableTypeEnum = pgEnum("deliverable_type", deliverableTypes);
export type DeliverableType = (typeof deliverableTypes)[number];

/** §5.8 Files pane: `drafting`, `draft ready`, `needs you`, `final`; `pending` before stage 6. */
export const deliverableStatuses = [
  "pending",
  "drafting",
  "draft_ready",
  "needs_you",
  "final",
] as const;
export const deliverableStatusEnum = pgEnum("deliverable_status", deliverableStatuses);
export type DeliverableStatus = (typeof deliverableStatuses)[number];

/** How the school's portal counts (§5.8). Matches packages/linters' `LimitKind`. */
export const limitKinds = ["words", "chars_incl_spaces", "chars_excl_spaces"] as const;
export const limitKindEnum = pgEnum("limit_kind", limitKinds);
export type LimitKind = (typeof limitKinds)[number];

/** §8.10. */
export const authorshipModes = ["draft", "coach", "talking_points"] as const;
export const authorshipModeEnum = pgEnum("authorship_mode", authorshipModes);
export type AuthorshipMode = (typeof authorshipModes)[number];

export const angleLabels = ["A", "B", "C"] as const;
export const angleLabelEnum = pgEnum("angle_label", angleLabels);

export const draftAuthors = ["ai", "user"] as const;
export const draftAuthorEnum = pgEnum("draft_author", draftAuthors);
export type DraftAuthor = (typeof draftAuthors)[number];

export const checkSources = ["linter", "critic"] as const;
export const checkSourceEnum = pgEnum("check_source", checkSources);
export type CheckSource = (typeof checkSources)[number];

export const checkSeverities = ["must", "should", "consider"] as const;
export const checkSeverityEnum = pgEnum("check_severity", checkSeverities);
export type CheckSeverity = (typeof checkSeverities)[number];

export const checkStatuses = ["open", "fixed", "dismissed"] as const;
export const checkStatusEnum = pgEnum("check_status", checkStatuses);
export type CheckStatus = (typeof checkStatuses)[number];

export const needStatuses = ["open", "answered", "skipped"] as const;
export const needStatusEnum = pgEnum("need_status", needStatuses);
export type NeedStatus = (typeof needStatuses)[number];

export const verifyStatuses = ["open", "confirmed", "corrected"] as const;
export const verifyStatusEnum = pgEnum("verify_status", verifyStatuses);
export type VerifyStatus = (typeof verifyStatuses)[number];

/** `ready`: the patch is computed and its diff awaits the applicant's accept or reject (§5.8). */
export const revisionStatuses = ["pending", "ready", "accepted", "rejected", "failed"] as const;
export const revisionStatusEnum = pgEnum("revision_status", revisionStatuses);
export type RevisionStatus = (typeof revisionStatuses)[number];

/* Shapes stored in jsonb --------------------------------------------------------------------- */

/** A prompt part to answer (§5.8 "each part ticked"). */
export interface DeliverablePart {
  part: string;
}

/** A beat in an angle's outline (Appendix I `Angle.beats`). */
export interface AngleBeat {
  beat: string;
  words: number;
  sources: string[];
}

/**
 * A draft's body: paragraphs with stable ids, each sentence with its kind and sources (Appendix I
 * `Draft`). The rest of the Writer's output (needs, prompt parts, notes, verify) rides along so the
 * Coach pane can show it for the exact version on screen. Coach-mode output (`CoachBeats`) is
 * stored under `coach` with no paragraphs.
 */
export interface DraftContent {
  paragraphs: Paragraph[];
  [key: string]: unknown;
}

/** Where a finding points (Appendix I `Finding.location`). */
export interface CheckLocation {
  paragraph_id: string | null;
  sentence: number | null;
}

/* Tables ------------------------------------------------------------------------------------- */

export const kitStages = pgTable(
  "kit_stages",
  {
    ...baseColumns(),
    userId: owner(),
    kitId: uuid("kit_id")
      .notNull()
      .references(() => kits.id, { onDelete: "cascade" }),
    stage: kitStageKeyEnum("stage").notNull(),
    /** 1–10, the stage's place in §5.7's table. */
    ordinal: integer("ordinal").notNull(),
    status: kitStageStatusEnum("status").notNull().default("pending"),
    output: jsonb("output").$type<unknown>(),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    startedAt: timestamptz("started_at"),
    finishedAt: timestamptz("finished_at"),
  },
  (t) => [
    unique("kit_stages_kit_stage_unique").on(t.kitId, t.stage),
    index("kit_stages_user_id_idx").on(t.userId),
  ],
);

export const deliverables = pgTable(
  "deliverables",
  {
    ...baseColumns(),
    userId: owner(),
    kitId: uuid("kit_id")
      .notNull()
      .references(() => kits.id, { onDelete: "cascade" }),
    type: deliverableTypeEnum("type").notNull(),
    /** The pack's key for this prompt; the file map's `deliverable_key`. */
    packKey: text("pack_key").notNull(),
    title: text("title"),
    /** Verbatim from the pack (§5.8). */
    promptText: text("prompt_text").notNull(),
    limitKind: limitKindEnum("limit_kind"),
    limitValue: integer("limit_value"),
    parts: jsonb("parts").$type<DeliverablePart[]>().notNull().default([]),
    order: integer("order").notNull().default(0),
    status: deliverableStatusEnum("status").notNull().default("pending"),
    authorshipMode: authorshipModeEnum("authorship_mode").notNull().default("draft"),
  },
  (t) => [
    unique("deliverables_kit_pack_key_unique").on(t.kitId, t.packKey),
    index("deliverables_user_id_idx").on(t.userId),
  ],
);

export const angles = pgTable(
  "angles",
  {
    ...baseColumns(),
    userId: owner(),
    deliverableId: uuid("deliverable_id")
      .notNull()
      .references(() => deliverables.id, { onDelete: "cascade" }),
    label: angleLabelEnum("label").notNull(),
    pitch: text("pitch").notNull(),
    opening: text("opening").notNull(),
    /** Story codes (S03…), as the Angle Maker writes them; §10 says uuid[], codes survive merges. */
    stories: text("stories")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    beats: jsonb("beats").$type<AngleBeat[]>().notNull().default([]),
    proves: text("proves")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    tradeoffs: text("tradeoffs")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    recommended: boolean("recommended").notNull().default(false),
    reason: text("reason").notNull().default(""),
  },
  (t) => [
    unique("angles_deliverable_label_unique").on(t.deliverableId, t.label),
    index("angles_user_id_idx").on(t.userId),
  ],
);

export const drafts = pgTable(
  "drafts",
  {
    ...baseColumns(),
    userId: owner(),
    deliverableId: uuid("deliverable_id")
      .notNull()
      .references(() => deliverables.id, { onDelete: "cascade" }),
    angleId: uuid("angle_id").references(() => angles.id, { onDelete: "set null" }),
    /** 1, 2, 3… per deliverable: every AI generation and every user save is a version (§5.8). */
    version: integer("version").notNull(),
    author: draftAuthorEnum("author").notNull(),
    content: jsonb("content").$type<DraftContent>().notNull(),
    plainText: text("plain_text").notNull(),
    wordCount: integer("word_count").notNull(),
    charCountIncl: integer("char_count_incl").notNull(),
    charCountExcl: integer("char_count_excl").notNull(),
    /** Share of words in verbatim/adapted sentences, 0–1 (§8.7). */
    voiceFidelity: numeric("voice_fidelity", { precision: 5, scale: 4, mode: "number" }),
    parentDraftId: uuid("parent_draft_id").references((): AnyPgColumn => drafts.id, {
      onDelete: "set null",
    }),
    /** A one-line description of what made this version: "Warmer", "Restored version 3". */
    note: text("note"),
    isCurrent: boolean("is_current").notNull().default(false),
    /** A fact or story it used was edited after it was written (§5.3 AC). */
    stale: boolean("stale").notNull().default(false),
    staleReason: text("stale_reason"),
    lockedParagraphs: text("locked_paragraphs")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    userEditedParagraphs: text("user_edited_paragraphs")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    usedFactCodes: text("used_fact_codes")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    usedStoryCodes: text("used_story_codes")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    isFinal: boolean("is_final").notNull().default(false),
    markedFinalAt: timestamptz("marked_final_at"),
  },
  (t) => [
    unique("drafts_deliverable_version_unique").on(t.deliverableId, t.version),
    index("drafts_user_id_idx").on(t.userId),
    uniqueIndex("drafts_one_current_per_deliverable")
      .on(t.deliverableId)
      .where(sql`is_current`),
    index("drafts_used_fact_codes_idx").using("gin", t.usedFactCodes),
    index("drafts_used_story_codes_idx").using("gin", t.usedStoryCodes),
  ],
);

export const checks = pgTable(
  "checks",
  {
    ...baseColumns(),
    userId: owner(),
    draftId: uuid("draft_id")
      .notNull()
      .references(() => drafts.id, { onDelete: "cascade" }),
    source: checkSourceEnum("source").notNull(),
    ruleId: text("rule_id").notNull(),
    severity: checkSeverityEnum("severity").notNull(),
    location: jsonb("location").$type<CheckLocation>().notNull(),
    explanation: text("explanation").notNull(),
    fixHint: text("fix_hint"),
    patch: jsonb("patch").$type<unknown>(),
    status: checkStatusEnum("status").notNull().default("open"),
  },
  (t) => [index("checks_draft_idx").on(t.draftId), index("checks_user_id_idx").on(t.userId)],
);

export const needItems = pgTable(
  "need_items",
  {
    ...baseColumns(),
    userId: owner(),
    kitId: uuid("kit_id")
      .notNull()
      .references(() => kits.id, { onDelete: "cascade" }),
    deliverableId: uuid("deliverable_id")
      .notNull()
      .references(() => deliverables.id, { onDelete: "cascade" }),
    draftId: uuid("draft_id").references(() => drafts.id, { onDelete: "set null" }),
    paragraphId: text("paragraph_id"),
    afterSentence: integer("after_sentence"),
    question: text("question").notNull(),
    approxWords: integer("approx_words"),
    blocking: boolean("blocking").notNull().default(false),
    status: needStatusEnum("status").notNull().default("open"),
    answerSourceId: uuid("answer_source_id").references(() => sources.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    index("need_items_deliverable_idx").on(t.deliverableId),
    index("need_items_user_id_idx").on(t.userId),
  ],
);

export const verifyItems = pgTable(
  "verify_items",
  {
    ...baseColumns(),
    userId: owner(),
    kitId: uuid("kit_id")
      .notNull()
      .references(() => kits.id, { onDelete: "cascade" }),
    deliverableId: uuid("deliverable_id").references(() => deliverables.id, {
      onDelete: "cascade",
    }),
    draftId: uuid("draft_id").references(() => drafts.id, { onDelete: "set null" }),
    text: text("text").notNull(),
    reason: text("reason").notNull(),
    /** Provenance or pack codes the item is about (F12, K17), and a link for school specifics. */
    cites: text("cites")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    url: text("url"),
    status: verifyStatusEnum("status").notNull().default("open"),
    correction: text("correction"),
    resolvedAt: timestamptz("resolved_at"),
  },
  (t) => [
    index("verify_items_kit_idx").on(t.kitId),
    index("verify_items_user_id_idx").on(t.userId),
  ],
);

export const revisionRequests = pgTable(
  "revision_requests",
  {
    ...baseColumns(),
    userId: owner(),
    draftId: uuid("draft_id")
      .notNull()
      .references(() => drafts.id, { onDelete: "cascade" }),
    instruction: text("instruction").notNull(),
    quickAction: text("quick_action"),
    targetParagraphs: text("target_paragraphs")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    resultDraftId: uuid("result_draft_id").references(() => drafts.id, { onDelete: "set null" }),
    status: revisionStatusEnum("status").notNull().default("pending"),
    summary: text("summary"),
    error: text("error"),
  },
  (t) => [
    index("revision_requests_draft_idx").on(t.draftId),
    index("revision_requests_user_id_idx").on(t.userId),
  ],
);

export const feedback = pgTable(
  "feedback",
  {
    ...baseColumns(),
    userId: owner(),
    /** e.g. `draft`, `angle`, `check`, `profile_read`. */
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    /** −1 (down) or 1 (up); range enforced in the repository. */
    rating: integer("rating"),
    reason: text("reason"),
    text: text("text"),
  },
  (t) => [
    index("feedback_user_id_idx").on(t.userId),
    index("feedback_target_idx").on(t.targetType, t.targetId),
  ],
);
