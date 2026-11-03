import "server-only";

import { assistAnswerText, assistProvenanceIssues } from "@admitstory/ai";
import { claimPortalAssist, getDb, writePortalLetter, type PortalAccess } from "@admitstory/db";
import { recommenderVoice } from "@admitstory/linters";
import {
  PORTAL_LIMITS,
  letterKey,
  type PortalLetter,
  type PortalMode,
  type PortalNote,
  type RecommenderAssist,
} from "@admitstory/shared/kit";
import { assistNoteId } from "@admitstory/ui";
import { ai } from "@/lib/ai";
import { ApiError } from "@/lib/api";
import type { RecommenderSchoolQuestion } from "@/lib/recommenders/schools";
import { effectiveMode, questionIn, relationshipLabel, type PortalContext } from "./view";

// The portal assistant (Phase 6 plan §4 `lor.recommender_assist`, §6, decision 2 and LOR-10).
//
// It never writes a letter. In assist mode it organises the recommender's own notes into an answer
// and says, sentence by sentence, which note each one came from. In coach mode — a school that
// asks recommenders not to use AI, or the recommender's own choice — it gives a structure and
// questions, and no sentences at all.
//
// The applicant's brief is passed as context only, and `assistProvenanceIssues` is re-run on the
// model's output here: if anything in the answer isn't the recommender's own words, the answer is
// dropped and only the structure is kept. A sentence nobody wrote never reaches the page.

const MAX_NOTES = 60;
const MAX_BRIEF_POINTS = 30;

/** The talking points for one question, as context the assistant must not borrow words from. */
export function briefPointsFor(
  context: PortalContext,
  groupKey: string,
  questionId: string,
): string[] {
  const row = context.groups.find((group) => group.key === groupKey)?.brief ?? null;
  if (!row || row.status !== "ready" || !row.content) return [];
  const points = row.content.schools.flatMap((school) =>
    school.questions
      .filter((question) => question.question_id === questionId)
      .flatMap((question) => question.talking_points),
  );
  return [
    ...new Set(points.map((point) => `${point.point} ${point.evidence}`.trim().slice(0, 800))),
  ].slice(0, MAX_BRIEF_POINTS);
}

/** The notes the assistant sees, newest last, with the ids its schema expects (N1…). */
function assistNotes(notes: readonly PortalNote[]): { id: string; text: string }[] {
  return notes
    .slice(-MAX_NOTES)
    .map((note) => ({ id: assistNoteId(note.id), text: note.text.slice(0, 8_000) }));
}

/** The answer box's new text: the organised answer, unless the recommender has edited theirs. */
export function nextLetterText(previous: PortalLetter | null, assisted: RecommenderAssist): string {
  const organised = assistAnswerText(assisted);
  if (!organised) return previous?.text ?? "";
  const current = previous?.text?.trim() ?? "";
  const wasOurs = previous?.assisted ? assistAnswerText(previous.assisted).trim() : "";
  // Their own edits are never overwritten; a fresh or untouched box takes the new answer.
  return current === "" || current === wasOurs ? organised : current;
}

export interface AssistResult {
  letter: PortalLetter;
  assistsLeft: number;
  /** True when the output failed the provenance re-check and only the structure was kept. */
  answerWithheld: boolean;
}

/**
 * Organises one question's answer, or plans it. Costs one of the invite's assists, claimed
 * atomically before the call so two tabs can't go past the cap.
 */
export async function runPortalAssist(
  context: PortalContext,
  request: { groupKey: string; questionId: string; coach?: boolean },
  now: Date = new Date(),
): Promise<AssistResult> {
  const { group, question } = questionIn(context, request.groupKey, request.questionId);
  const notes = context.workspace.notes;
  if (notes.length === 0)
    throw new ApiError(422, "Add a note first, then this page can organise what you wrote.");

  const policyMode = effectiveMode(group, context.workspace.preferCoach);
  const mode: PortalMode = request.coach || policyMode === "coach" ? "coach" : "assist";

  const claim = await claimPortalAssist(getDb(), context.access, PORTAL_LIMITS.assistsTotal);
  if (!claim.ok)
    throw new ApiError(
      429,
      "This page has given all the help it can. Your notes and answers are saved, and you can keep writing.",
    );

  const input = {
    mode,
    question: { text_verbatim: question.text, limit: question.rule },
    notes: assistNotes(notes),
    voice_card:
      context.workspace.voice?.card ?? recommenderVoice(notes.map((note) => note.text)).card,
    brief_points: briefPointsFor(context, request.groupKey, request.questionId),
    applicant_first_name: context.applicant.firstName,
    relationship: relationshipLabel(context.recommender),
  };

  let assisted: RecommenderAssist;
  try {
    // Metered to the applicant (decision 20), with content logging off: these are not their words.
    assisted = await ai().run("lor.recommender_assist", input, {
      userId: context.userId,
      contentLoggingAllowed: false,
    });
    await ai().flush();
  } catch (error) {
    console.error("[portal] assist failed", error);
    throw new ApiError(
      503,
      "This page couldn't organise your notes just now. Everything you wrote is saved; try again.",
    );
  }

  // Belt and braces: the task checks this and gets one repair, and it is checked again here on the
  // stored output. An answer that isn't provably the recommender's own words is not shown.
  const issues = assistProvenanceIssues(assisted, input.notes, input.brief_points, question.rule, [
    context.applicant.firstName,
  ]);
  const answerWithheld = issues.length > 0 && assisted.answer !== null;
  if (answerWithheld) {
    console.warn(
      "[portal] assist answer withheld",
      issues.map((issue) => issue.path),
    );
    assisted = { ...assisted, answer: null };
  }

  const previous = context.workspace.letters[letterKey(group.key, question.id)] ?? null;
  const letter: PortalLetter = {
    text: nextLetterText(previous, assisted),
    assisted,
    mode,
    updatedAt: now.toISOString(),
  };
  await writePortalLetter(getDb(), context.access, letterKey(group.key, question.id), letter, now);
  return {
    letter,
    assistsLeft: Math.max(0, PORTAL_LIMITS.assistsTotal - claim.count),
    answerWithheld,
  };
}

/** Saves what the recommender typed into one answer box. Their words, kept as written. */
export async function savePortalLetter(
  access: PortalAccess,
  letters: Record<string, PortalLetter>,
  group: { key: string },
  question: Pick<RecommenderSchoolQuestion, "id">,
  text: string,
  now: Date = new Date(),
): Promise<PortalLetter> {
  if (text.length > PORTAL_LIMITS.letterChars)
    throw new ApiError(
      422,
      `That answer is longer than this page keeps (${PORTAL_LIMITS.letterChars} characters).`,
    );
  const key = letterKey(group.key, question.id);
  const previous = letters[key] ?? null;
  const letter: PortalLetter = {
    text,
    assisted: previous?.assisted ?? null,
    mode: previous?.mode ?? null,
    updatedAt: now.toISOString(),
  };
  await writePortalLetter(getDb(), access, key, letter, now);
  return letter;
}
