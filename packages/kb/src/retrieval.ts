// Hybrid retrieval over `kb_chunks` (spec §8.9): vector top 20 + full-text top 20, fused with
// reciprocal rank fusion, filtered by school, cycle, source type and trust, returning the top 6
// chunks within 2,500 tokens, each with a K-style code and its source.
//
// The store is an interface (types.ts: ChunkStore) that packages/db implements against Postgres
// (pgvector + tsvector); this module owns the fusion, the filtering guarantees and the codes, so
// they are the same whichever store answers.
//
// Codes. A chunk is cited the way a pack item is, with a K code that @admitstory/shared's
// `parseCode` reads as kind "pack". Pack items use K01…K899999 (the schema refuses anything at or
// above RETRIEVAL_CODE_BASE); retrieval codes are K900001 upward, numbered per result in rank
// order. A caller that puts two results into one prompt passes `codeStart` to the second so the
// codes don't repeat. `chunkForCode` turns a code back into its chunk.
//
// Guarantees enforced here, not trusted to the store:
//   - filters are re-applied to every hit;
//   - `third_party_reference` chunks are never returned unless the caller names that type in
//     `sourceTypes` (§9.6: reference for Manu only, never shown to users). The default is passed
//     down to the store as an explicit `sourceTypes` list, so third-party chunks can't use up the
//     top-20 slots of either index; when a caller does ask for them they are never `citable`;
//   - a chunk with no verified date, or verified before the filter's cycle, is marked
//     `citable: false` (§9.3 freshness): usable as background, never as a cited school specific.

import { code, estimateTokens, parseCode } from "@admitstory/shared";
import { isStale } from "./freshness";
import {
  KB_SOURCE_TYPES,
  RETRIEVAL_CODE_BASE,
  type ChunkFilters,
  type ChunkHit,
  type ChunkStore,
  type KbSourceType,
} from "./types";

export type { ChunkFilters, ChunkHit, ChunkStore, KbSourceType } from "./types";

export const RETRIEVAL_DEFAULTS = { vectorK: 20, textK: 20, limit: 6, maxTokens: 2_500 } as const;

/** §8.9 doesn't fix the RRF constant; 60 is the value from the original paper and common practice. */
export const RRF_K = 60;

export interface RetrievedChunk extends ChunkHit {
  /** K900001… — cite this. */
  code: string;
  /** The fused RRF score (the store's own `score` is kept as it came). */
  fusedScore: number;
  tokenCount: number;
  /**
   * Verified within the filter's cycle (or no cycle filter and verified at all), and not a
   * `third_party_reference` chunk.
   */
  citable: boolean;
}

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  tokenCount: number;
  /** The next unused retrieval number, for `codeStart` on a following search. */
  nextCodeStart: number;
}

export interface HybridSearchOptions {
  vectorK?: number;
  textK?: number;
  limit?: number;
  maxTokens?: number;
  /** First retrieval number to use (1 → K900001). */
  codeStart?: number;
  /** For freshness; see freshness.ts. */
  cycleOpensOn?: string;
}

/** Retrieval number → code: 1 → "K900001". */
export function retrievalCode(n: number): string {
  if (!Number.isInteger(n) || n < 1 || RETRIEVAL_CODE_BASE + n > 999_999)
    throw new Error(`Retrieval numbers run 1–${999_999 - RETRIEVAL_CODE_BASE}, got ${n}`);
  return code("pack", RETRIEVAL_CODE_BASE + n);
}

/** Whether a K code is a retrieval citation rather than a pack item. */
export function isRetrievalCode(value: string): boolean {
  const parsed = parseCode(value);
  return parsed?.kind === "pack" && parsed.n > RETRIEVAL_CODE_BASE;
}

export function chunkForCode(
  result: Pick<RetrievalResult, "chunks">,
  value: string,
): RetrievedChunk | undefined {
  const parsed = parseCode(value);
  if (parsed?.kind !== "pack") return undefined;
  const canonical = code("pack", parsed.n);
  return result.chunks.find((chunk) => chunk.code === canonical);
}

/** Every source type except `third_party_reference`: what a search covers unless told otherwise. */
export const DEFAULT_SOURCE_TYPES: readonly KbSourceType[] = KB_SOURCE_TYPES.filter(
  (type) => type !== "third_party_reference",
);

/** The filters with the third-party default made explicit, as sent to the store. */
export function storeFilters(filters: ChunkFilters): ChunkFilters {
  return filters.sourceTypes !== undefined
    ? filters
    : { ...filters, sourceTypes: [...DEFAULT_SOURCE_TYPES] };
}

