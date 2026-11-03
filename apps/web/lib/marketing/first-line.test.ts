import { describe, expect, it, vi } from "vitest";
import {
  FIRST_LINE_KEY,
  FIRST_LINE_MAX_CHARS,
  FIRST_LINE_TRANSITION,
  FIRST_LINE_TTL_MS,
  clearFirstLine,
  parseFirstLine,
  readFirstLine,
  saveFirstLine,
  subscribeFirstLine,
  type KeepableFirstLine,
} from "./first-line";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

const throwing = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
  removeItem: () => {
    throw new Error("SecurityError");
  },
};

const IDENTITY = {
  version: 1 as const,
  avgPitchHz: 180,
  paceWpm: 150,
  pitchRangeSemitones: 8,
  pauseRhythm: 0.3,
  source: "voice" as const,
};

const LINE: KeepableFirstLine = {
  line: "It was 2 a.m. and the feed from the lab system was dropping every fourth message.",
  source: "voice",
  identity: IDENTITY,
  removedFillers: 2,
};

const NOW = 1_800_000_000_000;

describe("first-line contract", () => {
  it("names the key, the transition and the limits the packages share", () => {
    expect(FIRST_LINE_KEY).toBe("admitstory.first-line.v1");
    expect(FIRST_LINE_TRANSITION).toBe("first-line");
    expect(FIRST_LINE_MAX_CHARS).toBe(200);
    expect(FIRST_LINE_TTL_MS).toBe(86_400_000);
  });

  it("round-trips a line with its identity", () => {
    const storage = memoryStorage();
    expect(saveFirstLine(LINE, storage, NOW)).toBe(true);
    expect(readFirstLine(storage, NOW + 1000)).toEqual({ ...LINE, savedAt: NOW });
  });

  it("returns the same object while nothing changes (useSyncExternalStore snapshot)", () => {
    const storage = memoryStorage();
    saveFirstLine(LINE, storage, NOW);
    expect(readFirstLine(storage, NOW + 1)).toBe(readFirstLine(storage, NOW + 2));
  });

  it("trims the line and keeps a written line without an identity", () => {
    const storage = memoryStorage();
    saveFirstLine(
      { ...LINE, line: "  I fixed it.  ", source: "written", identity: null },
      storage,
      NOW,
    );
    expect(readFirstLine(storage, NOW)).toMatchObject({ line: "I fixed it.", identity: null });
  });

  it("expires after 24 hours and tidies the key away", () => {
    const storage = memoryStorage();
    saveFirstLine(LINE, storage, NOW);
    expect(readFirstLine(storage, NOW + FIRST_LINE_TTL_MS - 1)).not.toBeNull();
    expect(readFirstLine(storage, NOW + FIRST_LINE_TTL_MS)).toBeNull();
    expect(storage.map.has(FIRST_LINE_KEY)).toBe(false);
  });

  it("rejects malformed JSON and malformed records", () => {
    expect(parseFirstLine("{not json", NOW)).toBeNull();
    expect(parseFirstLine("null", NOW)).toBeNull();
    expect(parseFirstLine(JSON.stringify("a line"), NOW)).toBeNull();
    const good = { ...LINE, savedAt: NOW };
    expect(parseFirstLine(JSON.stringify(good), NOW)).toEqual(good);
    expect(parseFirstLine(JSON.stringify({ ...good, removedFillers: -1 }), NOW)).toBeNull();
    expect(parseFirstLine(JSON.stringify({ ...good, removedFillers: 1.5 }), NOW)).toBeNull();
    expect(parseFirstLine(JSON.stringify({ ...good, savedAt: "today" }), NOW)).toBeNull();
    expect(parseFirstLine(JSON.stringify({ ...good, source: "model" }), NOW)).toBeNull();
    expect(
      parseFirstLine(JSON.stringify({ ...good, identity: { ...IDENTITY, version: 2 } }), NOW),
    ).toBeNull();
    expect(parseFirstLine(JSON.stringify({ ...good, savedAt: NOW + 60 * 60_000 }), NOW)).toBeNull();
  });

  it("refuses lines over 200 characters, empty lines and control characters", () => {
    const storage = memoryStorage();
    expect(saveFirstLine({ ...LINE, line: "a".repeat(201) }, storage, NOW)).toBe(false);
    expect(saveFirstLine({ ...LINE, line: "a".repeat(200) }, storage, NOW)).toBe(true);
    expect(saveFirstLine({ ...LINE, line: "   " }, storage, NOW)).toBe(false);
    expect(saveFirstLine({ ...LINE, line: "two\nlines" }, storage, NOW)).toBe(false);
    const long = JSON.stringify({ ...LINE, line: "a".repeat(201), savedAt: NOW });
    expect(parseFirstLine(long, NOW)).toBeNull();
  });

  it("never keeps the sample, which isn't the visitor's line", () => {
    const storage = memoryStorage();
    expect(saveFirstLine({ ...LINE, source: "sample" }, storage, NOW)).toBe(false);
    expect(storage.map.size).toBe(0);
    const stored = JSON.stringify({ ...LINE, source: "sample", savedAt: NOW });
    expect(parseFirstLine(stored, NOW)).toBeNull();
  });

  it("returns null or false, never throws, when storage is blocked or missing", () => {
    expect(saveFirstLine(LINE, throwing, NOW)).toBe(false);
    expect(readFirstLine(throwing, NOW)).toBeNull();
    expect(() => clearFirstLine(throwing)).not.toThrow();
    expect(saveFirstLine(LINE, null, NOW)).toBe(false);
    expect(readFirstLine(null, NOW)).toBeNull();
    // Node has no window: the default storage is "none".
    expect(readFirstLine()).toBeNull();
    expect(saveFirstLine(LINE)).toBe(false);
  });

  it("clears the line and tells subscribers about saves and clears", () => {
    const storage = memoryStorage();
    const listener = vi.fn();
    const unsubscribe = subscribeFirstLine(listener);
    saveFirstLine(LINE, storage, NOW);
    clearFirstLine(storage);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(readFirstLine(storage, NOW)).toBeNull();
    unsubscribe();
    saveFirstLine(LINE, storage, NOW);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
