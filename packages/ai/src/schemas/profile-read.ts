import { ProfileRead } from "@admitstory/shared/schemas";
import { z } from "zod";
import { MedianComparisonInput } from "./median";

/**
 * profile.read (spec §5.4, §8.5.4). The applicant's material is the compact dossier (L2, passed
 * as ctx.dossier); the input carries only what code has already worked out — how the applicant's
 * numbers sit against each target school's medians — so the model never does the arithmetic.
 */

export const ProfileReadInput = z.object({
  targets: z
    .array(
      z.object({
        school: z.string().trim().min(1).max(120),
        medians: MedianComparisonInput,
      }),
    )
    .max(12)
    .default([]),
});
export type ProfileReadInput = z.input<typeof ProfileReadInput>;

/** Appendix-style shape from @admitstory/shared (plain type: `ProfileRead` in /kit). */
export const ProfileReadOutput = ProfileRead;
