import "server-only";

import { getDb, getRecommender } from "@admitstory/db";
import { Cite, TraitId } from "@admitstory/shared/schemas";
import { INTAKE_QUESTION_IDS } from "@admitstory/shared/kit";
import { z } from "zod";
import { notFound } from "@/lib/api";
import { LanguageTag, MAX_VOICE_SECONDS_PER_ANSWER } from "@/lib/voice/schemas";

// What every applicant-side recommender route shares (Phase 6 plan §6). Ownership goes through the
// repo, so another applicant's id is a 404 and never a 403 that confirms the id exists.

/** Writes to a recommender: generous, since the intake saves as the applicant types. */
export const RECOMMENDER_WRITE_LIMIT = { limit: 120, windowMs: 60_000 };
/** The intake extraction and a brief rebuild both call the model (decision 19). */
export const RECOMMENDER_AI_LIMIT = { limit: 10, windowMs: 3_600_000 };
/** The coverage plan is free, so the limit is what stops it being asked for in a loop. */
export const RECOMMENDER_PLAN_LIMIT = { limit: 6, windowMs: 3_600_000 };

/** The caller's recommender, or a 404. */
export async function ownRecommender(userId: string, recommenderId: string) {
  const row = await getRecommender(getDb(), userId, recommenderId);
  if (!row) notFound("That recommender");
  return row;
}

/* Bodies shared by the story routes --------------------------------------------------------- */

const story = (max: number) => z.string().trim().min(1).max(max);

/** One story as the applicant may write or correct it; the same shape `lor.extract` produces. */
export const LorStoryFieldsBody = z.strictObject({
  title: story(120),
  what_happened: story(1_200),
  what_they_saw: story(800),
  your_actions: z.array(story(400)).max(8).default([]),
  result: story(600),
  numbers: z.array(story(80)).max(10).default([]),
  what_they_said: story(600).nullable().default(null),
  traits: z.array(TraitId).max(4).default([]),
  cites: z.array(Cite).max(8).default([]),
});

/** The intake (Appendix F): one answer per question, dictated or typed, the story one repeatable. */
export const IntakeAnswersBody = z
  .array(
    z.strictObject({
      questionId: z.enum(INTAKE_QUESTION_IDS),
      text: z.string().trim().min(1).max(6_000),
      spoken: z
        .strictObject({
          seconds: z.number().int().min(0).max(MAX_VOICE_SECONDS_PER_ANSWER),
          language: LanguageTag,
        })
        .nullable()
        .optional(),
    }),
  )
  .min(1)
  .max(20);
