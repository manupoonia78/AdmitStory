// Schools, cycles, School Packs and the AI policy registry (spec §5.18, §9, §14.2).
//
// Two audiences. Admin functions take an AdminContext and write `audit_log`. Public reads take a
// plain database handle and only ever return what is published: a pack once `published`, an AI
// policy once verified. Nothing unverified reaches an applicant (§0, §9.3).

import { and, asc, desc, eq, ilike, inArray, isNotNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { DbExecutor } from "../client";
import {
  aiPolicies,
  aiStances,
  cycleStatuses,
  schoolCycles,
  schoolPacks,
  schoolRegions,
  schools,
  type CycleRound,
  type SchoolPackData,
} from "../schema";
import { adminDb, audited, type AdminContext } from "./admin";
import { assertId } from "./ids";

export type School = typeof schools.$inferSelect;
export type SchoolCycle = typeof schoolCycles.$inferSelect;
export type SchoolPack = typeof schoolPacks.$inferSelect;
export type AiPolicy = typeof aiPolicies.$inferSelect;

const name = (max: number) => z.string().trim().min(1).max(max);
const isoDate = z.iso.date();

/* Schools ------------------------------------------------------------------------------------ */

export const NewSchool = z.strictObject({
  slug: z
    .string()
    .trim()
    .max(80)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug is lower-case words joined by hyphens"),
  name: name(200),
  shortName: name(80),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "ISO 3166-1 alpha-2")
    .nullable()
    .optional(),
  city: z.string().trim().max(120).nullable().optional(),
  website: z
    .url({ protocol: /^https?$/ })
    .max(500)
    .nullable()
    .optional(),
  logoKey: z.string().trim().max(512).nullable().optional(),
  region: z.enum(schoolRegions),
});
export type NewSchool = z.input<typeof NewSchool>;

export const SchoolPatch = NewSchool.omit({ slug: true }).partial();
export type SchoolPatch = z.input<typeof SchoolPatch>;

export async function createSchool(admin: AdminContext, input: NewSchool): Promise<School> {
  const values = NewSchool.parse(input);
  return audited(
    admin,
    (row: School) => ({ action: "schools.create", targetType: "school", targetId: row.id }),
    async (db) => {
      const [row] = await db.insert(schools).values(values).returning();
      if (!row) throw new Error("Failed to create school");
      return row;
    },
  );
}

export async function updateSchool(
  admin: AdminContext,
  schoolId: string,
  patch: SchoolPatch,
): Promise<School | null> {
  const id = assertId(schoolId, "schoolId");
  const values = SchoolPatch.parse(patch);
  if (Object.keys(values).length === 0) return getSchoolForAdmin(admin, id);
  return audited(
    admin,
    (row: School | null) =>
      row && {
        action: "schools.update",
        targetType: "school",
        targetId: id,
        meta: { fields: Object.keys(values) },
      },
    async (db) => {
      const [row] = await db.update(schools).set(values).where(eq(schools.id, id)).returning();
      return row ?? null;
    },
  );
}

export async function getSchoolForAdmin(
  admin: AdminContext,
  schoolId: string,
): Promise<School | null> {
  const [row] = await adminDb(admin)
    .select()
    .from(schools)
    .where(eq(schools.id, assertId(schoolId, "schoolId")))
    .limit(1);
  return row ?? null;
}

export interface AdminCycleSummary extends SchoolCycle {
  draftPackId: string | null;
  draftVersion: number | null;
  publishedVersion: number | null;
  publishedAt: Date | null;
  aiStance: AiPolicy["stance"] | null;
  aiPolicyVerifiedAt: Date | null;
}

export interface AdminSchoolSummary extends School {
  cycles: AdminCycleSummary[];
}

