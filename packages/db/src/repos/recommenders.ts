// The Recommender Kit, applicant side (spec §5.11, §10), Phase 6. Every function takes the
// applicant's user id and is scoped by owner (`assertId`); a row that isn't theirs is null or [].
//
// The recommender's own writing (`recommender_workspaces.*_encrypted`) is never selected here: the
// only module that reads or writes it is recommender-portal.ts, reached by a portal token. What the
// applicant may see is status: invite dates, when the portal was opened, when the recommender
// started, and what they marked submitted (§14.3, packages/db/test/portal-boundary.test.ts).

import {
  RELATIONSHIPS,
  type LorPlan,
  type LorBrief,
  type BriefMeta,
  type LorStoryFields,
  type PlannedReminder,
  type StoredIntake,
} from "@admitstory/shared/kit";
import { nextCode } from "@admitstory/shared";
import { and, asc, desc, eq, inArray, isNull, lte, notInArray, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { DbExecutor } from "../client";
import { hashEmail } from "../crypto/tokens";
import {
  lorBriefs,
  lorPlans,
  profiles,
  users,
  lorStories,
  recommenderInvites,
  recommenderReminders,
  recommenderWorkspaces,
  recommenders,
  userSchools,
  type InviteRow,
  type InviteStatus,
  type LorBriefRow,
  type LorPlanRow,
  type LorStoryRow,
  type RecommenderRow,
  type ReminderRow,
  type ReminderStatus,
} from "../schema";
import { adminDb, type AdminContext } from "./admin";
import { assertId } from "./ids";

export type { InviteRow, LorBriefRow, LorPlanRow, LorStoryRow, RecommenderRow, ReminderRow };

/* Recommenders --------------------------------------------------------------------------------- */

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const email = z.string().trim().toLowerCase().max(254).pipe(z.email());

export const NewRecommender = z.strictObject({
  name: z.string().trim().min(1).max(120),
  email,
  title: optionalText(120),
  organisation: optionalText(160),
  relationship: z.enum(RELATIONSHIPS),
  durationText: optionalText(120),
  frequencyText: optionalText(120),
  userSchoolIds: z.array(z.guid()).max(20).default([]),
});
export type NewRecommender = z.input<typeof NewRecommender>;

export const RecommenderPatch = z.strictObject({
  name: z.string().trim().min(1).max(120).optional(),
  email: email.optional(),
  title: optionalText(120),
  organisation: optionalText(160),
  relationship: z.enum(RELATIONSHIPS).optional(),
  durationText: optionalText(120),
  frequencyText: optionalText(120),
  userSchoolIds: z.array(z.guid()).max(20).optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});
export type RecommenderPatch = z.input<typeof RecommenderPatch>;

const blank = (value: string | null | undefined) =>
  value === undefined ? undefined : value === null || value === "" ? null : value;

/** Only the applicant's own user_schools ids survive, in the order given, without repeats. */
async function ownSchoolIds(
  db: DbExecutor,
  ownerId: string,
  ids: readonly string[],
): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select({ id: userSchools.id })
    .from(userSchools)
    .where(and(eq(userSchools.userId, ownerId), inArray(userSchools.id, [...new Set(ids)])));
  const owned = new Set(rows.map((r) => r.id));
  return [...new Set(ids)].filter((id) => owned.has(id));
}

/** One transaction-scoped lock per applicant and purpose, so refs and R codes never collide. */
async function lockFor(db: DbExecutor, purpose: string, ownerId: string): Promise<void> {
  await db.execute(sql`select pg_advisory_xact_lock(hashtext(${`${purpose}:${ownerId}`}))`);
}

export async function createRecommender(
  db: DbExecutor,
  userId: string,
  input: NewRecommender,
): Promise<RecommenderRow> {
  const ownerId = assertId(userId, "userId");
  const values = NewRecommender.parse(input);
  return db.transaction(async (tx) => {
    await lockFor(tx, "recommenders", ownerId);
    // Refs count archived recommenders too, so "rec2" never means two different people.
    const existing = await tx
      .select({ ref: recommenders.ref, sortOrder: recommenders.sortOrder })
      .from(recommenders)
      .where(eq(recommenders.userId, ownerId));
    const highest = existing.reduce((max, r) => {
      const n = Number(/^rec(\d+)$/.exec(r.ref)?.[1] ?? 0);
      return n > max ? n : max;
    }, 0);
    const [row] = await tx
      .insert(recommenders)
      .values({
        userId: ownerId,
        ref: `rec${highest + 1}`,
        name: values.name,
        email: values.email,
        title: blank(values.title) ?? null,
        organisation: blank(values.organisation) ?? null,
        relationship: values.relationship,
        durationText: blank(values.durationText) ?? null,
        frequencyText: blank(values.frequencyText) ?? null,
        userSchoolIds: await ownSchoolIds(tx, ownerId, values.userSchoolIds),
        sortOrder: existing.reduce((max, r) => Math.max(max, r.sortOrder + 1), 0),
      })
      .returning();
    if (!row) throw new Error("Failed to create recommender");
    return row;
  });
}

