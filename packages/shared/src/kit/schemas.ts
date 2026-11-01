// Zod validators for Appendix I and the Phase 3 reads. Server-only: reached through
// `@admitstory/shared/schemas`, never from a client component (see ../schemas.ts for why).
//
// Numeric and length bounds below are enforced by Zod after parsing. The AI layer turns these
// schemas into the structured-output JSON Schema with the SDK's transform, which moves every
// bound it cannot send (min/max, lengths, most minItems) into the field description, so the
// request schema carries no constraints the API would reject (Appendix I note).

import { z } from "zod";
import { isCode } from "../codes";
import { LENS_IDS } from "../lenses";
import { TRAIT_IDS, type TraitId as TraitIdType } from "../traits";
import { RED_FLAG_IDS } from "./strategy";
import type * as Plain from "./strategy";
import {
  ADDRESS_IN,
  ANGLE_LABELS,
  FINDING_SEVERITIES,
  LEAD_TRAITS_MAX,
  LIST_TONES,
  LEAD_TRAITS_MIN,
  PATCH_OPS,
  SCORE_MAX,
  SCORE_MIN,
  SENTENCE_KINDS,
  SHORTFORM_FORMATS,
} from "./types";
import type * as Kit from "./types";

// Local copies of the shared enums so this module does not import ../schemas (which re-exports it).
const TraitId = z.enum(TRAIT_IDS as [TraitIdType, ...TraitIdType[]]);
const LensId = z.enum(LENS_IDS);
const Cite = z.string().refine((value) => isCode(value), {
  message: "Not a provenance code (F##, S##, L###, P#, C#, K##)",
});
const StoryCode = z.string().refine((value) => isCode(value, "story"), {
  message: "Not a story code (S##)",
});
const PackCode = z.string().refine((value) => isCode(value, "pack"), {
  message: "Not a school pack code (K##)",
});

const text = (max: number) => z.string().trim().min(1).max(max);
const score = z
  .number()
  .int()
  .min(SCORE_MIN)
  .max(SCORE_MAX)
  .describe(`Whole number from ${SCORE_MIN} to ${SCORE_MAX}`);
const wordCount = z.number().int().min(1).max(2_000);

/* Positioning and file map -------------------------------------------------------------------- */

export const CitedText = z.object({ text: text(600), cites: z.array(Cite).max(12) });

export const Positioning = z.object({
  must_see: z.array(z.object({ text: text(600), cites: z.array(Cite).min(1).max(12) })).max(8),
  lead_traits: z
    .array(z.object({ trait: TraitId, why: text(600), cites: z.array(Cite).min(1).max(12) }))
    .min(LEAD_TRAITS_MIN)
    .max(LEAD_TRAITS_MAX)
    .describe(`${LEAD_TRAITS_MIN} or ${LEAD_TRAITS_MAX} traits`),
  red_flags: z
    .array(z.object({ flag: text(300), address_in: z.enum(ADDRESS_IN), how: text(600) }))
    .max(12),
  career_lane_check: z.object({
    short_term: text(400),
    realism: text(800),
    plan_b: text(400),
    risks: z.array(text(400)).max(8),
    cites: z.array(Cite).max(12),
  }),
  reapplicant_angle: text(800).nullable(),
});

export const FileMapItem = z.object({
  deliverable_key: text(80),
  primary_story: StoryCode.nullable().describe('"S03", or null when no story should lead'),
  primary_reason_if_none: text(400).nullable(),
  supporting: z.array(StoryCode).max(6),
  traits_shown: z.array(TraitId).max(6),
  lenses: z.array(LensId).max(4),
  why: text(400),
});

export const FileMap = z.object({
  items: z.array(FileMapItem).max(40),
  recommender_plan: z
    .array(
      z.object({
        recommender_id: text(40),
        strengths: z.array(TraitId).max(6),
        stories: z.array(StoryCode).max(6),
        facets: z.array(text(300)).max(8),
      }),
    )
    .max(4),
  coverage_gaps: z.array(text(400)).max(12),
  warnings: z.array(text(400)).max(12),
});

/* Angles, drafts, coaching -------------------------------------------------------------------- */