/** Every school with its cycles, pack versions and AI policy state, for the admin console. */
export async function listSchoolsForAdmin(admin: AdminContext): Promise<AdminSchoolSummary[]> {
  const db = adminDb(admin);
  const schoolRows = await db
    .select()
    .from(schools)
    .orderBy(asc(schools.region), asc(schools.name));
  const cycleRows = await db.select().from(schoolCycles).orderBy(desc(schoolCycles.cycle));
  const packRows = await db
    .select({
      id: schoolPacks.id,
      cycleId: schoolPacks.cycleId,
      version: schoolPacks.version,
      status: schoolPacks.status,
      publishedAt: schoolPacks.publishedAt,
    })
    .from(schoolPacks)
    .orderBy(desc(schoolPacks.version));
  const policyRows = await db
    .select({
      cycleId: aiPolicies.schoolCycleId,
      stance: aiPolicies.stance,
      verifiedAt: aiPolicies.verifiedAt,
    })
    .from(aiPolicies);
  const policies = new Map(policyRows.map((p) => [p.cycleId, p] as const));

  const cyclesBySchool = new Map<string, AdminCycleSummary[]>();
  for (const cycle of cycleRows) {
    const packs = packRows.filter((p) => p.cycleId === cycle.id);
    const draft = packs.find((p) => p.status === "draft");
    const published = packs.find((p) => p.status === "published");
    const policy = policies.get(cycle.id);
    const list = cyclesBySchool.get(cycle.schoolId) ?? [];
    list.push({
      ...cycle,
      draftPackId: draft?.id ?? null,
      draftVersion: draft?.version ?? null,
      publishedVersion: published?.version ?? null,
      publishedAt: published?.publishedAt ?? null,
      aiStance: policy?.stance ?? null,
      aiPolicyVerifiedAt: policy?.verifiedAt ?? null,
    });
    cyclesBySchool.set(cycle.schoolId, list);
  }
  return schoolRows.map((school) => ({ ...school, cycles: cyclesBySchool.get(school.id) ?? [] }));
}

/* Cycles ------------------------------------------------------------------------------------- */

const Rounds = z
  .array(
    z.strictObject({
      name: name(40),
      deadline: isoDate.nullable(),
      decisionDate: isoDate.nullable().optional(),
      interviewInvitesWindow: z.string().trim().max(200).nullable().optional(),
      notes: z.string().trim().max(1000).nullable().optional(),
    }),
  )
  .max(12);

const CycleName = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}$/, 'cycle is like "2026-27"');

export const NewCycle = z.strictObject({
  schoolId: z.guid(),
  cycle: CycleName,
  status: z.enum(cycleStatuses).optional(),
  rounds: Rounds.optional(),
});
export type NewCycle = z.input<typeof NewCycle>;

export const CyclePatch = z
  .strictObject({ status: z.enum(cycleStatuses), rounds: Rounds })
  .partial();
export type CyclePatch = z.input<typeof CyclePatch>;

export async function createCycle(admin: AdminContext, input: NewCycle): Promise<SchoolCycle> {
  const values = NewCycle.parse(input);
  return audited(
    admin,
    (row: SchoolCycle) => ({
      action: "school_cycles.create",
      targetType: "school_cycle",
      targetId: row.id,
      meta: { schoolId: row.schoolId, cycle: row.cycle },
    }),
    async (db) => {
      const [row] = await db
        .insert(schoolCycles)
        .values({ ...values, rounds: (values.rounds as CycleRound[] | undefined) ?? [] })
        .returning();
      if (!row) throw new Error("Failed to create cycle");
      return row;
    },
  );
}

export async function updateCycle(
  admin: AdminContext,
  cycleId: string,
  patch: CyclePatch,
): Promise<SchoolCycle | null> {
  const id = assertId(cycleId, "cycleId");
  const values = CyclePatch.parse(patch);
  if (Object.keys(values).length === 0) return getCycleForAdmin(admin, id);
  return audited(
    admin,
    (row: SchoolCycle | null) =>
      row && {
        action: "school_cycles.update",
        targetType: "school_cycle",
        targetId: id,
        meta: { fields: Object.keys(values), status: values.status },
      },
    async (db) => {
      const [row] = await db
        .update(schoolCycles)
        .set({ ...values, rounds: values.rounds as CycleRound[] | undefined })
        .where(eq(schoolCycles.id, id))
        .returning();
      return row ?? null;
    },
  );
}

