"use client";

// The microphone behind a live Voiceprint (spec §6.2, §7.5): getUserMedia with echo cancellation
// and noise suppression, an AnalyserNode, and per-frame features written into a VoiceSignalRef.
// Nothing is recorded or kept: each frame is analysed and dropped. Only the status is React
// state, so speaking never re-renders anything.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSignalProcessor, statusForError, type AnalysisFrame } from "./audio-features";
import type { LiveVoiceSignal, MicrophoneState, VoiceSignalRef } from "./types";

export const SILENT_SIGNAL: Readonly<LiveVoiceSignal> = {
  amplitude: 0,
  centroid: 0,
  pitchDelta: 0,
};

export interface MicrophoneOptions {
  /** Called once per analysed frame (e.g. to feed an IdentityAccumulator). Never React state. */
  onFrame?: (frame: AnalysisFrame) => void;
}

const FFT_SIZE = 2048;

type AudioContextConstructor = typeof AudioContext;

function audioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === "undefined") return null;
  const legacy = (window as unknown as { webkitAudioContext?: AudioContextConstructor })
    .webkitAudioContext;
  return window.AudioContext ?? legacy ?? null;
}

/** True when this browser can give us a microphone at all (secure context, Web Audio). */
export function microphoneSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    audioContextConstructor() !== null
  );
}

interface Session {
  close(): void;
}

/** Wires a granted stream to the analyser and starts the per-frame loop. */
function openSession(
  context: AudioContext,
  stream: MediaStream,
  signal: LiveVoiceSignal,
  onFrame: (frame: AnalysisFrame) => void,
  onEnded: () => void,
): Session {
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  // Smoothing happens in the processor, with separate attack and release.
  analyser.smoothingTimeConstant = 0;
  source.connect(analyser);

  const timeDomain = new Float32Array(analyser.fftSize);
  const spectrum = new Float32Array(analyser.frequencyBinCount);
  const processor = createSignalProcessor(context.sampleRate, analyser.fftSize, signal);

  let frame = requestAnimationFrame(function tick(now) {
    frame = requestAnimationFrame(tick);
    analyser.getFloatTimeDomainData(timeDomain);
    analyser.getFloatFrequencyData(spectrum);
    onFrame(processor.process(now / 1000, timeDomain, spectrum));
  });

  // The device was unplugged or the permission revoked mid-session.
  const tracks = stream.getAudioTracks();
  for (const track of tracks) track.addEventListener("ended", onEnded);

  return {
    close() {
      cancelAnimationFrame(frame);
      for (const track of tracks) {
        track.removeEventListener("ended", onEnded);
        track.stop();
      }
      source.disconnect();
      void context.close().catch(() => {});
      processor.reset();
    },
  };
}

/**
 * The microphone as a live voice signal. start() asks for permission (call it from a click, so
 * Safari lets the audio context run); stop() releases the tracks and closes the context, and the
 * same happens on unmount.
 */
export function useMicrophone(options: MicrophoneOptions = {}): MicrophoneState {
  const signal = useRef<LiveVoiceSignal>({ ...SILENT_SIGNAL }) as VoiceSignalRef;
  const [status, setStatus] = useState<MicrophoneState["status"]>("idle");
  const session = useRef<Session | null>(null);
  // Each start() gets a token; a stop() or unmount while the permission prompt is open voids it.
  const attempt = useRef(0);
  const onFrame = useRef(options.onFrame);

  useEffect(() => {
    onFrame.current = options.onFrame;
  });

  const release = useCallback(() => {
    attempt.current += 1;
    session.current?.close();
    session.current = null;
    Object.assign(signal.current, SILENT_SIGNAL);
  }, [signal]);

  const stop = useCallback(() => {
    release();
    setStatus((current) => (current === "live" || current === "requesting" ? "idle" : current));
  }, [release]);

  const start = useCallback(async () => {
    if (session.current) return;
    const Context = audioContextConstructor();
    if (!microphoneSupported() || !Context) {
      setStatus("unsupported");
      return;
    }
    const token = ++attempt.current;
    setStatus("requesting");
    // Created inside the click, before the permission prompt, so it is allowed to start.
    let context: AudioContext | null = null;
    try {
      context = new Context();
      void context.resume().catch(() => {});
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
      if (token !== attempt.current) {
        for (const track of stream.getTracks()) track.stop();
        void context.close().catch(() => {});
        return;
      }
      session.current = openSession(
        context,
        stream,
        signal.current,
        (frame) => onFrame.current?.(frame),
        () => {
          release();
          setStatus("error");
        },
      );
      setStatus("live");
    } catch (error) {
      void context?.close().catch(() => {});
      if (token === attempt.current) setStatus(statusForError(error));
    }
  }, [release, signal]);

  useEffect(() => release, [release]);

  return useMemo(() => ({ status, start, stop, signal }), [status, start, stop, signal]);
}
