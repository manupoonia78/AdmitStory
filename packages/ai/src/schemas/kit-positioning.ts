import { FileMap, Positioning } from "@admitstory/shared/schemas";
import { z } from "zod";
import { RetrievalChunks } from "./retrieval";

/**
 * kit.positioning_filemap (spec §8.5.5): the Strategist, once per kit on Opus. It reads the full
 * compiled pack (L1, ctx.schoolPack) and the full compact dossier (L2, ctx.dossier); the input
 * lists what the school's application asks for and who will recommend the applicant.
 */

export const DELIVERABLE_KINDS = [
  "essay",
  "short_answer",
  "goal_field",
  "video",
  "optional_essay",
  "reapplicant_essay",
  "form_section",
  "recommendation_question",
  "interview_question",
] as const;
export type DeliverableKind = (typeof DELIVERABLE_KINDS)[number];

export const KitDeliverable = z.object({
  key: z.string().trim().min(1).max(80),
  kind: z.enum(DELIVERABLE_KINDS),
  /** The prompt as the school publishes it. */
  prompt: z.string().trim().min(1).max(4_000),
  /** "300 words", "1,000 characters including spaces", or null. */
  limit: z.string().trim().max(80).nullable(),
  required: z.boolean(),
});

export const KitPositioningInput = z.object({
  school: z.string().trim().min(1).max(120),
  cycle: z.string().trim().min(1).max(20),
  deliverables: z
    .array(KitDeliverable)
    .min(1)
    .max(40)
    .refine((items) => new Set(items.map((d) => d.key)).size === items.length, {
      message: "Deliverable keys must be unique",
    }),
  is_reapplicant: z.boolean(),
  recommenders: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(40),
        role: z.string().trim().min(1).max(200),
        relationship: z.string().trim().min(1).max(300),
      }),
    )
    .max(4)
    .default([]),
  retrieval: RetrievalChunks,
});
export type KitPositioningInput = z.input<typeof KitPositioningInput>;

export const KitPositioningOutput = z.object({ positioning: Positioning, file_map: FileMap });
export type KitPositioningOutput = z.output<typeof KitPositioningOutput>;
