// Speech features behind the live Voiceprint (spec §6.2): amplitude, spectral centroid and pitch
// movement, computed per animation frame from an AnalyserNode. Pure functions plus one small
// stateful processor, so everything here runs (and is tested) without a microphone.

import type { LiveVoiceSignal } from "./types";

/** One analysed frame. The identity accumulator reads these; nothing here keeps audio. */
export interface AnalysisFrame {
  /** Seconds, monotonic. */
  time: number;
  /** Seconds since the previous frame; 0 after a gap (hidden tab). */
  dt: number;
  /** Level above the tracked noise floor, in dB (0 in silence). */
  snrDb: number;
  /** Normalised loudness, 0..1 (the same number written to the live signal). */
  amplitude: number;
  /** Normalised spectral centroid, 0..1. */
  centroid: number;
  /** Fundamental frequency on voiced frames, else null. */
  pitchHz: number | null;
  /** -1..1, smoothed direction of pitch movement. */
  pitchDelta: number;
}

/** Root mean square of a buffer of samples in -1..1. */
export function rms(buffer: ArrayLike<number>): number {
  if (buffer.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    const sample = buffer[i] ?? 0;
    sum += sample * sample;
  }
  return Math.sqrt(sum / buffer.length);
}

const SILENCE_DB = -100;

/** dBFS of an RMS value, floored at -100 so silence stays a finite number. */
export function toDecibels(value: number): number {
  return value > 0 ? Math.max(SILENCE_DB, 20 * Math.log10(value)) : SILENCE_DB;
}

/**
 * Spectral centroid in Hz of a dB spectrum (AnalyserNode.getFloatFrequencyData), over the band
 * that carries speech. 0 when the band is silent. Brighter, sharper sounds have a higher centroid.
 */
export function spectralCentroid(
  spectrumDb: ArrayLike<number>,
  binHz: number,
  minHz = 80,
  maxHz = 8000,
): number {
  const first = Math.max(1, Math.ceil(minHz / binHz));
  const last = Math.min(spectrumDb.length - 1, Math.floor(maxHz / binHz));
  let weighted = 0;
  let total = 0;
  for (let bin = first; bin <= last; bin += 1) {
    const db = spectrumDb[bin] ?? -Infinity;
    if (!Number.isFinite(db)) continue;
    const magnitude = 10 ** (db / 20);
    weighted += magnitude * bin * binHz;
    total += magnitude;
  }
  return total > 1e-9 ? weighted / total : 0;
}

// Speech centroids sit roughly between a dark 300 Hz and a hissing 4 kHz.
const CENTROID_LOW_HZ = 300;
const CENTROID_HIGH_HZ = 4000;

/** A centroid in Hz as 0..1 on a log scale (as hearing works). */
export function normaliseCentroid(hz: number): number {
  if (!(hz > 0)) return 0;
  const position = Math.log(hz / CENTROID_LOW_HZ) / Math.log(CENTROID_HIGH_HZ / CENTROID_LOW_HZ);
  return Math.min(1, Math.max(0, position));
}

/** Box-filter downsampling by an integer factor: cheap, and enough for pitch below 400 Hz. */
export function decimate(input: ArrayLike<number>, factor: number, output?: Float32Array) {
  const step = Math.max(1, Math.floor(factor));
  const length = Math.floor(input.length / step);
  const out = output && output.length >= length ? output : new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    let sum = 0;
    for (let j = 0; j < step; j += 1) sum += input[i * step + j] ?? 0;
    out[i] = sum / step;
  }
  return out.subarray(0, length);
}

export interface PitchOptions {
  minHz?: number;
  maxHz?: number;
  /** YIN's absolute threshold on the normalised difference; lower is stricter. */
  threshold?: number;
}

export interface Pitch {
  hz: number;
  /** 0..1, how periodic the frame is (1 - the normalised difference at the chosen lag). */
  clarity: number;
}

