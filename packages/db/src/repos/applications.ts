// The applicant's school list, "Pack coming soon" votes, Profile Reads and kit previews (spec §5.4,
// §5.5, §10). Every statement is scoped to the owner, like the rest of the user repositories.
//
// Status `preview` is set here when a preview is saved; `unlocked` belongs to checkout (Phase 4).
// Neither can be set through UserSchoolPatch.

import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { DbExecutor } from "../client";
import {
  kits,
  profileReads,
  schoolCycles,
  schoolInterestVotes,
  schools,
  sources,
  userSchoolStatuses,
  userSchools,
  type CycleRound,
  type ProfileReadContent,
  type UserSchoolFit,
} from "../schema";
import { assertId } from "./ids";

export type UserSchool = typeof userSchools.$inferSelect;
export type Kit = typeof kits.$inferSelect;
export type ProfileRead = typeof profileReads.$inferSelect;

/* User schools ------------------------------------------------------------------------------- */

export const NewUserSchool = z.strictObject({
  schoolCycleId: z.guid(),
  round: z.string().trim().min(1).max(40).nullable().optional(),
  isReapplicant: z.boolean().optional(),
});
export type NewUserSchool = z.input<typeof NewUserSchool>;

/** Statuses the applicant sets; `preview` and `unlocked` are set by the system. */
export const applicantSchoolStatuses = userSchoolStatuses.filter(
  (s) => s !== "preview" && s !== "unlocked",
) as Exclude<(typeof userSchoolStatuses)[number], "preview" | "unlocked">[];

export const UserSchoolPatch = z
  .strictObject({
    round: z.string().trim().min(1).max(40).nullable(),
    status: z.enum(applicantSchoolStatuses),
    isReapplicant: z.boolean(),
    previousOutcome: z.string().trim().max(200).nullable(),
    previousMaterialsSourceId: z.guid().nullable(),
  })
  .partial();
export type UserSchoolPatch = z.input<typeof UserSchoolPatch>;

export interface UserSchoolWithSchool extends UserSchool {
  cycle: { id: string; cycle: string; status: string; rounds: CycleRound[] };
  school: {
    id: string;
    slug: string;
    name: string;
    shortName: string;
    country: string | null;
    region: string;
  };
}

/** Adds a school-cycle to the applicant's list. Adding one twice returns the existing row. */
export async function addUserSchool(
  db: DbExecutor,
  userId: string,
  input: NewUserSchool,
): Promise<UserSchool> {
  const ownerId = assertId(userId, "userId");
  const values = NewUserSchool.parse(input);
  const [created] = await db
    .insert(userSchools)
    .values({
      userId: ownerId,
      schoolCycleId: values.schoolCycleId,
      round: values.round ?? null,
      isReapplicant: values.isReapplicant ?? false,
    })
    .onConflictDoNothing({ target: [userSchools.userId, userSchools.schoolCycleId] })
    .returning();
  if (created) return created;
  const [existing] = await db
    .select()
    .from(userSchools)
    .where(
      and(eq(userSchools.userId, ownerId), eq(userSchools.schoolCycleId, values.schoolCycleId)),
    )
    .limit(1);
  if (!existing) throw new Error("Failed to add school");
  return existing;
}

export async function listUserSchools(
  db: DbExecutor,
  userId: string,
): Promise<UserSchoolWithSchool[]> {
  const rows = await db
    .select({
      userSchool: userSchools,
      cycle: {
        id: schoolCycles.id,
        cycle: schoolCycles.cycle,
        status: schoolCycles.status,
        rounds: schoolCycles.rounds,
      },
      school: {
        id: schools.id,
        slug: schools.slug,
        name: schools.name,
        shortName: schools.shortName,
        country: schools.country,
        region: schools.region,
      },
    })
    .from(userSchools)
    .innerJoin(schoolCycles, eq(schoolCycles.id, userSchools.schoolCycleId))
    .innerJoin(schools, eq(schools.id, schoolCycles.schoolId))
    .where(eq(userSchools.userId, assertId(userId, "userId")))
    .orderBy(asc(userSchools.createdAt));
  return rows.map((r) => ({ ...r.userSchool, cycle: r.cycle, school: r.school }));
}

