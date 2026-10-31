import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PROVIDER_VOICES } from "../src/config";
import {
  TTS_SAMPLE_RATE,
  type TTSProvider,
  type TtsChunk,
  type TtsStreamLine,
} from "../src/contract";
import { parseVoiceEnv } from "../src/env";
import { ttsCostUsd, ttsLedgerEntry, sttLedgerEntry } from "../src/pricing";
import { createMemoryTtsCache, ttsCacheKey } from "../src/tts/cache";
import { createCartesiaTts } from "../src/tts/cartesia";
import { createElevenLabsTts, createWordAssembler } from "../src/tts/elevenlabs";
import { createFakeTts, estimateWordTimings } from "../src/tts/fake";
import { selectTtsProvider } from "../src/tts/select";
import { ttsLines } from "../src/tts/stream";

const input = {
  text: "Tell me about the night the feed went down.",
  voice: "warm" as const,
  speed: 1 as const,
};

/** A response body delivered in awkward pieces, to prove parsers keep partial lines. */
function chunkedBody(text: string, size = 7): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  let at = 0;
  return new ReadableStream({
    pull(controller) {
      if (at >= bytes.length) return controller.close();
      controller.enqueue(bytes.slice(at, at + size));
      at += size;
    },
  });
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of iterable) out.push(item);
  return out;
}

const pcm = (bytes: number[]) => Buffer.from(Uint8Array.from(bytes)).toString("base64");

beforeEach(() => {
  PROVIDER_VOICES.cartesia.warm = "cartesia-warm-id";
  PROVIDER_VOICES.elevenlabs.warm = "eleven-warm-id";
});
afterEach(() => {
  PROVIDER_VOICES.cartesia.warm = "";
  PROVIDER_VOICES.elevenlabs.warm = "";
});

describe("Cartesia adapter", () => {
  it("requests raw 16-bit PCM at the TTS rate with timestamps, and parses chunk and timestamp events", async () => {
    const sse = [
      `data: ${JSON.stringify({ type: "chunk", data: pcm([1, 0, 2, 0]) })}`,
      "",
      `data: ${JSON.stringify({ type: "timestamps", word_timestamps: { words: ["Tell", "me"], start: [0, 0.25], end: [0.2, 0.4] } })}`,
      "",
      `data: ${JSON.stringify({ type: "done", done: true })}`,
      "",
      "",
    ].join("\n");
    const fetch = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) => new Response(chunkedBody(sse)),
    );
    const chunks = await collect(
      createCartesiaTts({ apiKey: "ck", fetch }).synthesize({ ...input, speed: 1.15 }),
    );

    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://api.cartesia.ai/tts/sse");
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer ck");
    expect(headers.get("Cartesia-Version")).toBeTruthy();
    expect(JSON.parse(String(init?.body))).toMatchObject({
      transcript: input.text,
      voice: { id: "cartesia-warm-id" },
      output_format: { container: "raw", encoding: "pcm_s16le", sample_rate: TTS_SAMPLE_RATE },
      add_timestamps: true,
      generation_config: { speed: 1.15 },
    });
    expect(chunks).toEqual([
      { pcm: Uint8Array.from([1, 0, 2, 0]) },
      {
        words: [
          { word: "Tell", startMs: 0, endMs: 200 },
          { word: "me", startMs: 250, endMs: 400 },
        ],
      },
    ]);
  });

  it("surfaces an error event and a failed request", async () => {
    const errorSse = `data: ${JSON.stringify({ type: "error", message: "bad", status_code: 400 })}\n\n`;
    const failing = createCartesiaTts({
      apiKey: "k",
      fetch: vi.fn(async () => new Response(errorSse)),
    });
    await expect(collect(failing.synthesize(input))).rejects.toThrow(/Cartesia TTS error/);
    const down = createCartesiaTts({
      apiKey: "k",
      fetch: vi.fn(async () => new Response("", { status: 500 })),
    });
    await expect(collect(down.synthesize(input))).rejects.toThrow("Cartesia TTS failed (500).");
  });

  it("refuses a voice nobody has mapped, pointing at the config", async () => {
    PROVIDER_VOICES.cartesia.warm = "";
    const tts = createCartesiaTts({ apiKey: "k", fetch: vi.fn() });
    await expect(collect(tts.synthesize(input))).rejects.toThrow(/PROVIDER_VOICES/);
  });
});

