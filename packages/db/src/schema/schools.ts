// Schools and knowledge (spec §9, §10), the admin registries (§5.18) and the audit log.
//
// None of this is user-owned: schools, packs and the knowledge base are written only through the
// admin repositories in src/repos (which demand an AdminContext and write `audit_log`), and read by
// users only once published. The one exception to "in the clear" is `kb_sources.text_encrypted`:
// uploaded documents' text is encrypted at rest like the applicant's (§14.4). Chunks hold the text
// in the clear because full-text search has to index it.

import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
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
  vector,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { baseColumns } from "./columns";

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

/** Postgres full-text vector. Drizzle has no builder for it; it is only ever generated. */
const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

/** Voyage `voyage-3.5-lite` output size (packages/ai routing). Changing it needs a migration. */
export const EMBEDDING_DIMENSIONS = 1024;

/* Enums -------------------------------------------------------------------------------------- */

export const schoolRegions = ["us", "europe", "asia_other"] as const;
export const schoolRegionEnum = pgEnum("school_region", schoolRegions);
export type SchoolRegion = (typeof schoolRegions)[number];

export const cycleStatuses = ["draft", "live", "archived"] as const;
export const cycleStatusEnum = pgEnum("cycle_status", cycleStatuses);
export type CycleStatus = (typeof cycleStatuses)[number];

export const packStatuses = ["draft", "published"] as const;
export const packStatusEnum = pgEnum("pack_status", packStatuses);
export type PackStatus = (typeof packStatuses)[number];

/** Spec §9.1. Shared with packages/kb's `KbSourceType`; keep both in sync. */
export const kbSourceTypes = [
  "official",
  "adcom",
  "insider",
  "interview_reports",
  "coach_notes",
  "third_party_reference",
  "press",
] as const;
export const kbSourceTypeEnum = pgEnum("kb_source_type", kbSourceTypes);
export type KbSourceTypeValue = (typeof kbSourceTypes)[number];

/** The §9.3 ingestion stages a source moves through, then `ready` or `failed`. */
export const kbSourceStatuses = [
  "pending",
  "extracting",
  "embedding",
  "normalizing",
  "ready",
  "failed",
] as const;
export const kbSourceStatusEnum = pgEnum("kb_source_status", kbSourceStatuses);
export type KbSourceStatus = (typeof kbSourceStatuses)[number];

export const proposalStatuses = ["pending", "accepted", "rejected", "edited"] as const;
export const proposalStatusEnum = pgEnum("kb_proposal_status", proposalStatuses);
export type ProposalStatus = (typeof proposalStatuses)[number];

/** Spec §9.2 `ai_policy.stance` and §14.2. */
export const aiStances = [
  "permitted",
  "permitted_with_disclosure",
  "limited",
  "prohibited",
  "unknown",
] as const;
export const aiStanceEnum = pgEnum("ai_stance", aiStances);
export type AiStance = (typeof aiStances)[number];

/* Schools and cycles ------------------------------------------------------------------------- */

export const schools = pgTable("schools", {
  ...baseColumns(),
  /** Stable URL id, e.g. `uva-darden`. Seed rows are matched on it. */
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  /** ISO 3166-1 alpha-2, upper case. */
  country: text("country"),
  city: text("city"),
  website: text("website"),
  logoKey: text("logo_key"),
  region: schoolRegionEnum("region").notNull(),
});

export interface CycleRound {
  name: string;
  /** ISO date. */
  deadline: string | null;
  decisionDate?: string | null;
  interviewInvitesWindow?: string | null;
  notes?: string | null;
}

