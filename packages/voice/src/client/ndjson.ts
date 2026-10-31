// Incremental NDJSON for the /api/tts stream: network chunks split anywhere — mid-line, even
// mid-character — and each complete line becomes one TtsStreamLine. Checked by hand rather than
// with Zod, which must stay out of the browser bundle; the server validates what it sends.

import type { TtsStreamLine } from "../contract";

export interface NdjsonParser {
  /** Returns every line completed by this chunk. */
  push(chunk: Uint8Array): TtsStreamLine[];
  /** The last line, if the stream did not end with a newline. */
  end(): TtsStreamLine[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

function isWords(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every(
      (word) =>
        isRecord(word) &&
        typeof word.word === "string" &&
        typeof word.startMs === "number" &&
        typeof word.endMs === "number",
    )
  );
}

/** A parsed line if it is a well-formed TtsStreamLine, else null (ignored by the player). */
export function toTtsLine(value: unknown): TtsStreamLine | null {
  if (!isRecord(value)) return null;
  switch (value.type) {
    case "start":
      return typeof value.sampleRate === "number" && value.sampleRate > 0
        ? (value as TtsStreamLine)
        : null;
    case "audio":
      return typeof value.pcm === "string" ? (value as TtsStreamLine) : null;
    case "words":
      return isWords(value.words) ? (value as TtsStreamLine) : null;
    case "end":
      return value as TtsStreamLine;
    case "error":
      return typeof value.message === "string" ? (value as TtsStreamLine) : null;
    default:
      return null;
  }
}

function parseLine(line: string): TtsStreamLine | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    return toTtsLine(JSON.parse(trimmed));
  } catch {
    return null;
  }
}

export function createNdjsonParser(): NdjsonParser {
  const decoder = new TextDecoder();
  let pending = "";
  const lines = (text: string): TtsStreamLine[] => {
    const out: TtsStreamLine[] = [];
    for (const line of text.split("\n")) {
      const parsed = parseLine(line);
      if (parsed) out.push(parsed);
    }
    return out;
  };
  return {
    push(chunk) {
      pending += decoder.decode(chunk, { stream: true });
      const cut = pending.lastIndexOf("\n");
      if (cut === -1) return [];
      const complete = pending.slice(0, cut);
      pending = pending.slice(cut + 1);
      return lines(complete);
    },
    end() {
      const rest = pending + decoder.decode();
      pending = "";
      return lines(rest);
    },
  };
}

/** base64 → bytes, without Buffer (browser). */
export function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
