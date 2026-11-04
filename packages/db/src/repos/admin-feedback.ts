// Admin › Feedback (spec §5.18, §15): the thumbs and notes applicants leave on drafts, Profile Read
// and the résumé pass. A draft excerpt is shown only when its owner switched on "Help improve
// AdmitStories", and reading one is audited.

import {
  AUDIT_ACTIONS,
  type AdminFeedbackItem,
  type FeedbackMeta,
  type FeedbackReason,
  type FeedbackStatus,
  type FeedbackTarget,
} from "@admitstory/shared";
import { and, desc, eq, lt, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { DbExecutor } from "../client";
import {
  deliverables,
  drafts,
  feedback,
  kits,
  profileReads,
  profiles,
  resumeReviews,
  schoolCycles,
  schools,
  userSchools,
  users,
} from "../schema";
import { adminDb, audited, recordAudit, type AdminContext } from "./admin";
import { assertId } from "./ids";

type Row = {
  feedback: typeof feedback.$inferSelect;
  email: string | null;
  optedIn: boolean | null;
};

function toItem(row: Row): AdminFeedbackItem {
  const f = row.feedback;
  return {
    id: f.id,
    createdAt: f.createdAt.toISOString(),
    userId: f.userId,
    userEmail: row.email,
    targetType: f.targetType,
    targetId: f.targetId,
    rating: f.rating,
    reason: (f.reason as FeedbackReason | null) ?? null,
    text: f.text,
    meta: f.meta,
    status: f.status,
    adminNote: f.adminNote,
    ownerOptedIn: row.optedIn === true,
  };
}

function select(admin: AdminContext) {
  return adminDb(admin)
    .select({ feedback, email: users.email, optedIn: profiles.improveProductOptIn })
    .from(feedback)
    .leftJoin(users, eq(users.id, feedback.userId))
    .leftJoin(profiles, eq(profiles.userId, feedback.userId));
}

export async function listFeedbackForAdmin(
  admin: AdminContext,
  filter: {
    status?: FeedbackStatus;
    reason?: string;
    targetType?: string;
    cursor?: string;
    limit?: number;
  } = {},
): Promise<{ items: AdminFeedbackItem[]; next: string | null }> {
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
  const conditions: SQL[] = [];
  if (filter.status) conditions.push(eq(feedback.status, filter.status));
  if (filter.reason) conditions.push(eq(feedback.reason, filter.reason));
  if (filter.targetType) conditions.push(eq(feedback.targetType, filter.targetType));
  if (filter.cursor) {
    const at = new Date(filter.cursor);
    if (!Number.isNaN(at.getTime())) conditions.push(lt(feedback.createdAt, at));
  }
  const rows = await select(admin)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(feedback.createdAt))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return {
    items: page.map(toItem),
    next: rows.length > limit && last ? last.feedback.createdAt.toISOString() : null,
  };
}

export async function updateFeedbackStatus(
  admin: AdminContext,
  id: string,
  patch: { status: FeedbackStatus; adminNote?: string | null },
): Promise<AdminFeedbackItem | null> {
  const feedbackId = assertId(id, "feedbackId");
  const note = z.string().trim().max(1000).nullable().optional().parse(patch.adminNote);
  const updated = await audited(
    admin,
    (changed: boolean) =>
      changed
        ? {
            action: AUDIT_ACTIONS.feedbackUpdate,
            targetType: "feedback",
            targetId: feedbackId,
            meta: { status: patch.status },
          }
        : null,
    async (db) => {
      const rows = await db
        .update(feedback)
        .set({
          status: patch.status,
          handledBy: admin.actorId,
          handledAt: new Date(),
          ...(note !== undefined ? { adminNote: note || null } : {}),
        })
        .where(eq(feedback.id, feedbackId))
        .returning({ id: feedback.id });
      return rows.length > 0;
    },
  );
  if (!updated) return null;
  const [row] = await select(admin).where(eq(feedback.id, feedbackId)).limit(1);
  return row ? toItem(row) : null;
}

export async function countNewFeedback(admin: AdminContext): Promise<number> {
  const [row] = await adminDb(admin)
    .select({ n: sql<number>`count(*)::int` })
    .from(feedback)
    .where(eq(feedback.status, "new"));
  return row?.n ?? 0;
}

/** The rated draft's first 1,500 characters, only when its owner opted in. Audited. */
export async function optedInDraftExcerpt(
  admin: AdminContext,
  feedbackId: string,
): Promise<string | null> {
  const id = assertId(feedbackId, "feedbackId");
  const [row] = await select(admin).where(eq(feedback.id, id)).limit(1);
  if (!row || row.feedback.targetType !== "draft" || row.optedIn !== true) return null;
  const [draft] = await adminDb(admin)
    .select({ text: drafts.plainText })
    .from(drafts)
    .where(and(eq(drafts.id, row.feedback.targetId), eq(drafts.userId, row.feedback.userId)))
    .limit(1);
  if (!draft) return null;
  await recordAudit(admin, {
    action: AUDIT_ACTIONS.feedbackExcerpt,
    targetType: "feedback",
    targetId: id,
    meta: { userId: row.feedback.userId },
  });
  return draft.text.slice(0, 1500);
}

/* Applicant side ------------------------------------------------------------------------------ */

/**
 * The rated item's ids and labels when it belongs to `userId`, else null (so a forged id is a 404).
 * Labels only: never the text being rated.
 */
export async function feedbackTargetMeta(
  db: DbExecutor,
  userId: string,
  targetType: FeedbackTarget,
  targetId: string,
): Promise<FeedbackMeta | null> {
  const owner = assertId(userId, "userId");
  const id = assertId(targetId, "targetId");
  if (targetType === "draft") {
    const [row] = await db
      .select({
        school: schools.shortName,
        deliverableType: deliverables.type,
        draftVersion: drafts.version,
        kitId: deliverables.kitId,
      })
      .from(drafts)
      .innerJoin(deliverables, eq(deliverables.id, drafts.deliverableId))
      .innerJoin(kits, eq(kits.id, deliverables.kitId))
      .innerJoin(userSchools, eq(userSchools.id, kits.userSchoolId))
      .innerJoin(schoolCycles, eq(schoolCycles.id, userSchools.schoolCycleId))
      .innerJoin(schools, eq(schools.id, schoolCycles.schoolId))
      .where(and(eq(drafts.id, id), eq(drafts.userId, owner)))
      .limit(1);
    return row
      ? {
          school: row.school,
          deliverableType: row.deliverableType,
          draftVersion: row.draftVersion,
          kitId: row.kitId,
        }
      : null;
  }
  const table = targetType === "profile_read" ? profileReads : resumeReviews;
  const [row] = await db
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.id, id), eq(table.userId, owner)))
    .limit(1);
  return row ? {} : null;
}