/**
 * YIN pitch detection (de Cheveigné and Kawahara, 2002): the cumulative-mean-normalised
 * difference function, the first dip under the threshold, then parabolic interpolation.
 * Returns null on unvoiced or silent frames. The buffer must hold at least two periods of
 * minHz; downsample first (decimate) to keep it cheap.
 */
export function detectPitch(
  buffer: ArrayLike<number>,
  sampleRate: number,
  { minHz = 70, maxHz = 400, threshold = 0.15 }: PitchOptions = {},
): Pitch | null {
  const maxLag = Math.min(Math.floor(sampleRate / minHz), Math.floor(buffer.length / 2));
  const minLag = Math.max(2, Math.floor(sampleRate / maxHz));
  if (maxLag <= minLag + 2 || rms(buffer) < 1e-4) return null;
  const window = buffer.length - maxLag;

  const diff = new Float32Array(maxLag + 1);
  for (let lag = 1; lag <= maxLag; lag += 1) {
    let sum = 0;
    for (let i = 0; i < window; i += 1) {
      const delta = (buffer[i] ?? 0) - (buffer[i + lag] ?? 0);
      sum += delta * delta;
    }
    diff[lag] = sum;
  }

  // Cumulative mean normalised difference; cmnd[0] is 1 by definition.
  const cmnd = new Float32Array(maxLag + 1);
  cmnd[0] = 1;
  let running = 0;
  for (let lag = 1; lag <= maxLag; lag += 1) {
    running += diff[lag] ?? 0;
    cmnd[lag] = running > 0 ? ((diff[lag] ?? 0) * lag) / running : 1;
  }

  let lag = -1;
  for (let candidate = minLag; candidate <= maxLag; candidate += 1) {
    if ((cmnd[candidate] ?? 1) < threshold) {
      // Walk down to the bottom of this dip.
      while (candidate + 1 <= maxLag && (cmnd[candidate + 1] ?? 1) < (cmnd[candidate] ?? 1)) {
        candidate += 1;
      }
      lag = candidate;
      break;
    }
  }
  if (lag < 0) return null;

  const before = cmnd[lag - 1] ?? cmnd[lag] ?? 1;
  const at = cmnd[lag] ?? 1;
  const after = cmnd[lag + 1] ?? at;
  const curve = before + after - 2 * at;
  const shift = curve > 0 ? (before - after) / (2 * curve) : 0;
  const refined = lag + Math.max(-1, Math.min(1, shift));
  return { hz: sampleRate / refined, clarity: Math.max(0, Math.min(1, 1 - at)) };
}

/** Classifies a getUserMedia failure into the microphone states the UI words differently. */
export function statusForError(error: unknown): "denied" | "unsupported" | "error" {
  const name =
    typeof error === "object" && error !== null && "name" in error ? String(error.name) : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
    return "denied";
  }
  // getUserMedia is missing outside secure contexts and throws a TypeError when called anyway.
  if (name === "TypeError" || name === "NotSupportedError") return "unsupported";
  return "error";
}

/* The processor --------------------------------------------------------------------------- */

/** Exponential smoothing towards `target` with time constant `tau` seconds. */
export function smooth(current: number, target: number, dt: number, tau: number): number {
  if (dt <= 0) return current;
  return current + (target - current) * (1 - Math.exp(-dt / tau));
}

// Loudness: the noise floor drops instantly and creeps up slowly, so it follows the room, not the
// speaker. Amplitude spans 34 dB above a gate 8 dB over the floor.
const FLOOR_START_DB = -60;
const FLOOR_MIN_DB = -90;
const FLOOR_MAX_DB = -35;
const FLOOR_RISE_DB_PER_S = 1.5;
const GATE_DB = 8;
const SPAN_DB = 34;
const ATTACK_S = 0.03;
const RELEASE_S = 0.2;