/** Whether a hit satisfies the filters, including the third-party default. */
export function matchesFilters(hit: ChunkHit, filters: ChunkFilters): boolean {
  if (filters.schoolId !== undefined && hit.schoolId !== filters.schoolId) return false;
  if (filters.cycle !== undefined && hit.cycle !== null && hit.cycle !== filters.cycle)
    return false;
  if (filters.minTrust !== undefined && hit.trust < filters.minTrust) return false;
  if (filters.sourceTypes !== undefined) return filters.sourceTypes.includes(hit.sourceType);
  return hit.sourceType !== "third_party_reference";
}

/**
 * Reciprocal rank fusion: each list contributes 1 / (k + rank) for every hit it ranks (rank from
 * 1). Hits are deduplicated by chunk id. Ties break by chunk id, so the order is deterministic.
 */
export function reciprocalRankFusion(
  lists: readonly (readonly ChunkHit[])[],
  k: number = RRF_K,
): { hit: ChunkHit; fusedScore: number }[] {
  const fused = new Map<string, { hit: ChunkHit; fusedScore: number }>();
  for (const list of lists) {
    const seen = new Set<string>();
    list.forEach((hit, index) => {
      // A store that returns a chunk twice in one list only gets credit for its best rank.
      if (seen.has(hit.chunkId)) return;
      seen.add(hit.chunkId);
      const entry = fused.get(hit.chunkId) ?? { hit, fusedScore: 0 };
      entry.fusedScore += 1 / (k + index + 1);
      fused.set(hit.chunkId, entry);
    });
  }
  return [...fused.values()].sort(
    (a, b) => b.fusedScore - a.fusedScore || a.hit.chunkId.localeCompare(b.hit.chunkId),
  );
}

export async function hybridSearch(
  store: ChunkStore,
  embed: (text: string) => Promise<number[]>,
  query: string,
  filters: ChunkFilters,
  options: HybridSearchOptions = {},
): Promise<RetrievalResult> {
  const vectorK = options.vectorK ?? RETRIEVAL_DEFAULTS.vectorK;
  const textK = options.textK ?? RETRIEVAL_DEFAULTS.textK;
  const limit = options.limit ?? RETRIEVAL_DEFAULTS.limit;
  const maxTokens = options.maxTokens ?? RETRIEVAL_DEFAULTS.maxTokens;
  const codeStart = options.codeStart ?? 1;

  const embedding = await embed(query);
  const pushed = storeFilters(filters);
  const [vectorHits, textHits] = await Promise.all([
    store.vectorSearch({ embedding, filters: pushed, limit: vectorK }),
    store.textSearch({ query, filters: pushed, limit: textK }),
  ]);
  const keep = (hits: ChunkHit[]) => hits.filter((hit) => matchesFilters(hit, filters));
  const ranked = reciprocalRankFusion([keep(vectorHits), keep(textHits)]);

  const chunks: RetrievedChunk[] = [];
  let tokenCount = 0;
  for (const { hit, fusedScore } of ranked) {
    if (chunks.length >= limit) break;
    const tokens = estimateTokens(hit.text);
    // Skip a chunk that would break the budget, but keep looking: a smaller one may still fit.
    if (tokenCount + tokens > maxTokens) continue;
    tokenCount += tokens;
    const citable =
      hit.sourceType !== "third_party_reference" &&
      hit.verifiedAt !== null &&
      (filters.cycle === undefined ||
        !isStale(hit.verifiedAt.slice(0, 10), filters.cycle, options.cycleOpensOn));
    chunks.push({
      ...hit,
      code: retrievalCode(codeStart + chunks.length),
      fusedScore,
      tokenCount: tokens,
      citable,
    });
  }
  return { chunks, tokenCount, nextCodeStart: codeStart + chunks.length };
}

/** Retrieved chunks as a prompt block: `K900001 [insider 2026-09-02] Title\n<text>`. */
export function formatRetrieved(result: Pick<RetrievalResult, "chunks">): string {
  return result.chunks
    .map((chunk) => {
      const date = chunk.verifiedAt ? chunk.verifiedAt.slice(0, 10) : "unverified";
      const flag = chunk.citable ? "" : " background-only";
      return `${chunk.code} [${chunk.sourceType} ${date}${flag}] ${chunk.title}\n${chunk.text}`;
    })
    .join("\n\n");
}
