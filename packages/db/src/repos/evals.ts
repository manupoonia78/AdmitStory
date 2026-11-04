// The evaluation harness's records (spec §8.11, §9.4): runs, their synthetic samples, approvals of
// a cost rise, and the weekly human ratings. The rating queue mixes synthetic samples with drafts
// of applicants who switched on "Help improve AdmitStories"; nobody else's draft is ever queued.

import {
  AUDIT_ACTIONS,
  type EvalGateResult,
  type EvalMetrics,
  type EvalMode,
  type EvalReason,
  type EvalStatus,
  type NewEvalSample,
  type RatingQueueItem,
} from "@admitstory/shared";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { DbExecutor } from "../client";
import { deliverables, drafts, evalRatings, evalRuns, evalSamples, profiles } from "../schema";
import { adminDb, assertAdminContext, audited, type AdminContext } from "./admin";
import { assertId } from "./ids";

export type EvalRunRow = typeof evalRuns.$inferSelect;
export type EvalSampleRow = typeof evalSamples.$inferSelect;

export async function createEvalRun(
  ctx: AdminContext,
  input: {
    reason: EvalReason;
    mode: EvalMode;
    promptVersionId?: string | null;
    canonDocId?: string | null;
    fingerprint: string;
    triggeredBy?: string | null;
  },
): Promise<EvalRunRow> {
  const db = adminDb(ctx);
  const [row] = await db
    .insert(evalRuns)
    .values({
      reason: input.reason,
      mode: input.mode,
      status: "running",
      promptVersionId: input.promptVersionId ?? null,
      canonDocId: input.canonDocId ?? null,
      fingerprint: input.fingerprint.slice(0, 200),
      triggeredBy: input.triggeredBy ?? null,
      startedAt: new Date(),
    })
    .returning();
  if (!row) throw new Error("Failed to create the eval run");
  return row;
}

export async function finishEvalRun(
  ctx: AdminContext,
  id: string,
  result: {
    status: EvalStatus;
    metrics?: EvalMetrics | null;
    gate?: EvalGateResult | null;
    costUsd?: number;
    error?: string | null;
  },
): Promise<EvalRunRow> {
  const db = adminDb(ctx);
  const [row] = await db
    .update(evalRuns)
    .set({
      status: result.status,
      metrics: result.metrics ?? null,
      gate: result.gate ?? null,
      costUsd: result.costUsd ?? 0,
      error: result.error ? result.error.slice(0, 2000) : null,
      finishedAt: new Date(),
    })
    .where(eq(evalRuns.id, assertId(id, "runId")))
    .returning();
  if (!row) throw new Error("Eval run not found");
  return row;
}

export async function addEvalSamples(
  ctx: AdminContext,
  runId: string,
  samples: readonly NewEvalSample[],
): Promise<void> {
  const db = adminDb(ctx);
  if (samples.length === 0) return;
  const id = assertId(runId, "runId");
  await db.insert(evalSamples).values(
    samples.map((s) => ({
      runId: id,
      task: s.task,
      fixture: s.fixture,
      output: s.output,
      judgement: s.judgement,
      invented: s.invented,
      mustFix: s.mustFix,
      costUsd: s.costUsd,
      latencyMs: s.latencyMs,
      passed: s.passed,
    })),
  );
}

export async function listEvalRuns(
  admin: AdminContext,
  opts: { limit?: number } = {},
): Promise<EvalRunRow[]> {
  return adminDb(admin)
    .select()
    .from(evalRuns)
    .orderBy(desc(evalRuns.createdAt))
    .limit(Math.min(Math.max(opts.limit ?? 50, 1), 200));
}

export async function getEvalRun(
  admin: AdminContext,
  id: string,
): Promise<{ run: EvalRunRow; samples: EvalSampleRow[] } | null> {
  const db = adminDb(admin);
  const runId = assertId(id, "runId");
  const [run] = await db.select().from(evalRuns).where(eq(evalRuns.id, runId)).limit(1);
  if (!run) return null;
  const samples = await db
    .select()
    .from(evalSamples)
    .where(eq(evalSamples.runId, runId))
    .orderBy(evalSamples.task, evalSamples.fixture);
  return { run, samples };
}

/** The newest passing (or approved) live run for a prompt version. */
export async function passingRunFor(
  db: DbExecutor,
  promptVersionId: string,
): Promise<EvalRunRow | null> {
  const [row] = await db
    .select()
    .from(evalRuns)
    .where(
      and(
        eq(evalRuns.promptVersionId, assertId(promptVersionId, "promptVersionId")),
        eq(evalRuns.mode, "live"),
        sql`(${evalRuns.status} = 'passed' or ${evalRuns.approvedBy} is not null)`,
      ),
    )
    .orderBy(desc(evalRuns.createdAt))
    .limit(1);
  return row ?? null;
}

export async function approveEvalRun(
  admin: AdminContext,
  id: string,
  reason: string,
): Promise<EvalRunRow | null> {
  const runId = assertId(id, "runId");
  const why = z.string().trim().min(3).max(300).parse(reason);
  return audited(
    admin,
    (row: EvalRunRow | null) =>
      row
        ? {
            action: AUDIT_ACTIONS.evalApprove,
            targetType: "eval_runs",
            targetId: runId,
            reason: why,
          }
        : null,
    async (db) => {
      const [row] = await db
        .update(evalRuns)
        .set({ approvedBy: admin.actorId, approvedReason: why })
        .where(eq(evalRuns.id, runId))
        .returning();
      return row ?? null;
    },
  );
}