// Pitch runs at most ~33 times a second on a ~16 kHz copy of the buffer: plenty for a
// direction of movement, and cheap at 120 Hz frame rates.
const PITCH_INTERVAL_S = 0.03;
const PITCH_RATE_HZ = 16000;
/** Semitones per second that reads as full swirl. */
const PITCH_DELTA_FULL = 20;
const MAX_GAP_S = 0.25;

export interface SignalProcessor {
  /** Analyse one frame; writes the live numbers into `signal` and returns the frame. */
  process(time: number, timeDomain: Float32Array, spectrumDb: Float32Array): AnalysisFrame;
  reset(): void;
}

export function createSignalProcessor(
  sampleRate: number,
  fftSize: number,
  signal: LiveVoiceSignal,
): SignalProcessor {
  const binHz = sampleRate / fftSize;
  const factor = Math.max(1, Math.floor(sampleRate / PITCH_RATE_HZ));
  const pitchRate = sampleRate / factor;
  const scratch = new Float32Array(Math.ceil(fftSize / factor));

  let lastTime: number | null = null;
  let floorDb = FLOOR_START_DB;
  let amplitude = 0;
  let centroid = 0;
  let pitchDelta = 0;
  let pitchHz: number | null = null;
  let lastPitchRun = -Infinity;
  let previousPitch: { hz: number; time: number } | null = null;

  const reset = () => {
    lastTime = null;
    floorDb = FLOOR_START_DB;
    amplitude = 0;
    centroid = 0;
    pitchDelta = 0;
    pitchHz = null;
    lastPitchRun = -Infinity;
    previousPitch = null;
    signal.amplitude = 0;
    signal.centroid = 0;
    signal.pitchDelta = 0;
  };

  return {
    reset,
    process(time, timeDomain, spectrumDb) {
      const gap = lastTime === null ? 0 : time - lastTime;
      const dt = gap > 0 && gap < MAX_GAP_S ? gap : 0;
      lastTime = time;

      const level = toDecibels(rms(timeDomain));
      floorDb =
        level < floorDb
          ? Math.max(FLOOR_MIN_DB, level)
          : Math.min(FLOOR_MAX_DB, floorDb + FLOOR_RISE_DB_PER_S * dt);
      const snrDb = Math.max(0, level - floorDb);
      const loudness = Math.min(1, Math.max(0, (snrDb - GATE_DB) / SPAN_DB));
      amplitude =
        dt > 0 ? smooth(amplitude, loudness, dt, loudness > amplitude ? ATTACK_S : RELEASE_S) : 0;

      const audible = loudness > 0.02;
      centroid = smooth(
        centroid,
        audible ? normaliseCentroid(spectralCentroid(spectrumDb, binHz)) : 0,
        dt,
        audible ? 0.08 : 0.5,
      );

      if (time - lastPitchRun >= PITCH_INTERVAL_S) {
        lastPitchRun = time;
        const found = audible
          ? detectPitch(decimate(timeDomain, factor, scratch), pitchRate)
          : null;
        pitchHz = found ? found.hz : null;
        let target = 0;
        if (found && previousPitch && time - previousPitch.time < 0.15) {
          const semitones = 12 * Math.log2(found.hz / previousPitch.hz);
          // Jumps of half an octave or more are detection slips, not intonation.
          if (Math.abs(semitones) < 6) {
            const rate = semitones / Math.max(1e-3, time - previousPitch.time);
            target = Math.max(-1, Math.min(1, rate / PITCH_DELTA_FULL));
          }
        }
        previousPitch = found ? { hz: found.hz, time } : null;
        pitchDelta = smooth(pitchDelta, target, Math.max(dt, PITCH_INTERVAL_S), found ? 0.15 : 0.4);
      }

      signal.amplitude = amplitude;
      signal.centroid = centroid;
      signal.pitchDelta = pitchDelta;
      return { time, dt, snrDb, amplitude, centroid, pitchHz, pitchDelta };
    },
  };
}
