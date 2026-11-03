// The knowledge base (spec §9.1, §9.3): sources, their chunks and embeddings, the Normalizer's
// field-level proposals, and the refresh checker's URL snapshots. Admin-only; every mutation is
// audited. A source's extracted text is encrypted like the applicant's documents (§14.4) and comes
// back decrypted only from getKbSource.

import { createHash } from "node:crypto";
import { and, asc, count, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { decryptContent, encryptContent, getContentKeyring } from "../crypto/content";
import {
  EMBEDDING_DIMENSIONS,
  kbChunks,
  kbProposals,
  kbRefreshSnapshots,
  kbSourceStatuses,
  kbSourceTypes,
  kbSources,
  proposalStatuses,
  schoolInterestVotes,
  type KbSourceStatus,
  type KbSourceTypeValue,
  type ProposalConflict,
  type ProposalEvidence,
  type ProposalStatus,
} from "../schema";
import { adminDb, audited, type AdminContext } from "./admin";
import { assertId } from "./ids";

export type KbSourceRow = typeof kbSources.$inferSelect;
/** A source without its text. */
export type KbSource = Omit<KbSourceRow, "textEncrypted">;
export interface KbSourceWithText extends KbSource {
  text: string | null;
}
export type KbProposal = typeof kbProposals.$inferSelect;
export type KbRefreshSnapshot = typeof kbRefreshSnapshots.$inferSelect;

/** Spec §9.1 default trust per source type; the admin may override per source. */
export const DEFAULT_TRUST: Readonly<Record<KbSourceTypeValue, number>> = {
  official: 5,
  adcom: 4,
  insider: 3,
  interview_reports: 3,
  coach_notes: 4,
  third_party_reference: 2,
  press: 2,
};

/** sha256 hex of the text, as stored in `content_hash`. */
export const hashContent = (text: string): string =>
  createHash("sha256").update(text, "utf8").digest("hex");

const strip = ({ textEncrypted: _omit, ...rest }: KbSourceRow): KbSource => rest;

const Cycle = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}$/, 'cycle is like "2026-27"');
const Trust = z.int().min(1).max(5);
const Url = z.url({ protocol: /^https?$/ }).max(2000);
const MAX_SOURCE_TEXT = 2_000_000;

/* Sources ------------------------------------------------------------------------------------ */

export const NewKbSource = z.strictObject({
  schoolId: z.guid().nullable().optional(),
  cycle: Cycle.nullable().optional(),
  type: z.enum(kbSourceTypes),
  title: z.string().trim().min(1).max(300),
  url: Url.nullable().optional(),
  fileKey: z.string().trim().max(512).nullable().optional(),
  /** Defaults to DEFAULT_TRUST[type]. */
  trust: Trust.optional(),
  rightsNote: z.string().trim().max(2000).nullable().optional(),
  /** Extracted text, when already known (pasted text). URL and file sources set it later. */
  text: z.string().max(MAX_SOURCE_TEXT).nullable().optional(),
  verifiedAt: z.coerce.date().nullable().optional(),
  meta: z.record(z.string(), z.unknown()).nullable().optional(),
});
export type NewKbSource = z.input<typeof NewKbSource>;

export async function addKbSource(admin: AdminContext, input: NewKbSource): Promise<KbSource> {
  const values = NewKbSource.parse(input);
  const text = values.text ?? null;
  return audited(
    admin,
    (row: KbSource) => ({
      action: "kb_sources.create",
      targetType: "kb_source",
      targetId: row.id,
      meta: { schoolId: row.schoolId, type: row.type, cycle: row.cycle },
    }),
    async (db) => {
      const [row] = await db
        .insert(kbSources)
        .values({
          schoolId: values.schoolId ?? null,
          cycle: values.cycle ?? null,
          type: values.type,
          title: values.title,
          url: values.url ?? null,
          fileKey: values.fileKey ?? null,
          trust: values.trust ?? DEFAULT_TRUST[values.type],
          rightsNote: values.rightsNote ?? null,
          addedBy: admin.actorId,
          textEncrypted: text === null ? null : encryptContent(getContentKeyring(), text),
          contentHash: text === null ? null : hashContent(text),
          verifiedAt: values.verifiedAt ?? null,
          meta: values.meta ?? null,
        })
        .returning();
      if (!row) throw new Error("Failed to add source");
      return strip(row);
    },
  );
}