export const Angle = z.object({
  deliverable_key: text(80),
  label: z.enum(ANGLE_LABELS),
  pitch: text(600),
  opening_line: text(400),
  stories: z.array(StoryCode).max(4),
  beats: z
    .array(z.object({ beat: text(300), words: wordCount, sources: z.array(Cite).max(8) }))
    .max(10),
  proves: z.array(TraitId).max(5),
  risks: z.array(text(300)).max(6),
  recommended: z.boolean(),
  reason: text(600),
});

export const Sentence = z.object({
  text: text(1_200),
  kind: z.enum(SENTENCE_KINDS),
  sources: z.array(Cite).max(8),
});

export const Paragraph = z.object({ id: text(20), sentences: z.array(Sentence).min(1).max(40) });

export const Draft = z.object({
  paragraphs: z.array(Paragraph).min(1).max(30),
  needs: z
    .array(
      z.object({
        paragraph_id: text(20),
        after_sentence: z.number().int().min(0).max(200),
        question: text(400),
        approx_words: wordCount,
      }),
    )
    .max(12),
  prompt_parts_answered: z
    .array(z.object({ part: text(400), paragraph_ids: z.array(text(20)).max(30) }))
    .max(10),
  notes: z.object({
    why_this_story: text(800),
    what_it_proves: text(800),
    school_fit_points: z
      .array(z.object({ text: text(400), k_ids: z.array(PackCode).min(1).max(6) }))
      .max(8),
  }),
  verify: z.array(z.object({ text: text(400), reason: text(400) })).max(20),
});

export const CoachBeats = z.object({
  beats: z
    .array(
      z.object({
        beat: text(300),
        words: wordCount,
        your_lines: z.array(z.object({ text: text(1_000), source: Cite })).max(6),
        questions: z.array(text(400)).max(6),
      }),
    )
    .min(1)
    .max(10),
});

/* Gaps and short-form ------------------------------------------------------------------------ */

export const Gap = z.object({
  question: text(400),
  blocking: z.boolean(),
  deliverable_key: text(80),
  story: StoryCode.nullable(),
  approx_words: wordCount,
  why: text(400),
});

const DraftNeed = z.object({
  paragraph_id: text(20),
  after_sentence: z.number().int().min(0).max(200),
  question: text(400),
  approx_words: wordCount,
});

const seconds = z.number().int().min(1).max(600);

export const VideoPlan = z.object({
  questions: z
    .array(
      z.object({
        question: text(400),
        points: z.array(z.object({ text: text(300), sources: z.array(Cite).max(6) })).max(5),
      }),
    )
    .min(1)
    .max(8),
  structure: z.object({
    seconds,
    segments: z
      .array(z.object({ label: text(120), seconds }))
      .min(1)
      .max(8),
  }),
});

export const ShortformItem = z.object({
  deliverable_key: text(80),
  format: z.enum(SHORTFORM_FORMATS),
  paragraphs: z.array(Paragraph).max(15),
  list_tones: z.array(z.object({ paragraph_id: text(20), tone: z.enum(LIST_TONES) })).max(15),
  video: VideoPlan.nullable(),
  needs: z.array(DraftNeed).max(8),
  why: text(600),
});

export const Shortform = z.object({
  goals_statement: z.array(Sentence).min(1).max(20).nullable(),
  items: z.array(ShortformItem).min(1).max(20),
  verify: z.array(z.object({ text: text(400), reason: text(400) })).max(20),
});

/* Critique and revision ----------------------------------------------------------------------- */

export const Finding = z.object({
  rule_id: text(40),
  severity: z.enum(FINDING_SEVERITIES),
  location: z.object({
    paragraph_id: text(20).nullable(),
    sentence: z.number().int().min(0).max(200).nullable(),
  }),
  explanation: text(800),
  fix_hint: text(600).nullable(),
});

export const CriticReport = z.object({
  findings: z.array(Finding).max(40),
  scores: z.object({ answers_prompt: score, story_quality: score, voice_fidelity: score }),
});

export const Patch = z
  .object({
    op: z.enum(PATCH_OPS),
    paragraph_id: text(20),
    sentences: z.array(Sentence).min(1).max(40).nullable(),
  })
  .refine((patch) => (patch.op === "delete") === (patch.sentences === null), {
    message: "sentences is null for delete and required for replace and insert_after",
    path: ["sentences"],
  });

export const RevisionResult = z.object({ patches: z.array(Patch).max(20), summary: text(600) });

/* Interview and recommenders ------------------------------------------------------------------ */

