// The School Pack (spec §9.2) and the retrieval contract (§8.9) as plain TypeScript: types and
// plain arrays only, no Zod. Client components import from `@admitstory/kb/types`; the validators
// live in `./schema/school-pack.ts`, which is server-only because a top-level `z.enum()` can't be
// tree-shaken and Zod would cost ~31 KB of a 160 KB route budget (§6.11).
//
// `schema/school-pack.ts` asserts at compile time that its inferred types and these are the same
// shape, so the two cannot drift.
//
// What this adds to §9.2, and why:
//   - `sources`: the pack's own source registry. Every `source_ids` entry points here, so the
//     compiler can tell an `official` item from a `third_party_reference` one (§9.6) and the UI can
//     show where a fact came from without another query.
//   - Every structured record a user sees (a round, a prompt, a video format, an employment report,
//     an interview question…) carries a K id, `source_ids` and `verified_at`, like an Item does.
//     §0 requires every school fact shown to a user to carry a source and a verified date, and the
//     Phase 3 AC requires it of every displayed number; §9.2 gives those only to leaf Items.
//   - `class_profile` and `official_urls` (agreed with Manu, 2026-10-31).
//   - `status`, `_todo`, `synthetic` and `k_high_water`: draft packs (Appendix G) can hold
//     unverified items (`verified_at: null`), fixtures say they are invented, and K ids are never
//     reused after a deletion.

import type { ArchetypeId, TraitId } from "@admitstory/shared";

/* Enumerations --------------------------------------------------------------------------------- */

export const KB_SOURCE_TYPES = [
  "official",
  "adcom",
  "insider",
  "interview_reports",
  "coach_notes",
  "third_party_reference",
  "press",
] as const;

export type KbSourceType = (typeof KB_SOURCE_TYPES)[number];

/** §9.1's default trust per source type, 1 (lowest) to 5. */
export const DEFAULT_TRUST: Record<KbSourceType, number> = {
  official: 5,
  adcom: 4,
  insider: 3,
  interview_reports: 3,
  coach_notes: 4,
  third_party_reference: 2,
  press: 2,
};

export const LIMIT_KINDS = ["words", "chars_incl_spaces", "chars_excl_spaces"] as const;
export type LimitKind = (typeof LIMIT_KINDS)[number];

export const VIDEO_FORMATS = ["async_video", "live_video", "none"] as const;
export type VideoFormat = (typeof VIDEO_FORMATS)[number];

export const RECOMMENDATION_FORMATS = ["gmac_common", "school_specific"] as const;
export type RecommendationFormat = (typeof RECOMMENDATION_FORMATS)[number];

export const INTERVIEW_INVITATIONS = ["invite_only", "open", "guaranteed_if_by_date"] as const;
export type InterviewInvitation = (typeof INTERVIEW_INVITATIONS)[number];

export const INTERVIEWERS = ["adcom", "student", "alum"] as const;
export type Interviewer = (typeof INTERVIEWERS)[number];

export const INTERVIEW_LOCATIONS = ["campus", "virtual", "hub"] as const;
export type InterviewLocation = (typeof INTERVIEW_LOCATIONS)[number];

export const AI_STANCES = [
  "permitted",
  "permitted_with_disclosure",
  "limited",
  "prohibited",
  "unknown",
] as const;
export type AiStance = (typeof AI_STANCES)[number];

export const AI_POLICY_SCOPES = ["essays", "video", "recommendations"] as const;
export type AiPolicyScope = (typeof AI_POLICY_SCOPES)[number];

export const OFFICIAL_URL_KINDS = [
  "prompts",
  "deadlines",
  "class_profile",
  "employment_report",
  "ai_policy",
  "other",
] as const;
export type OfficialUrlKind = (typeof OFFICIAL_URL_KINDS)[number];

export const PACK_STATUSES = ["draft", "complete"] as const;
export type PackStatus = (typeof PACK_STATUSES)[number];

export const PROGRAMS = ["full_time_mba"] as const;
export type Program = (typeof PROGRAMS)[number];

/**
 * K ids below this number belong to pack items; K ids at or above it are retrieval citations
 * (`retrieval.ts`), numbered per result. `parseCode` in @admitstory/shared accepts up to six
 * digits, so K900001–K999999 are retrieval codes and a pack can never reach them.
 */
