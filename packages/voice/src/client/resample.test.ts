import { describe, expect, it } from "vitest";
import { createPcmEncoder } from "./resample";

const tone = (rate: number, hz: number, seconds: number, amplitude = 0.5) =>
  Float32Array.from(
    { length: Math.round(rate * seconds) },
    (_, i) => amplitude * Math.sin((2 * Math.PI * hz * i) / rate),
  );

/** Pushes `input` in chunks of the given sizes (cycled) and returns every output sample. */
function encode(rate: number, input: Float32Array, chunkSizes: readonly number[] = [128]) {
  const encoder = createPcmEncoder(rate);
  const frames: Int16Array[] = [];
  for (let at = 0, i = 0; at < input.length; i += 1) {
    const size = chunkSizes[i % chunkSizes.length] ?? 128;
    frames.push(...encoder.push(input.subarray(at, at + size)));
    at += size;
  }
  const rest = encoder.flush();
  if (rest) frames.push(rest);
  const out = new Int16Array(frames.reduce((sum, f) => sum + f.length, 0));
  let offset = 0;
  for (const frame of frames) {
    out.set(frame, offset);
    offset += frame.length;
  }
  return { out, frames };
}

const rms = (samples: Int16Array, skip = 200) => {
  let sum = 0;
  for (let i = skip; i < samples.length - skip; i += 1) sum += (samples[i] ?? 0) ** 2;
  return Math.sqrt(sum / (samples.length - 2 * skip)) / 32_768;
};

describe("createPcmEncoder", () => {
  it.each([48_000, 44_100, 16_000, 22_050])(
    "turns one second at %i Hz into 16 000 samples",
    (rate) => {
      const { out, frames } = encode(rate, tone(rate, 440, 1));
      expect(Math.abs(out.length - 16_000)).toBeLessThanOrEqual(1);
      // ~100 ms frames, all full but the flushed last one.
      expect(frames.slice(0, -1).every((frame) => frame.length === 1_600)).toBe(true);
    },
  );

  it("is seamless across chunk boundaries: any chunking gives the same samples", () => {
    const input = tone(44_100, 523, 0.7);
    const whole = encode(44_100, input, [input.length]).out;
    const ragged = encode(44_100, input, [1, 127, 128, 333, 4096, 7]).out;
    expect(ragged).toEqual(whole);
    // And no click: a 523 Hz tone never jumps more than its slope allows between samples.
    const maxStep = 2 * Math.PI * 523 * (0.5 / 16_000) * 32_768 * 1.1;
    for (let i = 1; i < ragged.length; i += 1)
      expect(Math.abs((ragged[i] ?? 0) - (ragged[i - 1] ?? 0))).toBeLessThan(maxStep);
  });

  it("passes speech frequencies at unity gain", () => {
    for (const rate of [48_000, 44_100]) {
      const level = rms(encode(rate, tone(rate, 1_000, 0.5)).out);
      expect(level).toBeCloseTo(0.5 / Math.SQRT2, 2);
    }
  });

  it("attenuates what would alias into the band by more than 50 dB", () => {
    for (const rate of [48_000, 44_100]) {
      // 12 kHz would fold back to ~4 kHz at 16 kHz without the filter.
      const level = rms(encode(rate, tone(rate, 12_000, 0.5)).out);
      expect(20 * Math.log10(level / (0.5 / Math.SQRT2))).toBeLessThan(-50);
    }
  });

  it("clamps out-of-range input and writes 16-bit values", () => {
    const { out } = encode(48_000, new Float32Array(4_800).fill(3));
    expect(Math.max(...out.slice(100))).toBe(32_767);
  });
});