export async function getUserSchool(
  db: DbExecutor,
  userId: string,
  userSchoolId: string,
): Promise<UserSchool | null> {
  const [row] = await db
    .select()
    .from(userSchools)
    .where(
      and(
        eq(userSchools.userId, assertId(userId, "userId")),
        eq(userSchools.id, assertId(userSchoolId, "userSchoolId")),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function updateUserSchool(
  db: DbExecutor,
  userId: string,
  userSchoolId: string,
  patch: UserSchoolPatch,
): Promise<UserSchool | null> {
  const ownerId = assertId(userId, "userId");
  const id = assertId(userSchoolId, "userSchoolId");
  const values = UserSchoolPatch.parse(patch);
  if (Object.keys(values).length === 0) return getUserSchool(db, ownerId, id);
  // The previous application's materials must be one of the applicant's own sources.
  if (values.previousMaterialsSourceId) {
    const [own] = await db
      .select({ id: sources.id })
      .from(sources)
      .where(and(eq(sources.userId, ownerId), eq(sources.id, values.previousMaterialsSourceId)))
      .limit(1);
    if (!own) return null;
  }
  const [row] = await db
    .update(userSchools)
    .set(values)
    .where(and(eq(userSchools.userId, ownerId), eq(userSchools.id, id)))
    .returning();
  return row ?? null;
}

export class UserSchoolLockedError extends Error {
  override name = "UserSchoolLockedError";
}

/**
 * Removes a school from the list. Refused once it is unlocked (or past it), because the kit,
 * drafts and purchase hang off it.
 */
export async function removeUserSchool(
  db: DbExecutor,
  userId: string,
  userSchoolId: string,
): Promise<boolean> {
  const ownerId = assertId(userId, "userId");
  const id = assertId(userSchoolId, "userSchoolId");
  const rows = await db
    .delete(userSchools)
    .where(
      and(
        eq(userSchools.userId, ownerId),
        eq(userSchools.id, id),
        sql`${userSchools.status} in ('considering', 'preview')`,
      ),
    )
    .returning({ id: userSchools.id });
  if (rows.length > 0) return true;
  if (await getUserSchool(db, ownerId, id))
    throw new UserSchoolLockedError("An unlocked school stays on the list");
  return false;
}

/** Stores computed fit (§5.5) with the pack version it was computed against. */
export async function saveUserSchoolFit(
  db: DbExecutor,
  userId: string,
  userSchoolId: string,
  fit: UserSchoolFit,
  packVersion: number | null,
): Promise<UserSchool | null> {
  const value = z.record(z.string(), z.unknown()).parse(fit);
  const [row] = await db
    .update(userSchools)
    .set({ fit: value, fitPackVersion: packVersion === null ? null : z.int().parse(packVersion) })
    .where(
      and(
        eq(userSchools.userId, assertId(userId, "userId")),
        eq(userSchools.id, assertId(userSchoolId, "userSchoolId")),
      ),
    )
    .returning();
  return row ?? null;
}

/* Interest votes ----------------------------------------------------------------------------- */

/** Records the applicant's vote for a school without a pack. True when it is a new vote. */
export async function voteForSchool(
  db: DbExecutor,
  userId: string,
  schoolId: string,
): Promise<boolean> {
  const rows = await db
    .insert(schoolInterestVotes)
    .values({ userId: assertId(userId, "userId"), schoolId: assertId(schoolId, "schoolId") })
    .onConflictDoNothing({ target: [schoolInterestVotes.userId, schoolInterestVotes.schoolId] })
    .returning({ id: schoolInterestVotes.id });
  return rows.length > 0;
}

export async function withdrawSchoolVote(
  db: DbExecutor,
  userId: string,
  schoolId: string,
): Promise<boolean> {
  const rows = await db
    .delete(schoolInterestVotes)
    .where(
      and(
        eq(schoolInterestVotes.userId, assertId(userId, "userId")),
        eq(schoolInterestVotes.schoolId, assertId(schoolId, "schoolId")),
      ),
    )
    .returning({ id: schoolInterestVotes.id });
  return rows.length > 0;
}

/** School ids the applicant voted for. */
export async function listSchoolVotes(db: DbExecutor, userId: string): Promise<string[]> {
  const rows = await db
    .select({ schoolId: schoolInterestVotes.schoolId })
    .from(schoolInterestVotes)
    .where(eq(schoolInterestVotes.userId, assertId(userId, "userId")));
  return rows.map((r) => r.schoolId);
}

/** How many applicants want a school; an aggregate that identifies no one. */
export async function countSchoolVotes(db: DbExecutor, schoolId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(schoolInterestVotes)
    .where(eq(schoolInterestVotes.schoolId, assertId(schoolId, "schoolId")));
  return row?.n ?? 0;
}

/* Profile Reads ------------------------------------------------------------------------------ */

export const NewProfileRead = z.strictObject({
  content: z.record(z.string(), z.unknown()),
  builtFromSnapshotVersion: z.int().positive().nullable(),
  model: z.string().trim().min(1).max(200).nullable().optional(),
});
export type NewProfileRead = z.input<typeof NewProfileRead>;

/** Saves the next version. The unique (user, version) constraint settles a concurrent save. */
export async function saveProfileRead(
  db: DbExecutor,
  userId: string,
  input: NewProfileRead,
): Promise<ProfileRead> {
  const ownerId = assertId(userId, "userId");
  const values = NewProfileRead.parse(input);
  const [row] = await db
    .insert(profileReads)
    .values({
      userId: ownerId,
      version: sql`(select coalesce(max(${profileReads.version}), 0) + 1 from ${profileReads} where ${profileReads.userId} = ${ownerId})`,
      content: values.content as ProfileReadContent,
      builtFromSnapshotVersion: values.builtFromSnapshotVersion,
      model: values.model ?? null,
    })
    .returning();
  if (!row) throw new Error("Failed to save Profile Read");
  return row;
}

export async function getLatestProfileRead(
  db: DbExecutor,
  userId: string,
): Promise<ProfileRead | null> {
  const [row] = await db
    .select()
    .from(profileReads)
    .where(eq(profileReads.userId, assertId(userId, "userId")))
    .orderBy(desc(profileReads.version))
    .limit(1);
  return row ?? null;
}

/* Kit previews ------------------------------------------------------------------------------- */

export const KitPreviewInput = z.strictObject({
  positioning: z.record(z.string(), z.unknown()),
  fileMap: z.record(z.string(), z.unknown()),
  gaps: z.array(z.unknown()).nullable().optional(),
  dossierSnapshotVersion: z.int().positive().nullable(),
  packVersion: z.int().positive(),
  costUsd: z.number().finite().nonnegative().optional(),
});
export type KitPreviewInput = z.input<typeof KitPreviewInput>;

export class KitAlreadyUnlockedError extends Error {
  override name = "KitAlreadyUnlockedError";
}

/** The newest kit for one of the applicant's schools, preview or full. */
export async function getKitForUserSchool(
  db: DbExecutor,
  userId: string,
  userSchoolId: string,
): Promise<Kit | null> {
  const [row] = await db
    .select()
    .from(kits)
    .where(
      and(
        eq(kits.userId, assertId(userId, "userId")),
        eq(kits.userSchoolId, assertId(userSchoolId, "userSchoolId")),
      ),
    )
    .orderBy(desc(kits.createdAt))
    .limit(1);
  return row ?? null;
}

export async function listKits(db: DbExecutor, userId: string): Promise<Kit[]> {
  return db
    .select()
    .from(kits)
    .where(eq(kits.userId, assertId(userId, "userId")))
    .orderBy(desc(kits.createdAt));
}

/**
 * Saves the free kit preview for one of the applicant's schools (§5.5): positioning and file map,
 * replacing an earlier preview, and moves the school from `considering` to `preview`. `costUsd` is
 * this run's cost and adds to the kit's running total, so a regenerated preview still shows
 * everything spent on it. Returns null when the school is not on the caller's list; refuses once a
 * full kit exists.
 */
export async function saveKitPreview(
  db: DbExecutor,
  userId: string,
  userSchoolId: string,
  input: KitPreviewInput,
): Promise<Kit | null> {
  const ownerId = assertId(userId, "userId");
  const id = assertId(userSchoolId, "userSchoolId");
  const values = KitPreviewInput.parse(input);
  return db.transaction(async (tx) => {
    const [owned] = await tx
      .select({ id: userSchools.id, status: userSchools.status })
      .from(userSchools)
      .where(and(eq(userSchools.userId, ownerId), eq(userSchools.id, id)))
      .limit(1)
      .for("update");
    if (!owned) return null;
    const existing = await tx
      .select({ id: kits.id, status: kits.status })
      .from(kits)
      .where(and(eq(kits.userId, ownerId), eq(kits.userSchoolId, id)));
    if (existing.some((k) => k.status !== "preview"))
      throw new KitAlreadyUnlockedError("This school already has a full kit");

    const cost = values.costUsd ?? 0;
    const row = {
      positioning: values.positioning,
      fileMap: values.fileMap,
      gaps: values.gaps ?? null,
      dossierSnapshotVersion: values.dossierSnapshotVersion,
      packVersion: values.packVersion,
    };
    const preview = existing[0];
    const [kit] = preview
      ? await tx
          .update(kits)
          .set({ ...row, costUsd: sql`${kits.costUsd} + ${cost}` })
          .where(and(eq(kits.userId, ownerId), eq(kits.id, preview.id)))
          .returning()
      : await tx
          .insert(kits)
          .values({ userId: ownerId, userSchoolId: id, status: "preview", ...row, costUsd: cost })
          .returning();
    if (!kit) throw new Error("Failed to save kit preview");
    if (owned.status === "considering")
      await tx
        .update(userSchools)
        .set({ status: "preview" })
        .where(and(eq(userSchools.userId, ownerId), eq(userSchools.id, id)));
    return kit;
  });
}
