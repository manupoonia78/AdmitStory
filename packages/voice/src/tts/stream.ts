import {
  TTS_SAMPLE_RATE,
  type TTSProvider,
  type TtsSpeed,
  type TtsStreamLine,
  type TtsVoice,
} from "../contract";
import type { TtsCache } from "./cache";

// The /api/tts stream (spec §7.5, contract TtsStreamLine), independent of Next so it can be tested
// alone: one `start`, the provider's audio and word chunks as they arrive (or the cached lines),
// one `end`. The route only frames these as NDJSON and writes the ledger row.

export interface TtsInput {
  text: string;
  voice: TtsVoice;
  speed: TtsSpeed;
}

/** Shared by the real adapters: reads a byte stream as text lines, keeping a partial line. */
export async function* readLines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline = buffer.indexOf("\n");
      while (newline !== -1) {
        yield buffer.slice(0, newline).replace(/\r$/, "");
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");
      }
    }
    buffer += decoder.decode();
    if (buffer !== "") yield buffer;
  } finally {
    reader.releaseLock();
  }
}

/**
 * A provider's chunks as contract lines. PCM is 16-bit, so an odd trailing byte is carried into the
 * next chunk rather than sent alone, which would shift every later sample by a byte.
 */
export async function* providerLines(
  provider: TTSProvider,
  input: TtsInput,
  signal?: AbortSignal,
): AsyncGenerator<TtsStreamLine> {
  let carry: Uint8Array | null = null;
  for await (const chunk of provider.synthesize(input, signal)) {
    if (chunk.pcm && chunk.pcm.byteLength > 0) {
      let bytes = chunk.pcm;
      if (carry) {
        const joined = new Uint8Array(carry.byteLength + bytes.byteLength);
        joined.set(carry);
        joined.set(bytes, carry.byteLength);
        bytes = joined;
        carry = null;
      }
      const even = bytes.byteLength - (bytes.byteLength % 2);
      if (even < bytes.byteLength) carry = bytes.slice(even);
      if (even > 0)
        yield {
          type: "audio",
          pcm: Buffer.from(bytes.buffer, bytes.byteOffset, even).toString("base64"),
        };
    }
    if (chunk.words && chunk.words.length > 0) yield { type: "words", words: chunk.words };
  }
}

export interface TtsStreamOptions {
  provider: TTSProvider;
  cache?: TtsCache;
  signal?: AbortSignal;
  /** Called once per fresh synthesis that produced anything, with what was billed: the metering hook. */
  onSynthesized?: (usage: { chars: number; latencyMs: number }) => void | Promise<void>;
  now?: () => number;
}

/** Every line of one /api/tts response, in contract order. Errors become an `error` line. */
export async function* ttsLines(
  input: TtsInput,
  { provider, cache, signal, onSynthesized, now = Date.now }: TtsStreamOptions,
): AsyncGenerator<TtsStreamLine> {
  const chars = input.text.length;
  const key = cache?.key(provider.name, input);
  const cached = key ? cache?.get(key) : undefined;

  yield {
    type: "start",
    sampleRate: TTS_SAMPLE_RATE,
    cached: cached !== undefined,
    voice: input.voice,
  };

  if (cached) {
    yield* cached;
    yield { type: "end", chars };
    return;
  }

  const startedAt = now();
  const lines: TtsStreamLine[] = [];
  // Once the provider has sent anything the characters are billed, finished or not: a client that
  // leaves mid-question (or a provider that fails mid-stream) is metered all the same, so aborting
  // early cannot read questions aloud for free.
  let metered = false;
  const meter = async () => {
    if (metered || lines.length === 0) return;
    metered = true;
    await onSynthesized?.({ chars, latencyMs: now() - startedAt });
  };
  try {
    try {
      for await (const line of providerLines(provider, input, signal)) {
        lines.push(line);
        yield line;
      }
    } catch (error) {
      // An abort is the client leaving; nobody is listening for an error line.
      if (signal?.aborted) return;
      console.error("[tts] synthesis failed", error);
      yield { type: "error", message: "The question could not be read aloud. It is on screen." };
      return;
    }
    if (signal?.aborted) return;
    if (key) cache?.set(key, lines);
    await meter();
    yield { type: "end", chars };
  } finally {
    await meter();
  }
}
