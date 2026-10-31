import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppUser } from "@/lib/app-user";
import { testUser } from "@/lib/voice/test-support";

// The Phase 2 additions to POST /api/studio/turns: a dictated answer is stored as a voice_turn with
// its language, its seconds are metered once, and the text path is unchanged.

const state = vi.hoisted(() => ({ user: null as unknown as AppUser, created: true }));
const db = vi.hoisted(() => ({
  createSource: vi.fn(async (_db: unknown, _userId: string, input: Record<string, unknown>) => ({
    id: "00000000-0000-4000-8000-0000000000a1",
    ...input,
  })),
  appendStudioTurn: vi.fn(async () => ({
    turn: { id: "00000000-0000-4000-8000-0000000000b1" },
    created: state.created,
  })),
  addSessionVoiceSeconds: vi.fn(async () => 42),
  recordVoiceUsage: vi.fn(async () => {}),
}));
const extractFromAnswer = vi.hoisted(() =>
  vi.fn(async () => ({
    storiesCreated: [],
    factsCreated: 0,
    conflictsRaised: 0,
    linesCreated: 0,
    sensitiveDisclosure: false,
  })),
);
const afterCallbacks = vi.hoisted(() => [] as (() => Promise<void>)[]);

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({
  after: (callback: () => Promise<void>) => afterCallbacks.push(callback),
}));
vi.mock("@/lib/app-user", () => ({ requireOnboardedUser: vi.fn(async () => state.user) }));
vi.mock("@/lib/analytics/server", () => ({ captureServerEvent: vi.fn(async () => {}) }));
vi.mock("@/inngest", () => ({ inngest: { send: vi.fn(async () => {}) } }));
vi.mock("@/lib/studio/extract", () => ({ extractFromAnswer }));
vi.mock("@/lib/ai", () => ({
  ai: () => ({
    run: vi.fn(async (_task: string, input: { targetSlot: string }) => ({
      move: "NEXT",
      question: "What happened next?",
      slot: input.targetSlot,
      story_ref: null,
    })),
    flush: vi.fn(async () => {}),
  }),
}));
vi.mock("@admitstory/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@admitstory/db")>()),
  getDb: () => ({}),
  getStudioSession: vi.fn(async (_db: unknown, userId: string, id: string) => ({
    id,
    userId,
    mode: "standard",
    currentChapter: "work",
    status: "active",
    openersAsked: 0,
    voiceSeconds: 0,
  })),
  updateStudioSession: vi.fn(async () => null),
  upsertSlotState: vi.fn(async () => {}),
  countUserTurns: vi.fn(async () => 1),
  getLatestSnapshot: vi.fn(async () => null),
  recentTurns: vi.fn(async () => []),
  listFacts: vi.fn(async () => []),
  listSlotStates: vi.fn(async () => []),
  listStories: vi.fn(async () => []),
  ...db,
}));

const { POST } = await import("./route");

const sessionId = randomUUID();
const post = (body: Record<string, unknown>) =>
  POST(
    new Request("http://localhost/api/studio/turns", {
      method: "POST",
      body: JSON.stringify({ sessionId, clientTurnId: randomUUID(), ...body }),
    }),
  );

async function runAfter() {
  for (const callback of afterCallbacks.splice(0)) await callback();
}

beforeEach(() => {
  state.user = testUser();
  state.created = true;
});
afterEach(() => {
  vi.clearAllMocks();
  afterCallbacks.length = 0;
});

describe("POST /api/studio/turns — voice answers (Phase 2)", () => {
  it("stores a dictated answer as a voice_turn and meters its seconds once", async () => {
    const response = await post({
      text: "We rebuilt the feed overnight.",
      inputMode: "voice",
      voiceSeconds: 41.6,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      recorded: true,
      question: { question: "What happened next?" },
    });

    expect(db.createSource).toHaveBeenCalledWith({}, state.user.session.user.id, {
      kind: "voice_turn",
      text: "We rebuilt the feed overnight.",
      language: "en",
    });
    expect(db.addSessionVoiceSeconds).toHaveBeenCalledWith(
      {},
      state.user.session.user.id,
      sessionId,
      41.6,
    );
    expect(db.recordVoiceUsage).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        task: "voice.stt",
        sttSeconds: 41.6,
        userId: state.user.session.user.id,
      }),
    );
  });

  it("clamps an implausible duration to half an hour", async () => {
    await post({ text: "Hello.", inputMode: "voice", voiceSeconds: 99_999 });
    expect(db.addSessionVoiceSeconds).toHaveBeenCalledWith(
      {},
      expect.any(String),
      sessionId,
      1_800,
    );
    expect((await post({ text: "Hello.", inputMode: "voice", voiceSeconds: -3 })).status).toBe(400);
  });

  it("does not meter a retried turn twice", async () => {
    state.created = false;
    expect(
      await (await post({ text: "Again.", inputMode: "voice", voiceSeconds: 10 })).json(),
    ).toMatchObject({
      duplicate: true,
    });
    expect(db.addSessionVoiceSeconds).not.toHaveBeenCalled();
    expect(db.recordVoiceUsage).not.toHaveBeenCalled();
  });

  it("keeps a non-English answer's language on the source and hands it to the Extractor (§7.5)", async () => {
    await post({
      text: "मैंने पूरी रात काम किया।",
      inputMode: "voice",
      voiceSeconds: 5,
      language: "hi",
    });
    expect(db.createSource).toHaveBeenCalledWith(
      {},
      expect.any(String),
      expect.objectContaining({ language: "hi" }),
    );
    await runAfter();
    expect(extractFromAnswer).toHaveBeenCalledWith(
      state.user.session.user.id,
      "मैंने पूरी रात काम किया।",
      expect.objectContaining({ language: "hi" }),
    );
  });

  it("falls back to the applicant's chosen speech language when Deepgram reports none", async () => {
    state.user = testUser({ profile: { speechLanguage: "es" } });
    await post({ text: "Trabajé toda la noche.", inputMode: "voice", voiceSeconds: 3 });
    expect(db.createSource).toHaveBeenCalledWith(
      {},
      expect.any(String),
      expect.objectContaining({ language: "es" }),
    );
  });

  it("leaves the text path unchanged: text_turn, no language, no metering", async () => {
    await post({ text: "Typed answer.", voiceSeconds: 30 });
    expect(db.createSource).toHaveBeenCalledWith({}, expect.any(String), {
      kind: "text_turn",
      text: "Typed answer.",
      language: null,
    });
    expect(db.addSessionVoiceSeconds).not.toHaveBeenCalled();
    expect(db.recordVoiceUsage).not.toHaveBeenCalled();
    await runAfter();
    expect(extractFromAnswer).toHaveBeenCalledWith(
      expect.any(String),
      "Typed answer.",
      expect.objectContaining({ language: null }),
    );
  });

  it("rejects a malformed language tag", async () => {
    expect((await post({ text: "Hi.", inputMode: "voice", language: "not a tag!" })).status).toBe(
      400,
    );
  });
});
