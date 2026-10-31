import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppUser } from "@/lib/app-user";
import { testUser } from "@/lib/voice/test-support";

// The Phase 2 addition to POST /api/dossier/stories/:id/add-detail: a dictated detail keeps its
// language and its seconds come out of the free voice minutes, like a Studio answer; a typed one
// is unchanged.

const state = vi.hoisted(() => ({
  user: null as unknown as AppUser,
  latestSession: "00000000-0000-4000-8000-0000000000c1" as string | null,
}));
const db = vi.hoisted(() => ({
  createSource: vi.fn(async (_db: unknown, _userId: string, input: Record<string, unknown>) => ({
    id: "00000000-0000-4000-8000-0000000000a1",
    ...input,
  })),
  getStory: vi.fn(async (_db: unknown, userId: string, id: string) => ({
    id,
    userId,
    slotKeys: ["work.impact"],
    chapter: "work",
  })),
  updateStory: vi.fn(async () => null),
  latestStudioSessionId: vi.fn(async () => state.latestSession),
  addSessionVoiceSeconds: vi.fn(async () => 42),
  recordVoiceUsage: vi.fn(async () => {}),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: () => {} }));
vi.mock("@/lib/app-user", () => ({ requireOnboardedUser: vi.fn(async () => state.user) }));
vi.mock("@/inngest", () => ({
  inngest: { send: vi.fn(async () => {}) },
  dossierConsolidate: { create: vi.fn(() => ({})) },
}));
vi.mock("@/lib/studio/extract", () => ({ extractFromAnswer: vi.fn(async () => ({})) }));
vi.mock("@/lib/ai", () => ({ ai: () => ({ flush: vi.fn(async () => {}) }) }));
vi.mock("@admitstory/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@admitstory/db")>()),
  getDb: () => ({}),
  ...db,
}));

const { POST } = await import("./route");

const storyId = randomUUID();
const post = (body: Record<string, unknown>) =>
  POST(
    new Request(`http://localhost/api/dossier/stories/${storyId}/add-detail`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: storyId }) },
  );

beforeEach(() => {
  state.user = testUser();
  state.latestSession = "00000000-0000-4000-8000-0000000000c1";
});
afterEach(() => vi.clearAllMocks());

describe("POST /api/dossier/stories/:id/add-detail — dictation (Phase 2)", () => {
  it("meters a dictated detail on the latest Studio session and in the ledger", async () => {
    const response = await post({
      text: "About forty people came.",
      inputMode: "voice",
      voiceSeconds: 7.5,
    });
    expect(response.status).toBe(200);
    const userId = state.user.session.user.id;
    expect(db.createSource).toHaveBeenCalledWith({}, userId, {
      kind: "need_answer",
      text: "About forty people came.",
      language: "en",
    });
    expect(db.addSessionVoiceSeconds).toHaveBeenCalledWith({}, userId, state.latestSession, 7.5);
    expect(db.recordVoiceUsage).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ task: "voice.stt", sttSeconds: 7.5, userId }),
    );
  });

  it("keeps the language Deepgram reported", async () => {
    await post({ text: "करीब चालीस लोग आए।", inputMode: "voice", voiceSeconds: 3, language: "hi" });
    expect(db.createSource).toHaveBeenCalledWith(
      {},
      expect.any(String),
      expect.objectContaining({ language: "hi" }),
    );
  });

  it("still records the cost when there is no Studio session to count it on", async () => {
    state.latestSession = null;
    await post({ text: "About forty.", inputMode: "voice", voiceSeconds: 2 });
    expect(db.addSessionVoiceSeconds).not.toHaveBeenCalled();
    expect(db.recordVoiceUsage).toHaveBeenCalledOnce();
  });

  it("leaves a typed detail as it was: no language, nothing metered", async () => {
    const response = await post({ text: "About forty people came." });
    expect(response.status).toBe(200);
    expect(db.createSource).toHaveBeenCalledWith({}, expect.any(String), {
      kind: "need_answer",
      text: "About forty people came.",
      language: null,
    });
    expect(db.latestStudioSessionId).not.toHaveBeenCalled();
    expect(db.recordVoiceUsage).not.toHaveBeenCalled();
  });

  it("refuses a negative duration", async () => {
    const response = await post({ text: "Hi.", inputMode: "voice", voiceSeconds: -1 });
    expect(response.status).toBe(400);
  });
});
