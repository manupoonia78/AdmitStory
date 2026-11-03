// The full kit (spec §5.7): its lifecycle, the resumable stage rows the pipeline writes, cost, the
// one whole-kit regeneration, and which deliverables use each story (§5.3 "Used in"). Every
// statement is scoped to the owner; the pipeline runs with the userId from its event.

import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import type { DbExecutor } from "../client";
import {
  deliverables,
  drafts,
  kitStageKeys,
  kitStageStatuses,
  kitStages,
  kitStatuses,
  kits,
  schoolCycles,
  schools,
  usageLedger,
  userSchools,
  type KitProgress,
  type KitStageKey,
  type KitStageStatus,
  type KitStatus,
} from "../schema";
import type { Kit } from "./applications";
import { consumeEntitlement } from "./commerce";
import { assertId } from "./ids";

export type KitStage = typeof kitStages.$inferSelect;

export interface KitContext {
  kit: Kit;
  userSchoolId: string;
  schoolCycleId: string;
  cycle: string;
  isReapplicant: boolean;
  school: { id: string; slug: string; name: string; shortName: string };
}

export async function getKit(db: DbExecutor, userId: string, kitId: string): Promise<Kit | null> {
  const [row] = await db
    .select()
    .from(kits)
    .where(and(eq(kits.userId, assertId(userId, "userId")), eq(kits.id, assertId(kitId, "kitId"))))
    .limit(1);
  return row ?? null;
}

/** The kit with the school and cycle it belongs to, for the pipeline and the Workspace header. */
export async function getKitContext(
  db: DbExecutor,
  userId: string,
  kitId: string,
): Promise<KitContext | null> {
  const [row] = await db
    .select({
      kit: kits,
      userSchoolId: userSchools.id,
      schoolCycleId: schoolCycles.id,
      cycle: schoolCycles.cycle,
      isReapplicant: userSchools.isReapplicant,
      school: {
        id: schools.id,
        slug: schools.slug,
        name: schools.name,
        shortName: schools.shortName,
      },
    })
    .from(kits)
    .innerJoin(userSchools, eq(userSchools.id, kits.userSchoolId))
    .innerJoin(schoolCycles, eq(schoolCycles.id, userSchools.schoolCycleId))
    .innerJoin(schools, eq(schools.id, schoolCycles.schoolId))
    .where(and(eq(kits.userId, assertId(userId, "userId")), eq(kits.id, assertId(kitId, "kitId"))))
    .limit(1);
  return row ?? null;
}

const FullKitStatus = z.enum(
  kitStatuses.filter((s) => s !== "preview") as [KitStatus, ...KitStatus[]],
);

/**
 * Moves a full kit through pending → running → ready | failed. `running` stamps `started_at` once;
 * `ready` and `failed` stamp `finished_at`; `pending` (a retry) clears the finish and the error.
 * A preview cannot be moved here: unlocking goes through checkout.
 */
export async function setKitStatus(
  db: DbExecutor,
  userId: string,
  kitId: string,
  status: Exclude<KitStatus, "preview">,
  extra: { error?: string | null; pipelineRunId?: string | null } = {},
): Promise<Kit | null> {
  const next = FullKitStatus.parse(status);
  const stamps =
    next === "running"
      ? { startedAt: sql`coalesce(${kits.startedAt}, now())`, finishedAt: null }
      : next === "pending"
        ? { finishedAt: null, error: null }
        : { finishedAt: sql`now()` };
  const [row] = await db
    .update(kits)
    .set({
      status: next,
      ...stamps,
      ...(extra.error !== undefined ? { error: extra.error } : {}),
      ...(extra.pipelineRunId !== undefined ? { pipelineRunId: extra.pipelineRunId } : {}),
    })
    .where(
      and(
        eq(kits.userId, assertId(userId, "userId")),
        eq(kits.id, assertId(kitId, "kitId")),
        ne(kits.status, "preview"),
      ),
    )
    .returning();
  return row ?? null;
}

