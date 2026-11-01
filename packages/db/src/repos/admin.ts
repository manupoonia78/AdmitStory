// Admin access (spec §5.18, §14.4). Every admin repository function takes an AdminContext, and the
// only ways to get one are requireAdmin(), which checks the `roles` table, and systemContext(), for
// background jobs and CLI scripts that act without a signed-in admin. Contexts are registered when
// issued, so an object that merely looks like one is refused.
//
// Every admin mutation writes an `audit_log` row in the same transaction as the change.

import { and, desc, eq, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { DbExecutor } from "../client";
import { auditLog } from "../schema";
import { assertId } from "./ids";
import { hasRole } from "./roles";

export class AdminRequiredError extends Error {
  override name = "AdminRequiredError";
}

export interface AdminContext {
  readonly db: DbExecutor;
  /** The admin acting; null for a system job. */
  readonly actorId: string | null;
  /** Names the system job or script when there is no actor, e.g. `inngest:kb.ingest`. */
  readonly job: string | null;
}

// Cached on globalThis like the pool (client.ts), so a dev reload that re-evaluates this module
// still recognises the contexts issued before it.
const globalForAdmin = globalThis as typeof globalThis & {
  __admitstoryAdminContexts?: WeakSet<AdminContext>;
};
const issued = (globalForAdmin.__admitstoryAdminContexts ??= new WeakSet<AdminContext>());

function issue(context: AdminContext): AdminContext {
  const frozen = Object.freeze({ ...context });
  issued.add(frozen);
  return frozen;
}

/** Throws unless `context` came from requireAdmin, systemContext or inTransaction. */
export function assertAdminContext(context: AdminContext): void {
  if (!issued.has(context))
    throw new AdminRequiredError("Admin repositories need a context from requireAdmin()");
}

/** Checks the `roles` table and returns the context admin repositories demand. */
export async function requireAdmin(db: DbExecutor, userId: string): Promise<AdminContext> {
  const actorId = assertId(userId, "userId");
  if (!(await hasRole(db, actorId, "admin"))) throw new AdminRequiredError("Admin role required");
  return issue({ db, actorId, job: null });
}

/**
 * For Inngest functions, crons and CLI scripts only (e.g. the refresh checker, the seed script).
 * Never call it from a request handler: a request always has a user, so use requireAdmin there.
 */
export function systemContext(db: DbExecutor, job: string): AdminContext {
  const name = z.string().trim().min(1).max(120).parse(job);
  return issue({ db, actorId: null, job: name });
}

/** Runs several admin operations in one transaction; `fn` receives a context bound to it. */
export async function inTransaction<T>(
  admin: AdminContext,
  fn: (tx: AdminContext) => Promise<T>,
): Promise<T> {
  assertAdminContext(admin);
  return admin.db.transaction((tx) => fn(issue({ ...admin, db: tx })));
}

/* Audit -------------------------------------------------------------------------------------- */

export const AuditEntry = z.strictObject({
  /** `<table>.<verb>`, e.g. `school_packs.publish`. */
  action: z
    .string()
    .trim()
    .regex(/^[a-z_]+\.[a-z_]+$/, "action is <table>.<verb>"),
  targetType: z.string().trim().min(1).max(60),
  targetId: z.string().trim().max(200).nullable().optional(),
  reason: z.string().trim().max(2000).nullable().optional(),
  meta: z.record(z.string(), z.unknown()).nullable().optional(),
});
export type AuditEntry = z.input<typeof AuditEntry>;

export type AuditRow = typeof auditLog.$inferSelect;

async function writeAudit(db: DbExecutor, admin: AdminContext, entry: AuditEntry): Promise<void> {
  const value = AuditEntry.parse(entry);
  const meta = admin.job === null ? (value.meta ?? null) : { ...value.meta, job: admin.job };
  await db.insert(auditLog).values({
    actorId: admin.actorId,
    action: value.action,
    targetType: value.targetType,
    targetId: value.targetId ?? null,
    reason: value.reason ?? null,
    meta,
  });
}

/** Records an admin action that is not a repository mutation (e.g. break-glass access, a refund). */
export async function recordAudit(admin: AdminContext, entry: AuditEntry): Promise<void> {
  assertAdminContext(admin);
  await writeAudit(admin.db, admin, entry);
}

/**
 * Runs a mutation and its audit row in one transaction. `entry` may depend on the result, e.g. to
 * record the id of a row just created, and returns null when nothing changed (a missing row), so
 * the log never claims a change that did not happen. Internal to the admin repositories.
 */
export async function audited<T>(
  admin: AdminContext,
  entry: AuditEntry | ((result: T) => AuditEntry | null),
  mutate: (db: DbExecutor) => Promise<T>,
): Promise<T> {
  assertAdminContext(admin);
  return admin.db.transaction(async (tx) => {
    const result = await mutate(tx);
    const value = typeof entry === "function" ? entry(result) : entry;
    if (value !== null) await writeAudit(tx, admin, value);
    return result;
  });
}

/** Admin read guard for the repositories' read functions. */
export function adminDb(admin: AdminContext): DbExecutor {
  assertAdminContext(admin);
  return admin.db;
}

export async function listAuditLog(
  admin: AdminContext,
  filter: { targetType?: string; targetId?: string; actorId?: string; limit?: number } = {},
): Promise<AuditRow[]> {
  const db = adminDb(admin);
  const conditions: SQL[] = [];
  if (filter.targetType) conditions.push(eq(auditLog.targetType, filter.targetType));
  if (filter.targetId) conditions.push(eq(auditLog.targetId, filter.targetId));
  if (filter.actorId) conditions.push(eq(auditLog.actorId, assertId(filter.actorId, "actorId")));
  return db
    .select()
    .from(auditLog)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditLog.at))
    .limit(Math.min(Math.max(filter.limit ?? 100, 1), 500));
}