export const DrillFeedback = z.object({
  scores: z.array(z.object({ criterion: text(80), score, quote: z.string().max(1_000) })).max(10),
  fixes: z.array(text(400)).max(6),
  stronger_version: text(3_000),
  consistency_flags: z.array(z.object({ text: text(400), conflicts_with: Cite })).max(8),
});

export const LorBrief = z.object({
  cover_note: text(2_000),
  schools: z
    .array(
      z.object({
        school_cycle_id: text(80),
        questions: z
          .array(
            z.object({
              question_verbatim: text(2_000),
              talking_points: z
                .array(
                  z.object({
                    point: text(400),
                    evidence: text(800),
                    trait: TraitId,
                    cites: z.array(Cite).min(1).max(8),
                  }),
                )
                .max(8),
            }),
          )
          .max(12),
      }),
    )
    .max(12),
  other_recommender_covers: z.array(text(400)).max(8),
  development_arc: z
    .object({
      feedback: text(800),
      response: text(800),
      steps: z.array(text(400)).max(6),
      evidence: text(800),
    })
    .nullable(),
  key_facts: z.array(text(300)).max(20),
});

/* Profile Read and School Fit ----------------------------------------------------------------- */

const ProfileAction = z.object({
  action: text(400),
  time_estimate: text(80).describe(
    'How long it takes, e.g. "2 hours" or "an evening a week for a month"',
  ),
  cites: z.array(Cite).max(8),
});

const LensRead = z.object({
  helps: z.array(z.object({ text: text(500), cites: z.array(Cite).min(1).max(8) })).max(6),
  doubts: z
    .array(
      z.object({
        flag_id: z.enum(RED_FLAG_IDS),
        text: text(500),
        cites: z.array(Cite).min(1).max(8),
      }),
    )
    .max(6),
  do: z.array(ProfileAction).max(5),
});

export const ProfileRead = z.object({
  lenses: z.object({
    academics: LensRead,
    self_awareness: LensRead,
    employability: LensRead,
    leadership: LensRead,
  }),
  strengthening_plan: z
    .array(ProfileAction.extend({ why: text(500) }))
    .min(1)
    .max(8),
  brand_preview: z
    .array(z.object({ trait: TraitId, why: text(400), cites: z.array(StoryCode).min(1).max(6) }))
    .max(4),
});

export const SchoolFit = z.object({
  honest_flags: z
    .array(z.object({ text: text(500), cites: z.array(PackCode).min(1).max(6) }))
    .max(6),
  looks_for: z
    .array(
      z.object({
        school_value: text(200),
        your_traits: z.array(TraitId).max(4),
        note: text(400),
        cites: z.array(PackCode).min(1).max(6),
      }),
    )
    .max(8),
  outcome_in_target_function: z
    .object({ text: text(600), cites: z.array(PackCode).min(1).max(6) })
    .nullable(),
});

/* The validators and the plain types must describe the same values. ---------------------------- */

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Parity<A extends z.ZodType, B> = Same<z.output<A>, B>;
// Fails to compile when a validator drifts from its plain type. Type-only: nothing ships.
export type KitSchemaParity = [
  Parity<typeof Positioning, Kit.Positioning>,
  Parity<typeof FileMapItem, Kit.FileMapItem>,
  Parity<typeof FileMap, Kit.FileMap>,
  Parity<typeof Angle, Kit.Angle>,
  Parity<typeof Sentence, Kit.Sentence>,
  Parity<typeof Paragraph, Kit.Paragraph>,
  Parity<typeof Draft, Kit.Draft>,
  Parity<typeof CoachBeats, Kit.CoachBeats>,
  Parity<typeof Gap, Kit.Gap>,
  Parity<typeof VideoPlan, Kit.VideoPlan>,
  Parity<typeof ShortformItem, Kit.ShortformItem>,
  Parity<typeof Shortform, Kit.Shortform>,
  Parity<typeof Finding, Kit.Finding>,
  Parity<typeof CriticReport, Kit.CriticReport>,
  Parity<typeof Patch, Kit.Patch>,
  Parity<typeof RevisionResult, Kit.RevisionResult>,
  Parity<typeof DrillFeedback, Kit.DrillFeedback>,
  Parity<typeof LorBrief, Kit.LorBrief>,
  Parity<typeof ProfileRead, Plain.ProfileRead>,
  Parity<typeof SchoolFit, Plain.SchoolFit>,
] extends true[]
  ? true
  : never;
const _parity: KitSchemaParity = true;