/** Stores the text extracted from a URL, PDF or recording after the source was added. */
export async function setKbSourceText(
  admin: AdminContext,
  sourceId: string,
  text: string,
): Promise<KbSource> {
  const id = assertId(sourceId, "sourceId");
  const value = z.string().max(MAX_SOURCE_TEXT).parse(text);
  return audited(
    admin,
    { action: "kb_sources.set_text", targetType: "kb_source", targetId: id },
    async (db) => {
      const [row] = await db
        .update(kbSources)
        .set({
          textEncrypted: encryptContent(getContentKeyring(), value),
          contentHash: hashContent(value),
        })
        .where(eq(kbSources.id, id))
        .returning();
      if (!row) throw new Error("Source not found");
      return strip(row);
    },
  );
}

export async function setKbSourceStatus(
  admin: AdminContext,
  sourceId: string,
  status: KbSourceStatus,
  error?: string | null,
): Promise<KbSource> {
  const id = assertId(sourceId, "sourceId");
  const value = z.enum(kbSourceStatuses).parse(status);
  const message = error ? z.string().max(2000).parse(error.slice(0, 2000)) : null;
  return audited(
    admin,
    {
      action: "kb_sources.set_status",
      targetType: "kb_source",
      targetId: id,
      meta: { status: value },
    },
    async (db) => {
      const [row] = await db
        .update(kbSources)
        .set({ status: value, error: value === "failed" ? message : null })
        .where(eq(kbSources.id, id))
        .returning();
      if (!row) throw new Error("Source not found");
      return strip(row);
    },
  );
}

export const KbSourcePatch = z
  .strictObject({
    type: z.enum(kbSourceTypes),
    title: z.string().trim().min(1).max(300),
    url: Url.nullable(),
    trust: Trust,
    cycle: Cycle.nullable(),
    rightsNote: z.string().trim().max(2000).nullable(),
    verifiedAt: z.coerce.date().nullable(),
  })
  .partial();
export type KbSourcePatch = z.input<typeof KbSourcePatch>;

/** Edits a source's tags. A new cycle is copied onto its chunks so retrieval filters stay true. */
export async function updateKbSource(
  admin: AdminContext,
  sourceId: string,
  patch: KbSourcePatch,
): Promise<KbSource | null> {
  const id = assertId(sourceId, "sourceId");
  const values = KbSourcePatch.parse(patch);
  if (Object.keys(values).length === 0) {
    const [row] = await adminDb(admin).select().from(kbSources).where(eq(kbSources.id, id));
    return row ? strip(row) : null;
  }
  return audited(
    admin,
    (row: KbSource | null) =>
      row && {
        action: "kb_sources.update",
        targetType: "kb_source",
        targetId: id,
        meta: { fields: Object.keys(values) },
      },
    async (db) => {
      const [row] = await db.update(kbSources).set(values).where(eq(kbSources.id, id)).returning();
      if (row && values.cycle !== undefined)
        await db.update(kbChunks).set({ cycle: row.cycle }).where(eq(kbChunks.sourceId, id));
      return row ? strip(row) : null;
    },
  );
}

/** Deletes a source with its chunks and proposals. */
export async function deleteKbSource(
  admin: AdminContext,
  sourceId: string,
  reason?: string,
): Promise<boolean> {
  const id = assertId(sourceId, "sourceId");
  return audited(
    admin,
    (deleted: boolean) =>
      deleted
        ? {
            action: "kb_sources.delete",
            targetType: "kb_source",
            targetId: id,
            reason: reason ?? null,
          }
        : null,
    async (db) => {
      const rows = await db
        .delete(kbSources)
        .where(eq(kbSources.id, id))
        .returning({ id: kbSources.id });
      return rows.length > 0;
    },
  );
}

export async function getKbSource(
  admin: AdminContext,
  sourceId: string,
): Promise<KbSourceWithText | null> {
  const [row] = await adminDb(admin)
    .select()
    .from(kbSources)
    .where(eq(kbSources.id, assertId(sourceId, "sourceId")))
    .limit(1);
  if (!row) return null;
  return {
    ...strip(row),
    text:
      row.textEncrypted === null ? null : decryptContent(getContentKeyring(), row.textEncrypted),
  };
}

export interface KbSourceFilter {
  schoolId?: string;
  cycle?: string;
  type?: KbSourceTypeValue;
  status?: KbSourceStatus;
  contentHash?: string;
  limit?: number;
}

