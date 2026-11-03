import { z } from "zod";

/**
 * eval.applicant_simulator (spec §8.11, §16 Phase 1): a Haiku stand-in applicant that answers
 * Studio questions from a fixture's ground truth, so Studio runs can be driven end to end without
 * a person. It is a test harness, never reachable from the product.
 *
 * Not in §8.3's route table — the spec names the simulator but gives it no route. Added in Phase 1;
 * see docs/phase-1.md.
 */

export const SPEAKING_STYLES = ["terse", "rambling", "formal", "humorous", "warm"] as const;

export type SpeakingStyle = (typeof SPEAKING_STYLES)[number];

export const ApplicantSimulatorInput = z.object({
  /** Who this fixture is, in a line or two. */
  persona: z.string().trim().min(1).max(2000),
  /** How they talk, so transcripts vary the way real ones do. */
  style: z.enum(SPEAKING_STYLES),
  /** The fixture's ground truth: the only material the simulator may answer from. */
  groundTruth: z.string().trim().min(1).max(60_000),
  question: z.string().trim().min(1).max(500),
  /** What they have already said this session, so they do not repeat themselves. */
  alreadySaid: z.array(z.string().max(4000)).max(40).default([]),
});

export type ApplicantSimulatorInput = z.input<typeof ApplicantSimulatorInput>;

export const ApplicantSimulatorOutput = z.object({
  answer: z
    .string()
    .trim()
    .min(1)
    .max(8000)
    .describe("How this person would answer out loud, in their own register. No narration."),
  /**
   * True when the ground truth has nothing to answer this question with, so the harness can check
   * that the Studio handles "I don't have anything for that" rather than inventing material.
   */
  nothing_to_say: z.boolean(),
});

export type ApplicantSimulatorOutput = z.output<typeof ApplicantSimulatorOutput>;
