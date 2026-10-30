"use client";

// The prototype applicant's Voiceprint identity and hue, shared by every prototype route and kept
// in this browser only. Fake data: in the product the identity is computed from the first three
// minutes of Studio speech and stored on the profile (spec §6.2).

import {
  DEFAULT_IDENTITY,
  VOICE_HUES,
  paramsFromIdentity,
  type VoiceprintIdentity,
} from "@admitstory/ui";
import { useCallback, useSyncExternalStore } from "react";

export const PROTOTYPE_IDENTITY_KEY = "admitstory.prototype.identity.v1";

export interface StoredIdentity {
  identity: VoiceprintIdentity;
  /** A hue chosen by hand (an index into VOICE_HUES); null means the identity's own hue. */
  hue: number | null;
}

const DEFAULT_STORED: StoredIdentity = { identity: DEFAULT_IDENTITY, hue: null };

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** Reads what localStorage held, falling back to the default for anything missing or malformed. */
export function parseStoredIdentity(raw: string | null): StoredIdentity {
  if (!raw) return DEFAULT_STORED;
  try {
    const value = JSON.parse(raw) as { identity?: Partial<VoiceprintIdentity>; hue?: unknown };
    const identity = value.identity;
    const valid =
      identity?.version === 1 &&
      isNumber(identity.avgPitchHz) &&
      isNumber(identity.paceWpm) &&
      isNumber(identity.pitchRangeSemitones) &&
      isNumber(identity.pauseRhythm) &&
      (identity.source === "voice" || identity.source === "text" || identity.source === "default");
    const hue =
      isNumber(value.hue) &&
      Number.isInteger(value.hue) &&
      value.hue >= 0 &&
      value.hue < VOICE_HUES.length;
    return {
      identity: valid ? (identity as VoiceprintIdentity) : DEFAULT_IDENTITY,
      hue: hue ? (value.hue as number) : null,
    };
  } catch {
    return DEFAULT_STORED;
  }
}

// One snapshot object per stored value, so useSyncExternalStore sees a stable reference.
let snapshot: StoredIdentity | null = null;
const listeners = new Set<() => void>();

function read(): StoredIdentity {
  if (snapshot) return snapshot;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(PROTOTYPE_IDENTITY_KEY);
  } catch {
    // Storage blocked (private window, site data off): the default identity still works.
  }
  snapshot = parseStoredIdentity(raw);
  return snapshot;
}

function write(next: StoredIdentity) {
  snapshot = next;
  try {
    window.localStorage.setItem(PROTOTYPE_IDENTITY_KEY, JSON.stringify(next));
  } catch {
    // Kept in memory for this page instead.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab changed it.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== PROTOTYPE_IDENTITY_KEY) return;
    snapshot = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export type PrototypeIdentity = [
  identity: VoiceprintIdentity,
  setIdentity: (identity: VoiceprintIdentity) => void,
  hueIndex: number,
  setHue: (hueIndex: number | null) => void,
];

/**
 * [identity, setIdentity, hueIndex, setHue]. The hue is the identity's own until one is picked;
 * setHue(null) goes back to it. Server render and hydration use the default identity.
 */
export function usePrototypeIdentity(): PrototypeIdentity {
  const stored = useSyncExternalStore(subscribe, read, () => DEFAULT_STORED);
  const setIdentity = useCallback(
    (identity: VoiceprintIdentity) => write({ ...read(), identity }),
    [],
  );
  const setHue = useCallback((hue: number | null) => write({ ...read(), hue }), []);
  const hueIndex = stored.hue ?? paramsFromIdentity(stored.identity).hueIndex;
  return [stored.identity, setIdentity, hueIndex, setHue];
}
