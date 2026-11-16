import { ChapterId } from "@admitstory/shared/schemas";
import { z } from "zod";

/**
 * studio.interviewer (spec §8.5.1). The applicant's dossier, the canon subset and the prompt are
 * all cached system layers; this is only what changes per turn.
 *
 * Model outputs use .nullable() rather than .optional(): structured outputs require every property
 * to be present, so "nothing here" is an explicit null.
 */

export const INTERVIEWER_MOVES = ["DIG", "NEXT", "CONFIRM", "CARE"] as const;

export type InterviewerMove = (typeof INTERVIEWER_MOVES)[number];

export const MAX_QUESTION_SENTENCES = 2;

export const StudioInterviewerInput = z.object({
  chapter: ChapterId,
  /** What the chapter gathers, so the question stays on topic. */
  chapterGathers: z.string().trim().min(1).max(500),
  /** The slot the selector chose. The model phrases a question for it; it does not choose it. */
  targetSlot: z.string().trim().min(1).max(80),
  /** Appendix B's seed question for that slot, to rephrase and personalise. */
  seedQuestion: z.string().trim().min(1).max(500),
  /** The applicant's last answer, verbatim. Empty on the first turn of a session. */
  lastAnswer: z.string().max(40_000).default(""),
  /** The last few turns, oldest first. */
  recentTurns: z
    .array(
      z.object({
        role: z.enum(["ai", "user"]),
        text: z.string().max(40_000),
      }),
    )
    .max(12)
    .default([]),
  /** How many DIG turns this story has already had; two is the limit unless they are enjoying it. */
  digsUsedOnStory: z.number().int().min(0).max(10).default(0),
  /** Express mode, or the applicant said they are short on time: prefer NEXT and keep it short. */
  hurried: z.boolean().default(false),
  /** Facts that look contradicted by the last answer, for a CONFIRM move. */
  possibleConflicts: z
    .array(
      z.object({
        code: z.string().max(16),
        key: z.string().max(80),
        knownValue: z.string().max(500),
        justSaid: z.string().max(500),
      }),
    )
    .max(5)
    .default([]),
  /** Whether a pause point is due (spec §5.2: one every ~10 minutes). */
  offerPause: z.boolean().default(false),
});

export type StudioInterviewerInput = z.input<typeof StudioInterviewerInput>;

const sentenceCount = (text: string) =>
  text
    .split(/[.!?]+(?:\s|$)/u)
    .map((part) => part.trim())
    .filter(Boolean).length;

/**
 * The reply's sentence budget: one short reaction plus a question of at most two sentences, or,
 * when the applicant asked something, a short answer and then the question.
 */
export const MAX_REPLY_SENTENCES = 3;
export const MAX_ANSWER_REPLY_SENTENCES = 6;

export const StudioInterviewerOutput = z
  .object({
    move: z.enum(INTERVIEWER_MOVES),
    /**
     * The applicant asked something (about the platform, their application, MBA admissions) and
     * the reply answers it before going back to the interview.
     */
    answered: z.boolean(),
    question: z
      .string()
      .trim()
      .min(1)
      .max(900)
      .describe(
        "What you say out loud: an optional short reaction (or a brief answer when they asked something), then exactly one question.",
      ),
  /** The slot this question serves — normally the target, or the story's slot on a DIG. */
  slot: z.string().trim().min(1).max(80),
  /** The story being dug into, as a code ("S03"), or null. */
  story_ref: z.string().max(16).nullable(),
  })
  .superRefine((output, context) => {
    const limit = output.answered ? MAX_ANSWER_REPLY_SENTENCES : MAX_REPLY_SENTENCES;
    if (sentenceCount(output.question) > limit)
      context.addIssue({
        code: "custom",
        path: ["question"],
        message: `At most ${limit} sentences`,
      });
  });

export type StudioInterviewerOutput = z.output<typeof StudioInterviewerOutput>;
