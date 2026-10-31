import { runInNewContext } from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CAPTURE_PROCESSOR, captureWorkletSource, FRAME_SAMPLES, startPcmCapture } from "./capture";

interface Port {
  posted: unknown[];
  onmessage: ((event: { data: unknown }) => void) | null;
  postMessage(data: unknown): void;
}

/** Runs the worklet module in an isolated scope with only what AudioWorkletGlobalScope offers. */
function loadProcessor(sampleRate: number) {
  const registered = new Map<
    string,
    new (options: unknown) => { port: Port; process(inputs: Float32Array[][]): boolean }
  >();
  class AudioWorkletProcessor {
    port: Port = {
      posted: [],
      onmessage: null,
      postMessage(data) {
        this.posted.push(data);
      },
    };
  }
  runInNewContext(captureWorkletSource(), {
    AudioWorkletProcessor,
    sampleRate,
    registerProcessor: (name: string, processor: never) => registered.set(name, processor),
  });
  const Processor = registered.get(CAPTURE_PROCESSOR);
  if (!Processor) throw new Error("processor not registered");
  return new Processor({ processorOptions: { outputRate: 16_000, frameSamples: FRAME_SAMPLES } });
}

describe("capture worklet", () => {
  it("is self-contained and posts 100 ms 16 kHz frames from 128-sample quanta", () => {
    const processor = loadProcessor(48_000);
    const quantum = new Float32Array(128).fill(0.25);
    // 0.55 s at 48 kHz.
    for (let i = 0; i < Math.ceil((48_000 * 0.55) / 128); i += 1)
      expect(processor.process([[quantum]])).toBe(true);
    const frames = processor.port.posted as Int16Array[];
    expect(frames).toHaveLength(5);
    expect(frames.every((frame) => frame.length === FRAME_SAMPLES)).toBe(true);
    expect(Math.abs((frames[4]?.[800] ?? 0) - 0.25 * 32_767)).toBeLessThanOrEqual(1);

    processor.port.onmessage?.({ data: "flush" });
    expect(processor.port.posted.at(-1)).toBe("flushed");
    expect((processor.port.posted.at(-2) as Int16Array).length).toBeGreaterThan(700);

    processor.port.onmessage?.({ data: "stop" });
    expect(processor.process([[quantum]])).toBe(false);
  });

  it("survives an input with no channels (device switching)", () => {
    expect(loadProcessor(44_100).process([[]])).toBe(true);
  });
});

describe("startPcmCapture", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("falls back to a ScriptProcessor without AudioWorklet and frames its audio", async () => {
    const node = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      onaudioprocess: null as null | ((e: unknown) => void),
    };
    const graphNode = () => ({ connect: vi.fn(), disconnect: vi.fn(), gain: { value: 1 } });
    const context = {
      sampleRate: 48_000,
      destination: {},
      createMediaStreamSource: vi.fn(graphNode),
      createGain: vi.fn(graphNode),
      createScriptProcessor: vi.fn(() => node),
    } as unknown as AudioContext;
    const frames: Int16Array[] = [];
    const capture = await startPcmCapture(context, {} as MediaStream, (pcm) => frames.push(pcm));
    expect(capture.kind).toBe("script-processor");
    const samples = new Float32Array(4096).fill(0.1);
    node.onaudioprocess?.({ inputBuffer: { getChannelData: () => samples } });
    expect(frames).toHaveLength(Math.floor(4096 / 3 / FRAME_SAMPLES));
    await capture.flush();
    expect(frames.reduce((sum, f) => sum + f.length, 0)).toBe(Math.floor(4096 / 3));
    capture.close();
    expect(node.onaudioprocess).toBeNull();
  });
});
