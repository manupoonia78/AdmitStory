import { describe, expect, it, vi } from "vitest";
import type { FrameMonitor, FrameSnapshot } from "../lib/frame-monitor";
import {
  createTierStore,
  decideTier,
  gpuClassFromResult,
  type GpuResult,
  type TierEnvironment,
  type TierInputs,
} from "./tier";

const GOOD: TierInputs = {
  reducedMotion: false,
  saveData: false,
  batterySaver: false,
  webgl: true,
  gpu: "high",
  sustainedSlow: false,
};

describe("decideTier", () => {
  const cases: [string, Partial<TierInputs>, 1 | 2 | 3][] = [
    ["good GPU, nothing else", {}, 3],
    ["reduced motion", { reducedMotion: true }, 1],
    ["Save-Data", { saveData: true }, 1],
    ["battery saver", { batterySaver: true }, 1],
    ["no WebGL", { webgl: false }, 1],
    ["low GPU", { gpu: "low" }, 1],
    ["GPU still being detected", { gpu: "pending" }, 1],
    ["mid GPU", { gpu: "mid" }, 2],
    ["GPU not in the benchmarks", { gpu: "unknown" }, 2],
    ["sustained slow frames", { sustainedSlow: true }, 2],
    ["slow frames and reduced motion", { sustainedSlow: true, reducedMotion: true }, 1],
    ["mid GPU and Save-Data", { gpu: "mid", saveData: true }, 1],
  ];
  it.each(cases)("%s", (_, inputs, tier) => {
    expect(decideTier({ ...GOOD, ...inputs })).toBe(tier);
  });
});

describe("gpuClassFromResult", () => {
  it.each([
    [
      { tier: 3, type: "BENCHMARK" },
      { webgl: true, gpu: "high" },
    ],
    [
      { tier: 2, type: "BENCHMARK" },
      { webgl: true, gpu: "mid" },
    ],
    [
      { tier: 1, type: "BENCHMARK" },
      { webgl: true, gpu: "low" },
    ],
    [
      { tier: 0, type: "BENCHMARK" },
      { webgl: true, gpu: "low" },
    ],
    [
      { tier: 0, type: "BLOCKLISTED" },
      { webgl: true, gpu: "low" },
    ],
    [
      { tier: 0, type: "WEBGL_UNSUPPORTED" },
      { webgl: false, gpu: "low" },
    ],
    [
      { tier: 1, type: "FALLBACK" },
      { webgl: true, gpu: "unknown" },
    ],
  ])("%o", (result, expected) => {
    expect(gpuClassFromResult(result)).toEqual(expected);
  });
});

/** A media query whose `matches` the test can flip. */
function mediaQuery(initial: boolean) {
  const listeners = new Set<() => void>();
  const query = {
    matches: initial,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  };
  return {
    query: query as unknown as MediaQueryList,
    set(matches: boolean) {
      query.matches = matches;
      for (const listener of listeners) listener();
    },
  };
}

function environment(options: {
  reduced?: ReturnType<typeof mediaQuery>;
  gpu?: GpuResult | Promise<GpuResult>;
  saveData?: boolean;
  frames?: FrameSnapshot;
}) {
  const intervals: (() => void)[] = [];
  let now = 0;
  const monitor: FrameMonitor = {
    start: vi.fn(),
    stop: vi.fn(),
    recordWork: vi.fn(),
    snapshot: () => options.frames ?? { fps: 120, p95FrameMs: 8.4, sustainedSlow: false },
  };
  const detectGpu = vi.fn(() => Promise.resolve(options.gpu ?? { tier: 3, type: "BENCHMARK" }));
  const env: TierEnvironment = {
    matchMedia: () => (options.reduced ?? mediaQuery(false)).query,
    navigator: { userAgent: "test", connection: { saveData: options.saveData ?? false } } as never,
    detectGpu,
    createMonitor: () => monitor,
    setInterval: (callback) => intervals.push(callback),
    clearInterval: () => {},
    now: () => now,
  };
  return {
    env,
    monitor,
    detectGpu,
    advance(ms: number) {
      now += ms;
      for (const tick of intervals) tick();
    },
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createTierStore", () => {
  it("serves the still tier to the server and while the GPU is being detected", async () => {
    const { env } = environment({});
    const store = createTierStore(env);
    expect(store.getServerSnapshot().tier).toBe(1);
    const unsubscribe = store.subscribe(() => {});
    expect(store.getSnapshot().tier).toBe(1);
    await flush();
    expect(store.getSnapshot().tier).toBe(3);
    unsubscribe();
  });

  it("follows reduced motion as it changes", async () => {
    const reduced = mediaQuery(true);
    const { env, detectGpu } = environment({ reduced });
    const store = createTierStore(env);
    const unsubscribe = store.subscribe(() => {});
    await flush();
    expect(store.getSnapshot().tier).toBe(1);
    // No GPU detection is needed while the answer is "still" anyway.
    expect(detectGpu).not.toHaveBeenCalled();

    reduced.set(false);
    await flush();
    expect(store.getSnapshot().tier).toBe(3);
    reduced.set(true);
    expect(store.getSnapshot().tier).toBe(1);
    unsubscribe();
  });

  it("never downloads benchmark data on Save-Data", async () => {
    const { env, detectGpu } = environment({ saveData: true });
    const store = createTierStore(env);
    const unsubscribe = store.subscribe(() => {});
    await flush();
    expect(store.getSnapshot().tier).toBe(1);
    expect(detectGpu).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("treats a failed detection as an unknown GPU (lite)", async () => {
    const { env } = environment({ gpu: Promise.reject(new Error("offline")) });
    const store = createTierStore(env);
    const unsubscribe = store.subscribe(() => {});
    await flush();
    expect(store.getSnapshot().inputs.gpu).toBe("unknown");
    expect(store.getSnapshot().tier).toBe(2);
    unsubscribe();
  });

  it("drops from tier 3 to 2 when frames are slow, after a grace period, and stays there", async () => {
    const slow = { fps: 48, p95FrameMs: 24, sustainedSlow: true };
    const { env, monitor, advance } = environment({ frames: slow });
    const store = createTierStore(env);
    const unsubscribe = store.subscribe(() => {});
    await flush();
    expect(store.getSnapshot().tier).toBe(3);
    expect(monitor.start).toHaveBeenCalled();

    advance(1000);
    expect(store.getSnapshot().tier).toBe(3);
    advance(3000);
    expect(store.getSnapshot().tier).toBe(2);
    expect(store.getSnapshot().inputs.sustainedSlow).toBe(true);
    // The monitor only runs at tier 3.
    expect(monitor.stop).toHaveBeenCalled();
    unsubscribe();
  });

  it("notifies subscribers and stops listening when the last one leaves", async () => {
    const reduced = mediaQuery(false);
    const { env } = environment({ reduced });
    const store = createTierStore(env);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    await flush();
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    listener.mockClear();
    reduced.set(true);
    expect(listener).not.toHaveBeenCalled();
  });
});
