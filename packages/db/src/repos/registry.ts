// The canon editor and the prompt registry (spec §5.18, §9.4). Versions are append-only: a change
// is a new version, publishing or activating one is a separate, audited step, and rollback is
// activating an older version.

import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { DbExecutor } from "../client";
import { canonDocs, promptVersions } from "../schema";
import { adminDb, audited, type AdminContext } from "./admin";
import { assertId } from "./ids";

export type CanonDoc = typeof canonDocs.$inferSelect;
export type PromptVersion = typeof promptVersions.$inferSelect;

/* Canon -------------------------------------------------------------------------------------- */

export const NewCanonVersion = z.strictObject({
  slug: z
    .string()
    .trim()
    .max(80)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug is the file name without .md"),
  content: z.string().min(1).max(400_000),
  /** Stable rule ids found in the content, e.g. CRAFT-07. */
  ruleIds: z
    .array(z.string().regex(/^[A-Z]+-\d{2,3}$/, "rule id like CRAFT-07"))
    .max(500)
    .default([]),
});
export type NewCanonVersion = z.input<typeof NewCanonVersion>;

/** Saves the next version of a canon file, unpublished. */
export async function createCanonVersion(
  admin: AdminContext,
  input: NewCanonVersion,
): Promise<CanonDoc> {
  const values = NewCanonVersion.parse(input);
  return audited(
    admin,
    (row: CanonDoc) => ({
      action: "canon_docs.create",
      targetType: "canon_doc",
      targetId: row.id,
      meta: { slug: row.slug, version: row.version },
    }),
    async (db) => {
      const [row] = await db
        .insert(canonDocs)
        .values({
          slug: values.slug,
          content: values.content,
          ruleIds: [...new Set(values.ruleIds)],
          version: sql`(select coalesce(max(${canonDocs.version}), 0) + 1 from ${canonDocs} where ${canonDocs.slug} = ${values.slug})`,
        })
        .returning();
      if (!row) throw new Error("Failed to save canon version");
      return row;
    },
  );
}

/** Marks a canon version published. The caller emits the eval-suite event (§9.4). */
export async function publishCanonVersion(
  admin: AdminContext,
  canonDocId: string,
): Promise<CanonDoc> {
  const id = assertId(canonDocId, "canonDocId");
  return audited(
    admin,
    (row: CanonDoc) => ({
      action: "canon_docs.publish",
      targetType: "canon_doc",
      targetId: row.id,
      meta: { slug: row.slug, version: row.version },
    }),
    async (db) => {
      const [row] = await db
        .update(canonDocs)
        .set({ publishedAt: new Date(), publishedBy: admin.actorId })
        .where(eq(canonDocs.id, id))
        .returning();
      if (!row) throw new Error("Canon version not found");
      return row;
    },
  );
}

export type CanonDocSummary = Omit<CanonDoc, "content">;

/** Every version's metadata, newest first per slug. */
export async function listCanonVersions(
  admin: AdminContext,
  slug?: string,
): Promise<CanonDocSummary[]> {
  return adminDb(admin)
    .select({
      id: canonDocs.id,
      createdAt: canonDocs.createdAt,
      updatedAt: canonDocs.updatedAt,
      slug: canonDocs.slug,
      version: canonDocs.version,
      ruleIds: canonDocs.ruleIds,
      publishedAt: canonDocs.publishedAt,
      publishedBy: canonDocs.publishedBy,
    })
    .from(canonDocs)
    .where(slug === undefined ? undefined : eq(canonDocs.slug, slug))
    .orderBy(asc(canonDocs.slug), desc(canonDocs.version));
}

export async function getCanonVersion(
  admin: AdminContext,
  canonDocId: string,
): Promise<CanonDoc | null> {
  const [row] = await adminDb(admin)
    .select()
    .from(canonDocs)
    .where(eq(canonDocs.id, assertId(canonDocId, "canonDocId")))
    .limit(1);
  return row ?? null;
}

/** The newest published version of each canon file, for the L0 prefix. */
export async function getPublishedCanon(db: DbExecutor): Promise<CanonDoc[]> {
  return db
    .selectDistinctOn([canonDocs.slug])
    .from(canonDocs)
    .where(isNotNull(canonDocs.publishedAt))
    .orderBy(canonDocs.slug, desc(canonDocs.version));
}

/* Prompt registry ---------------------------------------------------------------------------- */

const Agent = z
  .string()
  .trim()
  .regex(/^[a-z_]+(\.[a-z_]+)+$/, "agent is an ai.run task name like kit.draft");

export const NewPromptVersion = z.strictObject({
  agent: Agent,
  version: z
    .string()
    .trim()
    .regex(/^v\d+[a-z0-9-]*$/, "version like v3"),
  template: z.string().min(1).max(200_000),
  routeOverride: z.record(z.string(), z.unknown()).nullable().optional(),
});
export type NewPromptVersion = z.input<typeof NewPromptVersion>;

