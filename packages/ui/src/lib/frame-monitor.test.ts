import { describe, expect, it } from "vitest";
import {
  createFrameMonitor,
  fpsFromIntervals,
  isSustained,
  percentile,
  summarizeFrames,
} from "./frame-monitor";

const OPTIONS = { windowSize: 10, slowFrameMs: 12, slowRatio: 0.5 };
const repeat = (ms: number, count: number) => Array.from({ length: count }, () => ms);

describe("frame statistics", () => {
  it("takes nearest-rank percentiles", () => {
    expect(percentile([], 95)).toBe(0);
    expect(percentile([5, 1, 3, 2, 4], 50)).toBe(3);
    expect(percentile([...repeat(8, 19), 40], 95)).toBe(8);
    expect(percentile([...repeat(8, 18), 40, 40], 95)).toBe(40);
  });

  it("turns intervals into frames per second", () => {
    expect(fpsFromIntervals([])).toBe(0);
    expect(fpsFromIntervals(repeat(1000 / 120, 30))).toBeCloseTo(120);
  });

  it("calls a run slow only over a full window", () => {
    expect(isSustained(repeat(20, 9), 12, 0.5, 10)).toBe(false);
    expect(isSustained(repeat(20, 10), 12, 0.5, 10)).toBe(true);
    expect(isSustained([...repeat(20, 4), ...repeat(5, 6)], 12, 0.5, 10)).toBe(false);
  });
});

describe("summarizeFrames", () => {
  it("does not call a healthy 60 Hz display slow just because frames are 16.7 ms apart", () => {
    const snapshot = summarizeFrames(repeat(16.7, 20), [], OPTIONS);
    expect(snapshot).toEqual({ fps: 60, p95FrameMs: 16.7, sustainedSlow: false });
  });

  it("uses reported work time when a renderer gives it", () => {
    expect(summarizeFrames(repeat(16.7, 20), repeat(14, 10), OPTIONS).sustainedSlow).toBe(true);
    expect(summarizeFrames(repeat(16.7, 20), repeat(6, 10), OPTIONS).sustainedSlow).toBe(false);
  });

  it("falls back to sustained dropped frames without work samples", () => {
    // A 120 Hz display delivering most frames at 30 fps.
    const intervals = [...repeat(8.3, 2), ...repeat(33, 8)];
    expect(summarizeFrames(intervals, [], OPTIONS).sustainedSlow).toBe(true);
  });
});

describe("createFrameMonitor", () => {
  function fakeFrames() {
    let callback: ((time: number) => void) | null = null;
    let handles = 0;
    return {
      requestFrame: (cb: (time: number) => void) => {
        callback = cb;
        handles += 1;
        return handles;
      },
      cancelFrame: () => {
        callback = null;
      },
      run(times: number[]) {
        for (const time of times) callback?.(time);
      },
    };
  }

  it("samples animation frames between start and stop", () => {
    const frames = fakeFrames();
    const monitor = createFrameMonitor({ ...frames, windowSize: 4 });
    monitor.start();
    frames.run([0, 10, 20, 30, 40]);
    expect(monitor.snapshot().fps).toBe(100);

    monitor.stop();
    frames.run([50, 1000]);
    expect(monitor.snapshot().fps).toBe(100);
  });

  it("ignores long gaps from a hidden tab", () => {
    const frames = fakeFrames();
    const monitor = createFrameMonitor({ ...frames, windowSize: 4 });
    monitor.start();
    frames.run([0, 10, 5000, 5010]);
    expect(monitor.snapshot().p95FrameMs).toBe(10);
  });

  it("flags sustained slow work", () => {
    const monitor = createFrameMonitor({ ...fakeFrames(), windowSize: 5 });
    for (let i = 0; i < 5; i += 1) monitor.recordWork(15);
    expect(monitor.snapshot().sustainedSlow).toBe(true);
  });
});
