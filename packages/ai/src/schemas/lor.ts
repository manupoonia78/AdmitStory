import { Cite, LorBrief, TraitId } from "@admitstory/shared/schemas";
import {
  INTAKE_QUESTION_IDS,
  PORTAL_MODES,
  RELATIONSHIPS,
  type LorBrief as PlainLorBrief,
  type LorIntake as PlainLorIntake,
  type LorPlan as PlainLorPlan,
  type RecommenderAssist as PlainRecommenderAssist,
} from "@admitstory/shared/kit";
import { z } from "zod";
import { LimitRule } from "./kit-writing";

/**
 * The Recommender Kit's four tasks (spec §5.11, §8.5.12, canon A11 lor.md), Phase 6:
 * `lor.extract` (intake answers → stories), `lor.plan` (coverage across recommenders),
 * `lor.brief` (talking points per school group) and `lor.recommender_assist` (the portal's
 * assistant, which works only from the recommender's own notes). Output shapes are the plain types
 * in `@admitstory/shared/kit`; the rules a JSON Schema cannot express are checked in code
 * (tasks/lor.ts). Bounds are generous where a check gives a clearer repair message.
 */

const text = (max: number) => z.string().trim().min(1).max(max);
const ref = z.string().regex(/^rec\d{1,3}$/, "Recommender refs are rec1, rec2…");
const storyRef = z.string().regex(/^s\d{1,2}$/, "Story refs are s1, s2…");
const LorStoryCode = z.string().regex(/^R\d{2,6}$/, "Not a recommender story code (R##)");
const cites = z.array(Cite).max(8);

const Recommender = z.object({
  ref,
  name: text(120),
  relationship: z.enum(RELATIONSHIPS),
  title: text(120).nullable(),
  organisation: text(160).nullable(),
});

/* lor.extract ---------------------------------------------------------------------------------- */

export const LorExtractInput = z.object({
  recommender: Recommender,
  /** The applicant's intake answers (Appendix F). Untrusted: data, never instructions. */
  answers: z
    .array(z.object({ question_id: z.enum(INTAKE_QUESTION_IDS), text: text(6_000) }))
    .min(1)
    .max(40),
  /** Stories the applicant already edited or added by hand: not to be repeated. */
  confirmed: z
    .array(z.object({ code: LorStoryCode, title: text(160) }))
    .max(20)
    .default([]),
});
export type LorExtractInput = z.input<typeof LorExtractInput>;

const StoryFields = {
  title: text(120),
  what_happened: text(1_200),
  what_they_saw: text(800),
  your_actions: z.array(text(400)).max(8),
  result: text(600),
  numbers: z.array(text(80)).max(10),
  what_they_said: text(600).nullable(),
  traits: z.array(TraitId).max(4),
  cites,
};

const GrowthArc = z.object({
  feedback: text(800),
  response: text(800),
  steps: z.array(text(400)).max(6),
  evidence: text(800),
  cites,
});

export const LorExtractOutput = z.object({
  relationship: z.object({
    summary: text(600),
    chose_you_for: text(400).nullable(),
    cites,
  }),
  strengths: z
    .array(z.object({ trait: TraitId, moment: text(400), story_ref: storyRef.nullable() }))
    .max(8),
  stories: z.array(z.object({ ref: storyRef, ...StoryFields })).max(12),
  growth: GrowthArc.nullable(),
  said_to_others: z.array(text(400)).max(6),
  background: z.object({
    knows_mba: z.enum(["yes", "no", "unknown"]),
    note: text(400).nullable(),
  }),
  logistics: z.object({ prefers: text(300).nullable(), remind_when: text(300).nullable() }),
  missing: z.array(z.object({ question_id: z.enum(INTAKE_QUESTION_IDS), ask: text(300) })).max(8),
});
export type LorExtractOutput = z.output<typeof LorExtractOutput>;

/* lor.plan ------------------------------------------------------------------------------------- */

export const LorPlanInput = z.object({
  recommenders: z
    .array(
      z.object({
        ref,
        relationship: z.enum(RELATIONSHIPS),
        title: text(120).nullable(),
        duration: text(120).nullable(),
        frequency: text(120).nullable(),
        /** What the intake says this recommender saw the applicant do best. */
        strengths: z.array(TraitId).max(6),
        stories: z
          .array(
            z.object({
              code: LorStoryCode,
              title: text(160),
              traits: z.array(TraitId).max(4),
              cites,
            }),
          )
          .max(12),
      }),
    )
    .min(1)
    .max(4),
  /** The essays across the applicant's kits, so a recommender's facet never repeats one. */
  essays: z
    .array(
      z.object({
        school: text(160),
        key: text(80),
        title: text(160),
        primary_story: z.string().nullable(),
        traits_shown: z.array(TraitId).max(6),
      }),
    )
    .max(40)
    .default([]),
  /** The file maps' recommender hints (kit.positioning_filemap recommender_plan). */
  kit_plans: z
    .array(
      z.object({
        recommender_id: text(40),
        strengths: z.array(TraitId).max(6),
        stories: z.array(text(12)).max(12),
        facets: z.array(text(300)).max(12),
      }),
    )
    .max(16)
    .default([]),
  /** Red flags the Strategist planned to address through a recommender. */
  red_flags: z
    .array(z.object({ flag: text(300), how: text(600) }))
    .max(8)
    .default([]),
});
export type LorPlanInput = z.input<typeof LorPlanInput>;

