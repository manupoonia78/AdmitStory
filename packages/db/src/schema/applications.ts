// Applications and kits (spec §10), Phase 3 subset: the applicant's school list, "Pack coming
// soon" votes, Profile Reads and the kit row that holds a free preview. Every table is user-owned
// (`user_id` with an index) and reached only through ownership-checked repositories. `kits` carries
// its own `user_id`, which §10 leaves implicit through `user_schools`, so every kit query can be
// scoped without a join. Phase 4's kit tables (stages, deliverables, drafts…) are in ./kits.ts.

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
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { baseColumns } from "./columns";
import { schoolCycles, schools } from "./schools";
import { sources } from "./studio";

export const userSchoolStatuses = [
  "considering",
  "preview",
  "unlocked",
  "submitted",
  "interview",
  "admitted",
  "waitlisted",
  "denied",
  "withdrawn",
] as const;
export const userSchoolStatusEnum = pgEnum("user_school_status", userSchoolStatuses);
export type UserSchoolStatus = (typeof userSchoolStatuses)[number];

export const kitStatuses = ["preview", "pending", "running", "ready", "failed"] as const;
export const kitStatusEnum = pgEnum("kit_status", kitStatuses);
export type KitStatus = (typeof kitStatuses)[number];

/** Pipeline progress summary on the kit row (§5.7); per-stage outputs live in `kit_stages`. */
export interface KitProgress {
  /** The stage most recently started or finished. */
  stage: string;
  ordinal: number;
  status: string;
  done: number;
  total: number;
}

/** Computed School Strategy fit (§5.5). Shape owned by the strategy code in apps/web. */
export type UserSchoolFit = Record<string, unknown>;

export const userSchools = pgTable(
  "user_schools",
  {
    ...baseColumns(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // No cascade: a cycle with applicants is archived, never deleted.
    schoolCycleId: uuid("school_cycle_id")
      .notNull()
      .references(() => schoolCycles.id),
    /** Round name from the cycle's rounds, e.g. "R1". */
    round: text("round"),
    status: userSchoolStatusEnum("status").notNull().default("considering"),
    isReapplicant: boolean("is_reapplicant").notNull().default(false),
    previousOutcome: text("previous_outcome"),
    previousMaterialsSourceId: uuid("previous_materials_source_id").references(() => sources.id, {
      onDelete: "set null",
    }),
    fit: jsonb("fit").$type<UserSchoolFit>(),
    /** The published pack version `fit` was computed against; stale when the pack moves on. */
    fitPackVersion: integer("fit_pack_version"),
  },
  // Leading user_id column makes this the §10 user_id index as well.
  (t) => [unique("user_schools_user_cycle_unique").on(t.userId, t.schoolCycleId)],
);

/** Demand signal for schools without a published pack (§9.5, §5.5). */
export const schoolInterestVotes = pgTable(
  "school_interest_votes",
  {
    ...baseColumns(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
  },
  (t) => [
    unique("school_interest_votes_user_school_unique").on(t.userId, t.schoolId),
    index("school_interest_votes_school_idx").on(t.schoolId),
  ],
);

/** Profile Read output (§5.4); validated by packages/ai before it is stored. */
export type ProfileReadContent = Record<string, unknown>;

export const profileReads = pgTable(
  "profile_reads",
  {
    ...baseColumns(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    content: jsonb("content").$type<ProfileReadContent>().notNull(),
    /** The dossier snapshot it read; a newer snapshot makes it eligible to regenerate. */
    builtFromSnapshotVersion: integer("built_from_snapshot_version"),
    model: text("model"),
  },
  (t) => [unique("profile_reads_user_version_unique").on(t.userId, t.version)],
);

export const kits = pgTable(
  "kits",
  {
    ...baseColumns(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userSchoolId: uuid("user_school_id")
      .notNull()
      .references(() => userSchools.id, { onDelete: "cascade" }),
    status: kitStatusEnum("status").notNull().default("preview"),
    // Validated by packages/ai (Appendix I) before they are stored.
    positioning: jsonb("positioning").$type<Record<string, unknown>>(),
    fileMap: jsonb("file_map").$type<Record<string, unknown>>(),
    gaps: jsonb("gaps").$type<unknown[]>(),
    /** Inngest run id once the full pipeline starts (Phase 4). */
    pipelineRunId: text("pipeline_run_id"),
    costUsd: numeric("cost_usd", { precision: 10, scale: 5, mode: "number" }).notNull().default(0),
    /** A preview is reused on unlock only while the snapshot version is unchanged. */
    dossierSnapshotVersion: integer("dossier_snapshot_version"),
    packVersion: integer("pack_version"),
    // Phase 4: the full pipeline.
    stage: jsonb("stage").$type<KitProgress>(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    /** Whole-kit regenerations used (§5.6 allows one). */
    regenerations: integer("regenerations").notNull().default(0),
    /** Last pipeline failure, for the retry and the admin alert; never shown verbatim to users. */
    error: text("error"),
  },
  (t) => [
    index("kits_user_id_idx").on(t.userId),
    index("kits_user_school_idx").on(t.userSchoolId),
    // One free preview per school on the applicant's list (§5.5).
    uniqueIndex("kits_one_preview_per_user_school")
      .on(t.userSchoolId)
      .where(sql`status = 'preview'`),
    // One full kit per school: unlocking upgrades the preview row in place.
    uniqueIndex("kits_one_full_per_user_school")
      .on(t.userSchoolId)
      .where(sql`status <> 'preview'`),
  ],
);
