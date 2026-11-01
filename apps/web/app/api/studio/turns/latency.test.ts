import { randomUUID } from "node:crypto";
import { createAI, createMemoryLedger } from "@admitstory/ai";
import { createFakeTts, createMemoryTtsCache, type TtsStreamLine } from "@admitstory/voice";
import { afterAll, describe, expect, it, vi } from "vitest";
import { sseResponse, stubFetch } from "../../../../../../packages/ai/test/helpers";
import type { AppUser } from "@/lib/app-user";
import { testUser } from "@/lib/voice/test-support";

// Phase 2 acceptance (§16): question audio starts ≤ 2.0 s after the answer ends, p50. As agreed,
// "the answer ends" is the moment it is submitted (Done, or the 2.5 s auto-end).
//
// What this measures: N voice turns through the real POST /api/studio/turns handler — Zod, the slot
// selector, askNextQuestion and the real ai.run() pipeline (routing, prompt, output validation,
// ledger) — then the real POST /api/tts handler with the fake TTS provider, timed from the submit to
// the first `audio` line of the read-aloud stream.
//
// What it stands in for, with injected latencies taken from the spec's budgets (§7.5, §8.3):
//  - the Anthropic API: the Interviewer's streamed answer arrives after 1.2 s ± 0.3 s;
//  - Postgres: every repository call takes 8 ms (same-region Neon);
//  - the TTS provider: first audio after 150–300 ms.
// No replay fixtures exist for studio.interviewer, so the API is stubbed at the transport rather
// than replayed. Every injected delay is scaled by SCALE to keep the test fast, and the measured
// time is divided by SCALE again — which also multiplies our own code's real CPU time by 1/SCALE,
// so the estimate errs on the slow side. The browser's network hops and audio start-up are not
// here; they are the client's budget.

// Hoisted, because the module mocks below are.
const { SCALE, DB_MS } = vi.hoisted(() => ({ SCALE: 0.1, DB_MS: 8 }));
const TURNS = 15;

/** A deterministic pseudo-random sequence, so the jitter is the same on every run. */
function sequence(seed: number) {
  let value = seed;
  return () => {
    value = (value * 1_103_515_245 + 12_345) % 2 ** 31;
    return value / 2 ** 31;
  };
}
const random = sequence(7);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms * SCALE));

const state = vi.hoisted(() => ({ user: null as unknown as AppUser, turn: 0 }));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: () => {} }));
vi.mock("@/lib/app-user", () => ({ requireOnboardedUser: vi.fn(async () => state.user) }));
vi.mock("@/lib/analytics/server", () => ({ captureServerEvent: vi.fn(async () => {}) }));
vi.mock("@/inngest", () => ({ inngest: { send: vi.fn(async () => {}) } }));
vi.mock("@admitstory/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@admitstory/db")>();
  const query =
    <T>(value: (...args: never[]) => T) =>
    async (...args: never[]) => {
      await new Promise((resolve) => setTimeout(resolve, DB_MS * SCALE));
      return value(...args);
    };
  return {
    ...actual,
    getDb: () => ({}),
    listUserSchools: async () => [],
    getStudioSession: query((_db: unknown, userId: string, id: string) => ({
      id,
      userId,
      mode: "standard",
      currentChapter: "work",
      status: "active",
      openersAsked: 0,
      voiceSeconds: 0,
    })),
    updateStudioSession: query(() => null),
    upsertSlotState: query(() => undefined),
    createSource: query(() => ({ id: randomUUID() })),
    appendStudioTurn: query(() => ({ turn: { id: randomUUID() }, created: true })),
    countUserTurns: query(() => 1),
    getLatestSnapshot: query(() => null),
    recentTurns: query(() => []),
    listFacts: query(() => []),
    listSlotStates: query(() => []),
    listStories: query(() => []),
    addSessionVoiceSeconds: query(() => 10),
    recordVoiceUsage: query(() => undefined),
  };
});

// The app's ai() singleton, built before the route imports it: the real pipeline over a stub API.
const anthropic = stubFetch(async () => {
  await sleep(1_200 + (random() - 0.5) * 600);
  state.turn += 1;
  return sseResponse({
    text: JSON.stringify({
      move: "NEXT",
      question: `What did you do on the night of outage number ${state.turn}?`,
      slot: "work.ownership",
      story_ref: null,
    }),
  });
});
(globalThis as { __admitstoryAI?: unknown }).__admitstoryAI = createAI({
  mode: "live",
  apiKey: "test-key",
  ledger: createMemoryLedger(),
  fetch: anthropic,
});

const turns = await import("./route");
const tts = await import("../../tts/route");
const { setVoiceProviders } = await import("@/lib/voice/server");

setVoiceProviders({
  tts: createFakeTts({
    firstChunkDelayMs: () => (150 + random() * 150) * SCALE,
  }),
  ttsCache: createMemoryTtsCache(),
});
afterAll(() => setVoiceProviders(null));

async function submitToFirstAudio(sessionId: string): Promise<number> {
  const startedAt = performance.now();
  const turn = await turns.POST(
    new Request("http://localhost/api/studio/turns", {
      method: "POST",
      body: JSON.stringify({
        sessionId,
        clientTurnId: randomUUID(),
        text: "We rebuilt the feed overnight and I stayed on the call until it held.",
        inputMode: "voice",
        voiceSeconds: 20,
      }),
    }),
  );
  const { question } = (await turn.json()) as { question: { question: string } };
  const speech = await tts.POST(
    new Request("http://localhost/api/tts", {
      method: "POST",
      body: JSON.stringify({ text: question.question }),
    }),
  );
  const reader = speech.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) throw new Error("The read-aloud stream ended without audio.");
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    if (lines.some((line) => (JSON.parse(line) as TtsStreamLine).type === "audio")) break;
  }
  const elapsed = performance.now() - startedAt;
  await reader.cancel();
  return elapsed / SCALE;
}

describe("Phase 2 acceptance: submit → first question audio", () => {
  it(`is at most 2.0 s at the median over ${TURNS} voice turns`, async () => {
    state.user = testUser();
    const sessionId = randomUUID();
    const samples: number[] = [];
    for (let i = 0; i < TURNS; i++) samples.push(await submitToFirstAudio(sessionId));
    samples.sort((a, b) => a - b);
    const p50 = samples[Math.floor(samples.length / 2)]!;
    console.info(
      `[latency] submit → first audio (modelled ms): p50 ${Math.round(p50)}, max ${Math.round(samples.at(-1)!)}`,
    );
    expect(anthropic.calls).toHaveLength(TURNS);
    expect(p50).toBeLessThanOrEqual(2_000);
  });
});
