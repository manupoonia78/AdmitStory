import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { SttTokenResponse } from "../contract";
import {
  startFakeDeepgram,
  synthSilence,
  synthWord,
  type FakeDeepgram,
} from "../testing/fake-deepgram";
import {
  createDictationSession,
  type DictationOptions,
  type DictationSession,
  type NetworkStatus,
} from "./dictation";

// Dictation against the fake Deepgram over real WebSockets, time-scaled: audio is pushed as fast
// as the socket takes it, and every timing decision runs on the audio timeline, so a 30-minute
// session takes seconds. Phase 2 AC: a 30-minute voice session without loss.

let fake: FakeDeepgram;
beforeAll(async () => {
  fake = await startFakeDeepgram();
});
afterAll(() => fake.close());
afterEach(() => {
  fake.options = {};
});

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const token = (): SttTokenResponse => ({
  url: `${fake.url}?model=nova-3&encoding=linear16&sample_rate=16000&interim_results=true&utterance_end_ms=2500&vad_events=true&smart_format=true`,
  protocols: ["token", "test-key"],
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  remainingSeconds: 7_200,
  provider: "fake",
});

const session = (options: Partial<DictationOptions> = {}): DictationSession =>
  createDictationSession({
    fetchToken: async () => token(),
    retryDelaysMs: [5, 10, 20, 40, 80, 160],
    ...options,
  });

const tick = () => new Promise((resolve) => setImmediate(resolve));
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function until(condition: () => boolean, ms = 5_000) {
  const deadline = Date.now() + ms;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error("timed out");
    await wait(2);
  }
}

/**
 * A spoken answer of at most `maxBlocks` × 100 ms: sentences of 3–12 words, short gaps between
 * words, now and then a long thinking pause mid-sentence (up to 4.5 s, longer than the 2.5 s
 * utterance end), and pauses under 2.5 s after each sentence.
 */
function speech(random: () => number, maxBlocks: number) {
  const frames: Int16Array[] = [];
  const words: string[] = [];
  let id = 1;
  for (;;) {
    const sentence: Int16Array[] = [];
    const sentenceWords: string[] = [];
    const length = 3 + Math.floor(random() * 10);
    for (let w = 0; w < length; w += 1) {
      const last = w === length - 1;
      sentence.push(synthWord(id, last));
      sentenceWords.push(`w${id}${last ? "." : ""}`);
      id += 1;
      if (last) break;
      const r = random();
      const gap =
        r < 0.03
          ? 30 + Math.floor(random() * 16)
          : r < 0.15
            ? 5 + Math.floor(random() * 10)
            : Math.floor(random() * 3);
      for (let g = 0; g < gap; g += 1) sentence.push(synthSilence());
    }
    const pause = 1 + Math.floor(random() * 20);
    if (frames.length + sentence.length + pause > maxBlocks) break;
    frames.push(...sentence);
    words.push(...sentenceWords);
    for (let p = 0; p < pause; p += 1) frames.push(synthSilence());
  }
  return { frames, words, nextId: id };
}

const capturing = (s: DictationSession) => {
  const { state } = s.getSnapshot();
  return state === "connecting" || state === "listening";
};

/**
 * Pushes frames like a capture pipeline would and returns how many the session took. With
 * `paced`, each 2 s batch waits until the transcript is within a few seconds of the audio, as in
 * real time, where Deepgram keeps up with speech and a reconnect costs a fraction of a second;
 * unpaced, the test outruns the socket and the backlog is the test's, not the client's.
 */
async function speak(
  s: DictationSession,
  frames: readonly Int16Array[],
  { paced = false, onBatch }: { paced?: boolean; onBatch?: () => void } = {},
) {
  let accepted = 0;
  for (let i = 0; i < frames.length; i += 1) {
    if (capturing(s)) accepted += 1;
    s.pushAudio(frames[i]!);
    if (i % 20 === 19) {
      onBatch?.();
      await tick();
      const capturedSeconds = (i + 1) / 10;
      if (paced) await until(() => !capturing(s) || capturedSeconds - s.transcribedSeconds < 8);
    }
  }
  return accepted;
}

