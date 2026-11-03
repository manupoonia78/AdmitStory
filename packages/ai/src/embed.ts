import { createHash } from "node:crypto";
import { AIError, UpstreamError } from "./errors";
import type { Fetch } from "./replay";
import { EMBED_ROUTE, EMBEDDING_MODEL_IDS } from "./routing";

/**
 * Embeddings for the knowledge base (spec §8.9; agreed 2026-10-31): Voyage `voyage-3.5-lite` at
 * 1024 dimensions, which is what `kb_chunks.embedding vector(1024)` stores. They are model calls,
 * so they go through ai.embed() and are metered in usage_ledger as task `kb.embed` (run.ts).
 *
 * Two providers behind one interface: the Voyage adapter (plain fetch, no SDK) and a deterministic
 * fake for development without a VOYAGE_API_KEY. The fake refuses to run unless APP_URL is
 * localhost, the same rule as the payments and voice fakes: a deployed app without a key must fail
 * loudly, not fill the vector index with hash noise.
 */

export type EmbedInputType = "document" | "query";

export interface EmbeddingResult {
  /** One unit vector per input text, in input order. */
  vectors: number[][];
  /** Input tokens billed. The fake estimates them (4 characters a token). */
  tokens: number;
}

export interface EmbeddingProvider {
  /** An EMBEDDING_MODEL_IDS value; priced in pricing.ts. */
  readonly model: string;
  /** True for the local fake: its ledger rows are marked aiMode "replay" (nothing real ran). */
  readonly fake: boolean;
  readonly dimensions: number;
  /** One request's worth of texts (the caller splits larger inputs; see EMBED_BATCH_SIZE). */
  embed(
    texts: readonly string[],
    inputType: EmbedInputType,
    signal?: AbortSignal,
  ): Promise<EmbeddingResult>;
}

/** Texts per provider request. Voyage accepts 1,000; smaller requests keep each under its token cap. */
export const EMBED_BATCH_SIZE = 128;

export const VOYAGE_EMBEDDINGS_URL = "https://api.voyageai.com/v1/embeddings";

export class EmbedConfigError extends AIError {
  override readonly name = "EmbedConfigError";
  readonly code = "embed_config";
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Same rule as apps/web/lib/env.ts `isLocalAppUrl`; a missing or invalid URL is not local. */
export function isLocalUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

/* Voyage ------------------------------------------------------------------------------------- */

export interface VoyageConfig {
  apiKey: string;
  fetch?: Fetch;
  /** Retries after the first request on 429, 5xx and connection errors (default 3). */
  maxRetries?: number;
  /** Backoff sleep (tests). */
  sleep?: (ms: number) => Promise<void>;
}

interface VoyageResponse {
  data: { embedding: number[]; index: number }[];
  usage: { total_tokens: number };
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createVoyageEmbedder(config: VoyageConfig): EmbeddingProvider {
  const fetchFn = config.fetch ?? globalThis.fetch.bind(globalThis);
  const maxRetries = config.maxRetries ?? 3;
  const sleep = config.sleep ?? wait;
  const model = EMBEDDING_MODEL_IDS[EMBED_ROUTE.model];

  return {
    model,
    fake: false,
    dimensions: EMBED_ROUTE.dimensions,
    async embed(texts, inputType, signal) {
      const body = JSON.stringify({
        input: texts,
        model,
        input_type: inputType,
        output_dimension: EMBED_ROUTE.dimensions,
      });
      for (let attempt = 0; ; attempt += 1) {
        let response: Response;
        try {
          response = await fetchFn(VOYAGE_EMBEDDINGS_URL, {
            method: "POST",
            headers: {
              authorization: `Bearer ${config.apiKey}`,
              "content-type": "application/json",
            },
            body,
            ...(signal ? { signal } : {}),
          });
        } catch (error) {
          if (signal?.aborted)
            throw new UpstreamError(EMBED_ROUTE.task, null, false, true, { cause: error });
          if (attempt < maxRetries) {
            await sleep(500 * 2 ** attempt);
            continue;
          }
          throw new UpstreamError(EMBED_ROUTE.task, null, true, false, { cause: error });
        }
        const retryable = response.status === 429 || response.status >= 500;
        if (!response.ok) {
          if (retryable && attempt < maxRetries) {
            await sleep(500 * 2 ** attempt);
            continue;
          }
          throw new UpstreamError(EMBED_ROUTE.task, response.status, retryable, false);
        }
        const json = (await response.json()) as VoyageResponse;
        const vectors = new Array<number[]>(texts.length);
        for (const item of json.data) vectors[item.index] = item.embedding;
        // Array.from turns holes into undefined: `some` alone skips a missing index.
        if (
          vectors.length !== texts.length ||
          Array.from(vectors).some((v) => v?.length !== EMBED_ROUTE.dimensions)
        )
          throw new UpstreamError(EMBED_ROUTE.task, response.status, false, false, {
            cause: new Error("Voyage returned a malformed embeddings response"),
          });
        return { vectors, tokens: json.usage.total_tokens };
      }
    },
  };
}

/* The fake ------------------------------------------------------------------------------------- */

/** mulberry32: a tiny seeded PRNG, so a word always contributes the same direction. */
function prng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

function seedOf(word: string): number {
  return createHash("sha256").update(word).digest().readUInt32BE(0);
}

/**
 * A deterministic unit vector for a text: the normalised sum of one pseudo-random direction per
 * word. Texts that share words point the same way, so retrieval over the fake still ranks a chunk
 * about "deadlines" above one about "clubs" for a query about deadlines. Query and document
 * vectors are the same, which is what a perfect embedder would aim for.
 */
export function fakeEmbedding(text: string, dimensions: number = EMBED_ROUTE.dimensions): number[] {
  const vector = new Array<number>(dimensions).fill(0);
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  for (const word of words.length > 0 ? words : [""]) {
    const next = prng(seedOf(word));
    for (let i = 0; i < dimensions; i += 1) vector[i] = (vector[i] ?? 0) + next() * 2 - 1;
  }
  const norm = Math.hypot(...vector);
  return vector.map((value) => value / norm);
}

/** Refuses to exist off localhost (see the module comment). */
export function createFakeEmbedder(options: { appUrl: string | undefined }): EmbeddingProvider {
  if (!isLocalUrl(options.appUrl))
    throw new EmbedConfigError(
      "VOYAGE_API_KEY is not set and APP_URL is not localhost, so there is no embedder. The fake embedder runs on localhost only.",
    );
  return {
    model: EMBEDDING_MODEL_IDS.fake,
    fake: true,
    dimensions: EMBED_ROUTE.dimensions,
    async embed(texts) {
      return {
        vectors: texts.map((text) => fakeEmbedding(text)),
        tokens: texts.reduce((sum, text) => sum + Math.ceil(text.length / 4), 0),
      };
    },
  };
}

/**
 * The provider for an environment: Voyage when VOYAGE_API_KEY is set, otherwise the fake, built
 * on first use so a deployed app that never embeds does not fail at start-up.
 */
export function embedderFromEnv(env: NodeJS.ProcessEnv): () => EmbeddingProvider {
  const apiKey = env.VOYAGE_API_KEY?.trim();
  let provider: EmbeddingProvider | undefined;
  return () =>
    (provider ??= apiKey
      ? createVoyageEmbedder({ apiKey })
      : createFakeEmbedder({ appUrl: env.APP_URL }));
}
