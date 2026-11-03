import { createHash } from "node:crypto";
import { TTS_CACHE_TTL_SECONDS, type TtsStreamLine } from "../contract";
import type { TtsInput } from "./stream";

// The read-aloud cache (spec §7.5: by hash of text + voice, 24 h). In-process and bounded by
// bytes, least recently used first out. It stores a response's audio and word lines so a hit
// replays them exactly.
//
// In-process means each server instance has its own cache, so a hit rate across instances is lower
// than it would be. A shared Redis/R2 cache comes later (docs/phase-2.md); this interface is what
// it will implement.

export interface TtsCache {
  key(provider: string, input: TtsInput): string;
  get(key: string): readonly TtsStreamLine[] | undefined;
  set(key: string, lines: readonly TtsStreamLine[]): void;
}

export interface MemoryTtsCacheOptions {
  /** Default 64 MB: about 20 minutes of 24 kHz audio as base64. */
  maxBytes?: number;
  ttlSeconds?: number;
  now?: () => number;
}

interface Entry {
  lines: readonly TtsStreamLine[];
  bytes: number;
  expiresAt: number;
}

export function ttsCacheKey(provider: string, { text, voice, speed }: TtsInput): string {
  return createHash("sha256").update(`${provider}|${voice}|${speed}|${text}`).digest("hex");
}

const sizeOf = (lines: readonly TtsStreamLine[]): number =>
  lines.reduce((total, line) => total + (line.type === "audio" ? line.pcm.length : 64), 0);

export function createMemoryTtsCache({
  maxBytes = 64 * 1024 * 1024,
  ttlSeconds = TTS_CACHE_TTL_SECONDS,
  now = Date.now,
}: MemoryTtsCacheOptions = {}): TtsCache & { readonly bytes: number; readonly size: number } {
  // A Map iterates in insertion order; re-inserting on read makes the first entry the least recent.
  const entries = new Map<string, Entry>();
  let bytes = 0;

  const remove = (key: string) => {
    const entry = entries.get(key);
    if (!entry) return;
    bytes -= entry.bytes;
    entries.delete(key);
  };

  return {
    key: ttsCacheKey,
    get(key) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt <= now()) {
        remove(key);
        return undefined;
      }
      entries.delete(key);
      entries.set(key, entry);
      return entry.lines;
    },
    set(key, lines) {
      const size = sizeOf(lines);
      remove(key);
      if (size > maxBytes) return;
      while (bytes + size > maxBytes) {
        const oldest = entries.keys().next().value;
        if (oldest === undefined) break;
        remove(oldest);
      }
      entries.set(key, { lines, bytes: size, expiresAt: now() + ttlSeconds * 1000 });
      bytes += size;
    },
    get bytes() {
      return bytes;
    },
    get size() {
      return entries.size;
    },
  };
}
