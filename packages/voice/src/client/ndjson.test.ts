import { describe, expect, it } from "vitest";
import type { TtsStreamLine } from "../contract";
import { createNdjsonParser, decodeBase64, toTtsLine } from "./ndjson";

const lines: TtsStreamLine[] = [
  { type: "start", sampleRate: 24_000, cached: false, voice: "warm" },
  { type: "audio", pcm: "AAABAAIA" },
  {
    type: "words",
    words: [
      { word: "Où", startMs: 0, endMs: 200 },
      { word: "êtes-vous né ?", startMs: 200, endMs: 900 },
    ],
  },
  { type: "end", chars: 22 },
];
const bytes = new TextEncoder().encode(lines.map((line) => JSON.stringify(line)).join("\n") + "\n");

describe("createNdjsonParser", () => {
  it("parses lines split anywhere, even mid-character", () => {
    for (const size of [1, 2, 3, 7, 50, bytes.length]) {
      const parser = createNdjsonParser();
      const out: TtsStreamLine[] = [];
      for (let at = 0; at < bytes.length; at += size)
        out.push(...parser.push(bytes.subarray(at, at + size)));
      out.push(...parser.end());
      expect(out).toEqual(lines);
    }
  });

  it("keeps a last line without a newline for end()", () => {
    const parser = createNdjsonParser();
    expect(parser.push(new TextEncoder().encode('{"type":"end","chars":3}'))).toEqual([]);
    expect(parser.end()).toEqual([{ type: "end", chars: 3 }]);
  });

  it("skips blank, malformed and unknown lines", () => {
    const parser = createNdjsonParser();
    const text = '\n{oops\n{"type":"nope"}\n{"type":"audio"}\n{"type":"error","message":"x"}\n';
    expect(parser.push(new TextEncoder().encode(text))).toEqual([{ type: "error", message: "x" }]);
  });
});

describe("toTtsLine", () => {
  it("rejects words without numeric times", () => {
    expect(toTtsLine({ type: "words", words: [{ word: "a", startMs: "0", endMs: 1 }] })).toBeNull();
    expect(toTtsLine({ type: "start", sampleRate: 0 })).toBeNull();
  });
});

describe("decodeBase64", () => {
  it("decodes to bytes", () => {
    expect([...decodeBase64("AAABAAIA")]).toEqual([0, 0, 1, 0, 2, 0]);
  });
});