/** Newest first, without text, each with its chunk count. */
export async function listKbSources(
  admin: AdminContext,
  filter: KbSourceFilter = {},
): Promise<(KbSource & { chunkCount: number })[]> {
  const db = adminDb(admin);
  const conditions: SQL[] = [];
  if (filter.schoolId)
    conditions.push(eq(kbSources.schoolId, assertId(filter.schoolId, "schoolId")));
  if (filter.cycle) conditions.push(eq(kbSources.cycle, Cycle.parse(filter.cycle)));
  if (filter.type) conditions.push(eq(kbSources.type, z.enum(kbSourceTypes).parse(filter.type)));
  if (filter.status)
    conditions.push(eq(kbSources.status, z.enum(kbSourceStatuses).parse(filter.status)));
  if (filter.contentHash) conditions.push(eq(kbSources.contentHash, filter.contentHash));
  const rows = await db
    .select()
    .from(kbSources)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(kbSources.createdAt))
    .limit(Math.min(Math.max(filter.limit ?? 100, 1), 500));
  if (rows.length === 0) return [];
  const counts = await db
    .select({ sourceId: kbChunks.sourceId, n: count() })
    .from(kbChunks)
    .where(
      inArray(
        kbChunks.sourceId,
        rows.map((r) => r.id),
      ),
    )
    .groupBy(kbChunks.sourceId);
  const bySource = new Map(counts.map((c) => [c.sourceId, c.n] as const));
  return rows.map((row) => ({ ...strip(row), chunkCount: bySource.get(row.id) ?? 0 }));
}

/* Chunks ------------------------------------------------------------------------------------- */

const Embedding = z
  .array(z.number().finite())
  .length(EMBEDDING_DIMENSIONS, `embedding has ${EMBEDDING_DIMENSIONS} dimensions`);

export const NewChunk = z.strictObject({
  ord: z.int().nonnegative(),
  text: z.string().trim().min(1).max(20_000),
  embedding: Embedding.nullable(),
  meta: z.record(z.string(), z.unknown()).nullable().optional(),
});
export type NewChunk = z.input<typeof NewChunk>;

const CHUNK_BATCH = 100;

/**
 * Replaces a source's chunks with these, in batches, in one transaction, so re-ingesting a source
 * is idempotent. School and cycle are copied from the source for filtering.
 */
export async function insertChunks(
  admin: AdminContext,
  sourceId: string,
  chunks: readonly NewChunk[],
): Promise<{ inserted: number }> {
  const id = assertId(sourceId, "sourceId");
  const values = z
    .array(NewChunk)
    .max(20_000)
    .refine((list) => new Set(list.map((c) => c.ord)).size === list.length, "ord is unique")
    .parse(chunks);
  return audited(
    admin,
    (result: { inserted: number }) => ({
      action: "kb_chunks.replace",
      targetType: "kb_source",
      targetId: id,
      meta: {
        count: result.inserted,
        embedded: values.filter((c) => c.embedding !== null).length,
      },
    }),
    async (db) => {
      const [source] = await db
        .select({ schoolId: kbSources.schoolId, cycle: kbSources.cycle })
        .from(kbSources)
        .where(eq(kbSources.id, id))
        .limit(1)
        .for("update");
      if (!source) throw new Error("Source not found");
      await db.delete(kbChunks).where(eq(kbChunks.sourceId, id));
      for (let i = 0; i < values.length; i += CHUNK_BATCH) {
        await db.insert(kbChunks).values(
          values.slice(i, i + CHUNK_BATCH).map((chunk) => ({
            sourceId: id,
            schoolId: source.schoolId,
            cycle: source.cycle,
            ord: chunk.ord,
            text: chunk.text,
            embedding: chunk.embedding,
            meta: chunk.meta ?? null,
          })),
        );
      }
      return { inserted: values.length };
    },
  );
}

/** Fills in embeddings for chunks stored without one (e.g. embedding retried after a failure). */
export async function setChunkEmbeddings(
  admin: AdminContext,
  rows: readonly { chunkId: string; embedding: number[] }[],
): Promise<{ updated: number }> {
  const values = z
    .array(z.strictObject({ chunkId: z.guid(), embedding: Embedding }))
    .max(5_000)
    .parse(rows);
  return audited(
    admin,
    (result: { updated: number }) => ({
      action: "kb_chunks.embed",
      targetType: "kb_chunk",
      meta: { count: result.updated },
    }),
    async (db) => {
      let updated = 0;
      for (const row of values) {
        const done = await db
          .update(kbChunks)
          .set({ embedding: row.embedding })
          .where(eq(kbChunks.id, row.chunkId))
          .returning({ id: kbChunks.id });
        updated += done.length;
      }
      return { updated };
    },
  );
}