describe("dictation session", () => {
  it("loses nothing over a 30-minute session with forced disconnects at random points", async () => {
    const random = mulberry32(2026);
    const faults = mulberry32(7);
    let drops = 0;
    fake.options.dropAfterBytes = () => {
      if (faults() > 0.4) return undefined;
      drops += 1;
      return 64_000 + Math.floor(faults() * 3_000_000);
    };

    const totalBlocks = 30 * 60 * 10;
    let capturedBlocks = 0;
    let capturedSeconds = 0;
    let answers = 0;
    const connectionsBefore = fake.connections;

    while (capturedBlocks < totalBlocks) {
      const remaining = totalBlocks - capturedBlocks;
      const last = remaining <= 3_600;
      const maxBlocks = last
        ? remaining
        : 600 + Math.floor(random() * Math.min(2_400, remaining - 1_800));
      const auto = !last && random() < 0.5;
      const { frames, words, nextId } = speech(random, auto ? maxBlocks : maxBlocks - 2);
      if (!auto) {
        // A "Done" answer is exactly maxBlocks long and ends mid-thought: a word, a pause of
        // any length (it is mid-sentence, so it never ends the answer), a word, then "Done".
        frames.push(synthWord(nextId));
        while (frames.length < maxBlocks - 1) frames.push(synthSilence());
        frames.push(synthWord(nextId + 1));
        words.push(`w${nextId}`, `w${nextId + 1}`);
      }

      const s = session();
      s.start();
      let maxBuffered = 0;
      let accepted = await speak(s, frames, {
        paced: true,
        onBatch: () => (maxBuffered = Math.max(maxBuffered, s.bufferedSeconds)),
      });
      if (auto) {
        // Keep the room silent until the answer ends by itself.
        for (let i = 0; capturing(s); i += 1) {
          if (i > 400) throw new Error("the answer never ended");
          accepted += 1;
          s.pushAudio(synthSilence());
          await wait(1);
        }
      }
      const result = await s.finish();
      expect(result).not.toBeNull();
      // Every word exactly once, in order.
      expect(result!.text.split(" ")).toEqual(words);
      expect(result!.autoEnded).toBe(auto);
      expect(result!.seconds).toBeCloseTo(accepted / 10, 6);
      // Audio is released as it is transcribed, and entirely at the end of the answer.
      expect(maxBuffered).toBeLessThan(15);
      expect(s.bufferedSeconds).toBe(0);
      s.dispose();

      capturedBlocks += accepted;
      capturedSeconds += result!.seconds;
      answers += 1;
    }

    expect(capturedSeconds).toBeCloseTo(1_800, 1);
    expect(answers).toBeGreaterThan(5);
    expect(drops).toBeGreaterThanOrEqual(5);
    // Every drop cost one extra connection with a fresh token, and nothing more.
    expect(fake.connections - connectionsBefore).toBeGreaterThanOrEqual(answers + drops - 1);
  }, 120_000);

  it("keeps words in order when results lag behind the audio", async () => {
    fake.options.latencyMs = 25;
    let connection = 0;
    fake.options.dropAfterBytes = () => (connection++ % 2 === 0 ? 150_000 : undefined);
    const { frames, words } = speech(mulberry32(3), 900);
    const s = session();
    s.start();
    await speak(s, frames);
    const result = await s.finish();
    expect(result?.text.split(" ")).toEqual(words);
  });

  it('"Done" ends the answer at once, mid-sentence pause or not', async () => {
    const s = session();
    s.start();
    await speak(s, [
      synthWord(1),
      synthWord(2),
      ...Array.from({ length: 40 }, () => synthSilence()),
    ]);
    await until(() => s.getSnapshot().state === "listening");
    const finished = s.finish();
    expect(s.getSnapshot().state).toBe("finishing");
    const result = await finished;
    expect(result).toEqual({ text: "w1 w2", seconds: 4.2, language: null, autoEnded: false });
    expect(s.getSnapshot().state).toBe("done");
  });

  it("streams interim and final text to subscribers", async () => {
    const s = session();
    const seen = new Set<string>();
    s.subscribe(() => seen.add(`${s.getSnapshot().text}|${s.getSnapshot().interim}`));
    s.start();
    await speak(s, [
      synthWord(1),
      synthWord(2),
      synthWord(3),
      synthWord(4, true),
      ...Array.from({ length: 5 }, () => synthSilence()),
    ]);
    await until(() => s.getSnapshot().text === "w1 w2 w3 w4.");
    expect([...seen].some((entry) => entry.startsWith("|w1"))).toBe(true);
    s.dispose();
  });

  it("keeps the audio when STT keeps failing, and retry() recovers every word", async () => {
    fake.options.dropAfterMs = (n) => (n === fake.connections - 1 ? 30 : undefined);
    const s = session({ retryDelaysMs: [5, 5] });
    s.start();
    const first = speech(mulberry32(11), 200);
    await speak(s, first.frames.slice(0, 50));
    fake.options.refuse = () => true;
    await speak(s, first.frames.slice(50));
    await until(() => s.getSnapshot().state === "failed");
    expect(s.bufferedSeconds).toBeGreaterThan(0);

    // Still talking while it is down: kept too. Then "Done", which waits for the retry.
    const more = Array.from({ length: 10 }, () => synthSilence());
    await speak(s, more);
    const finished = s.finish();
    expect(s.getSnapshot().state).toBe("failed");

    fake.options.refuse = undefined;
    s.retry();
    const result = await finished;
    expect(result?.text.split(" ")).toEqual(first.words);
    expect(result?.seconds).toBeCloseTo((first.frames.length + 10) / 10, 6);
  });

  it("reports a refused token as its own outcome", async () => {
    for (const refusal of ["email_unverified", "voice_minutes_used", "stt_unavailable"] as const) {
      const s = session({ fetchToken: async () => ({ refusal }) });
      s.start();
      await until(() => s.getSnapshot().state !== "connecting");
      expect(s.getSnapshot()).toMatchObject({ state: "refused", refusal });
      await expect(s.finish()).resolves.toBeNull();
    }
  });

  it("keeps the words so far when the allowance runs out mid-answer", async () => {
    let calls = 0;
    fake.options.dropAfterBytes = (n) => (n === fake.connections - 1 ? 64_000 : undefined);
    const s = session({
      fetchToken: async () =>
        calls++ === 0 ? token() : { refusal: "voice_minutes_used" as const },
    });
    s.start();
    await speak(s, [
      synthWord(1),
      synthWord(2, true),
      ...Array.from({ length: 30 }, () => synthSilence()),
    ]);
    await until(() => s.getSnapshot().state === "refused");
    expect(s.getSnapshot().text).toBe("w1 w2.");
  });

  it("buffers while offline and resumes when the network returns", async () => {
    let online = false;
    const listeners = new Set<() => void>();
    const network: NetworkStatus = {
      online: () => online,
      subscribe(onChange) {
        listeners.add(onChange);
        return () => listeners.delete(onChange);
      },
    };
    const before = fake.connections;
    const s = session({ network });
    s.start();
    const { frames, words } = speech(mulberry32(5), 300);
    await speak(s, frames);
    expect(s.getSnapshot().connection).toBe("offline");
    expect(fake.connections).toBe(before);
    expect(s.bufferedSeconds).toBeCloseTo(frames.length / 10, 6);

    online = true;
    for (const listener of listeners) listener();
    const result = await s.finish();
    expect(result?.text.split(" ")).toEqual(words);
    expect(listeners.size).toBe(0);
  });

  it("sends KeepAlive while no audio flows, so Deepgram keeps the stream open", async () => {
    const controls: string[] = [];
    fake.options.onControl = (_n, type) => controls.push(type);
    const s = session({ keepAliveMs: 40 });
    s.start();
    s.pushAudio(synthWord(1));
    await until(() => s.getSnapshot().connection === "open");
    await wait(150);
    expect(controls).toContain("KeepAlive");
    s.dispose();
  });

  it("finishes at once when nothing was said", async () => {
    const s = session();
    s.start();
    await expect(s.finish()).resolves.toEqual({
      text: "",
      seconds: 0,
      language: null,
      autoEnded: false,
    });
  });
});
