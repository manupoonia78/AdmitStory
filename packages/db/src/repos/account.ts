// Settings › Privacy and data (spec §11 Account, §14.4): what we keep, who at AdmitStory has looked,
// the full export and account deletion.
//
// The export walks every table with a `user_id` column, so a table added later is exported without
// anyone remembering to list it. Left out on purpose: sign-in secrets (sessions, OAuth accounts,
// passkeys), the recommender's own workspace (it is theirs, not the applicant's), staff ratings, and
// any column that holds a token, hash, secret or raw provider payload. Encrypted text is decrypted.
//
// Deletion removes the `users` row; every user table cascades from it, and usage_ledger and
// audit_log keep anonymised rows (SET NULL). account_deletions has no FK, so it survives as the
// record that the deletion happened.

import {
  AUDIT_ACTIONS,
  type PrivacyInventory,
  type StaffAccessAction,
  type StaffAccessEntry,
} from "@admitstory/shared";
import { and, asc, desc, eq, inArray, is, or, sql } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import type { DbExecutor } from "../client";
import { decryptContent, getContentKeyring } from "../crypto/content";
import * as schema from "../schema";
import {
  accountDeletions,
  auditLog,
  facts,
  goldenLines,
  purchases,
  recommenders,
  sessions,
  sources,
  stories,
  studioSessions,
  userSchools,
  users,
  deliverables,
  drafts,
  kits,
  schoolCycles,
  schools,
} from "../schema";
import { assertAdminContext, type AdminContext } from "./admin";
import { assertId } from "./ids";

export type AccountDeletionRow = typeof accountDeletions.$inferSelect;

async function count(
  db: DbExecutor,
  table: PgTable,
  where: ReturnType<typeof eq>,
): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(table)
    .where(where);
  return row?.n ?? 0;
}

/** Counts only, for the "What we keep" list. */
export async function accountInventory(db: DbExecutor, userId: string): Promise<PrivacyInventory> {
  const id = assertId(userId, "userId");
  const [storyN, factN, lineN, draftN, schoolN, recN, uploadN, minutes] = await Promise.all([
    count(db, stories, eq(stories.userId, id)),
    count(db, facts, eq(facts.userId, id)),
    count(db, goldenLines, eq(goldenLines.userId, id)),
    count(db, drafts, eq(drafts.userId, id)),
    count(db, userSchools, eq(userSchools.userId, id)),
    count(db, recommenders, eq(recommenders.userId, id)),
    count(
      db,
      sources,
      and(eq(sources.userId, id), eq(sources.kind, "upload")) as ReturnType<typeof eq>,
    ),
    // Each session's length, capped at three hours so a tab left open doesn't count as a day.
    db
      .select({
        m: sql<number>`coalesce(sum(least(extract(epoch from (coalesce(${studioSessions.endedAt}, ${studioSessions.updatedAt}) - ${studioSessions.startedAt})), 10800)), 0)::float8 / 60`,
      })
      .from(studioSessions)
      .where(eq(studioSessions.userId, id))
      .then((rows) => Math.round(rows[0]?.m ?? 0)),
  ]);
  return {
    stories: storyN,
    facts: factN,
    goldenLines: lineN,
    studioMinutes: minutes,
    drafts: draftN,
    schools: schoolN,
    recommenders: recN,
    uploads: uploadN,
    audioRecordings: 0,
  };
}

const STAFF_ACTIONS: Record<string, StaffAccessAction> = {
  [AUDIT_ACTIONS.breakGlassView]: "viewed_content",
  [AUDIT_ACTIONS.breakGlassOpen]: "opened_access",
  [AUDIT_ACTIONS.entitlementAdjust]: "changed_access",
  [AUDIT_ACTIONS.compKit]: "changed_access",
  [AUDIT_ACTIONS.roleChange]: "role",
  "purchases.refund": "refund",
};

/** Staff actions on this account, newest first (§14.4: visible to the user). */
export async function staffAccessFor(db: DbExecutor, userId: string): Promise<StaffAccessEntry[]> {
  const id = assertId(userId, "userId");
  const purchaseIds = (
    await db.select({ id: purchases.id }).from(purchases).where(eq(purchases.userId, id))
  ).map((row) => row.id);
  const rows = await db
    .select({ at: auditLog.at, action: auditLog.action, reason: auditLog.reason })
    .from(auditLog)
    .where(
      or(
        and(
          eq(auditLog.targetType, "users"),
          eq(auditLog.targetId, id),
          inArray(auditLog.action, Object.keys(STAFF_ACTIONS)),
        ),
        purchaseIds.length > 0
          ? and(
              eq(auditLog.targetType, "purchase"),
              inArray(auditLog.targetId, purchaseIds),
              eq(auditLog.action, "purchases.refund"),
            )
          : undefined,
      ),
    )
    .orderBy(desc(auditLog.at))
    .limit(100);
  return rows.flatMap((row) => {
    const action = STAFF_ACTIONS[row.action];
    return action ? [{ at: row.at.toISOString(), action, reason: row.reason }] : [];
  });
}

/* Export ------------------------------------------------------------------------------------- */

/** Tables never exported (see the header). */
const EXCLUDED_TABLES = new Set([
  "sessions",
  "accounts",
  "passkeys",
  "verifications",
  "recommender_workspaces",
  "eval_ratings",
  "account_deletions",
]);
const EXCLUDED_COLUMN = /token|hash|secret|password|^raw$/i;

interface ExportTable {
  key: string;
  table: PgTable;
  userColumn: string;
}