export const schoolCycles = pgTable(
  "school_cycles",
  {
    ...baseColumns(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    /** e.g. "2026-27". */
    cycle: text("cycle").notNull(),
    status: cycleStatusEnum("status").notNull().default("draft"),
    rounds: jsonb("rounds").$type<CycleRound[]>().notNull().default([]),
  },
  (t) => [unique("school_cycles_school_cycle_unique").on(t.schoolId, t.cycle)],
);

/**
 * The SchoolPack JSON (§9.2). Its Zod schema lives in packages/kb; the database stores whatever that
 * schema accepted and never interprets it.
 */
export type SchoolPackData = Record<string, unknown>;

export const schoolPacks = pgTable(
  "school_packs",
  {
    ...baseColumns(),
    cycleId: uuid("cycle_id")
      .notNull()
      .references(() => schoolCycles.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    status: packStatusEnum("status").notNull().default("draft"),
    data: jsonb("data").$type<SchoolPackData>().notNull(),
    /** The L1 markdown, compiled by code on publish (§9.2). Null while a draft. */
    compiledPrompt: text("compiled_prompt"),
    tokenCount: integer("token_count"),
    publishedAt: timestamptz("published_at"),
    publishedBy: uuid("published_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    unique("school_packs_cycle_version_unique").on(t.cycleId, t.version),
    // One working draft per cycle; published versions accumulate.
    uniqueIndex("school_packs_one_draft_per_cycle")
      .on(t.cycleId)
      .where(sql`status = 'draft'`),
    index("school_packs_cycle_status_idx").on(t.cycleId, t.status, t.version),
  ],
);

/* Knowledge base ----------------------------------------------------------------------------- */

export const kbSources = pgTable(
  "kb_sources",
  {
    ...baseColumns(),
    /** Null for knowledge that applies to every school (rare; the canon lives in files). */
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }),
    /** Null when the source is not tied to one cycle (evergreen). */
    cycle: text("cycle"),
    type: kbSourceTypeEnum("type").notNull(),
    title: text("title").notNull(),
    url: text("url"),
    fileKey: text("file_key"),
    /** 1–5 (§9.1); defaults by type, the admin may override. */
    trust: integer("trust").notNull(),
    /** Where it came from and what we may do with it (§9.6). */
    rightsNote: text("rights_note"),
    addedBy: uuid("added_by").references(() => users.id, { onDelete: "set null" }),
    /** AES-256-GCM envelope (src/crypto/content.ts) of the extracted text. */
    textEncrypted: text("text_encrypted"),
    /** sha256 of the extracted text, to spot the same document added twice. */
    contentHash: text("content_hash"),
    /** When the content was last checked against its origin; shown as "verified on" (§9.3). */
    verifiedAt: timestamptz("verified_at"),
    status: kbSourceStatusEnum("status").notNull().default("pending"),
    error: text("error"),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
  },
  (t) => [
    index("kb_sources_school_cycle_idx").on(t.schoolId, t.cycle),
    index("kb_sources_content_hash_idx").on(t.contentHash),
  ],
);

export const kbChunks = pgTable(
  "kb_chunks",
  {
    ...baseColumns(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => kbSources.id, { onDelete: "cascade" }),
    // Copied from the source so retrieval filters without a join on the hot path.
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }),
    cycle: text("cycle"),
    /** Position within the source. */
    ord: integer("ord").notNull(),
    text: text("text").notNull(),
    /** Null until embedded. */
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
    tsv: tsvector("tsv").generatedAlwaysAs(sql`to_tsvector('english'::regconfig, "text")`),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
  },
  (t) => [
    unique("kb_chunks_source_ord_unique").on(t.sourceId, t.ord),
    index("kb_chunks_school_cycle_idx").on(t.schoolId, t.cycle),
    index("kb_chunks_embedding_hnsw_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
    index("kb_chunks_tsv_gin_idx").using("gin", t.tsv),
  ],
);

/** Where in the source a proposal came from (§9.3 "with source spans"). */
export interface ProposalEvidence {
  quote?: string;
  start?: number;
  end?: number;
  chunkId?: string;
}

/** Two sources disagree about a field (§9.3 "Conflicts"). */
export interface ProposalConflict {
  values: { value: unknown; sourceId: string | null; trust: number | null }[];
  note?: string;
}

