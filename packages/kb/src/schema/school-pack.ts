// The School Pack schema (spec §9.2), in Zod. Server-only: client code imports the plain types from
// `@admitstory/kb/types` instead (see the header there for what this adds to §9.2 and why).
//
// Beyond field shapes, `SchoolPack` checks the pack's integrity, because the compiler, the
// proposals model and every K citation downstream rely on it:
//   - every K id is canonical (`K07`), unique across the pack, and below RETRIEVAL_CODE_BASE;
//   - every `source_ids` entry names a source in `sources`;
//   - `k_high_water`, when present, is at least the highest K id in use;
//   - a `complete` pack has no `_todo` left and no prompt without its verbatim wording.
// Unverified items (`verified_at: null`) are allowed in any pack, so drafts validate; the compiler
// is what keeps them out of anything a user sees.

import { ArchetypeId, TraitId } from "@admitstory/shared/schemas";
import { z } from "zod";
import * as T from "../types";
import { citedNodes, packIdNumber } from "../walk";

const IsoDate = z.iso.date();
const NonEmpty = z.string().trim().min(1);
const PackId = z.string().refine((id) => packIdNumber(id) !== undefined, {
  message: "Not a pack K id (K01, K02…)",
});

export const KbSourceType = z.enum(T.KB_SOURCE_TYPES);
export const LimitKind = z.enum(T.LIMIT_KINDS);
export const AiStance = z.enum(T.AI_STANCES);

export const PackSource = z.object({
  id: NonEmpty,
  type: KbSourceType,
  title: NonEmpty,
  url: z.url().nullable(),
  trust: z.number().int().min(1).max(5),
  retrieved_at: IsoDate.nullable(),
  rights_note: z.string().nullable(),
});

export const PackItem = z.object({
  id: PackId,
  text: NonEmpty,
  source_ids: z.array(NonEmpty),
  verified_at: IsoDate.nullable(),
  confidence: z.number().min(0).max(1),
  approved_rewrite: z.boolean().optional(),
});

const cited = {
  id: PackId,
  source_ids: z.array(NonEmpty),
  verified_at: IsoDate.nullable(),
};

export const CitedThing = z.object({
  ...cited,
  name: NonEmpty,
  what_it_is: NonEmpty,
  why_it_matters_for: z.array(z.string()),
  url: z.url().nullable(),
});

export const PromptLimit = z.object({
  kind: LimitKind,
  value: z.number().int().positive(),
});

export const EssayPrompt = z.object({
  ...cited,
  key: NonEmpty,
  prompt_verbatim: NonEmpty.nullable(),
  limit: PromptLimit,
  required: z.boolean(),
  archetypes: z.array(ArchetypeId),
  parts: z.array(z.string()),
  list_count: z.number().int().positive().optional(),
  notes: z.array(PackItem),
});

export const Round = z.object({
  ...cited,
  name: NonEmpty,
  deadline: IsoDate,
  decision_date: IsoDate.optional(),
  interview_invites_window: z.string().optional(),
  notes: z.array(PackItem),
});

export const VideoComponent = z.object({
  ...cited,
  format: z.enum(T.VIDEO_FORMATS),
  think_time_s: z.number().int().nonnegative().nullable(),
  answer_time_s: z.number().int().positive().nullable(),
  attempts: z.number().int().positive().nullable(),
  question_types: z.array(PackItem),
  scripting_allowed: z.boolean(),
});

export const FormSection = z.object({
  ...cited,
  key: NonEmpty,
  label: NonEmpty,
  item_count_max: z.number().int().positive().optional(),
  char_limit: z.number().int().positive().optional(),
  /**
   * How the portal counts `char_limit` (Phase 5 addition: §9.2 gives forms a character limit but no
   * counting rule). Absent means characters including spaces, how most portals count a field.
   */
  limit_kind: LimitKind.optional(),
  guidance: z.array(PackItem),
});

export const Recommendations = z.object({
  ...cited,
  count: z.number().int().nonnegative(),
  format: z.enum(T.RECOMMENDATION_FORMATS),
  questions: z.array(z.object({ text_verbatim: NonEmpty, limit: PromptLimit.optional() })),
  notes: z.array(PackItem),
});

