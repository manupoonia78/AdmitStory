"use client";

// Thin React bindings for the Studio (spec §5.2): useDictation for one spoken answer at a time,
// useReadAloud for the question. All the behaviour lives in dictation.ts and tts-player.ts.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { startPcmCapture, type PcmCapture } from "./capture";
import {
  createDictationSession,
  type DictationResult,
  type DictationSession,
  type DictationSnapshot,
  type SttTokenOutcome,
} from "./dictation";
import { fetchSttToken } from "./token";
import {
  createReadAloudPlayer,
  type ReadAloudOptions,
  type ReadAloudOutcome,
  type ReadAloudPlayer,
  type ReadAloudSnapshot,
} from "./tts-player";

/** What useDictation needs from @admitstory/ui's useMicrophone (structurally the same). */
export interface SharedMicrophone {
  start(): Promise<void>;
  audio(): { context: AudioContext; stream: MediaStream } | null;
}

export interface UseDictationOptions {
  microphone: SharedMicrophone;
  fetchToken?: () => Promise<SttTokenOutcome>;
  utteranceEndMs?: number;
  /** Recording is starting: stop the question being read aloud. */
  onStart?: () => void;
  /** The answer is complete, by "Done" or by silence after a sentence end. */
  onDone?: (result: DictationResult) => void;
}

export interface Dictation {
  snapshot: DictationSnapshot;
  /** Starts a new answer. Call from the record button's click. False if there is no microphone. */
  start(): Promise<boolean>;
  /** "Done". Resolves with the answer, or null if it was cancelled. */
  done(): Promise<DictationResult | null>;
  retry(): void;
  /** Stops and discards the answer (e.g. "type instead"). */
  cancel(): void;
}

const IDLE_DICTATION: DictationSnapshot = {
  state: "idle",
  text: "",
  interim: "",
  seconds: 0,
  language: null,
  autoEnded: false,
  connection: "closed",
  refusal: null,
  remainingSeconds: null,
};

const noSubscription = () => () => {};

export function useDictation(options: UseDictationOptions): Dictation {
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });
  const [session, setSession] = useState<DictationSession | null>(null);
  const capture = useRef<PcmCapture | null>(null);
  // A second tap while the first is still waiting on the microphone prompt starts nothing.
  const starting = useRef(false);

  const snapshot = useSyncExternalStore(
    session ? session.subscribe : noSubscription,
    session ? session.getSnapshot : () => IDLE_DICTATION,
    () => IDLE_DICTATION,
  );

  const stopCapture = useCallback(() => {
    capture.current?.close();
    capture.current = null;
  }, []);

  const start = useCallback(async () => {
    if (starting.current) return false;
    starting.current = true;
    const { microphone, fetchToken, utteranceEndMs, onStart } = latest.current;
    onStart?.();
    stopCapture();
    try {
      await microphone.start();
    } finally {
      starting.current = false;
    }
    const audio = microphone.audio();
    if (!audio) return false;
    void audio.context.resume().catch(() => {});

    const next = createDictationSession({
      fetchToken: fetchToken ?? (() => fetchSttToken()),
      utteranceEndMs,
      onDone: (result) => latest.current.onDone?.(result),
    });
    // The capture ends with the answer, however it ends.
    const ended = () => {
      const { state } = next.getSnapshot();
      return state === "finishing" || state === "done" || state === "refused";
    };
    next.subscribe(() => {
      if (ended()) stopCapture();
    });
    setSession((previous) => {
      previous?.dispose();
      return next;
    });
    next.start();
    try {
      capture.current = await startPcmCapture(audio.context, audio.stream, (pcm) =>
        next.pushAudio(pcm),
      );
    } catch {
      next.dispose();
      setSession((current) => (current === next ? null : current));
      return false;
    }
    // It may have ended (a refused token) while the capture was starting.
    if (ended()) stopCapture();
    return true;
  }, [stopCapture]);

  const done = useCallback(async () => {
    if (!session) return null;
    await capture.current?.flush();
    stopCapture();
    return session.finish();
  }, [session, stopCapture]);

  const retry = useCallback(() => session?.retry(), [session]);

  const cancel = useCallback(() => {
    stopCapture();
    session?.dispose();
    setSession(null);
  }, [session, stopCapture]);

  useEffect(() => () => session?.dispose(), [session]);
  useEffect(() => stopCapture, [stopCapture]);

  return { snapshot, start, done, retry, cancel };
}

export interface ReadAloud extends ReadAloudSnapshot {
  speak(text: string): Promise<ReadAloudOutcome>;
  stop(): void;
  /** Call inside a user gesture (record, Done, unmute) so iOS lets the question play later. */
  unlock(): void;
}

export function useReadAloud(
  options: Omit<ReadAloudOptions, "onEnd"> & {
    onEnd?: (outcome: ReadAloudOutcome) => void;
  } = {},
): ReadAloud {
  const onEnd = useRef(options.onEnd);
  useEffect(() => {
    onEnd.current = options.onEnd;
  });
  // Created once; the audio context itself is only made on unlock() or speak().
  const [player] = useState<ReadAloudPlayer>(() =>
    createReadAloudPlayer({ ...options, onEnd: (outcome) => onEnd.current?.(outcome) }),
  );
  const snapshot = useSyncExternalStore(player.subscribe, player.getSnapshot, player.getSnapshot);
  useEffect(() => () => player.dispose(), [player]);

  const speak = useCallback((text: string) => player.speak({ text }), [player]);
  return { ...snapshot, speak, stop: player.stop, unlock: player.unlock };
}
