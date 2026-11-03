import "server-only";

import { BudgetExceededError, type TaskOutput } from "@admitstory/ai";
import {
  buildDossierInput,
  createChunkStore,
  getDb,
  getKitForUserSchool,
  getLatestSnapshot,
  getUserSchool,
  getCycleWithSchool,
  listStories,
  saveDossierSnapshot,
  saveKitPreview,
  saveUserSchoolFit,
  type DbExecutor,
  type DossierSnapshot,
} from "@admitstory/db";
import { hybridSearch } from "@admitstory/kb";
import { compileDossier } from "@admitstory/shared";
import { compareToMedian } from "@admitstory/shared/kit";
import { ai } from "@/lib/ai";
import { isInternational } from "./applicant";
import { packDeliverables } from "./deliverables";
import { asPack, type RetrievalSource } from "./pack";
import { previewDecision } from "./preview-policy";
import { loadApplicant, latestPack } from "./server";
import { readStoredFit, toRecord, type PreviewJob, type StoredFit } from "./stored-fit";

// The work behind School Strategy's two model calls (spec §5.5, §8.5.5, §8.9): the per-school fit
// (strategy.school_fit, Haiku) and the free kit preview (kit.positioning_filemap, Opus). The Inngest
// functions call these; so does a route directly when Inngest isn't configured (local development).

/* Retrieval (§8.9) ------------------------------------------------------------------------------ */

/**
 * Long-tail school material for a task, as K900001… chunks with their sources. Retrieval adds
 * detail, never essentials (the compiled pack is L1), so it degrades to nothing when embeddings
 * aren't available rather than failing the task. Only citable chunks are passed on.
 */
export async function retrieveForSchool(
  db: DbExecutor,
  args: { userId: string; schoolId: string; cycle: string; query: string; limit?: number },
): Promise<{
  chunks: { id: string; source: string; verified_at: string | null; text: string }[];
  sources: RetrievalSource[];
}> {
  try {
    const result = await hybridSearch(
      createChunkStore(db),
      async (text) => {
        const [vector] = await ai().embed([text], { userId: args.userId, inputType: "query" });
        if (!vector) throw new Error("No embedding returned");
        return vector;
      },
      args.query,
      { schoolId: args.schoolId, cycle: args.cycle },
      { limit: args.limit ?? 4, maxTokens: 1_800 },
    );
    const citable = result.chunks.filter((chunk) => chunk.citable);
    return {
      chunks: citable.map((chunk) => ({
        id: chunk.code,
        source: chunk.title.slice(0, 200),
        verified_at: chunk.verifiedAt,
        text: chunk.text.slice(0, 6_000),
      })),
      sources: citable.map((chunk) => ({
        id: chunk.code,
        source: chunk.title,
        url: chunk.url,
        verifiedAt: chunk.verifiedAt,
      })),
    };
  } catch (error) {
    console.warn(
      "[strategy] retrieval skipped:",
      error instanceof Error ? error.message : "unknown error",
    );
    return { chunks: [], sources: [] };
  }
}

/* Fit ------------------------------------------------------------------------------------------ */

export type FitResult =
  | { status: "saved"; packVersion: number }
  | { status: "skipped"; reason: "not_found" | "coming_soon" | "current" };

/**
 * Computes and stores one school's fit for one applicant, against the newest published pack. Skips
 * when the stored fit already matches that version, so re-sent events cost nothing.
 */
export async function runSchoolFit(
  userId: string,
  userSchoolId: string,
  options: { force?: boolean } = {},
): Promise<FitResult> {
  const db = getDb();
  const row = await getUserSchool(db, userId, userSchoolId);
  if (!row) return { status: "skipped", reason: "not_found" };
  const published = await latestPack(db, row.schoolCycleId);
  if (!published) return { status: "skipped", reason: "coming_soon" };
  const stored = readStoredFit(row.fit);
  if (!options.force && stored.output && row.fitPackVersion === published.version)
    return { status: "skipped", reason: "current" };

  const pack = asPack(published.data);
  const [applicant, cycle] = await Promise.all([
    loadApplicant(userId),
    getCycleWithSchool(db, row.schoolCycleId),
  ]);
  const schoolName = cycle?.school.name ?? pack.school.name;
  const retrieval = cycle
    ? await retrieveForSchool(db, {
        userId,
        schoolId: cycle.school.id,
        cycle: cycle.cycle.cycle,
        query: `${applicant.targetFunction ?? "career outcomes"}: recruiting, culture and what ${schoolName} looks for`,
      })
    : { chunks: [], sources: [] };

  const output: TaskOutput<"strategy.school_fit"> = await ai().run(
    "strategy.school_fit",
    {
      school: schoolName,
      cycle: pack.cycle,
      applicant: {
        summary: applicant.summary,
        target_function: applicant.targetFunction,
        brand_traits: applicant.brandTraits,
        international: isInternational(applicant.country, cycle?.school.country ?? null),
        round: row.round,
      },
      medians: compareToMedian(applicant.numbers, pack.class_profile ?? {}),
      retrieval: retrieval.chunks,
    },
    { userId, schoolPack: published.compiledPrompt, schoolPackId: published.id },
  );
  await ai().flush();

  // Re-read just before writing so a preview job state written meanwhile is kept.
  const latest = await getUserSchool(db, userId, userSchoolId);
  const next: StoredFit = {
    ...readStoredFit(latest?.fit ?? row.fit),
    output,
    retrieval: retrieval.sources,
    computedAt: new Date().toISOString(),
  };
  await saveUserSchoolFit(db, userId, userSchoolId, toRecord(next), published.version);
  return { status: "saved", packVersion: published.version };
}

