// Phase 9b operations tables (spec §5.18, §8.11, §12.4, §14.4): kill switches, task route
// overrides, admin alerts, evaluation runs and ratings, break-glass grants and account deletions.
// None of them holds applicant content, so nothing here is encrypted: eval samples are synthetic
// fixture outputs only, and an account deletion keeps a hash of the email, never the address.

import type {
  AlertKind,
  AlertSeverity,
  EvalGateResult,
  EvalJudgement,
  EvalMetrics,
  EvalMode,
  EvalReason,
  EvalStatus,
  FeatureKey,
} from "@admitstory/shared";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { baseColumns } from "./columns";
import { drafts } from "./kits";
import { canonDocs, promptVersions } from "./schools";

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

/** A missing row means "on": only switches someone has touched are stored. */
export const featureSwitches = pgTable(
  "feature_switches",
  {
    ...baseColumns(),
    key: text("key").$type<FeatureKey>().notNull(),
    enabled: boolean("enabled").notNull().default(true),
    /** Overrides the switch's default user line while paused (≤ 200 chars). */
    message: text("message"),
    reason: text("reason"),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [unique("feature_switches_key_unique").on(t.key)],
);

/** Task-level route overrides (§8.3 "routing is data"), laid over the routing table at run time. */
export const routeOverrides = pgTable(
  "route_overrides",
  {
    ...baseColumns(),
    task: text("task").notNull(),
    override: jsonb("override").$type<Record<string, unknown>>().notNull(),
    reason: text("reason").notNull(),
    setBy: uuid("set_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [unique("route_overrides_task_unique").on(t.task)],
);

/** One row per alert key; a repeat bumps `count` and `last_at` instead of adding a row. */
export const adminAlerts = pgTable(
  "admin_alerts",
  {
    ...baseColumns(),
    kind: text("kind").$type<AlertKind>().notNull(),
    dedupeKey: text("dedupe_key").notNull(),
    severity: text("severity").$type<AlertSeverity>().notNull(),
    title: text("title").notNull(),
    detail: jsonb("detail").$type<Record<string, unknown>>().notNull().default({}),
    firstAt: timestamptz("first_at").notNull().defaultNow(),
    lastAt: timestamptz("last_at").notNull().defaultNow(),
    count: integer("count").notNull().default(1),
    emailedAt: timestamptz("emailed_at"),
    acknowledgedAt: timestamptz("acknowledged_at"),
    acknowledgedBy: uuid("acknowledged_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    unique("admin_alerts_dedupe_key_unique").on(t.dedupeKey),
    index("admin_alerts_open_idx").on(t.acknowledgedAt, t.lastAt),
  ],
);

export const evalRuns = pgTable(
  "eval_runs",
  {
    ...baseColumns(),
    reason: text("reason").$type<EvalReason>().notNull(),
    mode: text("mode").$type<EvalMode>().notNull(),
    status: text("status").$type<EvalStatus>().notNull().default("queued"),
    promptVersionId: uuid("prompt_version_id").references(() => promptVersions.id, {
      onDelete: "set null",
    }),
    canonDocId: uuid("canon_doc_id").references(() => canonDocs.id, { onDelete: "set null" }),
    /** What was evaluated, e.g. `kit.draft@v3` or `canon:truth-discipline@v2`. */
    fingerprint: text("fingerprint").notNull(),
    metrics: jsonb("metrics").$type<EvalMetrics>(),
    gate: jsonb("gate").$type<EvalGateResult>(),
    costUsd: numeric("cost_usd", { precision: 10, scale: 5, mode: "number" }).notNull().default(0),
    approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
    approvedReason: text("approved_reason"),
    triggeredBy: uuid("triggered_by").references(() => users.id, { onDelete: "set null" }),
    startedAt: timestamptz("started_at"),
    finishedAt: timestamptz("finished_at"),
    error: text("error"),
  },
  (t) => [
    index("eval_runs_created_at_idx").on(t.createdAt),
    index("eval_runs_prompt_version_idx").on(t.promptVersionId),
  ],
);

/** Synthetic fixture outputs only, never applicant content. */
export const evalSamples = pgTable(
  "eval_samples",
  {
    ...baseColumns(),
    runId: uuid("run_id")
      .notNull()
      .references(() => evalRuns.id, { onDelete: "cascade" }),
    task: text("task").notNull(),
    fixture: text("fixture").notNull(),
    output: jsonb("output").$type<unknown>(),
    judgement: jsonb("judgement").$type<EvalJudgement>(),
    invented: jsonb("invented").$type<{ text: string; why: string }[]>().notNull().default([]),
    mustFix: integer("must_fix").notNull().default(0),
    costUsd: numeric("cost_usd", { precision: 10, scale: 5, mode: "number" }).notNull().default(0),
    latencyMs: integer("latency_ms"),
    passed: boolean("passed").notNull(),
  },
  (t) => [index("eval_samples_run_id_idx").on(t.runId)],
);

/** §8.11's weekly human ratings: synthetic samples, or drafts of applicants who opted in. */
export const evalRatings = pgTable(
  "eval_ratings",
  {
    ...baseColumns(),
    raterId: uuid("rater_id").references(() => users.id, { onDelete: "set null" }),
    sampleKind: text("sample_kind").$type<"eval_sample" | "draft">().notNull(),
    evalSampleId: uuid("eval_sample_id").references(() => evalSamples.id, { onDelete: "cascade" }),
    draftId: uuid("draft_id").references(() => drafts.id, { onDelete: "cascade" }),
    /** Owner of a rated draft, so deleting the account removes the rating. */
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    tags: text("tags").array().notNull().default([]),
    note: text("note"),
    /** ISO week, e.g. `2026-W45`. */
    week: text("week").notNull(),
  },
  (t) => [
    index("eval_ratings_week_idx").on(t.week),
    unique("eval_ratings_rater_sample_unique").on(t.raterId, t.evalSampleId),
    unique("eval_ratings_rater_draft_unique").on(t.raterId, t.draftId),
  ],
);

/** §14.4: content access is a 30-minute, reasoned, audited grant the user can see. */
export const breakGlassGrants = pgTable(
  "break_glass_grants",
  {
    ...baseColumns(),
    adminId: uuid("admin_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    expiresAt: timestamptz("expires_at").notNull(),
    revokedAt: timestamptz("revoked_at"),
  },
  (t) => [index("break_glass_grants_user_idx").on(t.userId, t.expiresAt)],
);

/** No FK on user_id: the user row is what gets deleted. */
export const accountDeletions = pgTable(
  "account_deletions",
  {
    ...baseColumns(),
    userId: uuid("user_id").notNull(),
    emailHash: text("email_hash").notNull(),
    status: text("status").$type<"pending" | "done" | "failed">().notNull().default("pending"),
    requestedBy: text("requested_by").$type<"user" | "admin">().notNull(),
    reason: text("reason"),
    /** Provider payment ids, kept for refund and chargeback reconciliation. */
    providerTxnIds: text("provider_txn_ids").array().notNull().default([]),
    requestedAt: timestamptz("requested_at").notNull().defaultNow(),
    completedAt: timestamptz("completed_at"),
    error: text("error"),
  },
  (t) => [
    index("account_deletions_user_idx").on(t.userId),
    index("account_deletions_status_idx").on(t.status),
  ],
);
