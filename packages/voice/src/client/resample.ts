// Microphone audio → dictation audio (spec §7.5): the context's Float32 samples (44.1 or 48 kHz,
// or whatever iOS hands us) become 16 kHz mono 16-bit PCM in ~100 ms frames for Deepgram.
//
// createPcmEncoder must stay self-contained — no imports, no references outside its own body —
// because capture-worklet.ts ships its source text into the AudioWorklet scope, which cannot
// import anything. Arrow functions only inside it, so no bundler adds name helpers.

export interface PcmEncoder {
  /** Feeds input samples; returns every frame completed by them (often none). */
  push(input: Float32Array): Int16Array[];
  /** The partly filled frame, if any, so the last few milliseconds of an answer are not lost. */
  flush(): Int16Array | null;
}

/**
 * A stateful resampler and framer. Each output sample is read from a 64-tap Blackman-windowed
 * sinc low-pass (cutoff 0.45 × the lower rate, so speech up to ~7.2 kHz passes and anything that
 * would fold back into the band is ~70 dB down), linearly interpolated at the fractional input
 * position. Filter history carries across push() calls, so chunk boundaries are seamless.
 * Int16Array is little-endian on every platform a browser runs on.
 */
export function createPcmEncoder(
  inputRate: number,
  outputRate = 16_000,
  frameSamples = 1_600,
): PcmEncoder {
  const taps = 64;
  const ratio = inputRate / outputRate;
  const cutoff = (0.45 * Math.min(inputRate, outputRate)) / inputRate;
  const kernel = new Float32Array(taps);
  const middle = (taps - 1) / 2;
  let gain = 0;
  for (let i = 0; i < taps; i += 1) {
    const x = i - middle;
    const sinc = x === 0 ? 2 * cutoff : Math.sin(2 * Math.PI * cutoff * x) / (Math.PI * x);
    const phase = (2 * Math.PI * i) / (taps - 1);
    const blackman = 0.42 - 0.5 * Math.cos(phase) + 0.08 * Math.cos(2 * phase);
    kernel[i] = sinc * blackman;
    gain += sinc * blackman;
  }
  for (let i = 0; i < taps; i += 1) kernel[i] = (kernel[i] ?? 0) / gain;

  // Input samples from absolute index `start`; the stream begins with `taps` samples of silence.
  let buffer = new Float32Array(taps * 4);
  let start = -taps;
  let length = taps;
  let next = 0; // absolute index of the next output sample
  let frame = new Int16Array(frameSamples);
  let filled = 0;

  const filtered = (index: number): number => {
    const base = index - start;
    let sum = 0;
    for (let k = 0; k < taps; k += 1) sum += (kernel[k] ?? 0) * (buffer[base - k] ?? 0);
    return sum;
  };

  const toInt16 = (value: number): number => {
    const clamped = value > 1 ? 1 : value < -1 ? -1 : value;
    return Math.round(clamped < 0 ? clamped * 32_768 : clamped * 32_767);
  };

  return {
    push(input) {
      if (length + input.length > buffer.length) {
        const grown = new Float32Array(Math.max(buffer.length * 2, length + input.length));
        grown.set(buffer.subarray(0, length));
        buffer = grown;
      }
      buffer.set(input, length);
      length += input.length;

      const frames: Int16Array[] = [];
      const last = start + length - 1;
      for (;;) {
        const position = next * ratio;
        const index = Math.floor(position);
        if (index + 1 > last) break;
        const a = filtered(index);
        const value = a + (filtered(index + 1) - a) * (position - index);
        frame[filled] = toInt16(value);
        filled += 1;
        next += 1;
        if (filled === frameSamples) {
          frames.push(frame);
          frame = new Int16Array(frameSamples);
          filled = 0;
        }
      }

      // Keep only the history the next output sample's filter needs.
      const keepFrom = Math.floor(next * ratio) - taps;
      const drop = keepFrom - start;
      if (drop > 0) {
        buffer.copyWithin(0, drop, length);
        length -= drop;
        start = keepFrom;
      }
      return frames;
    },
    flush() {
      if (filled === 0) return null;
      const partial = frame.slice(0, filled);
      filled = 0;
      return partial;
    },
  };
}