/** Every applicant's school on one cycle, for the fan-out after a pack is published. */
export async function userSchoolsForCycle(
  cycleId: string,
): Promise<{ userId: string; userSchoolId: string }[]> {
  // A system job across applicants (there is no user to scope by). packages/db has no repository
  // for this yet, so it reads through the relational query API, ids only.
  const rows = await getDb().query.userSchools.findMany({
    where: (t, { eq }) => eq(t.schoolCycleId, cycleId),
    columns: { id: true, userId: true },
  });
  return rows.map((r) => ({ userId: r.userId, userSchoolId: r.id }));
}

/* Kit preview ---------------------------------------------------------------------------------- */

/**
 * The dossier snapshot as it stands now (no model call: the compiler is code). The stored latest is
 * returned while it still matches what the dossier compiles to, so its version only moves when the
 * dossier did, which is what keeps a kit preview reusable (§5.5).
 */
export async function ensureSnapshot(userId: string): Promise<DossierSnapshot> {
  const db = getDb();
  const [latest, input] = await Promise.all([
    getLatestSnapshot(db, userId),
    buildDossierInput(db, userId),
  ]);
  if (latest && latest.compactText === compileDossier(input).text) return latest;
  return (await saveDossierSnapshot(db, userId)).snapshot;
}

/** Writes the preview job state beside the fit, keeping everything else stored there. */
export async function setPreviewJob(
  userId: string,
  userSchoolId: string,
  job: PreviewJob | null,
): Promise<void> {
  const db = getDb();
  const row = await getUserSchool(db, userId, userSchoolId);
  if (!row) return;
  const next: StoredFit = { ...readStoredFit(row.fit), previewJob: job };
  await saveUserSchoolFit(db, userId, userSchoolId, toRecord(next), row.fitPackVersion);
}

export type PreviewResult =
  | { status: "saved" | "reused" }
  | { status: "skipped"; reason: "not_found" | "coming_soon" }
  | { status: "budget" };

/**
 * Builds the free kit preview for one school (§5.5): kit.positioning_filemap with the full compiled
 * pack (L1), the applicant's snapshot (L2) and retrieved why-school detail. Reused when the stored
 * preview was built from the same snapshot and pack version. A spent free allowance is recorded as
 * a `budget` state for the page to explain, not thrown.
 */
export async function runKitPreview(userId: string, userSchoolId: string): Promise<PreviewResult> {
  const db = getDb();
  const row = await getUserSchool(db, userId, userSchoolId);
  if (!row) return { status: "skipped", reason: "not_found" };
  const published = await latestPack(db, row.schoolCycleId);
  if (!published) return { status: "skipped", reason: "coming_soon" };

  const [snapshot, kit, cycle] = await Promise.all([
    ensureSnapshot(userId),
    getKitForUserSchool(db, userId, userSchoolId),
    getCycleWithSchool(db, row.schoolCycleId),
  ]);
  const decision = previewDecision({
    published: true,
    packVersion: published.version,
    snapshotVersion: snapshot.version,
    kit,
    job: null,
    now: new Date(),
  });
  if (decision === "reuse") {
    await setPreviewJob(userId, userSchoolId, null);
    return { status: "reused" };
  }

  const pack = asPack(published.data);
  const schoolName = cycle?.school.name ?? pack.school.name;
  const deliverables = packDeliverables(pack, row.isReapplicant);
  const applicant = await loadApplicant(userId);
  const retrieval = cycle
    ? await retrieveForSchool(db, {
        userId,
        schoolId: cycle.school.id,
        cycle: cycle.cycle.cycle,
        query: `Why ${schoolName}: courses, clubs and recruiting for ${applicant.targetFunction ?? "the applicant's goals"}`,
        limit: 6,
      })
    : { chunks: [], sources: [] };

  try {
    const output = await ai().run(
      "kit.positioning_filemap",
      {
        school: schoolName,
        cycle: pack.cycle,
        deliverables: deliverables.map(({ key, kind, prompt, limit, required }) => ({
          key,
          kind,
          prompt,
          limit,
          required,
        })),
        is_reapplicant: row.isReapplicant,
        recommenders: [],
        retrieval: retrieval.chunks,
      },
      {
        userId,
        schoolPack: published.compiledPrompt,
        schoolPackId: published.id,
        dossier: snapshot.compactText,
      },
    );
    await ai().flush();
    await saveKitPreview(db, userId, userSchoolId, {
      positioning: output.positioning as unknown as Record<string, unknown>,
      fileMap: {
        ...(output.file_map as unknown as Record<string, unknown>),
        // Kept so the preview's "what the school must see" lines can cite retrieved chunks later.
        retrieval: retrieval.sources,
      },
      dossierSnapshotVersion: snapshot.version,
      packVersion: published.version,
    });
    await setPreviewJob(userId, userSchoolId, null);
    return { status: "saved" };
  } catch (error) {
    if (error instanceof BudgetExceededError) {
      await setPreviewJob(userId, userSchoolId, { state: "budget", at: new Date().toISOString() });
      return { status: "budget" };
    }
    throw error;
  }
}

/** The stories' titles, for the file map (titles only, §5.5). Withheld stories keep their title. */
export async function storyTitles(userId: string) {
  const stories = await listStories(getDb(), userId);
  return stories
    .filter((story) => story.mergedInto === null)
    .map((story) => ({ code: story.code, nickname: story.nickname }));
}
