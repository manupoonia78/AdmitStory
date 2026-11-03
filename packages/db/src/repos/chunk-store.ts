// Hybrid retrieval over `kb_chunks` (spec §8.9): pgvector cosine search and Postgres full-text
// search, each filtered by school, cycle, source type and minimum trust. packages/kb fuses the two
// lists (reciprocal rank fusion) and trims to the token budget; this module only fetches.
//
// Filter semantics:
// - `schoolId` matches exactly.
// - `cycle` matches the cycle or evergreen chunks (cycle null), which apply to every cycle.
// - `sourceTypes` absent excludes `third_party_reference`: paid third-party notes are reference for
//   Manu only and must never reach a prompt or a user (§9.6). Ask for the type to get it.
// - Sources whose ingestion failed are never returned.

import {
  and,
  asc,
  cosineDistance,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { z } from "zod";
import type { DbExecutor } from "../client";
import { EMBEDDING_DIMENSIONS, kbChunks, kbSourceTypes, kbSources } from "../schema";
import type { ChunkFilters, ChunkHit, ChunkStore } from "../types";
import { assertId } from "./ids";

const MAX_LIMIT = 100;

const Filters = z.strictObject({
  schoolId: z.guid().optional(),
  cycle: z.string().trim().max(20).optional(),
  sourceTypes: z.array(z.enum(kbSourceTypes)).max(kbSourceTypes.length).optional(),
  minTrust: z.number().min(0).max(5).optional(),
});

const Embedding = z
  .array(z.number().finite())
  .length(EMBEDDING_DIMENSIONS, `embedding has ${EMBEDDING_DIMENSIONS} dimensions`);

const clampLimit = (limit: number) =>
  Math.min(Math.max(Number.isFinite(limit) ? Math.floor(limit) : 0, 0), MAX_LIMIT);

/** Null when the filters can match nothing (an empty `sourceTypes`). */
function conditions(filters: ChunkFilters): SQL[] | null {
  const f = Filters.parse(filters);
  const where: SQL[] = [ne(kbSources.status, "failed")];
  if (f.schoolId !== undefined) where.push(eq(kbChunks.schoolId, assertId(f.schoolId, "schoolId")));
  if (f.cycle !== undefined) {
    const cycle = or(eq(kbChunks.cycle, f.cycle), isNull(kbChunks.cycle));
    if (cycle) where.push(cycle);
  }
  if (f.sourceTypes === undefined) where.push(ne(kbSources.type, "third_party_reference"));
  else if (f.sourceTypes.length === 0) return null;
  else where.push(inArray(kbSources.type, f.sourceTypes));
  if (f.minTrust !== undefined) where.push(gte(kbSources.trust, f.minTrust));
  return where;
}

const hitColumns = {
  chunkId: kbChunks.id,
  sourceId: kbChunks.sourceId,
  schoolId: kbChunks.schoolId,
  cycle: kbChunks.cycle,
  text: kbChunks.text,
  sourceType: kbSources.type,
  trust: kbSources.trust,
  title: kbSources.title,
  url: kbSources.url,
  verifiedAt: kbSources.verifiedAt,
};

interface HitRow extends Omit<ChunkHit, "verifiedAt" | "score"> {
  verifiedAt: Date | null;
}

function toHit(row: HitRow, score: number): ChunkHit {
  return {
    ...row,
    verifiedAt: row.verifiedAt ? row.verifiedAt.toISOString().slice(0, 10) : null,
    score,
  };
}

export function createChunkStore(db: DbExecutor): ChunkStore {
  return {
    async vectorSearch({ embedding, filters, limit }) {
      const vector = Embedding.parse(embedding);
      const where = conditions(filters);
      const n = clampLimit(limit);
      if (where === null || n === 0) return [];
      const distance = cosineDistance(kbChunks.embedding, vector);
      return db.transaction(async (tx) => {
        // pgvector ≥ 0.8: keep scanning the HNSW graph until enough rows pass the filters,
        // instead of returning fewer than `limit` when most neighbours are other schools'.
        await tx.execute(sql`set local hnsw.iterative_scan = strict_order`);
        const rows = await tx
          .select({ ...hitColumns, distance: sql<number>`${distance}` })
          .from(kbChunks)
          .innerJoin(kbSources, eq(kbSources.id, kbChunks.sourceId))
          .where(and(isNotNull(kbChunks.embedding), ...where))
          .orderBy(distance, asc(kbChunks.id))
          .limit(n);
        // Cosine similarity, so higher is better in both searches.
        return rows.map(({ distance: d, ...row }) => toHit(row, 1 - Number(d)));
      });
    },

    async textSearch({ query, filters, limit }) {
      const text = z.string().max(2_000).parse(query).trim();
      const where = conditions(filters);
      const n = clampLimit(limit);
      if (text === "" || where === null || n === 0) return [];
      const tsquery = sql`websearch_to_tsquery('english'::regconfig, ${text})`;
      const rank = sql<number>`ts_rank(${kbChunks.tsv}, ${tsquery})`;
      const rows = await db
        .select({ ...hitColumns, rank })
        .from(kbChunks)
        .innerJoin(kbSources, eq(kbSources.id, kbChunks.sourceId))
        .where(and(sql`${kbChunks.tsv} @@ ${tsquery}`, ...where))
        .orderBy(desc(rank), asc(kbChunks.id))
        .limit(n);
      return rows.map(({ rank: r, ...row }) => toHit(row, Number(r)));
    },
  };
}