export async function createPromptVersion(
  admin: AdminContext,
  input: NewPromptVersion,
): Promise<PromptVersion> {
  const values = NewPromptVersion.parse(input);
  return audited(
    admin,
    (row: PromptVersion) => ({
      action: "prompt_versions.create",
      targetType: "prompt_version",
      targetId: row.id,
      meta: { agent: row.agent, version: row.version },
    }),
    async (db) => {
      const [row] = await db
        .insert(promptVersions)
        .values({ ...values, routeOverride: values.routeOverride ?? null })
        .returning();
      if (!row) throw new Error("Failed to save prompt version");
      return row;
    },
  );
}

/**
 * Makes one version the only active one for its agent, at 100% of traffic. Rollback is activating
 * an older version.
 */
export async function activatePromptVersion(
  admin: AdminContext,
  promptVersionId: string,
): Promise<PromptVersion> {
  const id = assertId(promptVersionId, "promptVersionId");
  return audited(
    admin,
    (row: PromptVersion) => ({
      action: "prompt_versions.activate",
      targetType: "prompt_version",
      targetId: row.id,
      meta: { agent: row.agent, version: row.version },
    }),
    async (db) => {
      const [target] = await db
        .select({ agent: promptVersions.agent })
        .from(promptVersions)
        .where(eq(promptVersions.id, id))
        .limit(1);
      if (!target) throw new Error("Prompt version not found");
      await db
        .update(promptVersions)
        .set({ active: false, abWeight: 0 })
        .where(eq(promptVersions.agent, target.agent));
      const [row] = await db
        .update(promptVersions)
        .set({ active: true, abWeight: 100 })
        .where(eq(promptVersions.id, id))
        .returning();
      if (!row) throw new Error("Prompt version not found");
      return row;
    },
  );
}

export const AbSplit = z
  .array(z.strictObject({ promptVersionId: z.guid(), weight: z.int().min(1).max(100) }))
  .min(1)
  .max(5)
  .refine((split) => split.reduce((sum, s) => sum + s.weight, 0) === 100, "weights sum to 100")
  .refine(
    (split) => new Set(split.map((s) => s.promptVersionId)).size === split.length,
    "each version once",
  );
export type AbSplit = z.input<typeof AbSplit>;

/** Sets an A/B split for one agent; versions not listed are deactivated. */
export async function setPromptAbSplit(
  admin: AdminContext,
  agent: string,
  split: AbSplit,
): Promise<PromptVersion[]> {
  const name = Agent.parse(agent);
  const values = AbSplit.parse(split);
  const ids = values.map((s) => s.promptVersionId);
  return audited(
    admin,
    {
      action: "prompt_versions.ab_split",
      targetType: "prompt_agent",
      targetId: name,
      meta: { split: values },
    },
    async (db) => {
      const owned = await db
        .select({ id: promptVersions.id })
        .from(promptVersions)
        .where(and(eq(promptVersions.agent, name), inArray(promptVersions.id, ids)));
      if (owned.length !== ids.length) throw new Error(`Every version must belong to ${name}`);
      await db
        .update(promptVersions)
        .set({ active: false, abWeight: 0 })
        .where(eq(promptVersions.agent, name));
      const rows: PromptVersion[] = [];
      for (const entry of values) {
        const [row] = await db
          .update(promptVersions)
          .set({ active: true, abWeight: entry.weight })
          .where(eq(promptVersions.id, entry.promptVersionId))
          .returning();
        if (row) rows.push(row);
      }
      return rows;
    },
  );
}

export type PromptVersionSummary = Omit<PromptVersion, "template">;

export async function listPromptVersions(
  admin: AdminContext,
  agent?: string,
): Promise<PromptVersionSummary[]> {
  return adminDb(admin)
    .select({
      id: promptVersions.id,
      createdAt: promptVersions.createdAt,
      updatedAt: promptVersions.updatedAt,
      agent: promptVersions.agent,
      version: promptVersions.version,
      routeOverride: promptVersions.routeOverride,
      active: promptVersions.active,
      abWeight: promptVersions.abWeight,
    })
    .from(promptVersions)
    .where(agent === undefined ? undefined : eq(promptVersions.agent, Agent.parse(agent)))
    .orderBy(asc(promptVersions.agent), desc(promptVersions.createdAt));
}

/** Active versions for an agent with their weights; empty means "use the file prompts". */
export async function getActivePromptVersions(
  db: DbExecutor,
  agent: string,
): Promise<PromptVersion[]> {
  return db
    .select()
    .from(promptVersions)
    .where(and(eq(promptVersions.agent, Agent.parse(agent)), eq(promptVersions.active, true)))
    .orderBy(desc(promptVersions.abWeight));
}