export async function getCycleForAdmin(
  admin: AdminContext,
  cycleId: string,
): Promise<SchoolCycle | null> {
  const [row] = await adminDb(admin)
    .select()
    .from(schoolCycles)
    .where(eq(schoolCycles.id, assertId(cycleId, "cycleId")))
    .limit(1);
  return row ?? null;
}

/* Packs -------------------------------------------------------------------------------------- */

const MAX_PACK_BYTES = 2_000_000;

const PackData = z
  .record(z.string(), z.unknown())
  .refine((data) => JSON.stringify(data).length <= MAX_PACK_BYTES, "pack data is too large");

/**
 * Creates the cycle's working draft at the next version number, or replaces the data of the draft
 * that already exists (there is at most one per cycle). Idempotent for loading a fixed pack such as
 * the Darden example (Appendix G).
 */
export async function insertDraftPack(
  admin: AdminContext,
  cycleId: string,
  data: SchoolPackData,
): Promise<SchoolPack> {
  const id = assertId(cycleId, "cycleId");
  const values = PackData.parse(data);
  return audited(
    admin,
    (row: SchoolPack) => ({
      action: "school_packs.save_draft",
      targetType: "school_pack",
      targetId: row.id,
      meta: { cycleId: id, version: row.version },
    }),
    async (db) => {
      const [draft] = await db
        .select({ id: schoolPacks.id })
        .from(schoolPacks)
        .where(and(eq(schoolPacks.cycleId, id), eq(schoolPacks.status, "draft")))
        .limit(1)
        .for("update");
      if (draft) {
        const [row] = await db
          .update(schoolPacks)
          .set({ data: values })
          .where(eq(schoolPacks.id, draft.id))
          .returning();
        if (!row) throw new Error("Failed to update draft pack");
        return row;
      }
      const [row] = await db
        .insert(schoolPacks)
        .values({
          cycleId: id,
          version: sql`(select coalesce(max(${schoolPacks.version}), 0) + 1 from ${schoolPacks} where ${schoolPacks.cycleId} = ${id})`,
          status: "draft",
          data: values,
        })
        .returning();
      if (!row) throw new Error("Failed to create draft pack");
      return row;
    },
  );
}

/** Replaces a draft's data. Published versions are immutable; edit by saving a new draft. */
export async function updateDraftPack(
  admin: AdminContext,
  packId: string,
  data: SchoolPackData,
): Promise<SchoolPack> {
  const id = assertId(packId, "packId");
  const values = PackData.parse(data);
  return audited(
    admin,
    { action: "school_packs.update_draft", targetType: "school_pack", targetId: id },
    async (db) => {
      const [row] = await db
        .update(schoolPacks)
        .set({ data: values })
        .where(and(eq(schoolPacks.id, id), eq(schoolPacks.status, "draft")))
        .returning();
      if (!row) throw new Error("Pack not found or already published");
      return row;
    },
  );
}

export const PublishPack = z.strictObject({
  /** The compiled L1 markdown (packages/kb compiler). */
  compiledPrompt: z.string().min(1).max(400_000),
  tokenCount: z.int().nonnegative(),
});
export type PublishPack = z.input<typeof PublishPack>;

/**
 * Publishes a draft as its version (§9.3 "Publish pack version N+1") and moves a `draft` cycle to
 * `live`. Applicants see the newest published version from then on.
 */