describe("ElevenLabs adapter", () => {
  const alignment = (chars: string, start: number, step = 0.1) => ({
    characters: [...chars],
    character_start_times_seconds: [...chars].map((_, i) => start + i * step),
    character_end_times_seconds: [...chars].map((_, i) => start + (i + 1) * step),
  });

  it("requests pcm_24000 with speed, and assembles words from character alignment across lines", async () => {
    const lines = [
      JSON.stringify({ audio_base64: pcm([1, 0, 2, 0]), alignment: alignment("Tell m", 0) }),
      JSON.stringify({ audio_base64: pcm([3, 0]), alignment: alignment("e now", 0.6) }),
    ].join("\n");
    const fetch = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) =>
        new Response(chunkedBody(lines, 11)),
    );
    const chunks = await collect(
      createElevenLabsTts({ apiKey: "ek", fetch }).synthesize({ ...input, speed: 0.85 }),
    );

    const [url, init] = fetch.mock.calls[0]!;
    expect(String(url)).toBe(
      "https://api.elevenlabs.io/v1/text-to-speech/eleven-warm-id/stream/with-timestamps?output_format=pcm_24000",
    );
    expect(new Headers(init?.headers).get("xi-api-key")).toBe("ek");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      text: input.text,
      voice_settings: { speed: 0.85 },
    });

    const words = chunks.flatMap((chunk) => chunk.words ?? []);
    expect(words.map((w) => w.word)).toEqual(["Tell", "me", "now"]);
    expect(words[1]).toEqual({ word: "me", startMs: 500, endMs: 700 });
    expect(chunks.filter((c) => c.pcm).map((c) => [...c.pcm!])).toEqual([
      [1, 0, 2, 0],
      [3, 0],
    ]);
  });

  it("offsets chunk-relative timings by the audio already received", () => {
    const words = createWordAssembler();
    words.push(alignment("One ", 0), 0);
    const second = [...words.push(alignment("two ", 0), 1000), ...words.flush()];
    expect(second[0]).toEqual({ word: "two", startMs: 1000, endMs: 1300 });
  });
});

describe("fake TTS", () => {
  it("is deterministic PCM with estimated word timings after a first-chunk delay", async () => {
    const sleep = vi.fn(async () => {});
    const tts = createFakeTts({ firstChunkDelayMs: 180, sleep });
    const first = await collect(tts.synthesize(input));
    const second = await collect(tts.synthesize(input));
    expect(sleep).toHaveBeenCalledWith(180, undefined);
    expect(first).toEqual(second);
    const words = first.flatMap((c: TtsChunk) => c.words ?? []);
    expect(words.map((w) => w.word)).toEqual(input.text.split(" "));
    const bytes = first.reduce((sum, c) => sum + (c.pcm?.byteLength ?? 0), 0);
    expect(bytes % 2).toBe(0);
    // About as long as the words take to say.
    expect((bytes / 2 / TTS_SAMPLE_RATE) * 1000).toBeGreaterThan(words.at(-1)!.endMs);
  });

  it("speaks faster at a higher speed", () => {
    const slow = estimateWordTimings(input.text, { speed: 0.85 }).at(-1)!.endMs;
    const fast = estimateWordTimings(input.text, { speed: 1.15 }).at(-1)!.endMs;
    expect(fast).toBeLessThan(slow);
  });

  it("is selected when the configured provider has no key", () => {
    expect(selectTtsProvider(parseVoiceEnv({ TTS_PROVIDER: "cartesia" })).name).toBe("fake");
    expect(selectTtsProvider(parseVoiceEnv({ CARTESIA_API_KEY: "k" })).name).toBe("cartesia");
    expect(
      selectTtsProvider(parseVoiceEnv({ TTS_PROVIDER: "elevenlabs", ELEVENLABS_API_KEY: "k" }))
        .name,
    ).toBe("elevenlabs");
    expect(
      selectTtsProvider(parseVoiceEnv({ TTS_PROVIDER: "elevenlabs", CARTESIA_API_KEY: "k" })).name,
    ).toBe("fake");
  });
});

describe("TTS cache (§7.5: by text + voice, 24 h)", () => {
  const lines = (n: number): TtsStreamLine[] => [{ type: "audio", pcm: "A".repeat(n) }];

  it("keys by provider, voice, speed and text", () => {
    const key = ttsCacheKey("fake", input);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(ttsCacheKey("fake", { ...input, voice: "low" })).not.toBe(key);
    expect(ttsCacheKey("fake", { ...input, speed: 1.15 })).not.toBe(key);
    expect(ttsCacheKey("cartesia", input)).not.toBe(key);
  });

  it("returns a stored entry until its TTL passes", () => {
    let now = 0;
    const cache = createMemoryTtsCache({ ttlSeconds: 10, now: () => now });
    cache.set("k", lines(4));
    expect(cache.get("k")).toEqual(lines(4));
    now = 9_999;
    expect(cache.get("k")).toBeDefined();
    now = 10_000;
    expect(cache.get("k")).toBeUndefined();
    expect(cache.bytes).toBe(0);
  });

  it("stays within its byte bound, evicting the least recently used", () => {
    const cache = createMemoryTtsCache({ maxBytes: 300 });
    cache.set("a", lines(100));
    cache.set("b", lines(100));
    cache.get("a");
    cache.set("c", lines(100));
    cache.set("d", lines(100));
    expect(cache.bytes).toBeLessThanOrEqual(300);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBeDefined();
    cache.set("huge", lines(1_000));
    expect(cache.get("huge")).toBeUndefined();
  });
});