export async function listSourceChunks(
  admin: AdminContext,
  sourceId: string,
): Promise<{ id: string; ord: number; text: string; embedded: boolean }[]> {
  return adminDb(admin)
    .select({
      id: kbChunks.id,
      ord: kbChunks.ord,
      text: kbChunks.text,
      embedded: sql<boolean>`${kbChunks.embedding} is not null`,
    })
    .from(kbChunks)
    .where(eq(kbChunks.sourceId, assertId(sourceId, "sourceId")))
    .orderBy(asc(kbChunks.ord));
}

/* Proposals ---------------------------------------------------------------------------------- */

export const NewProposal = z.strictObject({
  sourceId: z.guid().nullable().optional(),
  cycleId: z.guid(),
  packId: z.guid().nullable().optional(),
  fieldPath: z.string().trim().min(1).max(300),
  proposed: z.unknown().refine((v) => v !== undefined, "proposed is required"),
  current: z.unknown().optional(),
  confidence: z.number().min(0).max(1),
  evidence: z
    .array(
      z.strictObject({
        quote: z.string().max(2000).optional(),
        start: z.int().nonnegative().optional(),
        end: z.int().nonnegative().optional(),
        chunkId: z.guid().optional(),
      }),
    )
    .max(20)
    .nullable()
    .optional(),
  conflict: z
    .strictObject({
      values: z
        .array(
          z.strictObject({
            value: z.unknown(),
            sourceId: z.guid().nullable(),
            trust: Trust.nullable(),
          }),
        )
        .max(10),
      note: z.string().max(2000).optional(),
    })
    .nullable()
    .optional(),
});
export type NewProposal = z.input<typeof NewProposal>;

/** Stores the Normalizer's field-level diffs (§9.3), all pending review. */
export async function createProposals(
  admin: AdminContext,
  proposals: readonly NewProposal[],
): Promise<KbProposal[]> {
  const values = z.array(NewProposal).max(1_000).parse(proposals);
  if (values.length === 0) return [];
  return audited(
    admin,
    (rows: KbProposal[]) => ({
      action: "kb_proposals.create",
      targetType: "school_cycle",
      targetId: rows[0]?.cycleId ?? null,
      meta: { count: rows.length, sourceIds: [...new Set(rows.map((r) => r.sourceId))] },
    }),
    async (db) =>
      db
        .insert(kbProposals)
        .values(
          values.map((p) => ({
            sourceId: p.sourceId ?? null,
            cycleId: p.cycleId,
            packId: p.packId ?? null,
            fieldPath: p.fieldPath,
            proposed: p.proposed,
            current: p.current ?? null,
            confidence: p.confidence,
            evidence: (p.evidence as ProposalEvidence[] | null | undefined) ?? null,
            conflict: (p.conflict as ProposalConflict | null | undefined) ?? null,
          })),
        )
        .returning(),
  );
}

export async function listProposals(
  admin: AdminContext,
  filter: { cycleId?: string; sourceId?: string; status?: ProposalStatus; limit?: number } = {},
): Promise<KbProposal[]> {
  const conditions: SQL[] = [];
  if (filter.cycleId) conditions.push(eq(kbProposals.cycleId, assertId(filter.cycleId, "cycleId")));
  if (filter.sourceId)
    conditions.push(eq(kbProposals.sourceId, assertId(filter.sourceId, "sourceId")));
  if (filter.status)
    conditions.push(eq(kbProposals.status, z.enum(proposalStatuses).parse(filter.status)));
  return adminDb(admin)
    .select()
    .from(kbProposals)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(kbProposals.fieldPath), desc(kbProposals.confidence))
    .limit(Math.min(Math.max(filter.limit ?? 500, 1), 2_000));
}

export async function getProposal(
  admin: AdminContext,
  proposalId: string,
): Promise<KbProposal | null> {
  const [row] = await adminDb(admin)
    .select()
    .from(kbProposals)
    .where(eq(kbProposals.id, assertId(proposalId, "proposalId")))
    .limit(1);
  return row ?? null;
}

export const ProposalReview = z.discriminatedUnion("decision", [
  z.strictObject({ decision: z.literal("accepted"), reason: z.string().max(2000).optional() }),
  z.strictObject({ decision: z.literal("rejected"), reason: z.string().max(2000).optional() }),
  z.strictObject({
    decision: z.literal("edited"),
    edited: z.unknown().refine((v) => v !== undefined, "edited is required"),
    reason: z.string().max(2000).optional(),
  }),
]);
export type ProposalReview = z.input<typeof ProposalReview>;

