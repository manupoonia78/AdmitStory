import { describe, expect, it } from "vitest";
import {
  createSignalProcessor,
  decimate,
  detectPitch,
  normaliseCentroid,
  rms,
  spectralCentroid,
  statusForError,
  toDecibels,
} from "./audio-features";

const sine = (hz: number, sampleRate: number, length: number, gain = 0.5, phase = 0) =>
  Float32Array.from(
    { length },
    (_, i) => gain * Math.sin((2 * Math.PI * hz * i) / sampleRate + phase),
  );

/** A voice-like tone: a fundamental and falling harmonics. */
const voice = (hz: number, sampleRate: number, length: number, gain = 0.4) =>
  Float32Array.from({ length }, (_, i) => {
    let sample = 0;
    for (let h = 1; h <= 5; h += 1) sample += Math.sin((2 * Math.PI * hz * h * i) / sampleRate) / h;
    return gain * 0.5 * sample;
  });

/** A dB spectrum with energy spread around `peakHz`. */
const spectrum = (peakHz: number, binHz: number, bins = 1024) =>
  Float32Array.from({ length: bins }, (_, bin) => {
    const octaves = Math.log2(Math.max(1, bin * binHz) / peakHz);
    return -20 - 30 * octaves * octaves;
  });

describe("rms and decibels", () => {
  it("is 0 for silence and 1/√2 of the peak for a sine", () => {
    expect(rms(new Float32Array(512))).toBe(0);
    expect(rms(sine(440, 48000, 4800, 1))).toBeCloseTo(Math.SQRT1_2, 2);
  });

  it("keeps silence finite", () => {
    expect(toDecibels(0)).toBe(-100);
    expect(toDecibels(1)).toBe(0);
    expect(toDecibels(0.1)).toBeCloseTo(-20, 5);
  });
});

describe("spectralCentroid", () => {
  const binHz = 48000 / 2048;

  it("is 0 for a silent spectrum", () => {
    expect(spectralCentroid(new Float32Array(1024).fill(-Infinity), binHz)).toBe(0);
  });

  it("rises with a brighter spectrum", () => {
    const dark = spectralCentroid(spectrum(400, binHz), binHz);
    const bright = spectralCentroid(spectrum(2500, binHz), binHz);
    expect(bright).toBeGreaterThan(dark * 2);
    expect(normaliseCentroid(bright)).toBeGreaterThan(normaliseCentroid(dark));
  });

  it("normalises onto 0..1", () => {
    expect(normaliseCentroid(0)).toBe(0);
    expect(normaliseCentroid(100)).toBe(0);
    expect(normaliseCentroid(20000)).toBe(1);
    expect(normaliseCentroid(1100)).toBeGreaterThan(0.4);
    expect(normaliseCentroid(1100)).toBeLessThan(0.6);
  });
});

describe("detectPitch", () => {
  it("returns null for silence", () => {
    expect(detectPitch(new Float32Array(1024), 16000)).toBeNull();
  });

  it("finds a 220 Hz sine", () => {
    const pitch = detectPitch(sine(220, 16000, 1024), 16000);
    expect(pitch?.hz).toBeCloseTo(220, 0);
    expect(pitch!.clarity).toBeGreaterThan(0.9);
  });

  it("finds the fundamental of a harmonic voice across the speaking range", () => {
    for (const hz of [95, 140, 220, 310]) {
      const found = detectPitch(voice(hz, 16000, 1024), 16000);
      expect(Math.abs((found?.hz ?? 0) - hz) / hz).toBeLessThan(0.02);
    }
  });

  it("returns null for noise", () => {
    let state = 7;
    const noise = Float32Array.from({ length: 1024 }, () => {
      state = (state * 1103515245 + 12345) % 2147483648;
      return state / 2147483648 - 0.5;
    });
    expect(detectPitch(noise, 16000)).toBeNull();
  });

  it("still finds the pitch after decimating a 48 kHz buffer", () => {
    const down = decimate(sine(180, 48000, 2048), 3);
    expect(down).toHaveLength(682);
    expect(detectPitch(down, 16000)?.hz).toBeCloseTo(180, 0);
  });
});

describe("statusForError", () => {
  it("tells a blocked microphone from a missing one and an insecure page", () => {
    expect(statusForError(new DOMException("no", "NotAllowedError"))).toBe("denied");
    expect(statusForError(new DOMException("no", "SecurityError"))).toBe("denied");
    expect(statusForError(new DOMException("none", "NotFoundError"))).toBe("error");
    expect(statusForError(new DOMException("busy", "NotReadableError"))).toBe("error");
    expect(statusForError(new TypeError("getUserMedia is not a function"))).toBe("unsupported");
    expect(statusForError("weird")).toBe("error");
  });
});

describe("createSignalProcessor", () => {
  const sampleRate = 48000;
  const fftSize = 2048;
  const binHz = sampleRate / fftSize;

  const run = (frames: number, buffer: (i: number) => Float32Array, peakHz = 1200) => {
    const signal = { amplitude: 0, centroid: 0, pitchDelta: 0 };
    const processor = createSignalProcessor(sampleRate, fftSize, signal);
    const quiet = spectrum(peakHz, binHz);
    let last = processor.process(0, buffer(0), quiet);
    for (let i = 1; i < frames; i += 1) last = processor.process(i / 60, buffer(i), quiet);
    return { signal, last, processor };
  };

  it("stays at zero in silence", () => {
    const { signal, last } = run(120, () => new Float32Array(fftSize));
    expect(signal).toEqual({ amplitude: 0, centroid: 0, pitchDelta: 0 });
    expect(last.pitchHz).toBeNull();
  });

  it("rises with speech above the room's noise floor and reports its pitch", () => {
    const hush = sine(60, sampleRate, fftSize, 0.0005);
    const { signal, last } = run(180, (i) => (i < 60 ? hush : voice(150, sampleRate, fftSize)));
    expect(signal.amplitude).toBeGreaterThan(0.5);
    expect(signal.amplitude).toBeLessThanOrEqual(1);
    expect(signal.centroid).toBeGreaterThan(0);
    expect(last.pitchHz).toBeCloseTo(150, -1);
    expect(last.snrDb).toBeGreaterThan(20);
  });

  it("turns rising pitch into a positive pitchDelta and falling into a negative one", () => {
    const glide = (direction: 1 | -1) =>
      run(90, (i) => voice(150 * 2 ** ((direction * i) / 60 / 2), sampleRate, fftSize)).signal
        .pitchDelta;
    expect(glide(1)).toBeGreaterThan(0.1);
    expect(glide(-1)).toBeLessThan(-0.1);
  });

  it("resets the signal it writes to", () => {
    const { signal, processor } = run(60, () => voice(200, sampleRate, fftSize));
    processor.reset();
    expect(signal).toEqual({ amplitude: 0, centroid: 0, pitchDelta: 0 });
  });
});
