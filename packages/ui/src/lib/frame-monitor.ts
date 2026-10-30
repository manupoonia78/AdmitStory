// The live frame-time monitor behind performance tiers (spec §6.11): tiers are "re-checked if
// frames drop", and tier 2 applies when "frame time > 12 ms [is] sustained".
//
// Two kinds of sample, because a rAF interval alone can't tell a busy frame from a 60 Hz display
// (every 60 Hz frame is 16.7 ms apart, however little work it does):
//  - intervals between animation frames, always recorded: the delivered frame rate (fps, p95);
//  - work time per frame, recorded by a renderer with recordWork() (e.g. the Voiceprint timing
//    its own draw call). 12 ms of work leaves headroom inside a 16.7 ms frame.
// sustainedSlow uses work time when a renderer reports it. Otherwise it falls back to dropped
// frames: intervals longer than 1.5× the display's own refresh interval.

export interface FrameMonitorOptions {
  /** Frames per window; sustainedSlow needs a full window. Default 90 (about 1.5 s at 60 Hz). */
  windowSize?: number;
  /** Work time above which a frame counts as slow. Default 12 ms (spec §6.11). */
  slowFrameMs?: number;
  /** Share of slow frames in the window that makes it "sustained". Default 0.5. */
  slowRatio?: number;
  /** Injected for tests; default requestAnimationFrame / cancelAnimationFrame. */
  requestFrame?: (callback: (time: number) => void) => number;
  cancelFrame?: (handle: number) => void;
}

export interface FrameSnapshot {
  fps: number;
  p95FrameMs: number;
  sustainedSlow: boolean;
}

export interface FrameMonitor {
  start(): void;
  stop(): void;
  /** Report how long the latest frame's rendering took, in ms. */
  recordWork(ms: number): void;
  snapshot(): FrameSnapshot;
}

/** Nearest-rank percentile (p in 0..100) of the samples; 0 when there are none. */
export function percentile(samples: readonly number[], p: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1] ?? 0;
}

/** Frames per second from frame intervals in ms; 0 when there are none. */
export function fpsFromIntervals(intervals: readonly number[]): number {
  if (intervals.length === 0) return 0;
  const mean = intervals.reduce((sum, ms) => sum + ms, 0) / intervals.length;
  return mean > 0 ? 1000 / mean : 0;
}

/** True when the window is full and at least `ratio` of its samples exceed `limitMs`. */
export function isSustained(
  samples: readonly number[],
  limitMs: number,
  ratio: number,
  windowSize: number,
): boolean {
  if (samples.length < windowSize) return false;
  const recent = samples.slice(-windowSize);
  const slow = recent.filter((ms) => ms > limitMs).length;
  return slow / recent.length >= ratio;
}

export interface SummaryOptions {
  windowSize: number;
  slowFrameMs: number;
  slowRatio: number;
}

/** The snapshot for a set of samples: the pure core of the monitor. */
export function summarizeFrames(
  intervals: readonly number[],
  work: readonly number[],
  { windowSize, slowFrameMs, slowRatio }: SummaryOptions,
): FrameSnapshot {
  const recent = intervals.slice(-windowSize);
  let sustainedSlow: boolean;
  if (work.length > 0) {
    sustainedSlow = isSustained(work, slowFrameMs, slowRatio, windowSize);
  } else {
    // The display's refresh interval is the shortest the frames usually get.
    const refresh = percentile(recent, 10);
    sustainedSlow = isSustained(intervals, refresh * 1.5, slowRatio, windowSize);
  }
  return {
    fps: Math.round(fpsFromIntervals(recent)),
    p95FrameMs: Math.round(percentile(recent, 95) * 10) / 10,
    sustainedSlow,
  };
}

// Intervals this long mean the tab was hidden or the loop paused, not a slow frame.
const GAP_MS = 250;

export function createFrameMonitor(options: FrameMonitorOptions = {}): FrameMonitor {
  const summary: SummaryOptions = {
    windowSize: options.windowSize ?? 90,
    slowFrameMs: options.slowFrameMs ?? 12,
    slowRatio: options.slowRatio ?? 0.5,
  };
  const requestFrame = options.requestFrame ?? ((cb) => requestAnimationFrame(cb));
  const cancelFrame = options.cancelFrame ?? ((handle) => cancelAnimationFrame(handle));
  const keep = summary.windowSize * 2;

  const intervals: number[] = [];
  const work: number[] = [];
  let handle: number | null = null;
  let last: number | null = null;

  const push = (list: number[], value: number) => {
    list.push(value);
    if (list.length > keep) list.splice(0, list.length - keep);
  };

  const tick = (time: number) => {
    if (last !== null) {
      const interval = time - last;
      if (interval > 0 && interval < GAP_MS) push(intervals, interval);
    }
    last = time;
    handle = requestFrame(tick);
  };

  return {
    start() {
      if (handle !== null) return;
      last = null;
      handle = requestFrame(tick);
    },
    stop() {
      if (handle !== null) cancelFrame(handle);
      handle = null;
      last = null;
    },
    recordWork(ms: number) {
      if (Number.isFinite(ms) && ms >= 0) push(work, ms);
    },
    snapshot() {
      return summarizeFrames(intervals, work, summary);
    },
  };
}
