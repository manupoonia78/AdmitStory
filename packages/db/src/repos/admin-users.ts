// Admin › Users (spec §5.18, §14.4): look someone up, see their account without their content,
// adjust an entitlement, change a role, and open break-glass access. Content is only readable
// through breakGlassContent(), which needs an open grant and audits every view; the user sees
// both the grant and the views in Settings › Privacy.

import {
  AUDIT_ACTIONS,
  type AdminUserHit,
  type AdminUserView,
  type BreakGlassContentView,
} from "@admitstory/shared";
import { and, desc, eq, gt, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { DbExecutor } from "../client";
import {
  auditLog,
  breakGlassGrants,
  deliverables,
  drafts,
  entitlements,
  feedback,
  kits,
  profiles,
  purchases,
  roles,
  schoolCycles,
  schools,
  userSchools,
  users,
  type EntitlementCounter,
} from "../schema";
import { adminDb, audited, recordAudit, type AdminContext } from "./admin";
import { listFacts, listStories } from "./dossier";
import { assertId } from "./ids";
import { grantRole } from "./roles";
import { listSourceTexts } from "./sources";
import { costForUser } from "./usage-ledger";

export type BreakGlassGrantRow = typeof breakGlassGrants.$inferSelect;
export type EntitlementRow = typeof entitlements.$inferSelect;

/** Break-glass access lasts this long (§14.4). */
export const BREAK_GLASS_MINUTES = 30;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class BreakGlassRequiredError extends Error {
  override name = "BreakGlassRequiredError";
}

/** By email prefix (case-insensitive), or an exact user id. */
export async function findUsers(
  admin: AdminContext,
  query: string,
  limit = 25,
): Promise<AdminUserHit[]> {
  const db = adminDb(admin);
  const q = query.trim();
  if (q.length === 0) return [];
  const escaped = q.replace(/[\\%_]/g, (c) => `\\${c}`);
  const where = UUID.test(q)
    ? or(eq(users.id, q), ilike(users.email, `${escaped}%`))
    : ilike(users.email, `${escaped}%`);
  const rows = await db
    .select({ id: users.id, email: users.email, createdAt: users.createdAt })
    .from(users)
    .where(where)
    .orderBy(users.email)
    .limit(Math.min(Math.max(limit, 1), 100));
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const [roleRows, paidRows] = await Promise.all([
    db
      .select({ userId: roles.userId, role: roles.role })
      .from(roles)
      .where(inArray(roles.userId, ids)),
    db
      .selectDistinct({ userId: purchases.userId })
      .from(purchases)
      .where(and(inArray(purchases.userId, ids), eq(purchases.status, "completed"))),
  ]);
  const paid = new Set(paidRows.map((row) => row.userId));
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    createdAt: row.createdAt.toISOString(),
    roles: roleRows.filter((r) => r.userId === row.id).map((r) => r.role),
    paid: paid.has(row.id),
  }));
}

