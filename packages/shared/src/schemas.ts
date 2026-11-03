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
import { DELETE_CONFIRM_PHRASE, FEEDBACK_REASONS, FEEDBACK_TARGETS } from "./ops";
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
  message: "Not a provenance code (F##, S##, L###, P#, C#, K##, R##)",
});

// Appendix I and the Phase 3 reads (Profile Read, School Fit). Plain types: `@admitstory/shared/kit`.
export {
  Angle,
  CitedText,
  CoachBeats,
  CriticReport,
  Draft,
  DrillFeedback,
  FileMap,
  FileMapItem,
  Finding,
  Gap,
  LorBrief,
  Paragraph,
  Patch,
  Positioning,
  ProfileRead,
  RevisionResult,
  SchoolFit,
  Sentence,
  Shortform,
  ShortformItem,
  VideoPlan,
} from "./kit/schemas";

/* Phase 9b: operations, privacy and feedback request bodies ----------------------------------- */

const reasonText = z.string().trim().min(3, "Say why, in a few words").max(300);

export const AdminReason = z.strictObject({ reason: reasonText });

export const FeatureSwitchPatch = z.strictObject({
  enabled: z.boolean(),
  reason: reasonText,
  message: z.string().trim().max(200).nullable().optional(),
});

export const BreakGlassOpen = z.strictObject({
  reason: z.string().trim().min(20, "Give a reason of at least 20 characters").max(500),
});

export const EntitlementAdjust = z.strictObject({
  op: z.enum(["set_limit", "extend", "revoke", "restore"]),
  limit: z
    .strictObject({ key: z.string().trim().min(1).max(40), value: z.int().min(0).max(1000) })
    .optional(),
  expiresAt: z.iso.datetime().optional(),
  reason: reasonText,
});

export const CompKit = z.strictObject({ userSchoolId: z.guid(), reason: reasonText });

export const RoleChange = z.strictObject({
  role: z.enum(["admin", "expert"]),
  on: z.boolean(),
  reason: reasonText,
});

export const FeedbackInput = z.strictObject({
  targetType: z.enum(FEEDBACK_TARGETS),
  targetId: z.guid(),
  rating: z.union([z.literal(1), z.literal(-1)]),
  reason: z.enum(FEEDBACK_REASONS).optional(),
  text: z.string().trim().max(500).optional(),
});

export const FeedbackStatusPatch = z.strictObject({
  status: z.enum(["new", "read", "done"]),
  adminNote: z.string().trim().max(1000).nullable().optional(),
});

export const AccountDeleteInput = z.strictObject({
  confirm: z
    .string()
    .trim()
    .transform((value) => value.toLowerCase())
    .pipe(z.literal(DELETE_CONFIRM_PHRASE)),
  reason: z.string().trim().max(500).optional(),
});

export const PrivacyPrefsPatch = z.strictObject({ improveOptIn: z.boolean() });

export const RatingInput = z.strictObject({
  kind: z.enum(["eval_sample", "draft"]),
  id: z.guid(),
  score: z.int().min(1).max(5),
  tags: z.array(z.string().trim().min(1).max(40)).max(6).optional(),
  note: z.string().trim().max(1000).optional(),
});

export const EvalApprove = AdminReason;
export const EvalRunRequest = z.strictObject({ reason: z.literal("manual") });