export const ResumeRules = z.object({
  ...cited,
  page_limit: z.number().int().positive(),
  notes: z.array(PackItem),
});

export const Application = z.object({
  essays: z.array(EssayPrompt),
  short_answers: z.array(EssayPrompt),
  goal_fields: z.array(EssayPrompt),
  video: z.array(VideoComponent),
  reapplicant: z.object({ essay: EssayPrompt.nullable(), policy: z.array(PackItem) }).nullable(),
  optional_essay: EssayPrompt.nullable(),
  form_sections: z.array(FormSection),
  recommendations: Recommendations.nullable(),
  resume: ResumeRules.nullable(),
  test_policy: z.array(PackItem),
  fees_waivers: z.array(PackItem),
});

export const EmploymentReport = z.object({
  ...cited,
  class_year: z.number().int().min(2000).max(2100),
  currency: z.string().regex(/^[A-Z]{3}$/),
  by_function: z.array(
    z.object({
      function: NonEmpty,
      share: z.number().min(0).max(1),
      median_base: z.number().nonnegative().nullable(),
    }),
  ),
  top_employers: z.array(NonEmpty),
  intl_offer_rates: PackItem.optional(),
});

export const ClassProfile = z.object({
  ...cited,
  class_year: z.number().int().min(2000).max(2100),
  class_size: z.number().int().positive().nullable(),
  gmat_focus_median: z.number().min(205).max(805).nullable(),
  gmat_classic_median: z.number().min(200).max(800).nullable(),
  gre_median: z
    .object({ verbal: z.number().min(130).max(170), quant: z.number().min(130).max(170) })
    .nullable(),
  gpa_median: z.number().positive().nullable(),
  gpa_scale: z.number().positive().nullable(),
  work_experience_years_median: z.number().nonnegative().nullable(),
  international_share: z.number().min(0).max(1).nullable(),
});

export const Interview = z.object({
  ...cited,
  invitation: z.enum(T.INTERVIEW_INVITATIONS),
  who: z.array(z.enum(T.INTERVIEWERS)),
  blind: z.boolean().nullable(),
  length_min: z.number().int().positive(),
  location: z.array(z.enum(T.INTERVIEW_LOCATIONS)),
  common_questions: z.array(
    z.object({ ...cited, text: NonEmpty, frequency_weight: z.number().int().min(1).max(5) }),
  ),
  format_notes: z.array(PackItem),
});

export const AiPolicy = z.object({
  ...cited,
  stance: AiStance,
  applies_to: z.array(z.enum(T.AI_POLICY_SCOPES)),
  disclosure_text: z.string().nullable(),
  notes: z.array(PackItem),
});

const SchoolPackShape = z.object({
  school: z.object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
    name: NonEmpty,
    short_name: NonEmpty,
    country: z.string().regex(/^[A-Z]{2}$/),
    city: NonEmpty,
    website: z.url(),
    program: z.enum(T.PROGRAMS),
  }),
  cycle: z.string().regex(/^\d{4}-\d{2}$/),
  version: z.number().int().positive(),
  status: z.enum(T.PACK_STATUSES),
  synthetic: z.boolean().optional(),
  _todo: z.array(NonEmpty).optional(),
  k_high_water: z.number().int().nonnegative().optional(),
  sources: z.array(PackSource),
  official_urls: z.array(z.object({ kind: z.enum(T.OFFICIAL_URL_KINDS), url: z.url() })),
  rounds: z.array(Round),
  application: Application,
  values: z.object({
    stated: z.array(PackItem),
    trait_map: z.array(
      z.object({
        school_value: NonEmpty,
        admitstory_traits: z.array(TraitId),
        note: PackItem.optional(),
      }),
    ),
  }),
  culture_and_location: z.array(PackItem),
  academics: z.object({
    courses: z.array(CitedThing),
    centers: z.array(CitedThing),
    experiential: z.array(CitedThing),
    structure: z.array(PackItem),
  }),
  community: z.object({
    clubs: z.array(CitedThing),
    traditions: z.array(PackItem),
    treks_events: z.array(CitedThing),
  }),
  careers: z.object({
    employment_report: EmploymentReport.nullable(),
    recruiting_notes: z.array(PackItem),
  }),
  class_profile: ClassProfile.nullable(),
  interview: Interview.nullable(),
  ai_policy: AiPolicy,
  scholarships: z.array(PackItem),
  insider_notes: z.array(PackItem),
  avoid: z.array(PackItem),
  angles_that_work: z.array(PackItem),
  glossary: z.array(z.object({ ...cited, term: NonEmpty, plain_definition: NonEmpty })),
});

