import { and, asc, eq } from "drizzle-orm";
import type { DbExecutor } from "../client";
import { appRoles, roles, type AppRole } from "../schema";
import { assertId } from "./ids";

function assertRole(role: string): AppRole {
  if (!(appRoles as readonly string[]).includes(role)) throw new TypeError(`Unknown role: ${role}`);
  return role as AppRole;
}

export async function listRoles(db: DbExecutor, userId: string): Promise<AppRole[]> {
  const rows = await db
    .select({ role: roles.role })
    .from(roles)
    .where(eq(roles.userId, assertId(userId, "userId")))
    .orderBy(asc(roles.role));
  return rows.map((r) => r.role);
}

export async function hasRole(db: DbExecutor, userId: string, role: AppRole): Promise<boolean> {
  const rows = await db
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.userId, assertId(userId, "userId")), eq(roles.role, assertRole(role))))
    .limit(1);
  return rows.length > 0;
}

/**
 * Idempotent. Deciding who may grant elevated roles (expert, guide, admin) is
 * the caller's job; this only writes the row for the given user.
 */
export async function grantRole(db: DbExecutor, userId: string, role: AppRole): Promise<void> {
  await db
    .insert(roles)
    .values({ userId: assertId(userId, "userId"), role: assertRole(role) })
    .onConflictDoNothing({ target: [roles.userId, roles.role] });
}
