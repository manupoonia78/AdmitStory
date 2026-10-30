import { ArchetypeId, LensId, TraitId } from "@admitstory/shared/schemas";
import { z } from "zod";

/**
 * studio.extract and import.parse share one output shape (spec §8.5.2): the Extractor reads the
 * applicant's latest answer or an uploaded document and returns structured material, literally and
 * conservatively. It never infers a fact that was not stated.
 */

export const SENSITIVE_CATEGORIES = [
  "health",
  "bereavement",
  "identity",
  "family_hardship",
  "abuse",
  "legal",
  "finances",
] as const;

export type SensitiveCategory = (typeof SENSITIVE_CATEGORIES)[number];

/** Character offsets into the source text, so every card links back to what was said (§5.2 AC). */
const Span = z.object({
  start: z.number().int().min(0),
  end: z.number().int().min(0),
});

const ExtractedFact = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .describe("snake_case key, e.g. employer_current, title_current, team_size, gmat_total"),
  value: z
    .string()
    .trim()
    .min(1)
    .max(1000)
    .describe("Exactly as stated. Dates and numbers verbatim."),
  note: z.string().max(400).nullable().describe("Short parenthetical context, or null"),
  evidence_span: Span,
  confidence: z.number().min(0).max(1),
});

const ExtractedPerson = z.object({
  name: z.string().trim().min(1).max(120),
  role: z.string().trim().min(1).max(120).describe("Their role in the applicant's life or work"),
});

const ExtractedNumber = z.object({
  label: z.string().trim().min(1).max(80),
  value: z.string().trim().min(1).max(120).describe("As stated, including the unit"),
});

const StoryCandidate = z.object({
  nickname: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .describe('3–5 words in the applicant\'s own flavour, e.g. "The night-shift fix"'),
  era: z.string().trim().max(60).describe('When it happened: "2024", "college", "2019–2021"'),
  context: z.enum(["professional", "academic", "community", "personal"]),
  situation: z.string().trim().max(2000),
  stakes: z.string().max(2000).nullable().describe("Why it mattered; what was uncertain"),
  actions: z
    .array(z.string().trim().max(600))
    .max(12)
    .describe("What the applicant personally did, in order"),
  result: z.string().max(2000).nullable(),
  reflection: z.string().max(2000).nullable().describe("What changed in them, in their words"),
  people: z.array(ExtractedPerson).max(10),
  numbers: z.array(ExtractedNumber).max(10),
  traits: z.array(TraitId).max(8),
  lenses: z.array(LensId).max(4),
  archetypes: z.array(ArchetypeId).max(8),
  missing: z
    .array(
      z.object({
        question: z
          .string()
          .trim()
          .min(1)
          .max(300)
          .describe("The most valuable missing detail, as a question"),
        approx_words: z.number().int().min(5).max(300),
      }),
    )
    .max(4),
  evidence_spans: z.array(Span).max(20),
  confidence: z.number().min(0).max(1).describe("Below 0.5 if unsure this is a story at all"),
});

const GoldenLine = z.object({
  text: z
    .string()
    .trim()
    .min(1)
    .max(1000)
    .describe("Copied exactly, grammar included. Never corrected or tidied."),
  span: Span,
  /** Set when the applicant was not speaking English (spec §7.5). */
  english: z.string().max(1000).nullable(),
  /** Which story candidate it belongs to, by position in story_candidates, or null. */
  story_index: z.number().int().min(0).max(49).nullable(),
});

export const ExtractionOutput = z.object({
  facts: z.array(ExtractedFact).max(60),
  story_candidates: z.array(StoryCandidate).max(20),
  golden_lines: z
    .array(GoldenLine)
    .max(12)
    .describe("Up to 4 per story: vivid, specific or characteristic"),
  sensitive: z
    .array(
      z.object({
        category: z.enum(SENSITIVE_CATEGORIES),
        span: Span,
        /** Which story candidate the disclosure sits in, or null if it is loose in the answer. */
        story_index: z.number().int().min(0).max(49).nullable(),
      }),
    )
    .max(12)
    .describe("Category and location only. Never restate the disclosure."),
  conflicts: z
    .array(
      z.object({
        fact_code: z.string().max(16).describe("The known fact's code, e.g. F03"),
        known_value: z.string().max(500),
        stated_value: z.string().max(500),
      }),
    )
    .max(10),
});

export type ExtractionOutput = z.output<typeof ExtractionOutput>;

/** A fact the Extractor already knows, so it can spot a contradiction rather than re-reporting it. */
export const KnownFact = z.object({
  code: z.string().max(16),
  key: z.string().max(80),
  value: z.string().max(1000),
});

export const StudioExtractInput = z.object({
  /** The applicant's answer, verbatim. Offsets in the output are into this string. */
  text: z.string().trim().min(1).max(60_000),
  chapter: z.string().trim().max(40),
  /** The slot the question was asked for, as a hint about what the answer is likely to hold. */
  targetSlot: z.string().trim().max(80).nullable().default(null),
  knownFacts: z.array(KnownFact).max(200).default([]),
  /** Nicknames already on the shelf, so the same story is not proposed twice. */
  knownStories: z
    .array(z.object({ code: z.string().max(16), nickname: z.string().max(80) }))
    .max(100)
    .default([]),
});

export type StudioExtractInput = z.input<typeof StudioExtractInput>;

export const IMPORT_DOCUMENT_KINDS = ["resume", "linkedin", "essay", "notes", "other"] as const;

export const ImportParseInput = z.object({
  /**
   * The document's extracted text. Phase 1 extracts text in the upload route and discards the
   * file, so the model never receives the PDF itself (see docs/phase-1.md).
   */
  text: z.string().trim().min(1).max(200_000),
  documentKind: z.enum(IMPORT_DOCUMENT_KINDS).default("other"),
  fileName: z.string().max(300).default(""),
  knownFacts: z.array(KnownFact).max(200).default([]),
});

export type ImportParseInput = z.input<typeof ImportParseInput>;
