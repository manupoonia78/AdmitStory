// The Zod values built from the taxonomies: `LensId`, `TraitId`, `ChapterId`, `ArchetypeId`,
// `CoverageLevel` and `Cite`, for validating model output and request bodies.
//
// They live on their own subpath (`@admitstory/shared/schemas`), and are *built* here rather than
// beside each taxonomy, because a module that calls `z.enum()` at the top level cannot be
// tree-shaken: importing it for its plain data pulls Zod in too. Client components import the
// taxonomies constantly, and Zod is about 31 KB gzipped against a 160 KB route budget (spec
// §6.11). Nothing in the browser ever imports this file.

import { z } from "zod";
import { ARCHETYPE_IDS } from "./archetypes";
import { CHAPTER_IDS } from "./chapters";
import { isCode } from "./codes";
import { COVERAGE_LEVELS, LENS_IDS } from "./lenses";
import { TRAIT_IDS, type TraitId as TraitIdType } from "./traits";

export const LensId = z.enum(LENS_IDS);
export const CoverageLevel = z.enum(COVERAGE_LEVELS);
export const ChapterId = z.enum(CHAPTER_IDS);
export const ArchetypeId = z.enum(ARCHETYPE_IDS);

/** Appendix I's `TraitId`: the enum model output is validated against. */
export const TraitId = z.enum(TRAIT_IDS as [TraitIdType, ...TraitIdType[]]);

/**
 * Appendix I's `Cite`: "F12" | "S03" | "L041" | "K17" | "C2" | "P3". Kept permissive (any code
 * shape) rather than an enum, because what a given field may cite differs per agent and the
 * strict check belongs where the citation is resolved against real rows.
 */
export const Cite = z.string().refine((value) => isCode(value), {
  message: "Not a provenance code (F##, S##, L###, P#, C#, K##)",
});
