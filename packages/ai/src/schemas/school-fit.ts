import { SchoolFit, TraitId } from "@admitstory/shared/schemas";
import { z } from "zod";
import { MedianComparisonInput } from "./median";
import { RetrievalChunks } from "./retrieval";

/**
 * strategy.school_fit (spec §5.5). One call per school on the applicant's list, on Haiku. The
 * school's published pack is the L1 layer (ctx.schoolPack), so every user's call to the same pack
 * version shares the cached prefix; the applicant arrives as a short summary, not the dossier.
 */

export const SchoolFitInput = z.object({
  school: z.string().trim().min(1).max(120),
  cycle: z.string().trim().min(1).max(20),
  applicant: z.object({
    /** One or two lines: role, years, country, where they are headed. No names. */
    summary: z.string().trim().min(1).max(600),
    target_function: z.string().trim().max(120).nullable(),
    brand_traits: z.array(TraitId).max(4),
    /** Null when the applicant has not said where they hold citizenship. */
    international: z.boolean().nullable(),
    /** The round they are considering here, e.g. "R2", or null. */
    round: z.string().trim().max(20).nullable(),
  }),
  /** compareToMedian() against this school's class profile. */
  medians: MedianComparisonInput,
  retrieval: RetrievalChunks,
});
export type SchoolFitInput = z.input<typeof SchoolFitInput>;

export const SchoolFitOutput = SchoolFit;