const owned = (ownerId: string, id: string) =>
  and(eq(recommenders.userId, ownerId), eq(recommenders.id, assertId(id, "recommenderId")));

export async function getRecommender(
  db: DbExecutor,
  userId: string,
  recommenderId: string,
  options: { includeArchived?: boolean } = {},
): Promise<RecommenderRow | null> {
  const ownerId = assertId(userId, "userId");
  const [row] = await db
    .select()
    .from(recommenders)
    .where(
      and(
        owned(ownerId, recommenderId),
        options.includeArchived ? undefined : isNull(recommenders.archivedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** The applicant's recommenders in their order; `userSchoolId` keeps those writing for that school. */
export async function listRecommenders(
  db: DbExecutor,
  userId: string,
  options: { userSchoolId?: string; includeArchived?: boolean } = {},
): Promise<RecommenderRow[]> {
  const ownerId = assertId(userId, "userId");
  const conditions: SQL[] = [eq(recommenders.userId, ownerId)];
  if (!options.includeArchived) conditions.push(isNull(recommenders.archivedAt));
  if (options.userSchoolId)
    conditions.push(
      sql`${assertId(options.userSchoolId, "userSchoolId")}::uuid = any(${recommenders.userSchoolIds})`,
    );
  return db
    .select()
    .from(recommenders)
    .where(and(...conditions))
    .orderBy(asc(recommenders.sortOrder), asc(recommenders.createdAt));
}

/**
 * Updates a recommender's details. Changing the address here only changes the row: the route
 * revokes the link and deletes the old workspace first (decision 8).
 */
export async function updateRecommender(
  db: DbExecutor,
  userId: string,
  recommenderId: string,
  patch: RecommenderPatch,
): Promise<RecommenderRow | null> {
  const ownerId = assertId(userId, "userId");
  const values = RecommenderPatch.parse(patch);
  const set: Partial<typeof recommenders.$inferInsert> = {};
  if (values.name !== undefined) set.name = values.name;
  if (values.email !== undefined) set.email = values.email;
  if (values.title !== undefined) set.title = blank(values.title) ?? null;
  if (values.organisation !== undefined) set.organisation = blank(values.organisation) ?? null;
  if (values.relationship !== undefined) set.relationship = values.relationship;
  if (values.durationText !== undefined) set.durationText = blank(values.durationText) ?? null;
  if (values.frequencyText !== undefined) set.frequencyText = blank(values.frequencyText) ?? null;
  if (values.sortOrder !== undefined) set.sortOrder = values.sortOrder;
  if (values.userSchoolIds !== undefined)
    set.userSchoolIds = await ownSchoolIds(db, ownerId, values.userSchoolIds);
  if (Object.keys(set).length === 0) return getRecommender(db, ownerId, recommenderId);
  const [row] = await db
    .update(recommenders)
    .set({ ...set, updatedAt: sql`now()` })
    .where(and(owned(ownerId, recommenderId), isNull(recommenders.archivedAt)))
    .returning();
  return row ?? null;
}

/**
 * Removes a recommender from the applicant's view (DELETE /api/recommenders/:id): archives the row,
 * revokes any live link, deletes the recommender's workspace (their notes and letter) and every
 * reminder that hasn't gone out. Stories and briefs stay with the archived row. One transaction.
 */
export async function archiveRecommender(
  db: DbExecutor,
  userId: string,
  recommenderId: string,
  now: Date = new Date(),
): Promise<RecommenderRow | null> {
  const ownerId = assertId(userId, "userId");
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(recommenders)
      .set({ archivedAt: now, updatedAt: sql`now()` })
      .where(and(owned(ownerId, recommenderId), isNull(recommenders.archivedAt)))
      .returning();
    if (!row) return null;
    await tx
      .update(recommenderInvites)
      .set({ status: "revoked", revokedAt: now, updatedAt: sql`now()` })
      .where(
        and(
          eq(recommenderInvites.userId, ownerId),
          eq(recommenderInvites.recommenderId, row.id),
          eq(recommenderInvites.status, "active"),
        ),
      );
    await tx
      .delete(recommenderWorkspaces)
      .where(
        and(
          eq(recommenderWorkspaces.userId, ownerId),
          eq(recommenderWorkspaces.recommenderId, row.id),
        ),
      );
    await tx
      .delete(recommenderReminders)
      .where(
        and(
          eq(recommenderReminders.userId, ownerId),
          eq(recommenderReminders.recommenderId, row.id),
          notInArray(recommenderReminders.status, ["sent", "skipped"]),
        ),
      );
    return row;
  });
}

/** The extracted intake and the `sources` rows (kind recommender_intake) it came from. */
export async function saveIntake(
  db: DbExecutor,
  userId: string,
  recommenderId: string,
  input: { intake: StoredIntake; sourceIds: string[] },
): Promise<RecommenderRow | null> {
  const ownerId = assertId(userId, "userId");
  const [row] = await db
    .update(recommenders)
    .set({
      intake: input.intake,
      intakeSourceIds: input.sourceIds.map((id) => assertId(id, "sourceId")),
      updatedAt: sql`now()`,
    })
    .where(and(owned(ownerId, recommenderId), isNull(recommenders.archivedAt)))
    .returning();
  return row ?? null;
}

/* Stories (R codes) ---------------------------------------------------------------------------- */

export async function listLorStories(
  db: DbExecutor,
  userId: string,
  options: { recommenderId?: string } = {},
): Promise<LorStoryRow[]> {
  const ownerId = assertId(userId, "userId");
  return db
    .select()
    .from(lorStories)
    .where(
      and(
        eq(lorStories.userId, ownerId),
        options.recommenderId
          ? eq(lorStories.recommenderId, assertId(options.recommenderId, "recommenderId"))
          : undefined,
      ),
    )
    .orderBy(asc(lorStories.recommenderId), asc(lorStories.sortOrder), asc(lorStories.code));
}

/**
 * Replaces a recommender's extracted stories with a new extraction. Stories the applicant edited
 * or added by hand are kept. New stories get the next R codes after every code the applicant has
 * now (a code deleted by this call is never handed out again by it). Returns all of the
 * recommender's stories, or [] when the recommender isn't theirs.
 */
export async function replaceExtractedStories(
  db: DbExecutor,
  userId: string,
  recommenderId: string,
  stories: readonly LorStoryFields[],
  sourceIds: readonly string[],
): Promise<LorStoryRow[]> {
  const ownerId = assertId(userId, "userId");
  const owner = await getRecommender(db, ownerId, recommenderId);
  if (!owner) return [];
  const sources = sourceIds.map((id) => assertId(id, "sourceId"));
  await db.transaction(async (tx) => {
    await lockFor(tx, "lor_stories", ownerId);
    const existing = await tx
      .select({ code: lorStories.code, recommenderId: lorStories.recommenderId })
      .from(lorStories)
      .where(eq(lorStories.userId, ownerId));
    const codes = existing.map((r) => r.code);
    await tx
      .delete(lorStories)
      .where(
        and(
          eq(lorStories.userId, ownerId),
          eq(lorStories.recommenderId, owner.id),
          eq(lorStories.origin, "extracted"),
        ),
      );
    const kept = await tx
      .select({ sortOrder: lorStories.sortOrder })
      .from(lorStories)
      .where(and(eq(lorStories.userId, ownerId), eq(lorStories.recommenderId, owner.id)));
    let order = kept.reduce((max, r) => Math.max(max, r.sortOrder + 1), 0);
    const values = stories.map((fields) => {
      const code = nextCode("lor_story", codes);
      codes.push(code);
      return {
        userId: ownerId,
        recommenderId: owner.id,
        code,
        fields,
        origin: "extracted" as const,
        sourceIds: sources,
        sortOrder: order++,
      };
    });
    if (values.length > 0) await tx.insert(lorStories).values(values);
  });
  return listLorStories(db, ownerId, { recommenderId: owner.id });
}

export async function createManualLorStory(
  db: DbExecutor,
  userId: string,
  recommenderId: string,
  fields: LorStoryFields,
): Promise<LorStoryRow | null> {
  const ownerId = assertId(userId, "userId");
  const owner = await getRecommender(db, ownerId, recommenderId);
  if (!owner) return null;
  return db.transaction(async (tx) => {
    await lockFor(tx, "lor_stories", ownerId);
    const existing = await tx
      .select({
        code: lorStories.code,
        recommenderId: lorStories.recommenderId,
        sortOrder: lorStories.sortOrder,
      })
      .from(lorStories)
      .where(eq(lorStories.userId, ownerId));
    const [row] = await tx
      .insert(lorStories)
      .values({
        userId: ownerId,
        recommenderId: owner.id,
        code: nextCode(
          "lor_story",
          existing.map((r) => r.code),
        ),
        fields,
        origin: "manual",
        sortOrder: existing
          .filter((r) => r.recommenderId === owner.id)
          .reduce((max, r) => Math.max(max, r.sortOrder + 1), 0),
      })
      .returning();
    return row ?? null;
  });
}

/** Merges the applicant's changes into a story; an extracted story becomes "edited" and is kept. */
export async function updateLorStory(
  db: DbExecutor,
  userId: string,
  storyId: string,
  patch: Partial<LorStoryFields>,
): Promise<LorStoryRow | null> {
  const ownerId = assertId(userId, "userId");
  const id = assertId(storyId, "storyId");
  const [current] = await db
    .select()
    .from(lorStories)
    .where(and(eq(lorStories.userId, ownerId), eq(lorStories.id, id)))
    .limit(1);
  if (!current) return null;
  const [row] = await db
    .update(lorStories)
    .set({
      fields: { ...current.fields, ...patch },
      origin: current.origin === "manual" ? "manual" : "edited",
      updatedAt: sql`now()`,
    })
    .where(and(eq(lorStories.userId, ownerId), eq(lorStories.id, id)))
    .returning();
  return row ?? null;
}

export async function deleteLorStory(
  db: DbExecutor,
  userId: string,
  storyId: string,
): Promise<boolean> {
  const rows = await db
    .delete(lorStories)
    .where(
      and(
        eq(lorStories.userId, assertId(userId, "userId")),
        eq(lorStories.id, assertId(storyId, "storyId")),
      ),
    )
    .returning({ id: lorStories.id });
  return rows.length > 0;
}

/* Coverage plan -------------------------------------------------------------------------------- */

export async function getLorPlan(db: DbExecutor, userId: string): Promise<LorPlanRow | null> {
  const [row] = await db
    .select()
    .from(lorPlans)
    .where(eq(lorPlans.userId, assertId(userId, "userId")))
    .limit(1);
  return row ?? null;
}

/** Saves the applicant's plan; a later save replaces it and bumps the version. */
export async function saveLorPlan(
  db: DbExecutor,
  userId: string,
  input: { content: LorPlan; inputHash: string; dossierSnapshotVersion: number },
): Promise<LorPlanRow> {
  const ownerId = assertId(userId, "userId");
  const [row] = await db
    .insert(lorPlans)
    .values({ userId: ownerId, ...input })
    .onConflictDoUpdate({
      target: lorPlans.userId,
      set: { ...input, version: sql`${lorPlans.version} + 1`, updatedAt: sql`now()` },
    })
    .returning();
  if (!row) throw new Error("Failed to save the recommender plan");
  return row;
}

/* Briefs --------------------------------------------------------------------------------------- */

export async function getLorBrief(
  db: DbExecutor,
  userId: string,
  recommenderId: string,
  groupKey: string,
): Promise<LorBriefRow | null> {
  const [row] = await db
    .select()
    .from(lorBriefs)
    .where(
      and(
        eq(lorBriefs.userId, assertId(userId, "userId")),
        eq(lorBriefs.recommenderId, assertId(recommenderId, "recommenderId")),
        eq(lorBriefs.groupKey, groupKey),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function listLorBriefs(
  db: DbExecutor,
  userId: string,
  options: { recommenderId?: string } = {},
): Promise<LorBriefRow[]> {
  return db
    .select()
    .from(lorBriefs)
    .where(
      and(
        eq(lorBriefs.userId, assertId(userId, "userId")),
        options.recommenderId
          ? eq(lorBriefs.recommenderId, assertId(options.recommenderId, "recommenderId"))
          : undefined,
      ),
    )
    .orderBy(asc(lorBriefs.recommenderId), asc(lorBriefs.groupKey));
}

/** Marks one brief as building (creating its row). The previous content stays until it's replaced. */
export async function markLorBriefBuilding(
  db: DbExecutor,
  userId: string,
  recommenderId: string,
  input: {
    groupKey: string;
    schoolCycleIds: string[];
    inputHash: string;
    chargedRefId: string | null;
  },
): Promise<LorBriefRow | null> {
  const ownerId = assertId(userId, "userId");
  const owner = await getRecommender(db, ownerId, recommenderId);
  if (!owner) return null;
  const values = {
    schoolCycleIds: input.schoolCycleIds.map((id) => assertId(id, "schoolCycleId")),
    status: "building" as const,
    inputHash: input.inputHash,
    chargedRefId: input.chargedRefId === null ? null : assertId(input.chargedRefId, "chargedRefId"),
    error: null,
  };
  const [row] = await db
    .insert(lorBriefs)
    .values({ userId: ownerId, recommenderId: owner.id, groupKey: input.groupKey, ...values })
    .onConflictDoUpdate({
      target: [lorBriefs.recommenderId, lorBriefs.groupKey],
      set: { ...values, updatedAt: sql`now()` },
      setWhere: eq(lorBriefs.userId, ownerId),
    })
    .returning();
  return row ?? null;
}

/** Stores a finished brief: status ready, version + 1, built now. */
export async function saveLorBrief(
  db: DbExecutor,
  userId: string,
  recommenderId: string,
  groupKey: string,
  input: {
    content: LorBrief;
    meta: BriefMeta;
    planVersion: number | null;
    dossierSnapshotVersion: number;
  },
): Promise<LorBriefRow | null> {
  const ownerId = assertId(userId, "userId");
  const owner = await getRecommender(db, ownerId, recommenderId, { includeArchived: true });
  if (!owner) return null;
  const values = {
    status: "ready" as const,
    content: input.content,
    meta: input.meta,
    planVersion: input.planVersion,
    dossierSnapshotVersion: input.dossierSnapshotVersion,
    error: null,
    builtAt: sql`now()`,
  };
  const [row] = await db
    .insert(lorBriefs)
    .values({
      userId: ownerId,
      recommenderId: owner.id,
      groupKey,
      schoolCycleIds: input.meta.schools.map((s) => assertId(s.schoolCycleId, "schoolCycleId")),
      version: 1,
      ...values,
    })
    .onConflictDoUpdate({
      target: [lorBriefs.recommenderId, lorBriefs.groupKey],
      set: { ...values, version: sql`${lorBriefs.version} + 1`, updatedAt: sql`now()` },
      setWhere: eq(lorBriefs.userId, ownerId),
    })
    .returning();
  return row ?? null;
}

export async function failLorBrief(
  db: DbExecutor,
  userId: string,
  recommenderId: string,
  groupKey: string,
  error: string,
): Promise<LorBriefRow | null> {
  const [row] = await db
    .update(lorBriefs)
    .set({ status: "failed", error: error.slice(0, 500), updatedAt: sql`now()` })
    .where(
      and(
        eq(lorBriefs.userId, assertId(userId, "userId")),
        eq(lorBriefs.recommenderId, assertId(recommenderId, "recommenderId")),
        eq(lorBriefs.groupKey, groupKey),
      ),
    )
    .returning();
  return row ?? null;
}

/* Invites (applicant side: never sees a raw token; the caller supplies its hash) --------------- */

/**
 * Sends a new link: revokes any live one, records the new invite, and binds the workspace for
 * this address to it, creating the workspace the first time. Reissuing to the same address keeps
 * what the recommender wrote (decision 8). Null when the recommender isn't theirs.
 */
export async function issueInvite(
  db: DbExecutor,
  userId: string,
  recommenderId: string,
  input: { tokenHash: string; emailHash: string; expiresAt: Date; now: Date },
): Promise<InviteRow | null> {
  const ownerId = assertId(userId, "userId");
  const owner = await getRecommender(db, ownerId, recommenderId);
  if (!owner) return null;
  return db.transaction(async (tx) => {
    await tx
      .update(recommenderInvites)
      .set({ status: "revoked", revokedAt: input.now, updatedAt: sql`now()` })
      .where(
        and(
          eq(recommenderInvites.userId, ownerId),
          eq(recommenderInvites.recommenderId, owner.id),
          eq(recommenderInvites.status, "active"),
        ),
      );
    const [invite] = await tx
      .insert(recommenderInvites)
      .values({
        userId: ownerId,
        recommenderId: owner.id,
        emailHash: input.emailHash,
        tokenHash: input.tokenHash,
        status: "active",
        sentAt: input.now,
        expiresAt: input.expiresAt,
      })
      .returning();
    if (!invite) throw new Error("Failed to record the invite");
    await tx
      .insert(recommenderWorkspaces)
      .values({
        userId: ownerId,
        recommenderId: owner.id,
        emailHash: input.emailHash,
        inviteId: invite.id,
      })
      .onConflictDoUpdate({
        target: [recommenderWorkspaces.recommenderId, recommenderWorkspaces.emailHash],
        set: { inviteId: invite.id, updatedAt: sql`now()` },
        setWhere: eq(recommenderWorkspaces.userId, ownerId),
      });
    return invite;
  });
}

/** A check-in's fresh link: the old hash is kept so the old link says "replaced" (decision 9). */
export async function rotateInviteToken(
  db: DbExecutor,
  userId: string,
  inviteId: string,
  input: { tokenHash: string },
): Promise<InviteRow | null> {
  const [row] = await db
    .update(recommenderInvites)
    .set({
      previousTokenHash: sql`${recommenderInvites.tokenHash}`,
      tokenHash: input.tokenHash,
      sendCount: sql`${recommenderInvites.sendCount} + 1`,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(recommenderInvites.userId, assertId(userId, "userId")),
        eq(recommenderInvites.id, assertId(inviteId, "inviteId")),
        eq(recommenderInvites.status, "active"),
      ),
    )
    .returning();
  return row ?? null;
}

/** "Turn off the link". Returns the revoked invite, or null when there was no live one. */
export async function revokeInvite(
  db: DbExecutor,
  userId: string,
  recommenderId: string,
  now: Date = new Date(),
): Promise<InviteRow | null> {
  const [row] = await db
    .update(recommenderInvites)
    .set({ status: "revoked", revokedAt: now, updatedAt: sql`now()` })
    .where(
      and(
        eq(recommenderInvites.userId, assertId(userId, "userId")),
        eq(recommenderInvites.recommenderId, assertId(recommenderId, "recommenderId")),
        eq(recommenderInvites.status, "active"),
      ),
    )
    .returning();
  return row ?? null;
}

export interface InviteStatusRow {
  id: string;
  status: InviteStatus;
  sentAt: Date;
  expiresAt: Date;
  lastOpenedAt: Date | null;
  sendCount: number;
}

const inviteStatusColumns = {
  id: recommenderInvites.id,
  recommenderId: recommenderInvites.recommenderId,
  status: recommenderInvites.status,
  sentAt: recommenderInvites.sentAt,
  expiresAt: recommenderInvites.expiresAt,
  lastOpenedAt: recommenderInvites.lastOpenedAt,
  sendCount: recommenderInvites.sendCount,
};

/** The newest invite's status. A live invite past its expiry is marked expired on the way. */
export async function getInviteStatus(
  db: DbExecutor,
  userId: string,
  recommenderId: string,
  now: Date = new Date(),
): Promise<InviteStatusRow | null> {
  const ownerId = assertId(userId, "userId");
  const [row] = await db
    .select(inviteStatusColumns)
    .from(recommenderInvites)
    .where(
      and(
        eq(recommenderInvites.userId, ownerId),
        eq(recommenderInvites.recommenderId, assertId(recommenderId, "recommenderId")),
      ),
    )
    .orderBy(desc(recommenderInvites.sentAt), desc(recommenderInvites.createdAt))
    .limit(1);
  if (!row) return null;
  let status = row.status;
  if (status === "active" && row.expiresAt.getTime() <= now.getTime()) {
    await db
      .update(recommenderInvites)
      .set({ status: "expired", updatedAt: sql`now()` })
      .where(
        and(
          eq(recommenderInvites.userId, ownerId),
          eq(recommenderInvites.id, row.id),
          eq(recommenderInvites.status, "active"),
        ),
      );
    status = "expired";
  }
  return {
    id: row.id,
    status,
    sentAt: row.sentAt,
    expiresAt: row.expiresAt,
    lastOpenedAt: row.lastOpenedAt,
    sendCount: row.sendCount,
  };
}

/**
 * Deletes what a recommender wrote: every workspace of this recommender, or every one except the
 * workspace bound to `exceptEmailHash` (an address change, decision 8). Returns how many went.
 */
export async function deleteWorkspacesForRecommender(
  db: DbExecutor,
  userId: string,
  recommenderId: string,
  options: { exceptEmailHash?: string } = {},
): Promise<number> {
  const rows = await db
    .delete(recommenderWorkspaces)
    .where(
      and(
        eq(recommenderWorkspaces.userId, assertId(userId, "userId")),
        eq(recommenderWorkspaces.recommenderId, assertId(recommenderId, "recommenderId")),
        options.exceptEmailHash
          ? sql`${recommenderWorkspaces.emailHash} <> ${options.exceptEmailHash}`
          : undefined,
      ),
    )
    .returning({ id: recommenderWorkspaces.id });
  return rows.length;
}

/** What the applicant may know about each recommender: dates and marks, never content. */
export interface RecommenderStatusRow {
  recommenderId: string;
  invite: InviteStatusRow | null;
  /** When the recommender first opened the portal from the current address. */
  openedAt: Date | null;
  /** When they last wrote a note or a letter. */
  progressAt: Date | null;
  /** school_cycle_id → ISO time marked submitted. */
  submitted: Record<string, string>;
}

/**
 * Status for every current recommender. EXPLICIT select lists only: the workspace's encrypted
 * columns are never read here (portal-boundary.test.ts). The workspace is the one bound to the
 * recommender's current address. An invite past its expiry reads as expired.
 */
export async function listRecommenderStatuses(
  db: DbExecutor,
  userId: string,
  now: Date = new Date(),
): Promise<RecommenderStatusRow[]> {
  const ownerId = assertId(userId, "userId");
  const people = await db
    .select({ id: recommenders.id, email: recommenders.email })
    .from(recommenders)
    .where(and(eq(recommenders.userId, ownerId), isNull(recommenders.archivedAt)))
    .orderBy(asc(recommenders.sortOrder), asc(recommenders.createdAt));
  if (people.length === 0) return [];
  const ids = people.map((p) => p.id);
  const [invites, workspaces] = await Promise.all([
    db
      .selectDistinctOn([recommenderInvites.recommenderId], inviteStatusColumns)
      .from(recommenderInvites)
      .where(
        and(eq(recommenderInvites.userId, ownerId), inArray(recommenderInvites.recommenderId, ids)),
      )
      .orderBy(
        recommenderInvites.recommenderId,
        desc(recommenderInvites.sentAt),
        desc(recommenderInvites.createdAt),
      ),
    db
      .select({
        recommenderId: recommenderWorkspaces.recommenderId,
        emailHash: recommenderWorkspaces.emailHash,
        openedAt: recommenderWorkspaces.openedAt,
        progressAt: recommenderWorkspaces.progressAt,
        submitted: recommenderWorkspaces.submitted,
      })
      .from(recommenderWorkspaces)
      .where(
        and(
          eq(recommenderWorkspaces.userId, ownerId),
          inArray(recommenderWorkspaces.recommenderId, ids),
        ),
      ),
  ]);
  return people.map((person) => {
    const invite = invites.find((i) => i.recommenderId === person.id);
    const emailHash = hashEmail(person.email);
    const workspace = workspaces.find(
      (w) => w.recommenderId === person.id && w.emailHash === emailHash,
    );
    return {
      recommenderId: person.id,
      invite: invite
        ? {
            id: invite.id,
            status:
              invite.status === "active" && invite.expiresAt.getTime() <= now.getTime()
                ? "expired"
                : invite.status,
            sentAt: invite.sentAt,
            expiresAt: invite.expiresAt,
            lastOpenedAt: invite.lastOpenedAt,
            sendCount: invite.sendCount,
          }
        : null,
      openedAt: workspace?.openedAt ?? null,
      progressAt: workspace?.progressAt ?? null,
      submitted: { ...(workspace?.submitted ?? {}) },
    };
  });
}

/* Reminders (decisions 3 and 18) --------------------------------------------------------------- */

export async function listReminders(
  db: DbExecutor,
  userId: string,
  recommenderId: string,
): Promise<ReminderRow[]> {
  return db
    .select()
    .from(recommenderReminders)
    .where(
      and(
        eq(recommenderReminders.userId, assertId(userId, "userId")),
        eq(recommenderReminders.recommenderId, assertId(recommenderId, "recommenderId")),
      ),
    )
    .orderBy(asc(recommenderReminders.sendOn), asc(recommenderReminders.kind));
}

const UNTOUCHABLE: readonly ReminderStatus[] = ["sending", "sent", "skipped"];

/**
 * Brings the stored reminders in line with the planned schedule: inserts what's missing (as
 * "suggested"), moves a row whose date or schools changed (an "on" row becomes "changed" and needs
 * a new read before it sends), and deletes rows no longer planned that haven't gone out. Sent,
 * sending and skipped rows are history and never touched. Returns the recommender's reminders.
 */
export async function syncPlannedReminders(
  db: DbExecutor,
  userId: string,
  recommenderId: string,
  planned: readonly (PlannedReminder & { sendAt: Date })[],
): Promise<ReminderRow[]> {
  const ownerId = assertId(userId, "userId");
  const owner = await getRecommender(db, ownerId, recommenderId);
  if (!owner) return [];
  await db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(recommenderReminders)
      .where(
        and(
          eq(recommenderReminders.userId, ownerId),
          eq(recommenderReminders.recommenderId, owner.id),
        ),
      )
      .for("update");
    const key = (kind: string, deadline: string) => `${kind}|${deadline}`;
    const wanted = new Map(planned.map((p) => [key(p.kind, p.deadline), p]));
    const sameIds = (a: readonly string[], b: readonly string[]) =>
      a.length === b.length && [...a].sort().join() === [...b].sort().join();

    for (const row of existing) {
      if (UNTOUCHABLE.includes(row.status)) continue;
      const plan = wanted.get(key(row.kind, row.deadline));
      if (!plan) {
        await tx.delete(recommenderReminders).where(eq(recommenderReminders.id, row.id));
        continue;
      }
      const moved =
        row.sendOn !== plan.sendOn ||
        row.sendAt.getTime() !== plan.sendAt.getTime() ||
        !sameIds(row.schoolCycleIds, plan.schoolCycleIds);
      if (moved)
        await tx
          .update(recommenderReminders)
          .set({
            sendOn: plan.sendOn,
            sendAt: plan.sendAt,
            schoolCycleIds: plan.schoolCycleIds.map((id) => assertId(id, "schoolCycleId")),
            status: row.status === "on" ? "changed" : row.status,
            updatedAt: sql`now()`,
          })
          .where(eq(recommenderReminders.id, row.id));
    }
    const have = new Set(existing.map((row) => key(row.kind, row.deadline)));
    const missing = planned.filter((p) => !have.has(key(p.kind, p.deadline)));
    if (missing.length > 0)
      await tx
        .insert(recommenderReminders)
        .values(
          missing.map((p) => ({
            userId: ownerId,
            recommenderId: owner.id,
            kind: p.kind,
            deadline: p.deadline,
            schoolCycleIds: p.schoolCycleIds.map((id) => assertId(id, "schoolCycleId")),
            sendOn: p.sendOn,
            sendAt: p.sendAt,
            status: "suggested" as const,
          })),
        )
        .onConflictDoNothing();
  });
  return listReminders(db, ownerId, owner.id);
}

const ownedReminder = (ownerId: string, reminderId: string) =>
  and(
    eq(recommenderReminders.userId, ownerId),
    eq(recommenderReminders.id, assertId(reminderId, "reminderId")),
  );

/** The applicant's own line (≤ 300). Any change needs a new read; an "on" reminder becomes "changed". */
export async function setReminderNote(
  db: DbExecutor,
  userId: string,
  reminderId: string,
  note: string | null,
): Promise<ReminderRow | null> {
  const ownerId = assertId(userId, "userId");
  const value = note === null ? null : note.trim().slice(0, 300) || null;
  const [row] = await db
    .update(recommenderReminders)
    .set({
      note: value,
      previewHash: null,
      previewedAt: null,
      status: sql`case when ${recommenderReminders.status} = 'on' then 'changed' else ${recommenderReminders.status} end`,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        ownedReminder(ownerId, reminderId),
        notInArray(recommenderReminders.status, [...UNTOUCHABLE]),
      ),
    )
    .returning();
  return row ?? null;
}

/** "Read it": records which text the applicant read. Turning it on must match this hash. */
export async function previewReminder(
  db: DbExecutor,
  userId: string,
  reminderId: string,
  previewHash: string,
  now: Date = new Date(),
): Promise<ReminderRow | null> {
  const [row] = await db
    .update(recommenderReminders)
    .set({ previewHash, previewedAt: now, updatedAt: sql`now()` })
    .where(
      and(
        ownedReminder(assertId(userId, "userId"), reminderId),
        notInArray(recommenderReminders.status, [...UNTOUCHABLE]),
      ),
    )
    .returning();
  return row ?? null;
}

/**
 * "Turn on": only when `previewHash` is the text the applicant last read. "stale" when it isn't
 * (or the reminder has already gone out), null when the reminder isn't theirs.
 */
export async function enableReminder(
  db: DbExecutor,
  userId: string,
  reminderId: string,
  previewHash: string,
  now: Date = new Date(),
): Promise<"ok" | "stale" | null> {
  const ownerId = assertId(userId, "userId");
  const [row] = await db
    .update(recommenderReminders)
    .set({ status: "on", enabledAt: now, updatedAt: sql`now()` })
    .where(
      and(
        ownedReminder(ownerId, reminderId),
        eq(recommenderReminders.previewHash, previewHash),
        inArray(recommenderReminders.status, ["suggested", "off", "changed", "on"]),
      ),
    )
    .returning({ id: recommenderReminders.id });
  if (row) return "ok";
  const [exists] = await db
    .select({ id: recommenderReminders.id })
    .from(recommenderReminders)
    .where(ownedReminder(ownerId, reminderId))
    .limit(1);
  return exists ? "stale" : null;
}

export async function disableReminder(
  db: DbExecutor,
  userId: string,
  reminderId: string,
): Promise<ReminderRow | null> {
  const [row] = await db
    .update(recommenderReminders)
    .set({ status: "off", enabledAt: null, updatedAt: sql`now()` })
    .where(
      and(
        ownedReminder(assertId(userId, "userId"), reminderId),
        inArray(recommenderReminders.status, ["suggested", "on", "changed"]),
      ),
    )
    .returning();
  return row ?? null;
}

/* Reminders, system side (cron) ---------------------------------------------------------------- */

export type ReminderClaim = ReminderRow;

/**
 * Claims up to `limit` due reminders ("on" and `send_at` ≤ now) by moving them to "sending", in
 * one UPDATE … RETURNING whose inner select skips locked rows: two runs never claim the same row.
 * Takes an AdminContext from systemContext(db, job): a cron acts for no signed-in user.
 */
export async function claimDueReminders(
  ctx: AdminContext,
  now: Date,
  limit: number,
): Promise<ReminderClaim[]> {
  const db = adminDb(ctx);
  const take = Math.min(Math.max(Math.trunc(limit), 1), 500);
  const due = db
    .select({ id: recommenderReminders.id })
    .from(recommenderReminders)
    .where(and(eq(recommenderReminders.status, "on"), lte(recommenderReminders.sendAt, now)))
    .orderBy(asc(recommenderReminders.sendAt))
    .limit(take)
    .for("update", { skipLocked: true });
  return db
    .update(recommenderReminders)
    .set({ status: "sending", updatedAt: sql`now()` })
    .where(and(inArray(recommenderReminders.id, due), eq(recommenderReminders.status, "on")))
    .returning();
}

/** Records how a claimed reminder ended. Only a row in "sending" moves. */
export async function finishReminder(
  ctx: AdminContext,
  reminderId: string,
  outcome: {
    status: "sent" | "skipped" | "changed";
    deliveryId?: string | null;
    skippedReason?: string | null;
  },
  now: Date = new Date(),
): Promise<ReminderRow | null> {
  const db = adminDb(ctx);
  const [row] = await db
    .update(recommenderReminders)
    .set({
      status: outcome.status,
      sentAt: outcome.status === "sent" ? now : null,
      deliveryId: outcome.deliveryId?.slice(0, 200) ?? null,
      skippedReason: outcome.skippedReason?.slice(0, 300) ?? null,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(recommenderReminders.id, assertId(reminderId, "reminderId")),
        eq(recommenderReminders.status, "sending"),
      ),
    )
    .returning();
  return row ?? null;
}

/* The applicant, as a recommender sees them ---------------------------------------------------- */

export interface AccountIdentity {
  /** The account's name (Better Auth `users.name`). */
  name: string;
  /** The profile's display name, when the applicant set one. */
  displayName: string | null;
  email: string;
  /** IANA zone from the profile, or null. */
  timeZone: string | null;
}

/**
 * Who the applicant is, for the brief's "A note from …", the invite's From display name and
 * Reply-To, and 09:00 in their zone. Background jobs have no session, so this reads the row.
 */
export async function getAccountIdentity(
  db: DbExecutor,
  userId: string,
): Promise<AccountIdentity | null> {
  const ownerId = assertId(userId, "userId");
  const [row] = await db
    .select({
      name: users.name,
      email: users.email,
      displayName: profiles.displayName,
      timeZone: profiles.timezone,
    })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(users.id, ownerId))
    .limit(1);
  return row
    ? {
        name: row.name,
        displayName: row.displayName ?? null,
        email: row.email,
        timeZone: row.timeZone ?? null,
      }
    : null;
}