export const RETRIEVAL_CODE_BASE = 900_000;

/* The pack ------------------------------------------------------------------------------------- */

/** ISO calendar date, `YYYY-MM-DD`. */
export type IsoDate = string;

/** A source this pack's items cite. `id` is the `kb_sources` row id or a stable local slug. */
export interface PackSource {
  id: string;
  type: KbSourceType;
  title: string;
  url: string | null;
  /** 1–5; defaults per type in DEFAULT_TRUST, admin may override. */
  trust: number;
  /** When the source was read or captured. */
  retrieved_at: IsoDate | null;
  rights_note: string | null;
}

/** A citable leaf (§9.2): what the model cites as `K##`. */
export interface PackItem {
  id: string;
  text: string;
  source_ids: string[];
  /** Null in a draft until someone has checked it; the compiler never emits an unverified item. */
  verified_at: IsoDate | null;
  /** 0–1: how sure the person or Normalizer that wrote it was. */
  confidence: number;
  /**
   * §9.6: an item whose only sources are `third_party_reference` enters the compiled pack only
   * when an admin has rewritten it in Admitstory's own words and approved it.
   */
  approved_rewrite?: boolean;
}

/** The fields every citable structured record carries, besides its own content. */
export interface PackCited {
  id: string;
  source_ids: string[];
  verified_at: IsoDate | null;
}

/** §9.2 CitedThing (a course, centre, club, trek…), plus `source_ids`. */
export interface CitedThing extends PackCited {
  name: string;
  what_it_is: string;
  /** Goals or trait ids this is relevant to. */
  why_it_matters_for: string[];
  url: string | null;
}

export interface PromptLimit {
  kind: LimitKind;
  value: number;
}

export interface EssayPrompt extends PackCited {
  key: string;
  /** Null only in a draft whose wording is not yet verified (a paraphrase lives in `notes`). */
  prompt_verbatim: string | null;
  limit: PromptLimit;
  required: boolean;
  archetypes: ArchetypeId[];
  /** Each sub-question the answer must address. */
  parts: string[];
  /** For list-style prompts ("Share six things…"): how many entries. Each entry's limit is `limit`. */
  list_count?: number;
  notes: PackItem[];
}

export interface Round extends PackCited {
  name: string;
  deadline: IsoDate;
  decision_date?: IsoDate;
  interview_invites_window?: string;
  notes: PackItem[];
}

export interface VideoComponent extends PackCited {
  format: VideoFormat;
  think_time_s: number | null;
  answer_time_s: number | null;
  attempts: number | null;
  question_types: PackItem[];
  scripting_allowed: boolean;
}

export interface FormSection extends PackCited {
  key: string;
  label: string;
  item_count_max?: number;
  char_limit?: number;
  /** How the portal counts `char_limit`; absent means characters including spaces. */
  limit_kind?: LimitKind;
  guidance: PackItem[];
}

export interface RecommendationQuestion {
  text_verbatim: string;
  limit?: PromptLimit;
}

export interface Recommendations extends PackCited {
  count: number;
  format: RecommendationFormat;
  questions: RecommendationQuestion[];
  notes: PackItem[];
}

export interface ResumeRules extends PackCited {
  page_limit: number;
  notes: PackItem[];
}

export interface Reapplicant {
  essay: EssayPrompt | null;
  policy: PackItem[];
}

export interface Application {
  essays: EssayPrompt[];
  short_answers: EssayPrompt[];
  goal_fields: EssayPrompt[];
  video: VideoComponent[];
  reapplicant: Reapplicant | null;
  optional_essay: EssayPrompt | null;
  form_sections: FormSection[];
  recommendations: Recommendations | null;
  resume: ResumeRules | null;
  test_policy: PackItem[];
  fees_waivers: PackItem[];
}

export interface TraitMapEntry {
  school_value: string;
  admitstory_traits: TraitId[];
  note?: PackItem;
}

export interface Values {
  stated: PackItem[];
  trait_map: TraitMapEntry[];
}

export interface Academics {
  courses: CitedThing[];
  centers: CitedThing[];
  experiential: CitedThing[];
  structure: PackItem[];
}