export const KitOutputs = z
  .strictObject({
    positioning: z.record(z.string(), z.unknown()),
    fileMap: z.record(z.string(), z.unknown()),
    gaps: z.array(z.unknown()).nullable(),
    dossierSnapshotVersion: z.int().positive().nullable(),
    packVersion: z.int().positive().nullable(),
  })
  .partial();
export type KitOutputs = z.input<typeof KitOutputs>;

/** Stores the Strategist's and Gap Finder's output on a full kit (stages 2–4). */
export async function saveKitOutputs(
  db: DbExecutor,
  userId: string,
  kitId: string,
  outputs: KitOutputs,
): Promise<Kit | null> {
  const values = KitOutputs.parse(outputs);
  if (Object.keys(values).length === 0) return getKit(db, userId, kitId);
  const [row] = await db
    .update(kits)
    .set(values)
    .where(
      and(
        eq(kits.userId, assertId(userId, "userId")),
        eq(kits.id, assertId(kitId, "kitId")),
        ne(kits.status, "preview"),
      ),
    )
    .returning();
  return row ?? null;
}

/* Stages ------------------------------------------------------------------------------------- */

const StageKey = z.enum(kitStageKeys);
const StageStatus = z.enum(kitStageStatuses);

/** A stage's place in §5.7's table, 1–10. */
export const kitStageOrdinal = (stage: KitStageKey): number => kitStageKeys.indexOf(stage) + 1;

export interface KitStageUpdate {
  status: KitStageStatus;
  /** Persisted before the next stage starts (§5.7 AC). */
  output?: unknown;
  error?: string | null;
}

/**
 * Records a stage's progress (resumable pipeline, §5.7). `running` counts an attempt and clears the
 * previous finish; `done`, `failed` and `skipped` stamp `finished_at`. The kit's `stage` summary is
 * updated in the same transaction, which is what the progress stream tails. Null when the kit is not
 * the caller's.
 */
export async function upsertKitStage(
  db: DbExecutor,
  userId: string,
  kitId: string,
  stage: KitStageKey,
  update: KitStageUpdate,
): Promise<KitStage | null> {
  const ownerId = assertId(userId, "userId");
  const id = assertId(kitId, "kitId");
  const key = StageKey.parse(stage);
  const status = StageStatus.parse(update.status);
  const ordinal = kitStageOrdinal(key);
  return db.transaction(async (tx) => {
    const [kit] = await tx
      .select({ id: kits.id })
      .from(kits)
      .where(and(eq(kits.userId, ownerId), eq(kits.id, id)))
      .limit(1)
      .for("update");
    if (!kit) return null;
    const running = status === "running";
    const output = update.output === undefined ? {} : { output: update.output };
    const error =
      update.error === undefined ? (running ? { error: null } : {}) : { error: update.error };
    const timing = running
      ? { startedAt: new Date(), finishedAt: null }
      : status === "pending"
        ? { startedAt: null, finishedAt: null }
        : { finishedAt: new Date() };
    const [row] = await tx
      .insert(kitStages)
      .values({
        userId: ownerId,
        kitId: id,
        stage: key,
        ordinal,
        status,
        attempts: running ? 1 : 0,
        output: update.output ?? null,
        error: update.error ?? null,
        ...timing,
      })
      .onConflictDoUpdate({
        target: [kitStages.kitId, kitStages.stage],
        set: {
          status,
          ...output,
          ...error,
          ...timing,
          ...(running ? { attempts: sql`${kitStages.attempts} + 1` } : {}),
          updatedAt: new Date(),
        },
      })
      .returning();
    if (!row) throw new Error("Failed to record the kit stage");
    const [counts] = await tx
      .select({
        done: sql<number>`count(*) filter (where ${kitStages.status} in ('done', 'skipped'))::int`,
      })
      .from(kitStages)
      .where(eq(kitStages.kitId, id));
    const progress: KitProgress = {
      stage: key,
      ordinal,
      status,
      done: counts?.done ?? 0,
      total: kitStageKeys.length,
    };
    await tx.update(kits).set({ stage: progress }).where(eq(kits.id, id));
    return row;
  });
}