export class ProposalAlreadyReviewedError extends Error {
  override name = "ProposalAlreadyReviewedError";
}

/**
 * Accepts, rejects or edits a pending proposal. Applying it to the draft pack is packages/kb's job;
 * run both in one inTransaction() so a review and its edit land together.
 */
export async function reviewProposal(
  admin: AdminContext,
  proposalId: string,
  review: ProposalReview,
): Promise<KbProposal | null> {
  const id = assertId(proposalId, "proposalId");
  const value = ProposalReview.parse(review);
  return audited(
    admin,
    (row: KbProposal | null) =>
      row && {
        action: "kb_proposals.review",
        targetType: "kb_proposal",
        targetId: id,
        reason: value.reason ?? null,
        meta: { decision: value.decision },
      },
    async (db) => {
      const [row] = await db
        .update(kbProposals)
        .set({
          status: value.decision,
          edited: value.decision === "edited" ? value.edited : null,
          reviewedBy: admin.actorId,
          reviewedAt: new Date(),
        })
        .where(and(eq(kbProposals.id, id), eq(kbProposals.status, "pending")))
        .returning();
      if (row) return row;
      const [existing] = await db
        .select({ status: kbProposals.status })
        .from(kbProposals)
        .where(eq(kbProposals.id, id))
        .limit(1);
      if (existing)
        throw new ProposalAlreadyReviewedError(`Proposal is already ${existing.status}`);
      return null;
    },
  );
}

/* Refresh checker snapshots ------------------------------------------------------------------ */

export const NewRefreshSnapshot = z.strictObject({
  schoolCycleId: z.guid(),
  url: Url,
  contentHash: z.string().regex(/^[a-f0-9]{64}$/, "sha256 hex"),
  fetchedAt: z.coerce.date().optional(),
});
export type NewRefreshSnapshot = z.input<typeof NewRefreshSnapshot>;

/**
 * Records a fetch of an official URL and reports whether it changed since the last one (§9.3). The
 * first fetch of a URL is a baseline, not a change.
 */
export async function recordRefreshSnapshot(
  admin: AdminContext,
  input: NewRefreshSnapshot,
): Promise<{ snapshot: KbRefreshSnapshot; changed: boolean; previousHash: string | null }> {
  const values = NewRefreshSnapshot.parse(input);
  return audited(
    admin,
    (result) => ({
      action: "kb_refresh_snapshots.record",
      targetType: "school_cycle",
      targetId: values.schoolCycleId,
      meta: { url: values.url, changed: result.changed },
    }),
    async (db) => {
      const [previous] = await db
        .select({ contentHash: kbRefreshSnapshots.contentHash })
        .from(kbRefreshSnapshots)
        .where(
          and(
            eq(kbRefreshSnapshots.schoolCycleId, values.schoolCycleId),
            eq(kbRefreshSnapshots.url, values.url),
          ),
        )
        .orderBy(desc(kbRefreshSnapshots.fetchedAt))
        .limit(1);
      const [snapshot] = await db
        .insert(kbRefreshSnapshots)
        .values({ ...values, fetchedAt: values.fetchedAt ?? new Date() })
        .returning();
      if (!snapshot) throw new Error("Failed to record snapshot");
      const previousHash = previous?.contentHash ?? null;
      return {
        snapshot,
        changed: previousHash !== null && previousHash !== values.contentHash,
        previousHash,
      };
    },
  );
}

/** The newest snapshot per URL for a cycle. */
export async function latestRefreshSnapshots(
  admin: AdminContext,
  cycleId: string,
): Promise<KbRefreshSnapshot[]> {
  return adminDb(admin)
    .selectDistinctOn([kbRefreshSnapshots.url])
    .from(kbRefreshSnapshots)
    .where(eq(kbRefreshSnapshots.schoolCycleId, assertId(cycleId, "cycleId")))
    .orderBy(kbRefreshSnapshots.url, desc(kbRefreshSnapshots.fetchedAt));
}

/* Demand ------------------------------------------------------------------------------------- */

/** "Pack coming soon" votes per school, most wanted first (§9.5). */
export async function countInterestVotes(
  admin: AdminContext,
): Promise<{ schoolId: string; votes: number }[]> {
  return adminDb(admin)
    .select({ schoolId: schoolInterestVotes.schoolId, votes: count() })
    .from(schoolInterestVotes)
    .groupBy(schoolInterestVotes.schoolId)
    .orderBy(desc(count()));
}