export async function adminUserView(
  admin: AdminContext,
  userId: string,
): Promise<AdminUserView | null> {
  const db = adminDb(admin);
  const id = assertId(userId, "userId");
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user) return null;
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);

  const [
    roleRows,
    [profile],
    schoolRows,
    purchaseRows,
    entitlementRows,
    totalUsd,
    [last30],
    [feedbackCount],
    grants,
    auditRows,
  ] = await Promise.all([
    db.select({ role: roles.role }).from(roles).where(eq(roles.userId, id)),
    db.select().from(profiles).where(eq(profiles.userId, id)).limit(1),
    db
      .select({
        userSchoolId: userSchools.id,
        school: schools.shortName,
        round: userSchools.round,
        status: userSchools.status,
        kitStatus: kits.status,
      })
      .from(userSchools)
      .innerJoin(schoolCycles, eq(schoolCycles.id, userSchools.schoolCycleId))
      .innerJoin(schools, eq(schools.id, schoolCycles.schoolId))
      .leftJoin(kits, eq(kits.userSchoolId, userSchools.id))
      .where(eq(userSchools.userId, id))
      .orderBy(schools.shortName),
    db.select().from(purchases).where(eq(purchases.userId, id)).orderBy(desc(purchases.createdAt)),
    db
      .select()
      .from(entitlements)
      .where(eq(entitlements.userId, id))
      .orderBy(desc(entitlements.createdAt)),
    costForUser(db, id),
    db
      .execute<{ usd: number }>(
        sql`select coalesce(sum(cost_usd), 0)::float8 as usd from usage_ledger where user_id = ${id} and created_at >= ${thirtyDaysAgo}`,
      )
      .then((result) => result.rows),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(feedback)
      .where(eq(feedback.userId, id)),
    db
      .select({
        id: breakGlassGrants.id,
        at: breakGlassGrants.createdAt,
        reason: breakGlassGrants.reason,
        expiresAt: breakGlassGrants.expiresAt,
        revokedAt: breakGlassGrants.revokedAt,
        adminEmail: users.email,
      })
      .from(breakGlassGrants)
      .leftJoin(users, eq(users.id, breakGlassGrants.adminId))
      .where(eq(breakGlassGrants.userId, id))
      .orderBy(desc(breakGlassGrants.createdAt))
      .limit(20),
    db
      .select({
        at: auditLog.at,
        action: auditLog.action,
        reason: auditLog.reason,
        actorEmail: users.email,
      })
      .from(auditLog)
      .leftJoin(users, eq(users.id, auditLog.actorId))
      .where(and(eq(auditLog.targetType, "users"), eq(auditLog.targetId, id)))
      .orderBy(desc(auditLog.at))
      .limit(50),
  ]);

  const active = grants.find((g) => g.revokedAt === null && g.expiresAt > now) ?? null;
  return {
    id: user.id,
    email: user.email,
    name: user.name || null,
    createdAt: user.createdAt.toISOString(),
    emailVerified: user.emailVerified,
    roles: roleRows.map((r) => r.role),
    profile: profile
      ? {
          country: profile.country,
          timezone: profile.timezone,
          targetIntake: profile.targetIntake === null ? null : String(profile.targetIntake),
          studioMode: profile.studioMode,
          improveOptIn: profile.improveProductOptIn,
        }
      : null,
    schools: schoolRows.map((row) => ({
      userSchoolId: row.userSchoolId,
      school: row.school,
      round: row.round,
      status: row.status,
      kitStatus: row.kitStatus,
    })),
    purchases: purchaseRows.map((row) => ({
      id: row.id,
      productKey: row.productKey,
      amountCents: row.amountCents,
      currency: row.currency,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      providerTxnId: row.providerTxnId,
    })),
    entitlements: entitlementRows.map((row) => ({
      id: row.id,
      kind: row.kind,
      refId: row.refId,
      limits: row.limits,
      used: row.used as Record<string, number>,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      revokedAt: row.revokedAt?.toISOString() ?? null,
    })),
    cost: { totalUsd, last30Usd: last30?.usd ?? 0 },
    feedbackCount: feedbackCount?.n ?? 0,
    breakGlass: {
      active: active ? { id: active.id, expiresAt: active.expiresAt.toISOString() } : null,
      history: grants.map((g) => ({
        at: g.at.toISOString(),
        adminEmail: g.adminEmail,
        reason: g.reason,
      })),
    },
    audit: auditRows.map((row) => ({
      at: row.at.toISOString(),
      action: row.action,
      actorEmail: row.actorEmail,
      reason: row.reason,
    })),
  };
}

/* Entitlements and roles --------------------------------------------------------------------- */

export interface EntitlementAdjustInput {
  op: "set_limit" | "extend" | "revoke" | "restore";
  limit?: { key: string; value: number };
  expiresAt?: string;
}

const COUNTERS = new Set<string>(["revisions", "voice_mocks", "drills", "kit_regenerations"]);

export async function adjustEntitlement(
  admin: AdminContext,
  userId: string,
  entitlementId: string,
  patch: EntitlementAdjustInput,
  reason: string,
): Promise<EntitlementRow | null> {
  const ownerId = assertId(userId, "userId");
  const id = assertId(entitlementId, "entitlementId");
  const why = z.string().trim().min(3).max(300).parse(reason);
  return audited(
    admin,
    (row: EntitlementRow | null) =>
      row
        ? {
            action: AUDIT_ACTIONS.entitlementAdjust,
            targetType: "users",
            targetId: ownerId,
            reason: why,
            meta: { entitlementId: id, op: patch.op, limit: patch.limit ?? null },
          }
        : null,
    async (db) => {
      const [current] = await db
        .select()
        .from(entitlements)
        .where(and(eq(entitlements.id, id), eq(entitlements.userId, ownerId)))
        .limit(1)
        .for("update");
      if (!current) return null;
      const set: Partial<typeof entitlements.$inferInsert> = {};
      switch (patch.op) {
        case "set_limit": {
          if (!patch.limit || !COUNTERS.has(patch.limit.key))
            throw new z.ZodError([
              { code: "custom", path: ["limit", "key"], message: "Unknown counter", input: patch },
            ]);
          set.limits = {
            ...current.limits,
            [patch.limit.key as EntitlementCounter]: patch.limit.value,
          };
          break;
        }
        case "extend":
          set.expiresAt = patch.expiresAt ? new Date(patch.expiresAt) : null;
          break;
        case "revoke":
          set.revokedAt = new Date();
          set.revokeReason = why;
          break;
        case "restore":
          set.revokedAt = null;
          set.revokeReason = null;
          break;
      }
      const [row] = await db
        .update(entitlements)
        .set(set)
        .where(eq(entitlements.id, id))
        .returning();
      return row ?? null;
    },
  );
}

