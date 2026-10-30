import {
  appendStudioTurn,
  countUserTurns,
  createSource,
  getDb,
  getStudioSession,
  updateStudioSession,
  upsertSlotState,
} from "@admitstory/db";
import { after } from "next/server";
import { z } from "zod";
import { inngest } from "@/inngest";
import { captureServerEvent } from "@/lib/analytics/server";
import { RATE_LIMITS, checkRateLimit, handle, notFound, readJson, requireUser } from "@/lib/api";
import { ai } from "@/lib/ai";
import { extractFromAnswer } from "@/lib/studio/extract";
import { loadKnowledge } from "@/lib/studio/state";
import {
  TURNS_BETWEEN_CONSOLIDATIONS,
  askNextQuestion,
  possibleConflicts,
} from "@/lib/studio/turn";

// POST /api/studio/turns (spec §11, §7.3). The applicant's answer arrives; the answer is stored,
// the Interviewer's next question is returned, and extraction runs afterwards.
//
// Why extraction is not awaited: §8.3 budgets the Extractor 2,000 output tokens, which takes
// seconds, while §16's Phase 1 target is a median turn latency of 1.5 s. The two run in parallel in
// §7.3; here the question is returned as soon as it exists and the Extractor continues in `after()`,
// with the Studio's SSE channel telling the client when new stories land.

const Body = z.object({
  sessionId: z.guid(),
  /** Idempotency (spec §11): resending the same id returns the first result, not a second turn. */
  clientTurnId: z.string().trim().min(1).max(100),
  /** The answer. Empty with `skip`. */
  text: z.string().max(60_000).default(""),
  /** "Skip for now": records the skip so the selector stops offering that slot. */
  skip: z.boolean().default(false),
  /** The slot the question that is being answered was asked for. */
  slot: z.string().max(80).optional(),
  /** Set when the applicant switched chapter before answering. */
  chapter: z
    .enum([
      "roots",
      "education",
      "work",
      "beyond_work",
      "turning_points",
      "people_and_values",
      "goals",
      "schools",
      "recommenders",
    ])
    .optional(),
  /** "I'm short on time": switches the rest of the session to gap-only questioning (§5.2). */
  hurry: z.boolean().default(false),
  /** How many DIG turns the current story has had, tracked by the client across the exchange. */
  digsUsedOnStory: z.number().int().min(0).max(10).default(0),
});

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const { session: auth } = await requireUser();
    const userId = auth.user.id;
    const body = await readJson(request, Body);
    checkRateLimit("studioTurns", userId, RATE_LIMITS.studioTurns);

    const db = getDb();
    const session = await getStudioSession(db, userId, body.sessionId);
    if (!session) notFound("That session");
    if (session.status === "ended") notFound("That session");

    // "I'm short on time" switches the session to Express, which is what hurry mode is (§5.2).
    if (body.hurry && session.mode !== "express")
      await updateStudioSession(db, userId, session.id, { mode: "express" });
    if (body.chapter && body.chapter !== session.currentChapter)
      await updateStudioSession(db, userId, session.id, { currentChapter: body.chapter });

    const answer = body.text.trim();

    if (body.skip || answer === "") {
      if (body.slot) await upsertSlotState(db, userId, { slotKey: body.slot, skipped: true });
      const refreshed = await getStudioSession(db, userId, session.id);
      const next = refreshed ? await askNextQuestion(userId, { session: refreshed }) : null;
      return Response.json({ recorded: false, skipped: true, question: next });
    }

    // The answer is stored before anything else can fail, so it is never lost (§5.2).
    const source = await createSource(db, userId, { kind: "text_turn", text: answer });
    const { turn, created } = await appendStudioTurn(db, userId, {
      sessionId: session.id,
      role: "user",
      sourceId: source.id,
      slot: body.slot ?? null,
      clientTurnId: body.clientTurnId,
    });

    // A retry of a turn already recorded must not ask a second question or extract twice.
    if (!created) return Response.json({ recorded: true, duplicate: true, question: null });

    const [knowledge, conflicts] = await Promise.all([
      loadKnowledge(userId),
      possibleConflicts(userId, answer),
    ]);

    const chapter = body.chapter ?? session.currentChapter;
    const mode = body.hurry ? "express" : session.mode;
    const next = await askNextQuestion(userId, {
      session: { ...session, currentChapter: chapter, mode },
      lastAnswer: answer,
      possibleConflicts: conflicts,
      digsUsedOnStory: body.digsUsedOnStory,
      knowledge,
    });

    const turnCount = await countUserTurns(db, userId, session.id);

    after(async () => {
      try {
        const result = await extractFromAnswer(userId, answer, {
          targetSlot: body.slot ?? null,
          chapter,
          sourceId: source.id,
        });
        for (const story of result.storiesCreated)
          await captureServerEvent({
            distinctId: userId,
            event: "story_detected",
            properties: { chapter, code: story.code },
          });
        // Spec §7.4: the Consolidator runs every ~8 turns, keyed by user.
        if (turnCount > 0 && turnCount % TURNS_BETWEEN_CONSOLIDATIONS === 0)
          await inngest.send({
            name: "dossier/consolidate",
            data: { userId, reason: "turn_count" },
          });
        await ai().flush();
      } catch (error) {
        // A failed extraction must never cost the applicant their answer: the source and the turn
        // are already stored, and the next consolidation picks the material up.
        console.error("[studio] extraction failed", error);
      }
    });

    await captureServerEvent({
      distinctId: userId,
      event: "studio_turn",
      properties: { mode: session.mode, chapter, latency_ms: next?.latencyMs ?? 0 },
    });

    return Response.json({
      recorded: true,
      turnId: turn.id,
      question: next,
    });
  });
}
