import { TTS_SAMPLE_RATE, type TTSProvider, type TtsChunk } from "../contract";

// The development TTS provider, chosen when the real provider's key is missing. Deterministic: a
// quiet tone as long as the text would take to say, with word timings estimated from word length,
// so captions, karaoke highlighting and playback all work offline. The first chunk arrives after a
// configurable delay that stands in for a real provider's time to first byte.

export interface FakeTtsOptions {
  /** Default 150 ms, a realistic streaming TTS time to first audio. */
  firstChunkDelayMs?: number | (() => number);
  /** Audio per chunk. */
  chunkMs?: number;
  /** Words per minute at speed 1. */
  wordsPerMinute?: number;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

export function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** Word timings at a steady pace, longer words taking longer; pauses after punctuation. */
export function estimateWordTimings(
  text: string,
  { wordsPerMinute = 165, speed = 1 }: { wordsPerMinute?: number; speed?: number } = {},
): { word: string; startMs: number; endMs: number }[] {
  const words = text.split(/\s+/).filter(Boolean);
  const averageMs = 60_000 / wordsPerMinute / speed;
  const averageLength = words.reduce((sum, word) => sum + word.length, 0) / (words.length || 1);
  let at = 0;
  return words.map((word) => {
    const durationMs = Math.round(averageMs * (0.5 + (0.5 * word.length) / averageLength));
    const timing = { word, startMs: at, endMs: at + durationMs };
    at += durationMs + (/[.,;:!?…]$/.test(word) ? Math.round(averageMs * 0.6) : 0);
    return timing;
  });
}

/** A quiet 220 Hz tone, 16-bit little-endian mono. */
export function tonePcm(durationMs: number, startSample = 0): Uint8Array {
  const samples = Math.round((durationMs / 1000) * TTS_SAMPLE_RATE);
  const view = new DataView(new ArrayBuffer(samples * 2));
  for (let i = 0; i < samples; i++)
    view.setInt16(
      i * 2,
      Math.round(Math.sin((2 * Math.PI * 220 * (startSample + i)) / TTS_SAMPLE_RATE) * 1200),
      true,
    );
  return new Uint8Array(view.buffer);
}

export function createFakeTts({
  firstChunkDelayMs = 150,
  chunkMs = 200,
  wordsPerMinute = 165,
  sleep = abortableSleep,
}: FakeTtsOptions = {}): TTSProvider {
  return {
    name: "fake",
    async *synthesize({ text, speed }, signal): AsyncGenerator<TtsChunk> {
      const words = estimateWordTimings(text, { wordsPerMinute, speed });
      const totalMs = (words.at(-1)?.endMs ?? 0) + 200;
      await sleep(
        typeof firstChunkDelayMs === "function" ? firstChunkDelayMs() : firstChunkDelayMs,
        signal,
      );
      let sample = 0;
      for (let at = 0; at < totalMs; at += chunkMs) {
        if (signal?.aborted) throw signal.reason;
        const durationMs = Math.min(chunkMs, totalMs - at);
        const pcm = tonePcm(durationMs, sample);
        sample += pcm.byteLength / 2;
        const inChunk = words.filter((word) => word.startMs >= at && word.startMs < at + chunkMs);
        yield inChunk.length > 0 ? { pcm, words: inChunk } : { pcm };
      }
    },
  };
}
