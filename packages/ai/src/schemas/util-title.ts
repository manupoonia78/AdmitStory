import { z } from "zod";

/** Input and output schemas for util.title (spec §17: task schemas live in packages/ai/src/schemas). */

export const UTIL_TITLE_MAX_WORDS = 6;

export const UtilTitleInput = z.object({
  text: z.string().trim().min(1).max(20_000),
});

const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

// Field names avoid "reasoning"/"thinking": asking for reasoning in the output triggers
// reasoning_extraction refusals.
export const UtilTitleOutput = z.object({
  title: z
    .string()
    .min(1)
    .max(80)
    .describe("Sentence case, at most 6 words, no quotation marks, no trailing full stop")
    .refine((t) => t.trim() === t && t !== "", "Title must not have leading or trailing spaces")
    .refine(
      (t) => wordCount(t) <= UTIL_TITLE_MAX_WORDS,
      `Title must be at most ${UTIL_TITLE_MAX_WORDS} words`,
    )
    .refine((t) => !/["“”«»]/.test(t), "Title must not contain quotation marks")
    .refine((t) => !t.endsWith("."), "Title must not end with a full stop"),
});
