// Story Studio and the Applicant Dossier (spec §10). Every table is user-owned: `user_id` with an
// index, reached only through the ownership-checked repositories in src/repos.
//
// Two columns carry encrypted content (§14.4): `sources.text_encrypted`, which holds everything the
// applicant said or uploaded, and nothing else — the structured results (facts, stories, golden
// lines) are stored in the clear, because every linter, selector and query has to read them.

import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { baseColumns } from "./columns";

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

/* Enums -------------------------------------------------------------------------------------- */

export const sourceKinds = [
  "voice_turn",
  "text_turn",
  "upload",
  "import",
  "conversation_note",
  "need_answer",
] as const;
export const sourceKindEnum = pgEnum("source_kind", sourceKinds);
export type SourceKind = (typeof sourceKinds)[number];

export const studioSessionStatuses = ["active", "paused", "ended"] as const;
export const studioSessionStatusEnum = pgEnum("studio_session_status", studioSessionStatuses);
export type StudioSessionStatus = (typeof studioSessionStatuses)[number];

export const turnRoles = ["ai", "user"] as const;
export const turnRoleEnum = pgEnum("turn_role", turnRoles);
export type TurnRole = (typeof turnRoles)[number];

/** The Interviewer's four moves (spec §8.5.1). */
export const interviewerMoves = ["DIG", "NEXT", "CONFIRM", "CARE"] as const;
export const interviewerMoveEnum = pgEnum("interviewer_move", interviewerMoves);
export type InterviewerMove = (typeof interviewerMoves)[number];

export const slotStates = ["empty", "partial", "filled"] as const;
export const slotStateEnum = pgEnum("slot_state", slotStates);

export const factStatuses = ["confirmed", "needs_confirmation", "conflict"] as const;
export const factStatusEnum = pgEnum("fact_status", factStatuses);
export type FactStatus = (typeof factStatuses)[number];

export const storyStatuses = ["confirmed", "partial", "unconfirmed"] as const;
export const storyStatusEnum = pgEnum("story_status", storyStatuses);
export type StoryStatus = (typeof storyStatuses)[number];

export const sensitivities = ["none", "personal", "sensitive"] as const;
export const sensitivityEnum = pgEnum("sensitivity", sensitivities);
export type Sensitivity = (typeof sensitivities)[number];

export const storyContexts = ["professional", "academic", "community", "personal"] as const;
export const storyContextEnum = pgEnum("story_context", storyContexts);

export const chapters = [
  "roots",
  "education",
  "work",
  "beyond_work",
  "turning_points",
  "people_and_values",
  "goals",
  "schools",
  "recommenders",
] as const;
export const chapterEnum = pgEnum("studio_chapter", chapters);

/* Sources ------------------------------------------------------------------------------------ */

