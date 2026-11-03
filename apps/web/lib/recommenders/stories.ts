import "server-only";

import {
  createSource,
  getRecommender,
  getSources,
  isPaidUser,
  listLorStories,
  replaceExtractedStories,
  saveIntake,
  type DbExecutor,
  type LorStoryRow,
  type RecommenderRow,
} from "@admitstory/db";
import type { TaskInput, TaskOutput } from "@admitstory/ai";
import {
  INTAKE_QUESTION_IDS,
  type IntakeQuestionId,
  type LorStoryFields,
  type StoredIntake,
} from "@admitstory/shared/kit";
import { ApiError } from "@/lib/api";
import type { KitAI } from "@/lib/kit/pipeline";
import { ensureSnapshot } from "@/lib/strategy/jobs";
import { meterLooseDictation } from "@/lib/voice/server";

// The applicant's intake about one recommender (spec §5.11, Appendix F; Phase 6 plan §6): the
// answers are stored first, as `sources` rows the applicant owns, and then `lor.extract` pulls the
// stories out of them. Storing before extracting means an answer is never lost to a model error.
//
// Dictated answers are text plus a count of seconds: no audio is kept (decision 8), and the
// seconds are metered against the applicant's dictation allowance like a Studio turn.

export interface IntakeAnswerInput {
  questionId: IntakeQuestionId;
  text: string;
  spoken?: { seconds: number; language: string } | null;
}

const isQuestionId = (value: unknown): value is IntakeQuestionId =>
  typeof value === "string" && (INTAKE_QUESTION_IDS as readonly string[]).includes(value);

/** The answers already stored for this recommender, oldest first, for the next extraction. */
async function storedAnswers(
  db: DbExecutor,
  userId: string,
  sourceIds: readonly string[],
): Promise<{ question_id: IntakeQuestionId; text: string }[]> {
  if (sourceIds.length === 0) return [];
  const rows = await getSources(db, userId, [...sourceIds]);
  return rows
    .filter((row) => row.kind === "recommender_intake" && (row.text ?? "").trim() !== "")
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((row) => {
      const meta = (row.meta ?? {}) as { questionId?: unknown };
      return {
        question_id: isQuestionId(meta.questionId) ? meta.questionId : ("stories" as const),
        text: (row.text ?? "").trim(),
      };
    });
}

/** Stories the applicant edited or wrote themselves: the extraction must not repeat them. */
const confirmedOf = (rows: readonly LorStoryRow[]) =>
  rows
    .filter((row) => row.origin !== "extracted")
    .slice(0, 20)
    .map((row) => ({ code: row.code, title: row.fields.title }));

function intakeToStore(
  output: TaskOutput<"lor.extract">,
  codeOf: (ref: string) => string | null,
): StoredIntake {
  return {
    relationship: output.relationship,
    strengths: output.strengths.map((s) => ({
      trait: s.trait,
      moment: s.moment,
      story: s.story_ref ? codeOf(s.story_ref) : null,
    })),
    growth: output.growth,
    said_to_others: output.said_to_others,
    background: output.background,
    logistics: output.logistics,
    missing: output.missing,
  };
}

/**
 * Stores the applicant's answers, then extracts this recommender's stories from every answer they
 * have given so far. Returns the recommender's stories afterwards. Throws 404 when the recommender
 * isn't the caller's, 402 before any kit is owned.
 */
export async function saveIntakeAnswers(
  deps: { ai: KitAI; db: DbExecutor },
  userId: string,
  recommenderId: string,
  answers: readonly IntakeAnswerInput[],
): Promise<LorStoryRow[]> {
  const { db } = deps;
  const recommender = await getRecommender(db, userId, recommenderId);
  if (!recommender) throw new ApiError(404, "That recommender could not be found.");
  if (!(await isPaidUser(db, userId)))
    throw new ApiError(
      402,
      "Pulling the stories out of your answers comes with your first School Kit.",
    );

  const written = [];
  for (const answer of answers) {
    const text = answer.text.trim();
    if (text === "") continue;
    written.push(
      await createSource(db, userId, {
        kind: "recommender_intake",
        text,
        language: answer.spoken?.language ?? null,
        meta: { questionId: answer.questionId, spoken: Boolean(answer.spoken) },
      }),
    );
  }
  const spokenSeconds = answers.reduce((total, a) => total + (a.spoken?.seconds ?? 0), 0);
  if (spokenSeconds > 0) await meterLooseDictation(userId, spokenSeconds);

  const sourceIds = [...recommender.intakeSourceIds, ...written.map((row) => row.id)];
  return extractStories(deps, recommender, sourceIds);
}

/** `lor.extract` over every stored answer, saved as the intake and the extracted stories. */
export async function extractStories(
  deps: { ai: KitAI; db: DbExecutor },
  recommender: RecommenderRow,
  sourceIds: readonly string[],
): Promise<LorStoryRow[]> {
  const { db } = deps;
  const userId = recommender.userId;
  const [answers, existing] = await Promise.all([
    storedAnswers(db, userId, sourceIds),
    listLorStories(db, userId, { recommenderId: recommender.id }),
  ]);
  if (answers.length === 0)
    throw new ApiError(422, "Answer a question or two about them first, and the stories follow.");

  const input: TaskInput<"lor.extract"> = {
    recommender: {
      ref: recommender.ref,
      name: recommender.name,
      relationship: recommender.relationship,
      title: recommender.title,
      organisation: recommender.organisation,
    },
    answers: answers.slice(-40),
    confirmed: confirmedOf(existing),
  };
  const snapshot = await ensureSnapshot(userId);
  const output = await deps.ai.run("lor.extract", input, {
    userId,
    dossier: snapshot.compactText,
  });

  const fields: LorStoryFields[] = output.stories.map(({ ref: _ref, ...rest }) => rest);
  const rows = await replaceExtractedStories(db, userId, recommender.id, fields, [...sourceIds]);
  // The codes are handed out in the order the stories were given, so "s1" is the first new row.
  const extracted = rows
    .filter((row) => row.origin === "extracted")
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const byRef = new Map(output.stories.map((story, index) => [story.ref, extracted[index]?.code]));
  await saveIntake(db, userId, recommender.id, {
    intake: intakeToStore(output, (ref) => byRef.get(ref) ?? null),
    sourceIds: [...sourceIds],
  });
  return rows;
}