export async function publishPack(
  admin: AdminContext,
  packId: string,
  input: PublishPack,
): Promise<SchoolPack> {
  const id = assertId(packId, "packId");
  const values = PublishPack.parse(input);
  return audited(
    admin,
    (row: SchoolPack) => ({
      action: "school_packs.publish",
      targetType: "school_pack",
      targetId: row.id,
      meta: { cycleId: row.cycleId, version: row.version, tokenCount: row.tokenCount },
    }),
    async (db) => {
      const [row] = await db
        .update(schoolPacks)
        .set({
          status: "published",
          compiledPrompt: values.compiledPrompt,
          tokenCount: values.tokenCount,
          publishedAt: new Date(),
          publishedBy: admin.actorId,
        })
        .where(and(eq(schoolPacks.id, id), eq(schoolPacks.status, "draft")))
        .returning();
      if (!row) throw new Error("Pack not found or already published");
      await db
        .update(schoolCycles)
        .set({ status: "live" })
        .where(and(eq(schoolCycles.id, row.cycleId), eq(schoolCycles.status, "draft")));
      return row;
    },
  );
}

export async function getPackForAdmin(
  admin: AdminContext,
  packId: string,
): Promise<SchoolPack | null> {
  const [row] = await adminDb(admin)
    .select()
    .from(schoolPacks)
    .where(eq(schoolPacks.id, assertId(packId, "packId")))
    .limit(1);
  return row ?? null;
}

export async function getDraftPack(
  admin: AdminContext,
  cycleId: string,
): Promise<SchoolPack | null> {
  const [row] = await adminDb(admin)
    .select()
    .from(schoolPacks)
    .where(
      and(eq(schoolPacks.cycleId, assertId(cycleId, "cycleId")), eq(schoolPacks.status, "draft")),
    )
    .limit(1);
  return row ?? null;
}

/** Version history, newest first, without the (large) data and compiled prompt. */
export async function listPackVersions(
  admin: AdminContext,
  cycleId: string,
): Promise<Omit<SchoolPack, "data" | "compiledPrompt">[]> {
  return adminDb(admin)
    .select({
      id: schoolPacks.id,
      createdAt: schoolPacks.createdAt,
      updatedAt: schoolPacks.updatedAt,
      cycleId: schoolPacks.cycleId,
      version: schoolPacks.version,
      status: schoolPacks.status,
      tokenCount: schoolPacks.tokenCount,
      publishedAt: schoolPacks.publishedAt,
      publishedBy: schoolPacks.publishedBy,
    })
    .from(schoolPacks)
    .where(eq(schoolPacks.cycleId, assertId(cycleId, "cycleId")))
    .orderBy(desc(schoolPacks.version));
}

/* AI policy registry ------------------------------------------------------------------------- */

export const aiPolicyScopes = ["essays", "video", "recommendations"] as const;

export const AiPolicyInput = z.strictObject({
  stance: z.enum(aiStances),
  appliesTo: z.array(z.enum(aiPolicyScopes)).max(3),
  disclosureText: z.string().trim().max(2000).nullable().optional(),
  sourceUrl: z
    .url({ protocol: /^https?$/ })
    .max(1000)
    .nullable()
    .optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
  /**
   * Whether the admin checked it against the school's own page just now. Every save sets or clears
   * the verified date, so an edited stance never inherits an older verification.
   */
  verified: z.boolean(),
});
export type AiPolicyInput = z.input<typeof AiPolicyInput>;

