import { TraitId } from "@admitstory/shared/schemas";
import { z } from "zod";

/**
 * studio.consolidate (spec §8.5.3). Runs every ~8 turns and at chapter end. It does the judgment —
 * which candidates are the same story, which are confirmed, which lines are worth keeping, what
 * the brand is, how this person sounds — and the server then compiles the compact dossier from the
 * result (packages/shared), so the §8.2 layout and the §8.7 consent rule are code, not a prompt.
 */

export const StudioConsolidateInput = z.object({
  /** Stories as they stand, including unconfirmed candidates from recent turns. */
  stories: z
    .array(
      z.object({
        code: z.string().max(16),
        nickname: z.string().max(80),
        era: z.string().max(60),
        context: z.string().max(40),
        situation: z.string().max(2000),
        stakes: z.string().max(2000),
        actions: z.array(z.string().max(600)).max(12),
        result: z.string().max(2000),
        reflection: z.string().max(2000),
        traits: z.array(z.string().max(60)).max(12),
        status: z.string().max(20),
        lines: z.array(z.object({ code: z.string().max(16), text: z.string().max(1000) })).max(12),
      }),
    )
    .max(60),
  facts: z
    .array(
      z.object({
        code: z.string().max(16),
        key: z.string().max(80),
        value: z.string().max(1000),
        status: z.string().max(30),
      }),
    )
    .max(200),
  /** Sentence-length statistics, computed in code and passed in (spec §8.5.3). */
  voiceStats: z.object({
    sentenceLengthMean: z.number(),
    sentenceLengthStdDev: z.number(),
    sentenceLengthVariation: z.number(),
    wordCount: z.number().int(),
    sentenceCount: z.number().int(),
  }),
  /** A sample of the applicant's own sentences, for register, humour and the words they avoid. */
  voiceSamples: z.array(z.string().max(2000)).max(40).default([]),
});

export type StudioConsolidateInput = z.input<typeof StudioConsolidateInput>;

export const StudioConsolidateOutput = z.object({
  merges: z
    .array(
      z.object({
        keep: z.string().max(16).describe("The story code to keep"),
        merge: z.string().max(16).describe("The duplicate's code, folded into `keep`"),
        why: z.string().max(300),
      }),
    )
    .max(20),
  statuses: z
    .array(
      z.object({
        code: z.string().max(16),
        status: z.enum(["confirmed", "partial", "unconfirmed"]),
        /** Required when status is partial: the exact missing detail, as a question. */
        missing: z.string().max(300).nullable(),
        approx_words: z.number().int().min(5).max(300).nullable(),
      }),
    )
    .max(60)
    .describe(
      "confirmed only when situation, action and result are all in the applicant's own words",
    ),
  nicknames: z
    .array(z.object({ code: z.string().max(16), nickname: z.string().trim().min(1).max(80) }))
    .max(60)
    .describe("Improved nicknames, in the applicant's flavour. Leave a good one alone."),
  keep_lines: z
    .array(
      z.object({
        story_code: z.string().max(16),
        line_codes: z.array(z.string().max(16)).max(4),
      }),
    )
    .max(60)
    .describe("At most four golden lines per story"),
  fact_conflicts: z
    .array(
      z.object({
        code: z.string().max(16),
        question: z.string().max(300).describe("Which value is current, asked in one line"),
      }),
    )
    .max(20),
  brand: z
    .array(
      z.object({
        trait: TraitId,
        story_codes: z.array(z.string().max(16)).max(6),
        why: z.string().max(400),
      }),
    )
    .max(4)
    .describe("3–4 traits the evidence actually supports, each with the stories that prove it"),
  positioning_line: z.string().max(300).describe("Internal only; never submitted anywhere"),
  voice_card: z
    .string()
    .trim()
    .min(1)
    .max(1600)
    .describe(
      "One compact line in the §8.2 VOICE format, 300 tokens at most: sent_len, var, register, humour, opens_with, avoids",
    ),
  /** Anything the Consolidator noticed that the applicant should be asked about. */
  notes: z.array(z.string().max(300)).max(10),
});

export type StudioConsolidateOutput = z.output<typeof StudioConsolidateOutput>;