export async function getKitStage(
  db: DbExecutor,
  userId: string,
  kitId: string,
  stage: KitStageKey,
): Promise<KitStage | null> {
  const [row] = await db
    .select()
    .from(kitStages)
    .where(
      and(
        eq(kitStages.userId, assertId(userId, "userId")),
        eq(kitStages.kitId, assertId(kitId, "kitId")),
        eq(kitStages.stage, StageKey.parse(stage)),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** All recorded stages, in pipeline order. */
export async function listKitStages(
  db: DbExecutor,
  userId: string,
  kitId: string,
): Promise<KitStage[]> {
  return db
    .select()
    .from(kitStages)
    .where(
      and(
        eq(kitStages.userId, assertId(userId, "userId")),
        eq(kitStages.kitId, assertId(kitId, "kitId")),
      ),
    )
    .orderBy(asc(kitStages.ordinal));
}

/* Regeneration ------------------------------------------------------------------------------- */

export type RegenerationResult =
  | { ok: true; kit: Kit }
  | { ok: false; reason: "not_found" | "busy" | "no_entitlement" | "limit_reached" };

/**
 * Starts the one whole-kit regeneration §5.6 allows (e.g. after a big dossier change): uses the
 * `kit_regenerations` counter, clears the stage rows so the pipeline runs from stage 1, and sets
 * the kit back to `pending`. Deliverables, drafts and their history are kept; new drafts become new
 * versions. Refused while the pipeline is running.
 */
export async function beginKitRegeneration(
  db: DbExecutor,
  userId: string,
  kitId: string,
): Promise<RegenerationResult> {
  const ownerId = assertId(userId, "userId");
  const id = assertId(kitId, "kitId");
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ kit: kits, schoolCycleId: userSchools.schoolCycleId })
      .from(kits)
      .innerJoin(userSchools, eq(userSchools.id, kits.userSchoolId))
      .where(and(eq(kits.userId, ownerId), eq(kits.id, id), ne(kits.status, "preview")))
      .limit(1)
      .for("update", { of: kits });
    if (!row) return { ok: false, reason: "not_found" };
    if (row.kit.status === "pending" || row.kit.status === "running")
      return { ok: false, reason: "busy" };
    const used = await consumeEntitlement(tx, ownerId, {
      refId: row.schoolCycleId,
      counter: "kit_regenerations",
    });
    if (!used.ok) return { ok: false, reason: used.reason };
    await tx.delete(kitStages).where(eq(kitStages.kitId, id));
    const [kit] = await tx
      .update(kits)
      .set({
        status: "pending",
        regenerations: sql`${kits.regenerations} + 1`,
        stage: null,
        error: null,
        startedAt: null,
        finishedAt: null,
      })
      .where(eq(kits.id, id))
      .returning();
    if (!kit) throw new Error("Failed to restart the kit");
    return { ok: true, kit };
  });
}

/* Cost --------------------------------------------------------------------------------------- */

export interface KitCost {
  totalUsd: number;
  byTask: { task: string; costUsd: number; calls: number }[];
}

/** The kit's AI cost from usage_ledger (§5.7 AC, §12.4), per task. Null when not the caller's. */
export async function getKitCost(
  db: DbExecutor,
  userId: string,
  kitId: string,
): Promise<KitCost | null> {
  const kit = await getKit(db, userId, kitId);
  if (!kit) return null;
  const rows = await db
    .select({
      task: usageLedger.task,
      costUsd: sql<string>`coalesce(sum(${usageLedger.costUsd}), 0)`,
      calls: sql<number>`count(distinct ${usageLedger.runId})::int`,
    })
    .from(usageLedger)
    .where(eq(usageLedger.kitId, kit.id))
    .groupBy(usageLedger.task)
    .orderBy(asc(usageLedger.task));
  const byTask = rows.map((r) => ({ task: r.task, costUsd: Number(r.costUsd), calls: r.calls }));
  return { totalUsd: byTask.reduce((sum, r) => sum + r.costUsd, 0), byTask };
}