export async function upsertAiPolicy(
  admin: AdminContext,
  cycleId: string,
  input: AiPolicyInput,
): Promise<AiPolicy> {
  const id = assertId(cycleId, "cycleId");
  const { verified, ...values } = AiPolicyInput.parse(input);
  const verification = verified
    ? { verifiedAt: new Date(), verifiedBy: admin.actorId }
    : { verifiedAt: null, verifiedBy: null };
  const row = {
    ...values,
    appliesTo: [...new Set(values.appliesTo)],
    disclosureText: values.disclosureText ?? null,
    sourceUrl: values.sourceUrl ?? null,
    notes: values.notes ?? null,
    ...verification,
  };
  return audited(
    admin,
    (policy: AiPolicy) => ({
      action: "ai_policies.upsert",
      targetType: "ai_policy",
      targetId: policy.id,
      meta: { cycleId: id, stance: policy.stance, verified },
    }),
    async (db) => {
      const [policy] = await db
        .insert(aiPolicies)
        .values({ schoolCycleId: id, ...row })
        .onConflictDoUpdate({ target: aiPolicies.schoolCycleId, set: row })
        .returning();
      if (!policy) throw new Error("Failed to save AI policy");
      return policy;
    },
  );
}

export async function listAiPolicies(
  admin: AdminContext,
): Promise<(AiPolicy & { schoolId: string; schoolName: string; cycle: string })[]> {
  const rows = await adminDb(admin)
    .select({
      policy: aiPolicies,
      schoolId: schools.id,
      schoolName: schools.name,
      cycle: schoolCycles.cycle,
    })
    .from(aiPolicies)
    .innerJoin(schoolCycles, eq(schoolCycles.id, aiPolicies.schoolCycleId))
    .innerJoin(schools, eq(schools.id, schoolCycles.schoolId))
    .orderBy(asc(schools.name), desc(schoolCycles.cycle));
  return rows.map((r) => ({
    ...r.policy,
    schoolId: r.schoolId,
    schoolName: r.schoolName,
    cycle: r.cycle,
  }));
}

