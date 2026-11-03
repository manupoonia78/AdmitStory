import { afterEach, describe, expect, it, vi } from "vitest";
import type { TtsStreamLine } from "../contract";
import { createReadAloudPlayer, pcmToFloat32 } from "./tts-player";

// A Web Audio stand-in whose clock the test moves by hand, and a /api/tts response the test
// feeds chunk by chunk.

class FakeSource {
  buffer: { length: number; sampleRate: number } | null = null;
  startedAt: number | null = null;
  onended: (() => void) | null = null;
  connect = vi.fn();
  disconnect = vi.fn();
  stop = vi.fn();
  start(at = 0) {
    this.startedAt = at;
  }
}

class FakeContext {
  currentTime = 0;
  sampleRate = 48_000;
  state: AudioContextState = "suspended";
  destination = {};
  sources: FakeSource[] = [];
  resume = vi.fn(() => {
    this.state = "running";
    return Promise.resolve();
  });
  close = vi.fn(() => Promise.resolve());
  createBuffer(_channels: number, length: number, sampleRate: number) {
    const data = new Float32Array(length);
    return { length, sampleRate, duration: length / sampleRate, getChannelData: () => data };
  }
  createBufferSource() {
    const source = new FakeSource();
    this.sources.push(source);
    return source;
  }
}

const RATE = 24_000;
const pcmLine = (samples: number): TtsStreamLine => ({
  type: "audio",
  pcm: Buffer.from(new Int16Array(samples).fill(1_000).buffer).toString("base64"),
});

