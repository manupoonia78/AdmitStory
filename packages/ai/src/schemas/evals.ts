import { z } from "zod";

/**
 * eval.judge (spec §8.11, Phase 9b): the rubric judge the evaluation harness runs over a task's
 * output for a synthetic fixture. Admin-only: no product path reaches it, and it only ever reads
 * fixture material, never an applicant's.
 *
 * Not in §8.3's route table; added in Phase 9b (docs/phase-9.md).
 */

const Score = z
  .int()
  .min(1)
  .max(5)
  .describe("1 (poor) to 5 (excellent), against the rubric in the system prompt.");

export const EvalJudgeInput = z.object({
  /** The task that produced the output, e.g. `kit.draft`. */
  task: z.string().trim().min(1).max(80),
  fixture: z.object({
    applicant: z.string().trim().min(1).max(120),
    school: z.string().trim().max(120).default(""),
  }),
  /** The essay question or instruction the output answers. */
  promptText: z.string().trim().max(4000).default(""),
  /** The output being judged, as plain text. */
  outputText: z.string().trim().min(1).max(30_000),
  /** The fixture's facts and stories as plain lines: the only true material. */
  groundTruth: z.string().trim().min(1).max(60_000),
  /** A sample of how the applicant talks (≤ 1,500 chars of their own transcript). */
  voiceSample: z.string().trim().max(1_500).default(""),
  /** The school pack excerpt the output was written against (≤ 2,000 chars). */
  packExcerpt: z.string().trim().max(2_000).default(""),
});
export type EvalJudgeInput = z.input<typeof EvalJudgeInput>;

export const EvalJudgeOutput = z.object({
  scores: z.object({
    story_quality: Score,
    voice_fidelity: Score,
    prompt_coverage: Score,
    school_fit: Score,
  }),
  invented_facts: z
    .array(
      z.object({
        text: z
          .string()
          .trim()
          .min(1)
          .max(400)
          .describe(
            "The exact words from the output that assert something not in the ground truth.",
          ),
        why: z.string().trim().min(1).max(400),
      }),
    )
    .max(10),
  must_fix: z
    .array(
      z.object({
        rule_id: z
          .string()
          .regex(/^[A-Z]+-\d{2}$/)
          .nullable()
          .describe("The canon rule broken, e.g. TRUTH-01, or null."),
        text: z.string().trim().min(1).max(400),
      }),
    )
    .max(10),
  summary: z.string().trim().min(1).max(600).describe("At most 60 words."),
});
export type EvalJudgeOutput = z.output<typeof EvalJudgeOutput>;