export async function setUserRole(
  admin: AdminContext,
  userId: string,
  role: "admin" | "expert",
  on: boolean,
  reason: string,
): Promise<string[]> {
  const id = assertId(userId, "userId");
  const why = z.string().trim().min(3).max(300).parse(reason);
  if (!on && role === "admin" && admin.actorId === id)
    throw new z.ZodError([
      {
        code: "custom",
        path: ["role"],
        message: "You can't remove your own admin role",
        input: role,
      },
    ]);
  return audited(
    admin,
    {
      action: AUDIT_ACTIONS.roleChange,
      targetType: "users",
      targetId: id,
      reason: why,
      meta: { role, on },
    },
    async (db) => {
      if (on) await grantRole(db, id, role);
      else await db.delete(roles).where(and(eq(roles.userId, id), eq(roles.role, role)));
      const rows = await db.select({ role: roles.role }).from(roles).where(eq(roles.userId, id));
      return rows.map((r) => r.role);
    },
  );
}

/* Break-glass -------------------------------------------------------------------------------- */

export async function openBreakGlass(
  admin: AdminContext,
  userId: string,
  reason: string,
  now: Date,
): Promise<BreakGlassGrantRow> {
  const id = assertId(userId, "userId");
  const why = z.string().trim().min(20).max(500).parse(reason);
  if (admin.actorId === null) throw new BreakGlassRequiredError("Break-glass needs a person");
  const actorId = admin.actorId;
  return audited(
    admin,
    (row: BreakGlassGrantRow) => ({
      action: AUDIT_ACTIONS.breakGlassOpen,
      targetType: "users",
      targetId: id,
      reason: why,
      meta: { grantId: row.id, expiresAt: row.expiresAt.toISOString() },
    }),
    async (db) => {
      const [row] = await db
        .insert(breakGlassGrants)
        .values({
          adminId: actorId,
          userId: id,
          reason: why,
          expiresAt: new Date(now.getTime() + BREAK_GLASS_MINUTES * 60_000),
        })
        .returning();
      if (!row) throw new Error("Failed to open access");
      return row;
    },
  );
}

/** The acting admin's open grant on this user, if any. */
export async function activeBreakGlass(
  admin: AdminContext,
  userId: string,
  now: Date,
): Promise<BreakGlassGrantRow | null> {
  const db = adminDb(admin);
  if (admin.actorId === null) return null;
  const [row] = await db
    .select()
    .from(breakGlassGrants)
    .where(
      and(
        eq(breakGlassGrants.userId, assertId(userId, "userId")),
        eq(breakGlassGrants.adminId, admin.actorId),
        isNull(breakGlassGrants.revokedAt),
        gt(breakGlassGrants.expiresAt, now),
      ),
    )
    .orderBy(desc(breakGlassGrants.expiresAt))
    .limit(1);
  return row ?? null;
}

/** Read-only content view. Throws BreakGlassRequiredError without an open grant; audits each view. */
export async function breakGlassContent(
  admin: AdminContext,
  userId: string,
  now: Date,
): Promise<BreakGlassContentView> {
  const id = assertId(userId, "userId");
  const grant = await activeBreakGlass(admin, id, now);
  if (!grant) throw new BreakGlassRequiredError("No open access for this account");
  const db: DbExecutor = admin.db;
  await recordAudit(admin, {
    action: AUDIT_ACTIONS.breakGlassView,
    targetType: "users",
    targetId: id,
    reason: grant.reason,
    meta: { grantId: grant.id },
  });

  const [storyRows, factRows, draftRows, sourceRows] = await Promise.all([
    listStories(db, id),
    listFacts(db, id),
    db
      .select({
        school: schools.shortName,
        deliverable: sql<string>`coalesce(${deliverables.title}, ${deliverables.packKey})`,
        version: drafts.version,
        text: drafts.plainText,
      })
      .from(drafts)
      .innerJoin(deliverables, eq(deliverables.id, drafts.deliverableId))
      .innerJoin(kits, eq(kits.id, deliverables.kitId))
      .innerJoin(userSchools, eq(userSchools.id, kits.userSchoolId))
      .innerJoin(schoolCycles, eq(schoolCycles.id, userSchools.schoolCycleId))
      .innerJoin(schools, eq(schools.id, schoolCycles.schoolId))
      .where(and(eq(drafts.userId, id), eq(drafts.isCurrent, true)))
      .orderBy(schools.shortName, deliverables.order),
    listSourceTexts(db, id, { limit: 20 }),
  ]);

  const storyLines = storyRows.map((story) => ({
    label: `${story.code} ${story.nickname}`,
    text: [story.situation, story.stakes, ...story.actions, story.result, story.reflection]
      .filter((part): part is string => Boolean(part))
      .join(" "),
  }));
  const factLines = factRows.map((fact) => ({
    label: `${fact.code} ${fact.key}`,
    text: fact.value,
  }));
  return {
    dossierLines: [...storyLines, ...factLines],
    drafts: draftRows,
    sources: sourceRows.map((row) => ({
      kind: row.kind,
      createdAt: row.createdAt.toISOString(),
      text: row.text,
    })),
    expiresAt: grant.expiresAt.toISOString(),
  };
}