export interface Community {
  clubs: CitedThing[];
  traditions: PackItem[];
  treks_events: CitedThing[];
}

export interface EmploymentByFunction {
  function: string;
  /** 0–1 share of the class accepting offers in this function. */
  share: number;
  /** Annual base salary, in `currency`. Null when the report withholds it. */
  median_base: number | null;
}

export interface EmploymentReport extends PackCited {
  class_year: number;
  /** ISO 4217, e.g. "USD". */
  currency: string;
  by_function: EmploymentByFunction[];
  top_employers: string[];
  intl_offer_rates?: PackItem;
}

export interface Careers {
  employment_report: EmploymentReport | null;
  recruiting_notes: PackItem[];
}

/** Cited class medians (agreed addition). Null fields are ones the school doesn't publish. */
export interface ClassProfile extends PackCited {
  /** The entering class the numbers describe, by graduation year. */
  class_year: number;
  class_size: number | null;
  /** GMAT Focus Edition median (205–805). */
  gmat_focus_median: number | null;
  /** Classic GMAT median (200–800), for schools that still report it. */
  gmat_classic_median: number | null;
  gre_median: { verbal: number; quant: number } | null;
  gpa_median: number | null;
  gpa_scale: number | null;
  work_experience_years_median: number | null;
  /** 0–1. */
  international_share: number | null;
}

export interface InterviewQuestion extends PackCited {
  text: string;
  /** 1–5: how often reports mention it. */
  frequency_weight: number;
}

export interface Interview extends PackCited {
  invitation: InterviewInvitation;
  who: Interviewer[];
  /** Blind (interviewer hasn't read the file) or not; null when unknown. */
  blind: boolean | null;
  length_min: number;
  location: InterviewLocation[];
  common_questions: InterviewQuestion[];
  format_notes: PackItem[];
}

export interface AiPolicy extends PackCited {
  stance: AiStance;
  applies_to: AiPolicyScope[];
  disclosure_text: string | null;
  notes: PackItem[];
}

export interface GlossaryEntry extends PackCited {
  term: string;
  plain_definition: string;
}

export interface OfficialUrl {
  kind: OfficialUrlKind;
  url: string;
}

export interface SchoolInfo {
  id: string;
  name: string;
  short_name: string;
  country: string;
  city: string;
  website: string;
  program: Program;
}

export interface SchoolPack {
  school: SchoolInfo;
  /** "2026-27". */
  cycle: string;
  version: number;
  status: PackStatus;
  /** Fixture packs: the school, its numbers and its sources are invented. */
  synthetic?: boolean;
  /** Draft packs: each field still to fill or verify, named by path. */
  _todo?: string[];
  /** Highest K number ever allocated in this pack's lineage, so deleted ids are never reused. */
  k_high_water?: number;
  sources: PackSource[];
  official_urls: OfficialUrl[];
  rounds: Round[];
  application: Application;
  values: Values;
  culture_and_location: PackItem[];
  academics: Academics;
  community: Community;
  careers: Careers;
  class_profile: ClassProfile | null;
  /** Null until filled (a draft). */
  interview: Interview | null;
  ai_policy: AiPolicy;
  scholarships: PackItem[];
  insider_notes: PackItem[];
  /** Common mistakes for this school. */
  avoid: PackItem[];
  /** Patterns, not essays. */
  angles_that_work: PackItem[];
  glossary: GlossaryEntry[];
}

/* Retrieval contract (§8.9): packages/kb defines it, packages/db implements it ------------------ */

export interface ChunkFilters {
  schoolId?: string;
  cycle?: string;
  sourceTypes?: KbSourceType[];
  minTrust?: number;
}

export interface ChunkHit {
  chunkId: string;
  sourceId: string;
  schoolId: string | null;
  cycle: string | null;
  text: string;
  sourceType: KbSourceType;
  trust: number;
  title: string;
  url: string | null;
  /** ISO date. */
  verifiedAt: string | null;
  score: number;
}

export interface ChunkStore {
  vectorSearch(q: {
    embedding: number[];
    filters: ChunkFilters;
    limit: number;
  }): Promise<ChunkHit[]>;
  textSearch(q: { query: string; filters: ChunkFilters; limit: number }): Promise<ChunkHit[]>;
}