describe("ttsLines (the /api/tts stream)", () => {
  function scripted(chunks: TtsChunk[]): TTSProvider & { calls: number } {
    const provider = {
      name: "fake" as const,
      calls: 0,
      async *synthesize() {
        provider.calls++;
        yield* chunks;
      },
    };
    return provider;
  }

  it("sends start, audio and words in arrival order, then end; a hit replays without the provider", async () => {
    const provider = scripted([
      { pcm: Uint8Array.from([1, 0]), words: [{ word: "Tell", startMs: 0, endMs: 200 }] },
      { pcm: Uint8Array.from([2, 0]) },
    ]);
    const cache = createMemoryTtsCache();
    const onSynthesized = vi.fn();
    const first = await collect(ttsLines(input, { provider, cache, onSynthesized }));
    expect(first.map((l) => l.type)).toEqual(["start", "audio", "words", "audio", "end"]);
    expect(first[0]).toEqual({
      type: "start",
      sampleRate: TTS_SAMPLE_RATE,
      cached: false,
      voice: "warm",
    });
    expect(first.at(-1)).toEqual({ type: "end", chars: input.text.length });
    expect(onSynthesized).toHaveBeenCalledWith({
      chars: input.text.length,
      latencyMs: expect.any(Number),
    });

    const second = await collect(ttsLines(input, { provider, cache, onSynthesized }));
    expect(provider.calls).toBe(1);
    expect(onSynthesized).toHaveBeenCalledOnce();
    expect(second[0]).toMatchObject({ type: "start", cached: true });
    expect(second.slice(1)).toEqual(first.slice(1));
  });

  it("never splits a 16-bit sample across audio lines", async () => {
    const provider = scripted([
      { pcm: Uint8Array.from([1, 0, 2]) },
      { pcm: Uint8Array.from([0, 3, 0]) },
    ]);
    const lines = await collect(ttsLines(input, { provider }));
    const audio = lines
      .filter((l) => l.type === "audio")
      .map((l) => [...Buffer.from(l.pcm, "base64")]);
    expect(audio).toEqual([
      [1, 0],
      [2, 0, 3, 0],
    ]);
  });

  it("turns a provider failure into an error line and caches nothing", async () => {
    const provider: TTSProvider = {
      name: "fake",
      async *synthesize() {
        throw new Error("boom");
      },
    };
    vi.spyOn(console, "error").mockImplementation(() => {});
    const cache = createMemoryTtsCache();
    const onSynthesized = vi.fn();
    const lines = await collect(ttsLines(input, { provider, cache, onSynthesized }));
    expect(lines.map((l) => l.type)).toEqual(["start", "error"]);
    expect(cache.size).toBe(0);
    expect(onSynthesized).not.toHaveBeenCalled();
  });

  it("stops the provider when the client goes away, without metering", async () => {
    const abort = new AbortController();
    const tts = createFakeTts({ firstChunkDelayMs: 50 });
    const onSynthesized = vi.fn();
    const pending = collect(
      ttsLines(input, { provider: tts, signal: abort.signal, onSynthesized }),
    );
    abort.abort();
    const lines = await pending;
    expect(lines.map((l) => l.type)).toEqual(["start"]);
    expect(onSynthesized).not.toHaveBeenCalled();
  });

  it("meters a synthesis the client left midway, once, and caches nothing", async () => {
    const provider = scripted([{ pcm: Uint8Array.from([1, 0]) }, { pcm: Uint8Array.from([2, 0]) }]);
    const cache = createMemoryTtsCache();
    const onSynthesized = vi.fn();
    const lines = ttsLines(input, { provider, cache, onSynthesized });
    expect((await lines.next()).value).toMatchObject({ type: "start" });
    expect((await lines.next()).value).toMatchObject({ type: "audio" });
    await lines.return(undefined);
    expect(onSynthesized).toHaveBeenCalledOnce();
    expect(onSynthesized).toHaveBeenCalledWith({
      chars: input.text.length,
      latencyMs: expect.any(Number),
    });
    expect(cache.size).toBe(0);
  });
});

describe("voice pricing (§12.2, verify)", () => {
  it("prices STT per minute and TTS per 1K characters; the fakes are free", () => {
    expect(sttLedgerEntry("u", "deepgram", 60)).toMatchObject({
      task: "voice.stt",
      model: "deepgram",
      sttSeconds: 60,
      costUsd: 0.0048,
      aiMode: "live",
    });
    expect(sttLedgerEntry("u", "fake", 60)).toMatchObject({ costUsd: 0, aiMode: "replay" });
    expect(ttsCostUsd("cartesia", 1000)).toBe(0.04);
    expect(ttsLedgerEntry("u", "elevenlabs", 250, 180)).toMatchObject({
      task: "voice.tts",
      ttsChars: 250,
      costUsd: 0.01,
      latencyMs: 180,
    });
  });
});
