import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppUser } from "@/lib/app-user";
import { testUser } from "@/lib/voice/test-support";

const state = vi.hoisted(() => ({ user: null as unknown as AppUser }));
const db = vi.hoisted(() => ({
  updateVoiceSettings: vi.fn(
    async (_db: unknown, _userId: string, patch: Record<string, unknown>) => ({
      readAloud: true,
      speechLanguage: "en",
      ttsVoice: "warm",
      ttsSpeed: 1,
      ...patch,
    }),
  ),
  saveVoiceprint: vi.fn(async () => true),
  getProfile: vi.fn(async () => ({ voiceprint: { source: "voice" } })),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/app-user", () => ({ requireOnboardedUser: vi.fn(async () => state.user) }));
vi.mock("@admitstory/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@admitstory/db")>()),
  getDb: () => ({}),
  ...db,
}));

const voice = await import("./route");
const voiceprint = await import("../voiceprint/route");

const request = (method: string, body: unknown) =>
  new Request("http://localhost/api/profile", { method, body: JSON.stringify(body) });

afterEach(() => vi.clearAllMocks());

describe("GET/PATCH /api/profile/voice", () => {
  it("returns the contract's settings, with unknown stored values read as the defaults", async () => {
    state.user = testUser({
      profile: { readAloud: false, speechLanguage: "klingon", ttsVoice: "clear", ttsSpeed: 1.15 },
    });
    expect(await (await voice.GET()).json()).toEqual({
      readAloud: false,
      speechLanguage: "en",
      ttsVoice: "clear",
      ttsSpeed: 1.15,
    });
  });

  it("saves a valid partial patch", async () => {
    state.user = testUser();
    const response = await voice.PATCH(
      request("PATCH", { speechLanguage: "multi", ttsSpeed: 0.85 }),
    );
    expect(response.status).toBe(200);
    expect(db.updateVoiceSettings).toHaveBeenCalledWith({}, state.user.session.user.id, {
      speechLanguage: "multi",
      ttsSpeed: 0.85,
    });
    expect(await response.json()).toMatchObject({ speechLanguage: "multi", ttsSpeed: 0.85 });
  });

  it.each([
    [{ speechLanguage: "xx" }],
    [{ ttsVoice: "robot" }],
    [{ ttsSpeed: 1.5 }],
    [{ readAloud: "yes" }],
    [{ keepAudio: true }],
    [{}],
  ])("rejects %j", async (body) => {
    state.user = testUser();
    expect((await voice.PATCH(request("PATCH", body))).status).toBe(400);
    expect(db.updateVoiceSettings).not.toHaveBeenCalled();
  });
});

describe("PUT /api/profile/voiceprint", () => {
  const identity = {
    version: 1,
    avgPitchHz: 180,
    paceWpm: 150,
    pitchRangeSemitones: 8,
    pauseRhythm: 0.3,
    source: "voice",
  };

  it("stores a speech-derived identity", async () => {
    state.user = testUser();
    const response = await voiceprint.PUT(request("PUT", identity));
    expect(response.status).toBe(200);
    expect(db.saveVoiceprint).toHaveBeenCalledWith({}, state.user.session.user.id, identity);
    expect(await response.json()).toMatchObject({ saved: true });
  });

  it.each([
    [{ ...identity, source: "text" }],
    [{ ...identity, avgPitchHz: 5_000 }],
    [{ ...identity, pauseRhythm: 2 }],
    [{ ...identity, audio: "base64…" }],
  ])("rejects anything but derived numbers from speech: %j", async (body) => {
    state.user = testUser();
    expect((await voiceprint.PUT(request("PUT", body))).status).toBe(400);
    expect(db.saveVoiceprint).not.toHaveBeenCalled();
  });
});
