import {
  TTS_SAMPLE_RATE,
  createMemoryTtsCache,
  type TTSProvider,
  type TtsStreamLine,
} from "@admitstory/voice";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppUser } from "@/lib/app-user";
import { ndjson, testUser } from "@/lib/voice/test-support";

const state = vi.hoisted(() => ({ user: null as unknown as AppUser }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/app-user", () => ({ requireOnboardedUser: vi.fn(async () => state.user) }));
const recordVoiceUsage = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@admitstory/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@admitstory/db")>()),
  getDb: () => ({}),
  recordVoiceUsage,
}));

const { POST } = await import("./route");
const { setVoiceProviders } = await import("@/lib/voice/server");

/** A provider that records what it was asked for and answers with two audio chunks and words. */
function recordingProvider(): TTSProvider & {
  inputs: unknown[];
  signals: (AbortSignal | undefined)[];
} {
  const provider = {
    name: "cartesia" as const,
    inputs: [] as unknown[],
    signals: [] as (AbortSignal | undefined)[],
    async *synthesize(input: unknown, signal?: AbortSignal) {
      provider.inputs.push(input);
      provider.signals.push(signal);
      yield {
        pcm: Uint8Array.from([1, 0, 2, 0]),
        words: [{ word: "Why", startMs: 0, endMs: 200 }],
      };
      yield { pcm: Uint8Array.from([3, 0]) };
    },
  };
  return provider;
}

const post = (body: unknown, init: RequestInit = {}) =>
  POST(
    new Request("http://localhost/api/tts", {
      method: "POST",
      body: JSON.stringify(body),
      ...init,
    }),
  );

let provider: ReturnType<typeof recordingProvider>;

beforeEach(() => {
  state.user = testUser({ profile: { ttsVoice: "low", ttsSpeed: 1.15 } });
  provider = recordingProvider();
  setVoiceProviders({ tts: provider, ttsCache: createMemoryTtsCache() });
  recordVoiceUsage.mockClear();
});
afterEach(() => setVoiceProviders(null));

describe("POST /api/tts", () => {
  it("streams NDJSON lines in contract order with the profile's voice and speed", async () => {
    const response = await post({ text: "Why that team?" });
    expect(response.headers.get("Content-Type")).toContain("application/x-ndjson");
    const lines = await ndjson<TtsStreamLine>(response);
    expect(lines.map((l) => l.type)).toEqual(["start", "audio", "words", "audio", "end"]);
    expect(lines[0]).toEqual({
      type: "start",
      sampleRate: TTS_SAMPLE_RATE,
      cached: false,
      voice: "low",
    });
    expect(lines.at(-1)).toEqual({ type: "end", chars: "Why that team?".length });
    expect(provider.inputs[0]).toEqual({ text: "Why that team?", voice: "low", speed: 1.15 });
  });

  it("lets the request override voice and speed", async () => {
    await (await post({ text: "Go on.", voice: "clear", speed: 0.85 })).text();
    expect(provider.inputs[0]).toEqual({ text: "Go on.", voice: "clear", speed: 0.85 });
  });

  it("serves a repeat from the cache without calling the provider, and meters only the miss", async () => {
    const first = await ndjson<TtsStreamLine>(await post({ text: "Same question?" }));
    const second = await ndjson<TtsStreamLine>(await post({ text: "Same question?" }));
    expect(provider.inputs).toHaveLength(1);
    expect(second[0]).toMatchObject({ type: "start", cached: true });
    expect(second.slice(1)).toEqual(first.slice(1));
    expect(recordVoiceUsage).toHaveBeenCalledOnce();
    expect(recordVoiceUsage).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        task: "voice.tts",
        model: "cartesia",
        ttsChars: "Same question?".length,
        userId: state.user.session.user.id,
      }),
    );
  });

  it("validates the body: text required and capped, voice and speed from the contract", async () => {
    expect((await post({ text: "" })).status).toBe(400);
    expect((await post({ text: "x".repeat(601) })).status).toBe(400);
    expect((await post({ text: "Hi", voice: "robot" })).status).toBe(400);
    expect((await post({ text: "Hi", speed: 2 })).status).toBe(400);
    expect(provider.inputs).toHaveLength(0);
  });

  it("requires a verified email", async () => {
    state.user = testUser({ emailVerified: false });
    expect((await post({ text: "Hi" })).status).toBe(403);
  });

  it("allows 60 requests a minute (§12.4)", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 61; i++) {
      const response = await post({ text: `Question ${i}?` });
      statuses.push(response.status);
      await response.body?.cancel();
    }
    expect(statuses.slice(0, 60).every((s) => s === 200)).toBe(true);
    expect(statuses[60]).toBe(429);
  });

  it("aborts the provider when the client disconnects", async () => {
    const client = new AbortController();
    const response = await post({ text: "Leaving early?" }, { signal: client.signal });
    const reader = response.body!.getReader();
    await reader.read(); // start
    await reader.read(); // the first audio: the provider is now mid-stream
    client.abort();
    await reader.cancel();
    expect(provider.signals[0]?.aborted).toBe(true);
  });
});