function exportTables(): ExportTable[] {
  const found: ExportTable[] = [];
  for (const value of Object.values(schema)) {
    if (!is(value, PgTable)) continue;
    const config = getTableConfig(value);
    if (EXCLUDED_TABLES.has(config.name)) continue;
    const owner = config.columns.find((column) => column.name === "user_id");
    if (owner) found.push({ key: config.name, table: value, userColumn: "user_id" });
  }
  return found.sort((a, b) => a.key.localeCompare(b.key));
}

function cleanRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === "textEncrypted") {
      out.text = typeof value === "string" ? decryptContent(getContentKeyring(), value) : null;
      continue;
    }
    if (/Encrypted$/.test(key)) continue;
    if (EXCLUDED_COLUMN.test(key)) continue;
    out[key] = value;
  }
  return out;
}

/** Every row the applicant owns, one table at a time (streamed by the caller). */
export async function* exportSections(
  db: DbExecutor,
  userId: string,
): AsyncGenerator<{ key: string; rows: unknown[] }> {
  const id = assertId(userId, "userId");
  const [account] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      emailVerified: users.emailVerified,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  yield { key: "account", rows: account ? [account] : [] };
  for (const { key, table } of exportTables()) {
    const rows = (await db
      .select()
      .from(table)
      .where(sql`${sql.identifier("user_id")} = ${id}`)) as Record<string, unknown>[];
    yield { key, rows: rows.map(cleanRow) };
  }
}

/** The current draft of every deliverable, by school, for "Your drafts (Word)". */
export async function currentDraftsForExport(
  db: DbExecutor,
  userId: string,
): Promise<
  {
    school: string;
    title: string;
    prompt: string;
    text: string;
    version: number;
    isFinal: boolean;
  }[]
> {
  const id = assertId(userId, "userId");
  return db
    .select({
      school: schools.name,
      title: sql<string>`coalesce(${deliverables.title}, ${deliverables.packKey})`,
      prompt: deliverables.promptText,
      text: drafts.plainText,
      version: drafts.version,
      isFinal: drafts.isFinal,
    })
    .from(drafts)
    .innerJoin(deliverables, eq(deliverables.id, drafts.deliverableId))
    .innerJoin(kits, eq(kits.id, deliverables.kitId))
    .innerJoin(userSchools, eq(userSchools.id, kits.userSchoolId))
    .innerJoin(schoolCycles, eq(schoolCycles.id, userSchools.schoolCycleId))
    .innerJoin(schools, eq(schools.id, schoolCycles.schoolId))
    .where(and(eq(drafts.userId, id), eq(drafts.isCurrent, true)))
    .orderBy(asc(schools.name), asc(deliverables.order));
}

/* Deletion ----------------------------------------------------------------------------------- */

/** Records the request and signs the user out everywhere, in one transaction. */
export async function requestAccountDeletion(
  db: DbExecutor,
  userId: string,
  input: {
    emailHash: string;
    reason?: string | null;
    requestedBy: "user" | "admin";
    providerTxnIds: string[];
  },
): Promise<AccountDeletionRow> {
  const id = assertId(userId, "userId");
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(accountDeletions)
      .values({
        userId: id,
        emailHash: input.emailHash,
        requestedBy: input.requestedBy,
        reason: input.reason ? input.reason.slice(0, 500) : null,
        providerTxnIds: input.providerTxnIds,
      })
      .returning();
    if (!row) throw new Error("Failed to record the deletion");
    await tx.delete(sessions).where(eq(sessions.userId, id));
    return row;
  });
}

export async function getAccountDeletion(
  db: DbExecutor,
  deletionId: string,
): Promise<AccountDeletionRow | null> {
  const [row] = await db
    .select()
    .from(accountDeletions)
    .where(eq(accountDeletions.id, assertId(deletionId, "deletionId")))
    .limit(1);
  return row ?? null;
}

/** The newest pending deletion for a user, so a second request doesn't queue another. */
export async function pendingAccountDeletion(
  db: DbExecutor,
  userId: string,
): Promise<AccountDeletionRow | null> {
  const [row] = await db
    .select()
    .from(accountDeletions)
    .where(
      and(
        eq(accountDeletions.userId, assertId(userId, "userId")),
        eq(accountDeletions.status, "pending"),
      ),
    )
    .orderBy(desc(accountDeletions.requestedAt))
    .limit(1);
  return row ?? null;
}

/** Deletes the user row (every user table cascades) and marks the request done. */
export async function completeAccountDeletion(
  ctx: AdminContext,
  deletionId: string,
): Promise<"done" | "missing"> {
  assertAdminContext(ctx);
  const id = assertId(deletionId, "deletionId");
  return ctx.db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(accountDeletions)
      .where(eq(accountDeletions.id, id))
      .limit(1)
      .for("update");
    if (!row) return "missing";
    if (row.status === "done") return "done";
    await tx.delete(users).where(eq(users.id, row.userId));
    await tx
      .update(accountDeletions)
      .set({ status: "done", completedAt: new Date(), error: null })
      .where(eq(accountDeletions.id, id));
    await tx.insert(auditLog).values({
      actorId: ctx.actorId,
      action: AUDIT_ACTIONS.accountDelete,
      targetType: "account_deletions",
      targetId: id,
      reason: row.requestedBy === "admin" ? row.reason : null,
      meta: { requestedBy: row.requestedBy, ...(ctx.job ? { job: ctx.job } : {}) },
    });
    return "done";
  });
}

export async function failAccountDeletion(
  ctx: AdminContext,
  deletionId: string,
  error: string,
): Promise<void> {
  assertAdminContext(ctx);
  await ctx.db
    .update(accountDeletions)
    .set({ status: "failed", error: error.slice(0, 2000) })
    .where(eq(accountDeletions.id, assertId(deletionId, "deletionId")));
}