export const kbProposals = pgTable(
  "kb_proposals",
  {
    ...baseColumns(),
    /** Null for a refresh-checker task that is not tied to an ingested source. */
    sourceId: uuid("source_id").references(() => kbSources.id, { onDelete: "cascade" }),
    cycleId: uuid("cycle_id")
      .notNull()
      .references(() => schoolCycles.id, { onDelete: "cascade" }),
    /** The draft pack the proposal was made against, when there was one. */
    packId: uuid("pack_id").references(() => schoolPacks.id, { onDelete: "set null" }),
    /** Dot/bracket path into SchoolPack, e.g. `application.essays[goals].limit.value`. */
    fieldPath: text("field_path").notNull(),
    proposed: jsonb("proposed").$type<unknown>().notNull(),
    current: jsonb("current").$type<unknown>(),
    /** 0–1. */
    confidence: numeric("confidence", { precision: 4, scale: 3, mode: "number" }).notNull(),
    evidence: jsonb("evidence").$type<ProposalEvidence[]>(),
    status: proposalStatusEnum("status").notNull().default("pending"),
    /** The admin's version, when status is `edited`. */
    edited: jsonb("edited").$type<unknown>(),
    conflict: jsonb("conflict").$type<ProposalConflict>(),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamptz("reviewed_at"),
  },
  (t) => [
    index("kb_proposals_cycle_status_idx").on(t.cycleId, t.status),
    index("kb_proposals_source_idx").on(t.sourceId),
  ],
);

/** Last fetched hash per official URL, for `kb.refresh_check` (§9.3). One row per fetch. */
export const kbRefreshSnapshots = pgTable(
  "kb_refresh_snapshots",
  {
    ...baseColumns(),
    schoolCycleId: uuid("school_cycle_id")
      .notNull()
      .references(() => schoolCycles.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    contentHash: text("content_hash").notNull(),
    fetchedAt: timestamptz("fetched_at").notNull().defaultNow(),
  },
  (t) => [index("kb_refresh_snapshots_cycle_url_idx").on(t.schoolCycleId, t.url, t.fetchedAt)],
);

/* Canon, prompts, AI policies ---------------------------------------------------------------- */

export const canonDocs = pgTable(
  "canon_docs",
  {
    ...baseColumns(),
    /** File name without extension, e.g. `story-craft`. */
    slug: text("slug").notNull(),
    version: integer("version").notNull(),
    content: text("content").notNull(),
    ruleIds: text("rule_ids")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    publishedAt: timestamptz("published_at"),
    publishedBy: uuid("published_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [unique("canon_docs_slug_version_unique").on(t.slug, t.version)],
);

export const promptVersions = pgTable(
  "prompt_versions",
  {
    ...baseColumns(),
    /** The ai.run task name, e.g. `kit.positioning_filemap`. */
    agent: text("agent").notNull(),
    /** e.g. `v3`, as in packages/ai/src/prompts/<agent>/<version>.md. */
    version: text("version").notNull(),
    template: text("template").notNull(),
    /** Overrides the routing table for this version (§8.3), e.g. `{ "model": "sonnet" }`. */
    routeOverride: jsonb("route_override").$type<Record<string, unknown>>(),
    active: boolean("active").notNull().default(false),
    /** Share of traffic among active versions, 0–100. */
    abWeight: integer("ab_weight").notNull().default(0),
  },
  (t) => [
    unique("prompt_versions_agent_version_unique").on(t.agent, t.version),
    index("prompt_versions_agent_active_idx").on(t.agent, t.active),
  ],
);

export const aiPolicies = pgTable("ai_policies", {
  ...baseColumns(),
  schoolCycleId: uuid("school_cycle_id")
    .notNull()
    .unique()
    .references(() => schoolCycles.id, { onDelete: "cascade" }),
  stance: aiStanceEnum("stance").notNull().default("unknown"),
  /** `essays` | `video` | `recommendations` (§9.2). */
  appliesTo: text("applies_to")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  disclosureText: text("disclosure_text"),
  sourceUrl: text("source_url"),
  /** Null means unverified: nothing unverified is shown to applicants. */
  verifiedAt: timestamptz("verified_at"),
  verifiedBy: uuid("verified_by").references(() => users.id, { onDelete: "set null" }),
  /** Admin notes, e.g. where a seed value came from and what to re-check. */
  notes: text("notes"),
});

/* Audit log ---------------------------------------------------------------------------------- */

export const auditLog = pgTable(
  "audit_log",
  {
    ...baseColumns(),
    /** Null for system jobs and CLI scripts; `meta.job` names them. */
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    /** `<table>.<verb>`, e.g. `school_packs.publish`. */
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    reason: text("reason"),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    at: timestamptz("at").notNull().defaultNow(),
  },
  (t) => [
    index("audit_log_target_idx").on(t.targetType, t.targetId),
    index("audit_log_actor_idx").on(t.actorId, t.at),
    index("audit_log_at_idx").on(t.at),
  ],
);