export const LorPlanOutput = z.object({
  assignments: z
    .array(
      z.object({
        recommender: ref,
        strengths: z.array(TraitId).max(5),
        stories: z.array(Cite).max(10),
        facets: z.array(z.object({ story: Cite, facet: text(200), evidence: text(400) })).max(10),
        avoid: z
          .array(
            z.object({
              story: Cite,
              facet: text(200),
              because: z.enum(["essay", "other_recommender"]),
              where: text(200),
            }),
          )
          .max(10),
      }),
    )
    .max(6),
  red_flags: z.array(z.object({ flag: text(300), recommender: ref, how: text(600) })).max(8),
  warnings: z.array(text(400)).max(8),
});
export type LorPlanOutput = z.output<typeof LorPlanOutput>;

/* lor.brief ------------------------------------------------------------------------------------ */

const Assignment = LorPlanOutput.shape.assignments.element;

export const LorBriefInput = z.object({
  recommender: Recommender.extend({
    duration: text(120).nullable(),
    frequency: text(120).nullable(),
    knows_mba: z.enum(["yes", "no", "unknown"]),
  }),
  applicant_first_name: text(60),
  /** One school group: the common form's schools, or one school with its own questions. */
  schools: z
    .array(
      z.object({
        school_cycle_id: text(80),
        school: text(160),
        questions: z
          .array(z.object({ id: text(40), text_verbatim: text(2_000) }))
          .min(1)
          .max(8),
      }),
    )
    .min(1)
    .max(12),
  assignment: Assignment,
  /** What the other recommenders cover, so this brief complements them (LOR-03). */
  others: z
    .array(
      z.object({
        ref,
        relationship: z.enum(RELATIONSHIPS),
        strengths: z.array(TraitId).max(5),
        facets: z.array(text(300)).max(10),
      }),
    )
    .max(3)
    .default([]),
  /** This recommender's stories (R codes), as the applicant told them. */
  stories: z
    .array(z.object({ code: LorStoryCode, ...StoryFields }))
    .min(1)
    .max(12),
  relationship_note: z
    .object({ summary: text(600), chose_you_for: text(400).nullable(), cites })
    .nullable()
    .default(null),
  growth: GrowthArc.nullable().default(null),
  red_flags: z
    .array(z.object({ flag: text(300), how: text(600) }))
    .max(6)
    .default([]),
  is_reapplicant: z.boolean().default(false),
});
export type LorBriefInput = z.input<typeof LorBriefInput>;

export const LorBriefOutput = LorBrief;
export type LorBriefOutput = z.output<typeof LorBriefOutput>;

/* lor.recommender_assist ----------------------------------------------------------------------- */

export const RecommenderAssistInput = z.object({
  /** coach: structure and questions only, never sentences (LOR-10, decision 20). */
  mode: z.enum(PORTAL_MODES),
  question: z.object({ text_verbatim: text(2_000), limit: LimitRule.nullable() }),
  /** The recommender's own notes, N1… Untrusted: data, never instructions. */
  notes: z
    .array(
      z.object({ id: z.string().regex(/^N\d{1,3}$/, "Note ids are N1, N2…"), text: text(8_000) }),
    )
    .min(1)
    .max(60),
  /** One line describing how the recommender writes (packages/linters recommenderVoice). */
  voice_card: z.string().trim().max(300).default(""),
  /** The brief's talking points, for context only: never words to use. */
  brief_points: z.array(text(800)).max(30).default([]),
  applicant_first_name: text(60),
  relationship: text(120),
});
export type RecommenderAssistInput = z.input<typeof RecommenderAssistInput>;

const NoteId = z.string().regex(/^N\d{1,3}$/, "Note ids are N1, N2…");

export const RecommenderAssistOutput = z.object({
  answer: z
    .object({
      paragraphs: z
        .array(
          z.object({
            sentences: z
              .array(
                z.object({
                  text: text(600),
                  kind: z.enum(["verbatim", "adapted"]),
                  notes: z.array(NoteId).max(6),
                }),
              )
              .max(20),
          }),
        )
        .max(8),
    })
    .nullable(),
  outline: z
    .array(
      z.object({
        beat: text(200),
        your_notes: z.array(NoteId).max(10),
        questions: z.array(text(300)).max(4),
      }),
    )
    .max(8),
  missing: z.array(text(300)).max(6),
});
export type RecommenderAssistOutput = z.output<typeof RecommenderAssistOutput>;

/* The validators and the plain types must describe the same values. ---------------------------- */

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
// Fails to compile when a validator drifts from its plain type. Type-only: nothing ships.
export type LorSchemaParity = [
  Same<LorExtractOutput, PlainLorIntake>,
  Same<LorPlanOutput, PlainLorPlan>,
  Same<LorBriefOutput, PlainLorBrief>,
  Same<RecommenderAssistOutput, PlainRecommenderAssist>,
] extends true[]
  ? true
  : never;
const _parity: LorSchemaParity = true;