function streamingResponse() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({ start: (c) => void (controller = c) });
  const encoder = new TextEncoder();
  return {
    response: new Response(body, { headers: { "content-type": "application/x-ndjson" } }),
    send(...lines: TtsStreamLine[]) {
      const text = lines.map((line) => JSON.stringify(line) + "\n").join("");
      // Split mid-line on purpose.
      const cut = Math.floor(text.length / 2);
      controller.enqueue(encoder.encode(text.slice(0, cut)));
      controller.enqueue(encoder.encode(text.slice(cut)));
    },
    close: () => controller.close(),
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup() {
  const context = new FakeContext();
  const stream = streamingResponse();
  const fetch = vi.fn(() => Promise.resolve(stream.response));
  const onEnd = vi.fn();
  const player = createReadAloudPlayer({
    fetch: fetch as unknown as typeof globalThis.fetch,
    createContext: () => context as unknown as AudioContext,
    leadSeconds: 0.05,
    onEnd,
  });
  return { context, stream, fetch, onEnd, player };
}

afterEach(() => vi.restoreAllMocks());

describe("createReadAloudPlayer", () => {
  it("posts the request and schedules chunks back to back, without gaps", async () => {
    const { context, stream, fetch, player } = setup();
    player.unlock();
    expect(context.resume).toHaveBeenCalled();
    const done = player.speak({ text: "Where did you grow up?" });
    expect(player.getSnapshot().status).toBe("loading");
    expect(fetch).toHaveBeenCalledWith(
      "/api/tts",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ text: "Where did you grow up?" }),
      }),
    );

    context.currentTime = 1;
    stream.send({ type: "start", sampleRate: RATE, cached: false, voice: "warm" }, pcmLine(2_400));
    await settle();
    expect(player.getSnapshot().status).toBe("playing");
    expect(player.getSnapshot().timeToFirstAudioMs).not.toBeUndefined();
    stream.send(pcmLine(4_800), pcmLine(1_200));
    await settle();

    const played = context.sources.filter((source) => source.buffer?.sampleRate === RATE);
    const starts = played.map((source) => source.startedAt ?? NaN);
    [1.05, 1.15, 1.35].forEach((expected, i) => expect(starts[i]).toBeCloseTo(expected, 9));
    stream.send({ type: "end", chars: 22 });
    stream.close();
    await settle();
    for (const source of played) source.onended?.();
    await expect(done).resolves.toBe("ended");
    expect(player.getSnapshot().status).toBe("ended");
  });

  it("reports the heard position on its clock, stalling through an underrun", async () => {
    const { context, stream, player } = setup();
    void player.speak({ text: "Tell me about your first job." });
    stream.send({ type: "words", words: [{ word: "Tell", startMs: 0, endMs: 900 }] });
    stream.send(pcmLine(RATE / 10)); // 100 ms
    await settle();
    const clock = player.getSnapshot().clock!;
    expect(clock()).toBe(0); // scheduled 50 ms ahead
    context.currentTime = 0.1;
    expect(clock()).toBeCloseTo(50);
    context.currentTime = 0.4; // the first chunk ran out at 0.15: the network fell behind
    expect(clock()).toBeCloseTo(100);
    stream.send(pcmLine(RATE / 10));
    await settle();
    expect(context.sources.at(-1)?.startedAt).toBeCloseTo(0.45);
    context.currentTime = 0.5;
    expect(clock()).toBeCloseTo(150);
  });

  it("never runs the clock past the last known word until every timing has arrived", async () => {
    const { context, stream, player } = setup();
    void player.speak({ text: "Why now?" });
    stream.send({ type: "words", words: [{ word: "Why", startMs: 0, endMs: 300 }] }, pcmLine(RATE));
    await settle();
    const clock = player.getSnapshot().clock!;
    context.currentTime = 0.8;
    expect(clock()).toBe(299);
    stream.send(
      { type: "words", words: [{ word: "now?", startMs: 300, endMs: 900 }] },
      { type: "end", chars: 8 },
    );
    await settle();
    expect(clock()).toBeCloseTo(750);
  });

  it("accumulates word timings across lines", async () => {
    const { stream, player } = setup();
    void player.speak({ text: "Who shaped you most?" });
    stream.send({ type: "words", words: [{ word: "Who", startMs: 0, endMs: 200 }] });
    stream.send({ type: "words", words: [{ word: "shaped", startMs: 200, endMs: 500 }] });
    await settle();
    expect(player.getSnapshot().timings.map((t) => t.word)).toEqual(["Who", "shaped"]);
  });

  it("stop() silences every scheduled chunk and clears the clock", async () => {
    const { context, stream, onEnd, player } = setup();
    const done = player.speak({ text: "And then?" });
    stream.send(pcmLine(2_400), pcmLine(2_400));
    await settle();
    const clock = player.getSnapshot().clock!;
    player.stop();
    await expect(done).resolves.toBe("stopped");
    expect(context.sources.every((source) => source.stop.mock.calls.length === 1)).toBe(true);
    expect(clock()).toBeNull();
    expect(player.getSnapshot()).toMatchObject({ status: "stopped", clock: null });
    expect(onEnd).toHaveBeenCalledWith("stopped");
  });

  it("a new question replaces the one playing", async () => {
    const { stream, fetch, player } = setup();
    const first = player.speak({ text: "One?" });
    stream.send(pcmLine(2_400));
    await settle();
    fetch.mockImplementationOnce(() => new Promise(() => {}));
    void player.speak({ text: "Two?" });
    await expect(first).resolves.toBe("stopped");
    expect(player.getSnapshot()).toMatchObject({ status: "loading", text: "Two?", timings: [] });
  });

  it("ends in error on an error line or a failed request", async () => {
    const { stream, player } = setup();
    const done = player.speak({ text: "Hm?" });
    stream.send({ type: "error", message: "provider down" });
    await expect(done).resolves.toBe("error");

    const failing = createReadAloudPlayer({
      fetch: (() => Promise.resolve(new Response("{}", { status: 429 }))) as typeof fetch,
      createContext: () => new FakeContext() as unknown as AudioContext,
    });
    await expect(failing.speak({ text: "Hm?" })).resolves.toBe("error");
  });
});

describe("pcmToFloat32", () => {
  it("reads little-endian samples and keeps an odd byte for the next chunk", () => {
    const { samples, rest } = pcmToFloat32(new Uint8Array([0x00, 0x40, 0x00, 0xc0, 0x7f]));
    expect([...samples]).toEqual([0.5, -0.5]);
    expect([...(rest ?? [])]).toEqual([0x7f]);
  });
});
