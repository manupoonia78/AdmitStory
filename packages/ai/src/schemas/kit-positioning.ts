import { isCode } from "@admitstory/shared";
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
  /**
   * The free preview asks for the first lines of one essay (prompt v2), and only where the school's
   * AI policy allows drafted prose (§8.10). The paid pipeline leaves it off: its essays come from
   * kit.draft.
   */
  draft_opening: z.boolean().default(false),
});
export type KitPositioningInput = z.input<typeof KitPositioningInput>;

/**
 * The opening of one essay, shown in the free preview (Manu, 16 Nov 2026): the applicant's own
 * story on the page before they pay. Built only from the dossier; tasks/kit.ts checks that it
 * names an essay the request listed and that essay's own primary story.
 */
export const PreviewOpening = z.object({
  deliverable_key: z.string().trim().min(1).max(80),
  story: z.string().refine((v) => isCode(v, "story"), "Not a story code (S##)"),
  text: z.string().trim().min(80).max(900).describe("Two to four sentences, 45 to 90 words"),
});
export type PreviewOpening = z.output<typeof PreviewOpening>;

export const KitPositioningOutput = z.object({
  positioning: Positioning,
  file_map: FileMap,
  /** Null unless the request asked for it; absent in replies recorded before prompt v2. */
  opening: PreviewOpening.nullable().default(null),
});
export type KitPositioningOutput = z.output<typeof KitPositioningOutput>;
