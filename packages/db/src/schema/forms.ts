// The Form Advisor, the Résumé Pass and the consistency check (spec §5.10), Phase 5.
//
// §10 names no tables for these, so Phase 5 adds three (see docs/phase-5.md):
// - `form_advice`: one row per kit, the Form Advisor's output plus the applicant's own edits to
//   the entries. Refreshing replaces the advice and bumps `version`; the edits stay.
// - `resume_reviews`: one row per uploaded résumé (a `sources` row), shared by every kit — the
//   Résumé Pass is per applicant, not per school (Phase 5 decision). Holds the decision per bullet.
// - `consistency_dismissals`: findings the applicant marked "these are different things". The
//   check itself is pure code and is recomputed on read, so nothing else is stored.
//
// Like the kit tables, each carries `user_id` so every read and write is scoped by owner.

import type { BulletDecision, FormAdvice, ResumeReview } from "@admitstory/shared/kit";
import { boolean, index, integer, jsonb, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { kits } from "./applications";
import { users } from "./auth";
import { baseColumns } from "./columns";
import { sources } from "./studio";

const owner = () =>
  uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" });

/** The applicant's own text for an entry, keyed "section_key/item_id". Theirs, never overwritten. */
export type FormEdits = Record<string, string>;

export const formAdvice = pgTable(
  "form_advice",
  {
    ...baseColumns(),
    userId: owner(),
    kitId: uuid("kit_id")
      .notNull()
      .references(() => kits.id, { onDelete: "cascade" }),
    /** `draft` writes entries; `coach` doesn't (the school's essay authorship mode, §14.2). */
    mode: text("mode").$type<"draft" | "coach">().notNull(),
    content: jsonb("content").$type<FormAdvice>().notNull(),
    edits: jsonb("edits").$type<FormEdits>().notNull().default({}),
    /** Entries the app shortened to fit the portal's count, keyed like `edits`. */
    trimmed: text("trimmed").array().notNull().default([]),
    dossierSnapshotVersion: integer("dossier_snapshot_version").notNull(),
    packVersion: integer("pack_version").notNull(),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    unique("form_advice_kit_unique").on(t.kitId),
    index("form_advice_user_id_idx").on(t.userId),
  ],
);

export const resumeReviews = pgTable(
  "resume_reviews",
  {
    ...baseColumns(),
    userId: owner(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    content: jsonb("content").$type<ResumeReview>().notNull(),
    decisions: jsonb("decisions").$type<Record<string, BulletDecision>>().notNull().default({}),
    useSuggestedOrder: boolean("use_suggested_order").notNull().default(true),
    dossierSnapshotVersion: integer("dossier_snapshot_version").notNull(),
  },
  (t) => [
    unique("resume_reviews_source_unique").on(t.sourceId),
    index("resume_reviews_user_id_idx").on(t.userId),
  ],
);

export const consistencyDismissals = pgTable(
  "consistency_dismissals",
  {
    ...baseColumns(),
    userId: owner(),
    /** The finding's stable fingerprint (`ConsistencyFinding.id`). */
    findingId: text("finding_id").notNull(),
  },
  (t) => [unique("consistency_dismissals_user_finding_unique").on(t.userId, t.findingId)],
);

export type FormAdviceRow = typeof formAdvice.$inferSelect;
export type ResumeReviewRow = typeof resumeReviews.$inferSelect;