/** Everything the applicant said, wrote or uploaded. The raw material every fact traces back to. */
export const sources = pgTable(
  "sources",
  {
    ...baseColumns(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: sourceKindEnum("kind").notNull(),
    /** AES-256-GCM envelope (src/crypto/content.ts). Never written in the clear. */
    textEncrypted: text("text_encrypted"),
    /** BCP 47 tag of what was actually said, which may not be English (spec §7.5). */
    language: text("language"),
    /** Set only when the applicant opted into keeping recordings (§14.4). */
    audioObjectKey: text("audio_object_key"),
    /**
     * Phase 1 extracts an upload's text and discards the file, so this stays null until R2 is
     * wired (see docs/phase-1.md).
     */
    fileObjectKey: text("file_object_key"),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
  },
  (t) => [index("sources_user_id_idx").on(t.userId, t.createdAt)],
);

/* Studio sessions and turns ------------------------------------------------------------------ */

export const studioSessions = pgTable(
  "studio_sessions",
  {
    ...baseColumns(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mode: text("mode").notNull(),
    currentChapter: chapterEnum("current_chapter").notNull().default("roots"),
    status: studioSessionStatusEnum("status").notNull().default("active"),
    startedAt: timestamptz("started_at").notNull().defaultNow(),
    endedAt: timestamptz("ended_at"),
    /** Counts against the free tier's 120 minutes (§12.4). Zero until Phase 2. */
    voiceSeconds: integer("voice_seconds").notNull().default(0),
    /** Express mode's openers are asked in order; this records how far through we are. */
    openersAsked: integer("openers_asked").notNull().default(0),
  },
  (t) => [index("studio_sessions_user_id_idx").on(t.userId, t.startedAt)],
);

export const studioTurns = pgTable(
  "studio_turns",
  {
    ...baseColumns(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => studioSessions.id, { onDelete: "cascade" }),
    role: turnRoleEnum("role").notNull(),
    /**
     * An AI turn's question, in the clear: it is ours, not the applicant's, and the Studio UI,
     * the simulator and the admin console all read it. A user turn's words live in its source.
     */
    text: text("text"),
    move: interviewerMoveEnum("move"),
    slot: text("slot"),
    storyRef: text("story_ref"),
    sourceId: uuid("source_id").references(() => sources.id, { onDelete: "set null" }),
    latencyMs: integer("latency_ms"),
    /** Idempotency for POST /studio/turns (spec §11): one row per client turn. */
    clientTurnId: text("client_turn_id"),
  },
  (t) => [
    index("studio_turns_session_idx").on(t.sessionId, t.createdAt),
    index("studio_turns_user_id_idx").on(t.userId),
    unique("studio_turns_client_turn_id_unique").on(t.userId, t.clientTurnId),
  ],
);

/* Slot state --------------------------------------------------------------------------------- */

export const slotsState = pgTable(
  "slots_state",
  {
    ...baseColumns(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    slotKey: text("slot_key").notNull(),
    state: slotStateEnum("state").notNull().default("empty"),
    evidenceStoryIds: uuid("evidence_story_ids")
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    lastAskedAt: timestamptz("last_asked_at"),
    skippedCount: integer("skipped_count").notNull().default(0),
  },
  (t) => [unique("slots_state_user_slot_unique").on(t.userId, t.slotKey)],
);

/* Fact Sheet --------------------------------------------------------------------------------- */

export interface FactEvidence {
  sourceId: string;
  /** Character offsets into the source text the Extractor took it from. */
  spans: { start: number; end: number }[];
}

export interface FactConflict {
  otherValue: string;
  otherEvidence?: FactEvidence;
  note?: string;
}

export const facts = pgTable(
  "facts",
  {
    ...baseColumns(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Provenance code: F01, F02… unique per applicant (spec §8.7). */
    code: text("code").notNull(),
    key: text("key").notNull(),
    value: text("value").notNull(),
    /** Parenthetical context the Extractor kept: "US health system; 40+ hospitals". */
    note: text("note"),
    /** What drafts must say instead of `value`, when the applicant set one (§5.3a). */
    approvedPhrasing: text("approved_phrasing"),
    status: factStatusEnum("status").notNull().default("needs_confirmation"),
    sensitivity: sensitivityEnum("sensitivity").notNull().default("none"),
    /**
     * Not in §10, added here so §14.3 is enforceable per fact as it is per story: a sensitive fact
     * stays out of the dossier snapshot until the applicant says otherwise (see docs/phase-1.md).
     */
    consentToUse: boolean("consent_to_use").notNull().default(true),
    evidence: jsonb("evidence").$type<FactEvidence[]>(),
    conflict: jsonb("conflict").$type<FactConflict>(),
  },
  (t) => [
    unique("facts_user_code_unique").on(t.userId, t.code),
    index("facts_user_key_idx").on(t.userId, t.key),
  ],
);

/* Story Bank --------------------------------------------------------------------------------- */

export interface StoryMissing {
  /** The exact missing detail, as a question (spec §5.3b). */
  question: string;
  approxWords?: number;
}

export interface StoryNumber {
  label: string;
  value: string;
  factCode?: string;
}

export const stories = pgTable(
  "stories",
  {
    ...baseColumns(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** S01, S02… unique per applicant. */
    code: text("code").notNull(),
    nickname: text("nickname").notNull(),
    era: text("era"),
    context: storyContextEnum("context").notNull().default("professional"),
    chapter: chapterEnum("chapter"),
    situation: text("situation"),
    stakes: text("stakes"),
    actions: jsonb("actions").$type<string[]>().notNull().default([]),
    result: text("result"),
    reflection: text("reflection"),
    numbers: jsonb("numbers").$type<StoryNumber[]>(),
    traits: text("traits")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    lenses: text("lenses")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    archetypes: text("archetypes")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    slotKeys: text("slot_keys")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    /** Provenance codes of the people in this story (P1, P2…), so the dossier never has to guess. */
    peopleCodes: text("people_codes")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    status: storyStatusEnum("status").notNull().default("unconfirmed"),
    missing: jsonb("missing").$type<StoryMissing[]>(),
    sensitivity: sensitivityEnum("sensitivity").notNull().default("none"),
    /** Spec §8.7: false keeps the story out of the dossier snapshot entirely. */
    consentToUse: boolean("consent_to_use").notNull().default(true),
    evidence: jsonb("evidence").$type<FactEvidence[]>(),
    /** Set when the Consolidator merged this story into another; it stops appearing. */
    mergedInto: uuid("merged_into"),
    /** How confident the Extractor was it is a story at all (§8.5.2: include below 0.5 too). */
    confidence: text("confidence"),
  },
  (t) => [
    unique("stories_user_code_unique").on(t.userId, t.code),
    index("stories_user_status_idx").on(t.userId, t.status),
  ],
);

export const goldenLines = pgTable(
  "golden_lines",
  {
    ...baseColumns(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** L001, L002… unique per applicant. */
    code: text("code").notNull(),
    storyId: uuid("story_id").references(() => stories.id, { onDelete: "set null" }),
    /** Verbatim, exactly as said — grammar included (spec §8.5.2). */
    text: text("text").notNull(),
    /** An English rendering when the applicant spoke another language (§7.5). */
    english: text("english"),
    sourceId: uuid("source_id").references(() => sources.id, { onDelete: "set null" }),
    span: jsonb("span").$type<{ start: number; end: number }>(),
    starred: boolean("starred").notNull().default(false),
  },
  (t) => [
    unique("golden_lines_user_code_unique").on(t.userId, t.code),
    index("golden_lines_story_idx").on(t.storyId),
  ],
);

export const people = pgTable(
  "people",
  {
    ...baseColumns(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** P1, P2… unique per applicant. */
    code: text("code").notNull(),
    name: text("name").notNull(),
    roleInLife: text("role_in_life").notNull(),
    /** Spec §8.7: a name reaches a draft only when this is true. */
    mayName: boolean("may_name").notNull().default(false),
  },
  (t) => [unique("people_user_code_unique").on(t.userId, t.code)],
);

/* Brand and voice ---------------------------------------------------------------------------- */

export interface BrandTrait {
  traitId: string;
  /** Story codes that prove it. */
  storyCodes: string[];
  why?: string;
}

export const brand = pgTable(
  "brand",
  {
    ...baseColumns(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    version: integer("version").notNull().default(1),
    traits: jsonb("traits").$type<BrandTrait[]>().notNull().default([]),
    /** Internal positioning line; never submitted anywhere (spec §5.3c). */
    positioningLine: text("positioning_line"),
    /** The applicant accepted or edited it, so the Consolidator stops overwriting. */
    acceptedAt: timestamptz("accepted_at"),
  },
  (t) => [unique("brand_user_version_unique").on(t.userId, t.version)],
);

export interface VoiceStats {
  /** Computed in code from the applicant's own transcripts (spec §8.5.3). */
  sentenceLengthMean: number;
  sentenceLengthStdDev: number;
  /** Coefficient of variation; the §8.8 rhythm linter uses the same measure. */
  sentenceLengthVariation: number;
  wordCount: number;
  sentenceCount: number;
  /** Words per minute, when any of the material was spoken. */
  pace?: number;
  longestSentence?: number;
  shortestSentence?: number;
}

export const voiceProfiles = pgTable("voice_profiles", {
  ...baseColumns(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  stats: jsonb("stats").$type<VoiceStats>(),
  /** The ≤300-token voice card the Writer receives instead of transcripts (§5.3d). */
  card: text("card"),
});

/* Dossier snapshots -------------------------------------------------------------------------- */

export interface SnapshotBuiltFrom {
  factCodes: string[];
  storyCodes: string[];
  lineCodes: string[];
  withheldStories: number;
  withheldFacts: number;
  trimmed: { code: string; dropped: string[] }[];
}

export const dossierSnapshots = pgTable(
  "dossier_snapshots",
  {
    ...baseColumns(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    /** The compact L2 text (spec §8.2), compiled by packages/shared. */
    compactText: text("compact_text").notNull(),
    tokenCount: integer("token_count").notNull(),
    builtFrom: jsonb("built_from").$type<SnapshotBuiltFrom>(),
  },
  (t) => [unique("dossier_snapshots_user_version_unique").on(t.userId, t.version)],
);

/* Goals -------------------------------------------------------------------------------------- */

/**
 * The applicant's goals as the dossier states them. Not a §10 table: §10 carries goals inside the
 * dossier snapshot only, which would make them unreadable and uneditable in the Dossier UI that
 * §5.3 requires. One row per applicant (see docs/phase-1.md).
 */
export const goals = pgTable("goals", {
  ...baseColumns(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  shortTerm: text("short_term"),
  longTerm: text("long_term"),
  planB: text("plan_b"),
  whyMba: text("why_mba"),
  whyNow: text("why_now"),
});