/** The policy applicants and the kit pipeline may rely on: verified ones only. */
export async function getVerifiedAiPolicy(
  db: DbExecutor,
  cycleId: string,
): Promise<AiPolicy | null> {
  const [row] = await db
    .select()
    .from(aiPolicies)
    .where(
      and(
        eq(aiPolicies.schoolCycleId, assertId(cycleId, "cycleId")),
        isNotNull(aiPolicies.verifiedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

/* Public reads ------------------------------------------------------------------------------- */

export interface SchoolSummary {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  country: string | null;
  city: string | null;
  website: string | null;
  region: School["region"];
  /** The cycle School Strategy shows: the newest with a published pack, else the newest open one. */
  cycle: { id: string; cycle: string; status: SchoolCycle["status"] } | null;
  /** Null means "Pack coming soon": the school cannot be bought (§5.5). */
  publishedPack: { id: string; version: number; publishedAt: Date } | null;
}

async function summarise(db: DbExecutor, rows: School[]): Promise<SchoolSummary[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const cycles = await db
    .select()
    .from(schoolCycles)
    .where(and(inArray(schoolCycles.schoolId, ids), ne(schoolCycles.status, "archived")))
    .orderBy(desc(schoolCycles.cycle));
  const cycleIds = cycles.map((c) => c.id);
  const packs =
    cycleIds.length === 0
      ? []
      : await db
          .selectDistinctOn([schoolPacks.cycleId], {
            id: schoolPacks.id,
            cycleId: schoolPacks.cycleId,
            version: schoolPacks.version,
            publishedAt: schoolPacks.publishedAt,
          })
          .from(schoolPacks)
          .where(and(inArray(schoolPacks.cycleId, cycleIds), eq(schoolPacks.status, "published")))
          .orderBy(schoolPacks.cycleId, desc(schoolPacks.version));
  const packByCycle = new Map(packs.map((p) => [p.cycleId, p] as const));

  return rows.map((school) => {
    const own = cycles.filter((c) => c.schoolId === school.id);
    const chosen = own.find((c) => packByCycle.has(c.id)) ?? own[0] ?? null;
    const pack = chosen ? packByCycle.get(chosen.id) : undefined;
    return {
      id: school.id,
      slug: school.slug,
      name: school.name,
      shortName: school.shortName,
      country: school.country,
      city: school.city,
      website: school.website,
      region: school.region,
      cycle: chosen ? { id: chosen.id, cycle: chosen.cycle, status: chosen.status } : null,
      publishedPack:
        pack && pack.publishedAt
          ? { id: pack.id, version: pack.version, publishedAt: pack.publishedAt }
          : null,
    };
  });
}

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Folds accents and case so "said" finds "Saïd". */
const fold = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

/**
 * Search by name, short name or slug for School Strategy's "Add schools" (§5.5). Prefix matches
 * rank first. An empty query lists every school.
 */
export async function searchSchools(
  db: DbExecutor,
  q: string,
  options: { limit?: number } = {},
): Promise<SchoolSummary[]> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
  const query = z.string().max(200).parse(q).trim();
  if (query === "") return (await listSeedSchools(db)).slice(0, limit);
  const folded = fold(query);
  const contains = `%${escapeLike(query)}%`;
  const slugContains = `%${escapeLike(folded.replace(/\s+/g, "-"))}%`;
  const prefix = `${escapeLike(query)}%`;
  const rows = await db
    .select()
    .from(schools)
    .where(
      or(
        ilike(schools.name, contains),
        ilike(schools.shortName, contains),
        ilike(schools.slug, slugContains),
      ),
    )
    .orderBy(
      sql`case when ${schools.shortName} ilike ${prefix} or ${schools.name} ilike ${prefix} then 0 else 1 end`,
      asc(schools.name),
    )
    .limit(limit);
  return summarise(db, rows);
}

/** Every school (Appendix H and any added since), grouped by region then name. */
export async function listSeedSchools(db: DbExecutor): Promise<SchoolSummary[]> {
  const rows = await db.select().from(schools).orderBy(asc(schools.region), asc(schools.name));
  return summarise(db, rows);
}

export async function getSchoolBySlug(db: DbExecutor, slug: string): Promise<SchoolSummary | null> {
  const [row] = await db
    .select()
    .from(schools)
    .where(eq(schools.slug, z.string().trim().max(80).parse(slug)))
    .limit(1);
  if (!row) return null;
  const [summary] = await summarise(db, [row]);
  return summary ?? null;
}

export interface CycleWithSchool {
  cycle: SchoolCycle;
  school: School;
}

export async function getCycleWithSchool(
  db: DbExecutor,
  cycleId: string,
): Promise<CycleWithSchool | null> {
  const [row] = await db
    .select({ cycle: schoolCycles, school: schools })
    .from(schoolCycles)
    .innerJoin(schools, eq(schools.id, schoolCycles.schoolId))
    .where(eq(schoolCycles.id, assertId(cycleId, "cycleId")))
    .limit(1);
  return row ?? null;
}

export interface PublishedPack {
  id: string;
  cycleId: string;
  version: number;
  data: SchoolPackData;
  compiledPrompt: string;
  tokenCount: number;
  publishedAt: Date;
}

function toPublished(row: SchoolPack): PublishedPack | null {
  if (row.status !== "published" || row.compiledPrompt === null || row.publishedAt === null)
    return null;
  return {
    id: row.id,
    cycleId: row.cycleId,
    version: row.version,
    data: row.data,
    compiledPrompt: row.compiledPrompt,
    tokenCount: row.tokenCount ?? 0,
    publishedAt: row.publishedAt,
  };
}

/** The newest published pack for a cycle, or null ("Pack coming soon"). Drafts never leak. */
export async function getPublishedPack(
  db: DbExecutor,
  cycleId: string,
  version?: number,
): Promise<PublishedPack | null> {
  const id = assertId(cycleId, "cycleId");
  const [row] = await db
    .select()
    .from(schoolPacks)
    .where(
      and(
        eq(schoolPacks.cycleId, id),
        eq(schoolPacks.status, "published"),
        version === undefined ? undefined : eq(schoolPacks.version, z.int().parse(version)),
      ),
    )
    .orderBy(desc(schoolPacks.version))
    .limit(1);
  return row ? toPublished(row) : null;
}