/** The integrity rules in the header, as messages with paths. Empty when the pack is sound. */
export function packIntegrityIssues(pack: T.SchoolPack): { path: string; message: string }[] {
  const issues: { path: string; message: string }[] = [];
  const sourceIds = new Set<string>();
  pack.sources.forEach((source, index) => {
    if (sourceIds.has(source.id))
      issues.push({ path: `sources[${index}].id`, message: `Duplicate source id ${source.id}` });
    sourceIds.add(source.id);
  });
  const seen = new Map<string, string>();
  let highest = 0;
  for (const node of citedNodes(pack)) {
    const n = packIdNumber(node.id) ?? 0;
    highest = Math.max(highest, n);
    if (n >= T.RETRIEVAL_CODE_BASE)
      issues.push({ path: `${node.path}.id`, message: `${node.id} is in the retrieval range` });
    const first = seen.get(node.id);
    if (first !== undefined)
      issues.push({ path: `${node.path}.id`, message: `${node.id} is already used at ${first}` });
    else seen.set(node.id, node.path);
    for (const sourceId of node.sourceIds)
      if (!sourceIds.has(sourceId))
        issues.push({ path: `${node.path}.source_ids`, message: `Unknown source ${sourceId}` });
  }
  if (pack.k_high_water !== undefined && pack.k_high_water < highest)
    issues.push({
      path: "k_high_water",
      message: `k_high_water ${pack.k_high_water} is below the highest id in use (${highest})`,
    });
  if (pack.status === "complete") {
    if ((pack._todo ?? []).length > 0)
      issues.push({ path: "_todo", message: "A complete pack has nothing left to fill" });
    const prompts = [
      ...pack.application.essays,
      ...pack.application.short_answers,
      ...pack.application.goal_fields,
      ...(pack.application.optional_essay ? [pack.application.optional_essay] : []),
      ...(pack.application.reapplicant?.essay ? [pack.application.reapplicant.essay] : []),
    ];
    for (const prompt of prompts)
      if (prompt.prompt_verbatim === null)
        issues.push({ path: prompt.key, message: `Prompt ${prompt.key} has no verbatim wording` });
  }
  return issues;
}

export const SchoolPack = SchoolPackShape.superRefine((pack, ctx) => {
  for (const issue of packIntegrityIssues(pack))
    ctx.addIssue({ code: "custom", message: `${issue.path}: ${issue.message}` });
});

export type SchoolPack = z.infer<typeof SchoolPack>;
export type PackItem = z.infer<typeof PackItem>;
export type PackSource = z.infer<typeof PackSource>;
export type CitedThing = z.infer<typeof CitedThing>;
export type EssayPrompt = z.infer<typeof EssayPrompt>;
export type KbSourceType = z.infer<typeof KbSourceType>;

/* The plain types in ../types.ts must be exactly these shapes. ------------------------------------ */

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
function assertSame<_ extends true>(): void {}
assertSame<Same<z.infer<typeof SchoolPack>, T.SchoolPack>>();
assertSame<Same<z.infer<typeof PackItem>, T.PackItem>>();
assertSame<Same<z.infer<typeof EssayPrompt>, T.EssayPrompt>>();
assertSame<Same<z.infer<typeof CitedThing>, T.CitedThing>>();
assertSame<Same<z.infer<typeof PackSource>, T.PackSource>>();

/** Parse a pack, with the integrity checks. Throws a ZodError listing every problem. */
export function parseSchoolPack(value: unknown): T.SchoolPack {
  return SchoolPack.parse(value);
}
