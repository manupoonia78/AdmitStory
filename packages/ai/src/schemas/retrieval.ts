import { isCode } from "@admitstory/shared";
import { z } from "zod";

/**
 * Retrieved long-tail school material (spec §8.9): at most 6 chunks, each with its K-style code and
 * its source. Tasks that use retrieval take the chunks as input and render them in the messages,
 * after every cached layer, as untrusted data (§14.6). They never enter the cached prefix.
 */

/** §8.9: "Return top 6 chunks, ≤ 2,500 tokens". */
export const MAX_RETRIEVAL_CHUNKS = 6;

export const RetrievalChunk = z.object({
  id: z
    .string()
    .refine((value) => isCode(value, "pack"), "A retrieved chunk is cited by a K code")
    .describe("K code the model cites. Must not collide with the compiled pack's codes."),
  source: z.string().trim().min(1).max(200),
  /** ISO date the source was last verified, or null when it never was. */
  verified_at: z.string().max(40).nullable(),
  text: z.string().trim().min(1).max(6_000),
});
export type RetrievalChunk = z.output<typeof RetrievalChunk>;

export const RetrievalChunks = z
  .array(RetrievalChunk)
  .max(MAX_RETRIEVAL_CHUNKS)
  .refine((chunks) => new Set(chunks.map((c) => c.id)).size === chunks.length, {
    message: "Retrieved chunk codes must be unique",
  })
  .default([]);
