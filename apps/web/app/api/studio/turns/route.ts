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
import { LanguageTag, MAX_VOICE_SECONDS_PER_ANSWER } from "@/lib/voice/schemas";
import { meterDictation, voiceSettingsOf } from "@/lib/voice/server";
import {
  answersLeft,
  studioAllowance,
  studioLimitError,
  studioLimitReached,
} from "@/lib/studio/allowance";
import { extractFromAnswer } from "@/lib/studio/extract";
import { createStringStreamer } from "@/lib/studio/partial-json";
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
  /** Phase 2 (VoiceTurnFields): a dictated answer, its seconds of audio and its language. */
  inputMode: z.enum(["voice", "text"]).default("text"),
  voiceSeconds: z
    .number()
    .finite()
    .min(0)
    .transform((seconds) => Math.min(seconds, MAX_VOICE_SECONDS_PER_ANSWER))
    .optional(),
  language: LanguageTag.optional(),
  /** Answer as an NDJSON stream: saved, the reply as it is written, then done. */
  stream: z.boolean().default(false),
});

/**
 * The language a dictated answer was in (§7.5): what Deepgram reported, else the language the
 * applicant speaks in when they chose a single one, else English. Text answers record none.
 */
function answerLanguage(
  body: { inputMode: "voice" | "text"; language?: string | undefined },
  speechLanguage: string,
): string | null {
  if (body.inputMode !== "voice") return null;
  if (body.language) return body.language;
  return speechLanguage === "multi" ? "en" : speechLanguage;
}

type TurnEvent =
  | { type: "saved"; turnId: string }
  | { type: "delta"; text: string }
  | { type: "done"; [key: string]: unknown }
  | { type: "error"; error: string };

/**
 * An NDJSON response the turn writes into. Everything before it (auth, the allowance, storing the
 * answer) has already succeeded, so a failure in here is reported as an "error" line: the answer
 * is saved either way, and the client says so.
 */
