import { z } from "zod";

/**
 * The knowledge-base agents (spec §8.5.17, §9.3). Admin-only: their output is reviewed by Manu in
 * the admin console before anything reaches a published pack.
 */

/** §9.1 source types, with their default trust. */
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

/** The official pages the refresh checker watches (§9.3; the pack's `official_urls[].kind`). */
export const OFFICIAL_URL_KINDS = [
  "prompts",
  "deadlines",
  "class_profile",
  "employment_report",
  "ai_policy",
  "other",
] as const;
export type OfficialUrlKind = (typeof OFFICIAL_URL_KINDS)[number];

/** A run of this many consecutive words shared with a source counts as copying it (§9.6). */
export const VERBATIM_RUN_WORDS = 8;

const isJson = (value: string): boolean => {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
};

/* kb.normalize -------------------------------------------------------------------------------- */

export const KbNormalizeInput = z.object({
  school: z.string().trim().min(1).max(120),
  cycle: z.string().trim().min(1).max(20),
  source: z.object({
    type: z.enum(KB_SOURCE_TYPES),
    title: z.string().trim().min(1).max(200),
    url: z.string().trim().max(500).nullable(),
    trust: z.number().int().min(1).max(5),
    /** Extracted text (PDF, page, transcript). Untrusted: rendered inside a delimited block. */
    text: z.string().trim().min(1).max(200_000),
  }),
  /** The current draft or published pack data, as JSON. "{}" for a new school. */
  current_pack: z.string().max(200_000).refine(isJson, "current_pack must be JSON"),
});
export type KbNormalizeInput = z.input<typeof KbNormalizeInput>;

const Span = z.object({ start: z.number().int().min(0), end: z.number().int().min(0) });

export const KbProposal = z.object({
  field_path: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .describe(
      'Dotted path into the pack, list entries by selector: "application.essays[key=E1].limit.value"; "values.stated[+]" adds an entry',
    ),
  proposed: z
    .string()
    .max(8_000)
    .refine(isJson, "proposed must be JSON")
    .describe('The proposed value encoded as JSON: "a string", 250, {"kind":"words","value":250}'),
  current: z
    .string()
    .max(8_000)
    .refine(isJson, "current must be JSON")
    .nullable()
    .describe("The pack's current value at field_path encoded as JSON, or null if empty"),
  conflict: z.boolean().describe("True when the source disagrees with a non-empty current value"),
  confidence: z.number().min(0).max(1),
  source_span: Span.nullable().describe(
    "Character offsets into the source text this proposal rests on, counting from 0",
  ),
  rewritten_in_own_words: z
    .boolean()
    .describe("True when the proposed text is a paraphrase, false when it is copied as published"),
  note: z.string().max(400),
});
export type KbProposal = z.output<typeof KbProposal>;

export const KbNormalizeOutput = z.object({ proposals: z.array(KbProposal).max(60) });
export type KbNormalizeOutput = z.output<typeof KbNormalizeOutput>;

/* kb.refresh_check ---------------------------------------------------------------------------- */

const HOSTNAME = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export const KbRefreshCheckInput = z.object({
  school: z.string().trim().min(1).max(120),
  url: z.url().max(500),
  url_kind: z.enum(OFFICIAL_URL_KINDS),
  /** The last snapshot's text and today's. Code has already found that their hashes differ. */
  old_text: z.string().max(100_000),
  new_text: z.string().max(100_000),
  /** The school's official domains; web search is restricted to them (§8.3). */
  allowed_domains: z.array(z.string().toLowerCase().regex(HOSTNAME)).min(1).max(5),
});
export type KbRefreshCheckInput = z.input<typeof KbRefreshCheckInput>;

export const KbRefreshCheckOutput = z.object({
  changed: z
    .boolean()
    .describe("True only when something an applicant relies on changed, not layout or navigation"),
  summary: z.string().trim().min(1).max(800),
  affected_fields: z
    .array(z.string().trim().min(1).max(200))
    .max(20)
    .describe("Pack field paths the change affects; empty when changed is false"),
});
export type KbRefreshCheckOutput = z.output<typeof KbRefreshCheckOutput>;
