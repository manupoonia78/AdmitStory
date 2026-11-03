// Questions read aloud (spec §5.2, §7.5). POST /api/tts streams NDJSON; each audio line is
// scheduled on a Web Audio context back to back, so playback starts with the first chunk and has
// no gaps, on every browser including iOS Safari (which plays raw PCM this way but not through
// <audio> as it streams). Word timings accumulate for SpokenQuestion, and the clock reports how
// far the listener has actually heard.
//
// iOS only lets a context make sound once it has been resumed inside a user gesture: call unlock()
// from the record button or "Done" tap. A recording start must stop() any read-aloud.

import type { TtsRequest, TtsStreamLine } from "../contract";
import { TTS_SAMPLE_RATE } from "../contract";
import { markTtsFirstAudio, markTtsRequest } from "./marks";
import { createNdjsonParser, decodeBase64 } from "./ndjson";

/** Same shapes as WordTiming and PlaybackClock in @admitstory/ui (structural, no dependency). */
export interface SpokenWordTiming {
  word: string;
  startMs: number;
  endMs: number;
}
export type ReadAloudClock = () => number | null;

export type ReadAloudStatus = "idle" | "loading" | "playing" | "ended" | "stopped" | "error";
export type ReadAloudOutcome = "ended" | "stopped" | "error";

export interface ReadAloudSnapshot {
  status: ReadAloudStatus;
  /** The text being read, so the caller can match timings to its question. */
  text: string | null;
  /**
   * Ms of audio heard since this read-aloud began; a new function per read-aloud. Holds at the
   * end position once finished, and returns null once stopped.
   */
  clock: ReadAloudClock | null;
  timings: readonly SpokenWordTiming[];
  /** Request → first scheduled audio, in ms, for the latency AC. */
  timeToFirstAudioMs: number | null;
}

export interface ReadAloudOptions {
  endpoint?: string;
  fetch?: typeof fetch;
  createContext?: () => AudioContext;
  /** Scheduling headroom before the first chunk, and after any underrun. */
  leadSeconds?: number;
  onEnd?: (outcome: ReadAloudOutcome) => void;
}

export interface ReadAloudPlayer {
  getSnapshot(): ReadAloudSnapshot;
  subscribe(listener: () => void): () => void;
  /** Call inside a user gesture: creates or resumes the audio context (iOS Safari). */
  unlock(): void;
  /** Reads `request.text` aloud, replacing anything playing. */
  speak(request: TtsRequest): Promise<ReadAloudOutcome>;
  stop(): void;
  /** Stops and closes the audio context. */
  dispose(): void;
}

interface Segment {
  /** Context time this chunk starts playing. */
  at: number;
  /** Position of the chunk in the audio, ms. */
  audioMs: number;
  durationMs: number;
}

interface Playback {
  controller: AbortController;
  sources: Set<AudioBufferSourceNode>;
  segments: Segment[];
  cursor: number;
  nextAt: number | null;
  audioMs: number;
  sampleRate: number;
  leftover: Uint8Array | null;
  streamEnded: boolean;
  /** Set once finished: ended holds the end position, stopped/error read null. */
  finished: ReadAloudOutcome | null;
  lastTimingEnd: number;
  resolve: (outcome: ReadAloudOutcome) => void;
}

type ContextConstructor = typeof AudioContext;

function defaultContext(): AudioContext {
  const legacy = (globalThis as unknown as { webkitAudioContext?: ContextConstructor })
    .webkitAudioContext;
  const Context = globalThis.AudioContext ?? legacy;
  if (!Context) throw new Error("Web Audio is not available.");
  return new Context();
}

const IDLE: ReadAloudSnapshot = {
  status: "idle",
  text: null,
  clock: null,
  timings: [],
  timeToFirstAudioMs: null,
};

/** 16-bit little-endian PCM → Float32 samples; an odd trailing byte is returned for later. */
export function pcmToFloat32(bytes: Uint8Array): {
  samples: Float32Array;
  rest: Uint8Array | null;
} {
  const count = bytes.length >> 1;
  const view = new DataView(bytes.buffer, bytes.byteOffset, count * 2);
  const samples = new Float32Array(count);
  for (let i = 0; i < count; i += 1) samples[i] = view.getInt16(i * 2, true) / 32_768;
  return { samples, rest: bytes.length % 2 ? bytes.slice(bytes.length - 1) : null };
}