function streamTurn(work: (emit: (event: TurnEvent) => void) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const emit = (event: TurnEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          open = false;
        }
      };
      try {
        await work(emit);
      } catch (error) {
        console.error("[studio] turn failed after the answer was saved", error);
        emit({ type: "error", error: "Your answer is saved, but the next question didn't come." });
      } finally {
        open = false;
        try {
          controller.close();
        } catch {
          // The client went away.
        }
      }
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const { session: auth, profile } = await requireUser();
    const userId = auth.user.id;
    const body = await readJson(request, Body);
    await checkRateLimit("studioTurns", userId, RATE_LIMITS.studioTurns);

    const db = getDb();
    // The free half of the Studio (lib/studio/allowance.ts), read alongside the session so it
    // adds no round trip. Checked before the answer is stored, so a refused answer stays in the
    // composer rather than being half-recorded.
    const [session, allowance] = await Promise.all([
      getStudioSession(db, userId, body.sessionId),
      studioAllowance(userId),
    ]);
    if (!session) notFound("That session");
    if (session.status === "ended") notFound("That session");
    if (studioLimitReached(allowance)) throw studioLimitError(allowance);

    // "I'm short on time" switches the session to Express, which is what hurry mode is (§5.2).
    const sessionPatch = {
      ...(body.hurry && session.mode !== "express" ? { mode: "express" as const } : {}),
      ...(body.chapter && body.chapter !== session.currentChapter
        ? { currentChapter: body.chapter }
        : {}),
    };
    if (Object.keys(sessionPatch).length > 0)
      await updateStudioSession(db, userId, session.id, sessionPatch);

    const answer = body.text.trim();

    if (body.skip || answer === "") {
      if (body.slot) await upsertSlotState(db, userId, { slotKey: body.slot, skipped: true });
      const refreshed = await getStudioSession(db, userId, session.id);
      const ask = (onText?: (delta: string) => void) =>
        refreshed
          ? askNextQuestion(userId, { session: refreshed, ...(onText ? { onText } : {}) })
          : Promise.resolve(null);
      if (!body.stream) {
        const next = await ask();
        after(() => ai().flush());
        return Response.json({ recorded: false, skipped: true, question: next });
      }
      let skipDone: () => void = () => {};
      const skipped = new Promise<void>((resolve) => {
        skipDone = resolve;
      });
      after(async () => {
        await skipped;
        await ai().flush();
      });
      return streamTurn(async (emit) => {
        try {
          const next = await ask(
            createStringStreamer("question", (text) => emit({ type: "delta", text })),
          );
          emit({ type: "done", skipped: true, question: next });
        } finally {
          skipDone();
        }
      });
    }

    // The answer is stored before anything else can fail, so it is never lost (§5.2).
    const voice = body.inputMode === "voice";
    const language = answerLanguage(body, voiceSettingsOf(profile).speechLanguage);
    const source = await createSource(db, userId, {
      kind: voice ? "voice_turn" : "text_turn",
      text: answer,
      language,
    });
    const { turn, created } = await appendStudioTurn(db, userId, {
      sessionId: session.id,
      role: "user",
      sourceId: source.id,
      slot: body.slot ?? null,
      clientTurnId: body.clientTurnId,
    });

    // A retry of a turn already recorded must not ask a second question or extract twice.
    if (!created) return Response.json({ recorded: true, duplicate: true, question: null });

    // Extraction starts now, alongside the next question rather than after it (§7.3 runs the two
    // in parallel), and the response waits for neither: `after()` keeps it alive.
    const chapter = body.chapter ?? session.currentChapter;
    const extraction = (async () => {
      try {
        const result = await extractFromAnswer(userId, answer, {
          targetSlot: body.slot ?? null,
          chapter,
          sourceId: source.id,
          language,
        });
        for (const story of result.storiesCreated)
          await captureServerEvent({
            distinctId: userId,
            event: "story_detected",
            properties: { chapter, code: story.code },
          });
      } catch (error) {
        // A failed extraction must never cost the applicant their answer: the source and the turn
        // are already stored, and the next consolidation picks the material up.
        console.error("[studio] extraction failed", error);
      }
    })();

    // This answer was the last free one: it is stored and extracted, but no next question is
    // asked, since it couldn't be answered.
    const spent = { ...allowance, used: allowance.used + 1 };
    const left = answersLeft(spent);
    const mode = body.hurry ? "express" : session.mode;

    const nextQuestion = async (onText?: (delta: string) => void) => {
      if (left === 0) return null;
      // Dictation is metered once per recorded turn (a retry returned above), alongside the reads
      // the next question needs, so it adds no latency.
      const [knowledge, conflicts] = await Promise.all([
        loadKnowledge(userId),
        possibleConflicts(userId, answer),
        voice && body.voiceSeconds ? meterDictation(userId, session.id, body.voiceSeconds) : null,
      ]);
      return askNextQuestion(userId, {
        session: { ...session, currentChapter: chapter, mode },
        lastAnswer: answer,
        possibleConflicts: conflicts,
        digsUsedOnStory: body.digsUsedOnStory,
        knowledge,
        ...(onText ? { onText } : {}),
      });
    };

    // Registered now, inside the request, and run once the reply is out: it waits for the question
    // (for its latency) and for the extraction.
    let questionAsked: (next: Awaited<ReturnType<typeof nextQuestion>>) => void = () => {};
    const asked = new Promise<Awaited<ReturnType<typeof nextQuestion>>>((resolve) => {
      questionAsked = resolve;
    });
    after(async () => {
      const next = await asked;
      await extraction;
      try {
        await captureServerEvent({
          distinctId: userId,
          event: "studio_turn",
          properties: {
            mode: session.mode,
            chapter,
            latency_ms: next?.latencyMs ?? 0,
            input_mode: body.inputMode,
          },
        });
        // Spec §7.4: the Consolidator runs every ~8 turns, keyed by user.
        const turnCount = await countUserTurns(db, userId, session.id);
        if (turnCount > 0 && turnCount % TURNS_BETWEEN_CONSOLIDATIONS === 0)
          await inngest.send({
            name: "dossier/consolidate",
            data: { userId, reason: "turn_count" },
          });
        await ai().flush();
      } catch (error) {
        console.error("[studio] after-turn work failed", error);
      }
    });

    const allowanceOut = { used: spent.used, limit: spent.limit, left };

    if (!body.stream) {
      const next = await nextQuestion().catch((error: unknown) => {
        questionAsked(null);
        throw error;
      });
      questionAsked(next);
      return Response.json({
        recorded: true,
        turnId: turn.id,
        question: next,
        allowance: allowanceOut,
      });
    }

    // Streamed (NDJSON): "saved" at once, the reply's words as they are written, then "done".
    return streamTurn(async (emit) => {
      emit({ type: "saved", turnId: turn.id });
      const next = await nextQuestion(
        createStringStreamer("question", (text) => emit({ type: "delta", text })),
      ).catch((error: unknown) => {
        questionAsked(null);
        throw error;
      });
      questionAsked(next);
      emit({ type: "done", turnId: turn.id, question: next, allowance: allowanceOut });
    });
  });
}
