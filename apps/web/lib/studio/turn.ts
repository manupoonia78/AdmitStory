import "server-only";

import {
  appendStudioTurn,
  countUserTurns,
  getDb,
  getLatestSnapshot,
  listFacts,
  recentTurns,
  updateStudioSession,
  upsertSlotState,
  type StudioSession,
} from "@admitstory/db";
import { chapter as chapterOf, type ChapterId } from "@admitstory/shared";
import {
  EXPRESS_OPENERS,
  gapOnlySlots,
  questionsForSlot,
  selectSlot,
  slot as slotOf,
  type SlotKey,
} from "@admitstory/slots";
import { ai } from "@/lib/ai";
import { studioSchools } from "./schools";
import { loadKnowledge, type StudioKnowledge } from "./state";

// One Studio turn (spec §7.3): the slot selector chooses what to ask about, then the Interviewer
// phrases it. The question comes back as soon as the Interviewer answers; extraction runs after the
// response is sent (see extract.ts), so the applicant waits only for the question.

/** Spec §5.2: a pause point every ~10 minutes of conversation. */
const TURNS_BETWEEN_PAUSES = 10;
/** Spec §7.3: the Consolidator runs every ~8 turns and at chapter end. */
export const TURNS_BETWEEN_CONSOLIDATIONS = 8;

export interface NextQuestion {
  question: string;
  move: "DIG" | "NEXT" | "CONFIRM" | "CARE";
  slot: string;
  storyRef: string | null;
  turnId: string;
  /** The chapter the question belongs to, which may have moved on. */
  chapter: ChapterId;
  latencyMs: number;
}

export interface AskOptions {
  session: StudioSession;
  /** The applicant's last answer, or "" at the start of a session. */
  lastAnswer?: string;
  /** Facts the last answer appears to contradict, for a CONFIRM move. */
  possibleConflicts?: {
    code: string;
    key: string;
    knownValue: string;
    justSaid: string;
  }[];
  /** How many DIG turns the current story has had, so the Interviewer respects the limit of two. */
  digsUsedOnStory?: number;
  knowledge?: StudioKnowledge;
}

/**
 * Express mode opens with Appendix B's three wide questions before the selector takes over, and
 * then asks only what the applicant's schools still need (§5.2 hurry mode): the unfilled slots
 * their published prompts ask for, or a typical application's when no pack is published yet.
 */
function expressOpener(session: StudioSession) {
  return session.mode === "express" ? EXPRESS_OPENERS[session.openersAsked] : undefined;
}

export async function askNextQuestion(
  userId: string,
  options: AskOptions,
): Promise<NextQuestion | null> {
  const db = getDb();
  const { session } = options;
  const [knowledge, schools] = await Promise.all([
    options.knowledge ?? loadKnowledge(userId),
    studioSchools(userId),
  ]);
  const now = new Date();

  const opener = expressOpener(session);
  const hurried = session.mode === "express";

  let targetSlot: SlotKey;
  let seedQuestion: string;
  let chapterId: ChapterId = session.currentChapter;

  if (opener) {
    targetSlot = opener.targets[0] as SlotKey;
    seedQuestion = opener.text;
    chapterId = opener.chapter;
  } else {
    const picked = selectSlot({
      chapter: session.currentChapter,
      states: knowledge.states,
      now,
      need: schools.need,
      context: schools.context,
      ...(hurried
        ? { only: gapOnlySlots(knowledge.states, schools.context, undefined, schools.need) }
        : {}),
    });
    // Nothing left worth asking: every slot is filled, retired or exhausted.
    if (!picked) return null;
    targetSlot = picked.slot.key;
    chapterId = picked.slot.chapter;
    seedQuestion = questionsForSlot(targetSlot)[0]?.text ?? "";
  }

  const [history, snapshot, turnsSoFar] = await Promise.all([
    recentTurns(db, userId, session.id),
    getLatestSnapshot(db, userId),
    countUserTurns(db, userId, session.id),
  ]);

  const startedAt = Date.now();
  const result = await ai().run(
    "studio.interviewer",
    {
      chapter: chapterId,
      chapterGathers: chapterOf(chapterId).gathers,
      targetSlot,
      seedQuestion:
        seedQuestion === ""
          ? `Ask about ${targetSlot.replace(/[._]/g, " ")}, as a moment rather than a quality.`
          : seedQuestion,
      lastAnswer: options.lastAnswer ?? "",
      recentTurns: history.map((turn) => ({
        role: turn.role,
        text: turn.text ?? "",
      })),
      digsUsedOnStory: options.digsUsedOnStory ?? 0,
      hurried,
      possibleConflicts: options.possibleConflicts ?? [],
      offerPause: turnsSoFar > 0 && turnsSoFar % TURNS_BETWEEN_PAUSES === 0,
    },
    { userId, stream: true, dossier: snapshot?.compactText },
  );
  const latencyMs = Date.now() - startedAt;

  // The model may answer for a different slot on a DIG; keep it only if it is a real slot.
  const answeredSlot = isKnownSlot(result.slot) ? result.slot : targetSlot;

  const { turn } = await appendStudioTurn(db, userId, {
    sessionId: session.id,
    role: "ai",
    text: result.question,
    move: result.move,
    slot: answeredSlot,
    storyRef: result.story_ref,
    latencyMs,
  });

  await upsertSlotState(db, userId, { slotKey: answeredSlot, asked: true });
  if (chapterId !== session.currentChapter)
    await updateStudioSession(db, userId, session.id, { currentChapter: chapterId });
  if (opener)
    await updateStudioSession(db, userId, session.id, {
      openersAsked: session.openersAsked + 1,
    });

  return {
    question: result.question,
    move: result.move,
    slot: answeredSlot,
    storyRef: result.story_ref,
    turnId: turn.id,
    chapter: chapterId,
    latencyMs,
  };
}

function isKnownSlot(value: string): value is SlotKey {
  try {
    slotOf(value as SlotKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Facts the applicant's latest answer may contradict, found in code before the model sees it: a
 * known value that no longer appears while a different value for the same shape does. Cheap and
 * conservative — it only has to be good enough to prompt a CONFIRM question.
 */
export async function possibleConflicts(
  userId: string,
  answer: string,
): Promise<{ code: string; key: string; knownValue: string; justSaid: string }[]> {
  const facts = await listFacts(getDb(), userId);
  const numbers = answer.match(/\b\d[\d,.]*\b/g) ?? [];
  if (numbers.length === 0) return [];

  const conflicts: { code: string; key: string; knownValue: string; justSaid: string }[] = [];
  for (const fact of facts) {
    const knownNumber = fact.value.match(/\b\d[\d,.]*\b/)?.[0];
    if (!knownNumber) continue;
    // The answer states a number for something we already have a number for, and it differs.
    const differing = numbers.find((stated) => stated !== knownNumber);
    if (differing === undefined) continue;
    const mentionsSubject = fact.key
      .split("_")
      .filter((part) => part.length > 3)
      .some((part) => answer.toLowerCase().includes(part));
    if (!mentionsSubject) continue;
    conflicts.push({
      code: fact.code,
      key: fact.key,
      knownValue: fact.value,
      justSaid: differing,
    });
    if (conflicts.length === 5) break;
  }
  return conflicts;
}