/* Story usage -------------------------------------------------------------------------------- */

export interface StoryUsage {
  storyCode: string;
  role: "primary" | "supporting";
  kitId: string;
  schoolName: string;
  deliverableKey: string;
  /** Null when the file map names a deliverable the kit has not created yet. */
  deliverableId: string | null;
  deliverableTitle: string | null;
}

interface FileMapLike {
  items?: { deliverable_key?: unknown; primary_story?: unknown; supporting?: unknown }[];
}

/**
 * Which school deliverables use each story, as primary or supporting (§5.3 "Used in"): the file
 * map of every full kit, plus stories a current draft cites that its file-map entry does not name
 * (e.g. after "Use a different story"), counted as supporting.
 */
export async function listStoryUsage(
  db: DbExecutor,
  userId: string,
  storyCodes?: string[],
): Promise<StoryUsage[]> {
  const ownerId = assertId(userId, "userId");
  const wanted = storyCodes ? new Set(storyCodes) : null;
  const kitRows = await db
    .select({ id: kits.id, fileMap: kits.fileMap, schoolName: schools.name })
    .from(kits)
    .innerJoin(userSchools, eq(userSchools.id, kits.userSchoolId))
    .innerJoin(schoolCycles, eq(schoolCycles.id, userSchools.schoolCycleId))
    .innerJoin(schools, eq(schools.id, schoolCycles.schoolId))
    .where(and(eq(kits.userId, ownerId), ne(kits.status, "preview")))
    .orderBy(asc(kits.createdAt));
  if (kitRows.length === 0) return [];
  const kitIds = kitRows.map((k) => k.id);
  const deliverableRows = await db
    .select({
      id: deliverables.id,
      kitId: deliverables.kitId,
      packKey: deliverables.packKey,
      title: deliverables.title,
      order: deliverables.order,
    })
    .from(deliverables)
    .where(and(eq(deliverables.userId, ownerId), inArray(deliverables.kitId, kitIds)))
    .orderBy(asc(deliverables.order));
  const draftRows = await db
    .select({ deliverableId: drafts.deliverableId, codes: drafts.usedStoryCodes })
    .from(drafts)
    .innerJoin(deliverables, eq(deliverables.id, drafts.deliverableId))
    .where(
      and(
        eq(drafts.userId, ownerId),
        eq(drafts.isCurrent, true),
        inArray(deliverables.kitId, kitIds),
      ),
    );
  const byKey = new Map(deliverableRows.map((d) => [`${d.kitId}:${d.packKey}`, d]));
  const draftCodes = new Map(draftRows.map((d) => [d.deliverableId, d.codes]));

  const out: StoryUsage[] = [];
  const seen = new Set<string>();
  const push = (u: StoryUsage) => {
    const key = `${u.kitId}:${u.deliverableKey}:${u.storyCode}`;
    if (seen.has(key) || (wanted && !wanted.has(u.storyCode))) return;
    seen.add(key);
    out.push(u);
  };
  for (const kit of kitRows) {
    const items = (kit.fileMap as FileMapLike | null)?.items ?? [];
    const base = (deliverableKey: string) => {
      const d = byKey.get(`${kit.id}:${deliverableKey}`);
      return {
        kitId: kit.id,
        schoolName: kit.schoolName,
        deliverableKey,
        deliverableId: d?.id ?? null,
        deliverableTitle: d?.title ?? null,
      };
    };
    for (const item of items) {
      if (typeof item.deliverable_key !== "string") continue;
      if (typeof item.primary_story === "string")
        push({ storyCode: item.primary_story, role: "primary", ...base(item.deliverable_key) });
      for (const code of Array.isArray(item.supporting) ? item.supporting : [])
        if (typeof code === "string")
          push({ storyCode: code, role: "supporting", ...base(item.deliverable_key) });
    }
    for (const d of deliverableRows.filter((r) => r.kitId === kit.id))
      for (const code of draftCodes.get(d.id) ?? [])
        push({ storyCode: code, role: "supporting", ...base(d.packKey) });
  }
  return out;
}
