// "Keep this line" (direction §4.2, plan §3.2 and §5): the contract between the landing hero, which
// saves the visitor's first line, and sign-in and first run, which read it back.
//
// The line lives in this browser only, in localStorage (deviation D2: the magic link opens a new
// tab, and sessionStorage is per tab), for 24 hours. Nothing reaches our servers until the
// first-run checkbox sends it. Every storage access is wrapped: a private window or blocked site
// data means "no line", never an error.

import type { VoiceprintIdentity } from "@admitstory/shared";

export const FIRST_LINE_KEY = "admitstory.first-line.v1";
/** The <SharedElement name> the line flies under, on the landing page and on /sign-in. */
export const FIRST_LINE_TRANSITION = "first-line";
export const FIRST_LINE_MAX_CHARS = 200;
export const FIRST_LINE_TTL_MS = 24 * 60 * 60 * 1000;

/** How the line was made. A sample is never kept: it isn't the visitor's line. */
export type FirstLineSource = "voice" | "sample" | "written";

export interface FirstLine {
  line: string;
  source: FirstLineSource;
  identity: VoiceprintIdentity | null;
  /** How many filler words the cleanup removed ("We removed 2 filler words."). */
  removedFillers: number;
  /** Epoch milliseconds. */
  savedAt: number;
}

/** What a page may keep: the sample is excluded by type as well as at runtime. */
export type KeepableFirstLine = Omit<FirstLine, "savedAt">;

type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;

/** Allowed clock skew between a save and a read (another tab, a corrected clock). */
const FUTURE_SKEW_MS = 5 * 60 * 1000;
const MAX_FILLERS = 200;
// C0 and C1 control characters, including newlines and tabs: the line is one line.
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/;

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** The line, trimmed, if it is 1–200 characters with no control characters; otherwise null. */
export function cleanLine(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const line = value.trim();
  if (line.length === 0 || line.length > FIRST_LINE_MAX_CHARS) return null;
  if (CONTROL.test(line)) return null;
  return line;
}

/**
 * The identity if it is well formed, else null. The same checks as the prototypes'
 * parseStoredIdentity (apps/web/app/prototype/_shared/identity.ts), copied so the product never
 * imports from a prototype.
 */
export function parseIdentity(value: unknown): VoiceprintIdentity | null {
  if (typeof value !== "object" || value === null) return null;
  const identity = value as Partial<VoiceprintIdentity>;
  const valid =
    identity.version === 1 &&
    isNumber(identity.avgPitchHz) &&
    isNumber(identity.paceWpm) &&
    isNumber(identity.pitchRangeSemitones) &&
    isNumber(identity.pauseRhythm) &&
    (identity.source === "voice" || identity.source === "text" || identity.source === "default");
  if (!valid) return null;
  return {
    version: 1,
    avgPitchHz: identity.avgPitchHz as number,
    paceWpm: identity.paceWpm as number,
    pitchRangeSemitones: identity.pitchRangeSemitones as number,
    pauseRhythm: identity.pauseRhythm as number,
    source: identity.source as VoiceprintIdentity["source"],
  };
}

/** Pure: what storage held, if it is a valid, unexpired line that may be kept; otherwise null. */
export function parseFirstLine(raw: string | null, now: number): FirstLine | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const stored = value as Record<string, unknown>;
  const line = cleanLine(stored.line);
  if (!line) return null;
  if (stored.source !== "voice" && stored.source !== "written") return null;
  const removedFillers = stored.removedFillers;
  if (
    !isNumber(removedFillers) ||
    !Number.isInteger(removedFillers) ||
    removedFillers < 0 ||
    removedFillers > MAX_FILLERS
  ) {
    return null;
  }
  const savedAt = stored.savedAt;
  if (!isNumber(savedAt)) return null;
  if (now - savedAt >= FIRST_LINE_TTL_MS || savedAt - now > FUTURE_SKEW_MS) return null;
  const identity = stored.identity === null ? null : parseIdentity(stored.identity);
  if (stored.identity !== null && identity === null) return null;
  return { line, source: stored.source, identity, removedFillers, savedAt };
}

function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    // Reading window.localStorage itself throws when site data is blocked.
    return null;
  }
}

const listeners = new Set<() => void>();
function notify() {
  for (const listener of listeners) listener();
}

/**
 * Keeps the line for 24 hours. Returns false if it can't: a sample, an invalid line, or storage
 * that is full or blocked.
 */
export function saveFirstLine(
  value: KeepableFirstLine,
  storage: Storage | null = browserStorage(),
  now: number = Date.now(),
): boolean {
  if (value.source === "sample") return false;
  const line = cleanLine(value.line);
  if (!line || !storage) return false;
  const record: FirstLine = {
    line,
    source: value.source,
    identity: value.identity ? parseIdentity(value.identity) : null,
    removedFillers: Math.max(0, Math.min(MAX_FILLERS, Math.round(value.removedFillers))),
    savedAt: now,
  };
  try {
    storage.setItem(FIRST_LINE_KEY, JSON.stringify(record));
  } catch {
    return false;
  }
  notify();
  return true;
}

// One snapshot per stored string, so readFirstLine works as a useSyncExternalStore getSnapshot.
let last: { raw: string | null; value: FirstLine | null } | null = null;

/** The kept line, or null when there is none, it has expired, or storage is blocked. */
export function readFirstLine(
  storage: Storage | null = browserStorage(),
  now: number = Date.now(),
): FirstLine | null {
  if (!storage) return null;
  let raw: string | null;
  try {
    raw = storage.getItem(FIRST_LINE_KEY);
  } catch {
    return null;
  }
  if (last && last.raw === raw && (last.value === null || parseFirstLine(raw, now) !== null)) {
    return last.value;
  }
  const value = parseFirstLine(raw, now);
  if (raw !== null && value === null) {
    // Expired or malformed: tidy it away so it can't be read later.
    try {
      storage.removeItem(FIRST_LINE_KEY);
    } catch {
      // Blocked; nothing to tidy.
    }
    raw = null;
  }
  last = { raw, value };
  return value;
}

/** Forgets the line: once it has been used, or the visitor unticked "Start Story Studio with…". */
export function clearFirstLine(storage: Storage | null = browserStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(FIRST_LINE_KEY);
  } catch {
    return;
  }
  notify();
}

/** useSyncExternalStore subscribe: this tab's saves and clears, and other tabs' changes. */
export function subscribeFirstLine(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === FIRST_LINE_KEY) listener();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}