export function createReadAloudPlayer(options: ReadAloudOptions = {}): ReadAloudPlayer {
  const {
    endpoint = "/api/tts",
    fetch: fetchImpl = (...args) => globalThis.fetch(...args),
    createContext = defaultContext,
    leadSeconds = 0.05,
    onEnd,
  } = options;

  let context: AudioContext | null = null;
  let current: Playback | null = null;
  let snapshot = IDLE;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<ReadAloudSnapshot>) => {
    snapshot = { ...snapshot, ...patch };
    for (const listener of listeners) listener();
  };

  function audioContext(): AudioContext {
    context ??= createContext();
    if (context.state === "suspended") void context.resume().catch(() => {});
    return context;
  }

  function finish(playback: Playback, outcome: ReadAloudOutcome) {
    if (playback.finished) return;
    playback.finished = outcome;
    playback.controller.abort();
    if (outcome !== "ended")
      for (const source of playback.sources) {
        source.onended = null;
        try {
          source.stop();
        } catch {
          // Not started yet.
        }
        source.disconnect();
      }
    playback.sources.clear();
    if (current === playback) {
      current = null;
      update({ status: outcome });
    }
    playback.resolve(outcome);
    onEnd?.(outcome);
  }

  function maybeEnded(playback: Playback) {
    if (playback.streamEnded && playback.sources.size === 0) finish(playback, "ended");
  }

  function clockFor(playback: Playback, ctx: AudioContext): ReadAloudClock {
    return () => {
      if (playback.finished === "ended") return playback.audioMs;
      if (playback.finished) return null;
      const now = ctx.currentTime;
      const { segments } = playback;
      while (
        playback.cursor + 1 < segments.length &&
        (segments[playback.cursor + 1]?.at ?? Infinity) <= now
      )
        playback.cursor += 1;
      const segment = segments[playback.cursor];
      if (!segment || now < segment.at) return 0;
      const position = segment.audioMs + Math.min(segment.durationMs, (now - segment.at) * 1000);
      // Until every timing has arrived, never run past the last known word: a caption that
      // waits a beat is better than one that declares the reading over.
      return playback.streamEnded
        ? position
        : Math.min(position, Math.max(0, playback.lastTimingEnd - 1));
    };
  }

  function schedule(playback: Playback, ctx: AudioContext, bytes: Uint8Array) {
    const joined = playback.leftover ? concat(playback.leftover, bytes) : bytes;
    const { samples, rest } = pcmToFloat32(joined);
    playback.leftover = rest;
    if (samples.length === 0) return;
    const buffer = ctx.createBuffer(1, samples.length, playback.sampleRate);
    buffer.getChannelData(0).set(samples);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    // Back to back; after an underrun (the network fell behind), restart just ahead of now.
    const earliest = ctx.currentTime + leadSeconds;
    const at =
      playback.nextAt === null || playback.nextAt < ctx.currentTime ? earliest : playback.nextAt;
    source.start(at);
    const durationMs = (samples.length / playback.sampleRate) * 1000;
    playback.segments.push({ at, audioMs: playback.audioMs, durationMs });
    playback.audioMs += durationMs;
    playback.nextAt = at + samples.length / playback.sampleRate;
    playback.sources.add(source);
    source.onended = () => {
      playback.sources.delete(source);
      source.disconnect();
      maybeEnded(playback);
    };
    if (playback.segments.length === 1 && current === playback) {
      const { timeToFirstAudio } = markTtsFirstAudio();
      update({
        status: "playing",
        clock: clockFor(playback, ctx),
        timeToFirstAudioMs: timeToFirstAudio,
      });
    }
  }

  function apply(playback: Playback, ctx: AudioContext, line: TtsStreamLine) {
    if (playback.finished) return;
    switch (line.type) {
      case "start":
        playback.sampleRate = line.sampleRate;
        break;
      case "audio":
        schedule(playback, ctx, decodeBase64(line.pcm));
        break;
      case "words": {
        if (line.words.length === 0) break;
        playback.lastTimingEnd = Math.max(playback.lastTimingEnd, line.words.at(-1)?.endMs ?? 0);
        if (current === playback) update({ timings: [...snapshot.timings, ...line.words] });
        break;
      }
      case "end":
        playback.streamEnded = true;
        maybeEnded(playback);
        break;
      case "error":
        finish(playback, "error");
        break;
    }
  }

  async function run(playback: Playback, ctx: AudioContext, request: TtsRequest) {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
      signal: playback.controller.signal,
    });
    if (!response.ok || !response.body) throw new Error(`TTS failed: ${response.status}`);
    const reader = response.body.getReader();
    const parser = createNdjsonParser();
    for (;;) {
      const { value, done } = await reader.read();
      if (playback.finished) return;
      const lines = done ? parser.end() : parser.push(value);
      for (const line of lines) apply(playback, ctx, line);
      if (done) break;
    }
    // A stream that ended without its `end` line still plays out what arrived.
    if (!playback.streamEnded) apply(playback, ctx, { type: "end", chars: 0 });
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    unlock() {
      const ctx = audioContext();
      // A one-sample silent buffer started inside the gesture is what finally unlocks iOS.
      const source = ctx.createBufferSource();
      source.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      source.connect(ctx.destination);
      source.start();
    },
    speak(request) {
      if (current) finish(current, "stopped");
      const ctx = audioContext();
      markTtsRequest();
      let resolve: (outcome: ReadAloudOutcome) => void = () => {};
      const done = new Promise<ReadAloudOutcome>((r) => {
        resolve = r;
      });
      const playback: Playback = {
        controller: new AbortController(),
        sources: new Set(),
        segments: [],
        cursor: 0,
        nextAt: null,
        audioMs: 0,
        sampleRate: TTS_SAMPLE_RATE,
        leftover: null,
        streamEnded: false,
        finished: null,
        lastTimingEnd: 0,
        resolve,
      };
      current = playback;
      update({
        status: "loading",
        text: request.text,
        clock: null,
        timings: [],
        timeToFirstAudioMs: null,
      });
      run(playback, ctx, request).catch(() => finish(playback, playback.finished ?? "error"));
      return done;
    },
    stop() {
      if (current) finish(current, "stopped");
      update({ clock: null });
    },
    dispose() {
      if (current) finish(current, "stopped");
      void context?.close().catch(() => {});
      context = null;
    },
  };
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
}