/** ISO week label, e.g. `2026-W45`. */
export function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function sampleText(output: unknown): string {
  if (typeof output === "string") return output;
  if (output && typeof output === "object") {
    const record = output as Record<string, unknown>;
    for (const key of ["plain_text", "plainText", "text", "draft"])
      if (typeof record[key] === "string") return record[key];
  }
  return JSON.stringify(output, null, 2) ?? "";
}

/**
 * Ten items for the week (§8.11): newest synthetic samples first, then current drafts of opted-in
 * applicants. A stable order within the week, so the queue doesn't shuffle between visits.
 */
export async function ratingQueue(
  admin: AdminContext,
  week: string,
  size = 10,
): Promise<RatingQueueItem[]> {
  const db = adminDb(admin);
  const raterId = admin.actorId;
  const sampleRows = await db
    .select({
      id: evalSamples.id,
      task: evalSamples.task,
      fixture: evalSamples.fixture,
      output: evalSamples.output,
    })
    .from(evalSamples)
    .orderBy(desc(evalSamples.createdAt), evalSamples.id)
    .limit(size);
  const draftRows =
    sampleRows.length >= size
      ? []
      : await db
          .select({
            id: drafts.id,
            label: sql<string>`coalesce(${deliverables.title}, ${deliverables.packKey})`,
            text: drafts.plainText,
          })
          .from(drafts)
          .innerJoin(deliverables, eq(deliverables.id, drafts.deliverableId))
          .innerJoin(profiles, eq(profiles.userId, drafts.userId))
          .where(and(eq(drafts.isCurrent, true), eq(profiles.improveProductOptIn, true)))
          // Same seed all week: a different but stable slice of drafts each week.
          .orderBy(sql`md5(${drafts.id}::text || ${week})`)
          .limit(size - sampleRows.length);

  const ratedRows =
    raterId === null
      ? []
      : await db
          .select({ sample: evalRatings.evalSampleId, draft: evalRatings.draftId })
          .from(evalRatings)
          .where(and(eq(evalRatings.raterId, raterId), eq(evalRatings.week, week)));
  const rated = new Set(ratedRows.flatMap((r) => [r.sample, r.draft]).filter(Boolean));
  return [
    ...sampleRows.map((row) => ({
      kind: "eval_sample" as const,
      id: row.id,
      task: row.task,
      label: `${row.task} · ${row.fixture}`,
      text: sampleText(row.output),
      rated: rated.has(row.id),
    })),
    ...draftRows.map((row) => ({
      kind: "draft" as const,
      id: row.id,
      task: "kit.draft",
      label: `Applicant draft · ${row.label}`,
      text: row.text,
      rated: rated.has(row.id),
    })),
  ];
}

export async function saveRating(
  admin: AdminContext,
  input: {
    kind: "eval_sample" | "draft";
    id: string;
    score: number;
    tags?: string[];
    note?: string;
    week: string;
  },
): Promise<void> {
  assertAdminContext(admin);
  const id = assertId(input.id, "id");
  const score = z.int().min(1).max(5).parse(input.score);
  await audited(
    admin,
    { action: AUDIT_ACTIONS.evalRating, targetType: input.kind, targetId: id, meta: { score } },
    async (db) => {
      let ownerId: string | null = null;
      if (input.kind === "draft") {
        // Only an opted-in applicant's draft may be rated.
        const [row] = await db
          .select({ userId: drafts.userId })
          .from(drafts)
          .innerJoin(profiles, eq(profiles.userId, drafts.userId))
          .where(and(eq(drafts.id, id), eq(profiles.improveProductOptIn, true)))
          .limit(1);
        if (!row)
          throw new z.ZodError([
            { code: "custom", path: ["id"], message: "That draft can't be rated", input: id },
          ]);
        ownerId = row.userId;
      }
      const values = {
        raterId: admin.actorId,
        sampleKind: input.kind,
        evalSampleId: input.kind === "eval_sample" ? id : null,
        draftId: input.kind === "draft" ? id : null,
        userId: ownerId,
        score,
        tags: input.tags ?? [],
        note: input.note ?? null,
        week: input.week,
      };
      await db
        .insert(evalRatings)
        .values(values)
        .onConflictDoUpdate({
          target:
            input.kind === "eval_sample"
              ? [evalRatings.raterId, evalRatings.evalSampleId]
              : [evalRatings.raterId, evalRatings.draftId],
          set: {
            score,
            tags: values.tags,
            note: values.note,
            week: input.week,
            updatedAt: new Date(),
          },
        });
    },
  );
}

/** Ratings saved this week, for the queue's progress line. */
export async function ratingsThisWeek(admin: AdminContext, week: string): Promise<number> {
  const [row] = await adminDb(admin)
    .select({ n: sql<number>`count(*)::int` })
    .from(evalRatings)
    .where(eq(evalRatings.week, week));
  return row?.n ?? 0;
}
