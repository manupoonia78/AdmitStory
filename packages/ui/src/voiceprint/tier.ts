"use client";

// Performance tiers (spec §6.11), chosen at runtime and re-checked when frames drop:
//   3 full  — good GPU, no reduced motion, not Save-Data;
//   2 lite  — mid GPU, or frame time over 12 ms sustained;
//   1 still — low GPU, reduced motion, Save-Data, battery saver, or no WebGL.
// One store serves every Voiceprint and the prototype HUD, so the GPU is detected once and a
// single frame monitor runs however many components ask.

import { useSyncExternalStore } from "react";
import { createFrameMonitor, type FrameMonitor } from "../lib/frame-monitor";
import type { PerformanceTier } from "./types";

/** How detect-gpu rated the GPU. "unknown": not benchmarked (new or masked GPUs, Firefox). */
export type GpuClass = "pending" | "low" | "mid" | "high" | "unknown";

export interface TierInputs {
  reducedMotion: boolean;
  saveData: boolean;
  /** Battery low and not charging: the closest web signal to an OS battery saver. */
  batterySaver: boolean;
  webgl: boolean;
  gpu: GpuClass;
  /** The frame monitor saw sustained slow frames while at tier 3. Sticky for the session. */
  sustainedSlow: boolean;
}

/** The tier for a set of inputs: the pure rule from spec §6.11. */
export function decideTier(inputs: TierInputs): PerformanceTier {
  if (inputs.reducedMotion || inputs.saveData || inputs.batterySaver || !inputs.webgl) return 1;
  // Until the GPU is known the still form shows; it is never wrong, only less alive.
  if (inputs.gpu === "pending" || inputs.gpu === "low") return 1;
  // An unknown GPU is usually a recent one detect-gpu hasn't benchmarked: lite, not still.
  if (inputs.gpu === "mid" || inputs.gpu === "unknown" || inputs.sustainedSlow) return 2;
  return 3;
}

/** The parts of a detect-gpu result that matter here. */
export interface GpuResult {
  tier: number;
  type: string;
}

/** detect-gpu's 0..3 benchmark tier as a GPU class. */
export function gpuClassFromResult(result: GpuResult): { webgl: boolean; gpu: GpuClass } {
  switch (result.type) {
    case "WEBGL_UNSUPPORTED":
      return { webgl: false, gpu: "low" };
    case "BLOCKLISTED":
      return { webgl: true, gpu: "low" };
    case "BENCHMARK":
      return { webgl: true, gpu: result.tier >= 3 ? "high" : result.tier === 2 ? "mid" : "low" };
    default:
      // FALLBACK (renderer not in the benchmark data) and SSR.
      return { webgl: true, gpu: "unknown" };
  }
}

export interface TierDetails {
  tier: PerformanceTier;
  inputs: TierInputs;
}

/* The store -------------------------------------------------------------------------------- */

/** Where detect-gpu's benchmark data is served from. apps/web copies it to public/detect-gpu,
 *  so detection never calls a third-party CDN. */
let benchmarksURL = "/detect-gpu";

/** Point detect-gpu at another copy of its benchmark data (call before the first Voiceprint). */
export function configurePerformanceTier(options: { benchmarksURL: string }): void {
  benchmarksURL = options.benchmarksURL.replace(/\/+$/, "");
}

interface BatteryManagerLike extends EventTarget {
  charging: boolean;
  level: number;
}

export interface TierEnvironment {
  matchMedia?: (query: string) => MediaQueryList;
  navigator?: Navigator;
  /** Rates the GPU; the default lazy-loads detect-gpu after mount. */
  detectGpu: () => Promise<GpuResult>;
  createMonitor: () => FrameMonitor;
  setInterval: (callback: () => void, ms: number) => number;
  clearInterval: (handle: number) => void;
  now: () => number;
}

const DETECT_TIMEOUT_MS = 3000;
const MONITOR_CHECK_MS = 1000;
/** Shader compiles and first layout make the opening seconds janky on every machine. */
const MONITOR_GRACE_MS = 3000;
const LOW_BATTERY = 0.2;

const INITIAL_INPUTS: TierInputs = {
  reducedMotion: false,
  saveData: false,
  batterySaver: false,
  webgl: true,
  gpu: "pending",
  sustainedSlow: false,
};

const SERVER_DETAILS: TierDetails = { tier: 1, inputs: INITIAL_INPUTS };

export interface TierStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): TierDetails;
  getServerSnapshot(): TierDetails;
}

/** jsdom has no WebGL and logs an error whenever a canvas context is asked for. */
function isJsdom(nav: Navigator | undefined): boolean {
  return Boolean(nav?.userAgent.includes("jsdom"));
}

export function createTierStore(env: TierEnvironment): TierStore {
  let inputs = INITIAL_INPUTS;
  let details: TierDetails = { tier: decideTier(inputs), inputs };
  const listeners = new Set<() => void>();
  let teardown: (() => void) | null = null;
  let detecting = false;
  let monitor: FrameMonitor | null = null;
  let monitorTimer: number | null = null;
  let monitorSince = 0;

  const stopMonitor = () => {
    if (monitorTimer !== null) env.clearInterval(monitorTimer);
    monitorTimer = null;
    monitor?.stop();
    monitor = null;
  };

  // Frames only matter at tier 3, and a downgrade is sticky, so the monitor runs only then.
  const syncMonitor = () => {
    if (details.tier === 3 && listeners.size > 0 && !monitor) {
      monitor = env.createMonitor();
      monitor.start();
      monitorSince = env.now();
      monitorTimer = env.setInterval(() => {
        if (!monitor || env.now() - monitorSince < MONITOR_GRACE_MS) return;
        if (monitor.snapshot().sustainedSlow) update({ sustainedSlow: true });
      }, MONITOR_CHECK_MS);
    } else if (details.tier !== 3 && monitor) {
      stopMonitor();
    }
  };

  const needsGpu = () =>
    !inputs.reducedMotion && !inputs.saveData && !inputs.batterySaver && inputs.webgl;

  const detect = () => {
    if (detecting || inputs.gpu !== "pending" || !needsGpu()) return;
    detecting = true;
    const timeout = new Promise<GpuResult>((resolve) =>
      setTimeout(() => resolve({ tier: 0, type: "FALLBACK" }), DETECT_TIMEOUT_MS),
    );
    Promise.race([env.detectGpu(), timeout])
      .then((result) => update(gpuClassFromResult(result)))
      .catch(() => update({ gpu: "unknown" }));
  };

  function update(next: Partial<TierInputs>) {
    inputs = { ...inputs, ...next };
    const tier = decideTier(inputs);
    details = { tier, inputs };
    for (const listener of listeners) listener();
    detect();
    syncMonitor();
  }

  const start = () => {
    const cleanups: (() => void)[] = [];
    const nav = env.navigator;

    const motionQuery = env.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (motionQuery) {
      const onMotion = () => update({ reducedMotion: motionQuery.matches });
      motionQuery.addEventListener("change", onMotion);
      cleanups.push(() => motionQuery.removeEventListener("change", onMotion));
    }

    const connection = (
      nav as (Navigator & { connection?: EventTarget & { saveData?: boolean } }) | undefined
    )?.connection;
    if (connection) {
      const onConnection = () => update({ saveData: Boolean(connection.saveData) });
      connection.addEventListener?.("change", onConnection);
      cleanups.push(() => connection.removeEventListener?.("change", onConnection));
    }

    const getBattery = (
      nav as (Navigator & { getBattery?: () => Promise<BatteryManagerLike> }) | undefined
    )?.getBattery;
    if (nav && typeof getBattery === "function") {
      let battery: BatteryManagerLike | null = null;
      let stopped = false;
      const onBattery = () => {
        if (battery) update({ batterySaver: !battery.charging && battery.level <= LOW_BATTERY });
      };
      getBattery
        .call(nav)
        .then((manager) => {
          if (stopped) return;
          battery = manager;
          manager.addEventListener("levelchange", onBattery);
          manager.addEventListener("chargingchange", onBattery);
          onBattery();
        })
        .catch(() => {});
      cleanups.push(() => {
        stopped = true;
        battery?.removeEventListener("levelchange", onBattery);
        battery?.removeEventListener("chargingchange", onBattery);
      });
    }

    update({
      reducedMotion: Boolean(motionQuery?.matches),
      saveData: Boolean(connection?.saveData),
      ...(isJsdom(nav) ? { webgl: false } : {}),
    });

    return () => {
      for (const cleanup of cleanups) cleanup();
      stopMonitor();
    };
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      teardown ??= start();
      syncMonitor();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          // Detection results stay; the listeners and the monitor go.
          teardown?.();
          teardown = null;
        }
      };
    },
    getSnapshot: () => details,
    getServerSnapshot: () => SERVER_DETAILS,
  };
}

let browserStore: TierStore | null = null;

function store(): TierStore {
  browserStore ??= createTierStore({
    matchMedia: typeof window !== "undefined" ? window.matchMedia?.bind(window) : undefined,
    navigator: typeof navigator !== "undefined" ? navigator : undefined,
    detectGpu: async () => {
      const { getGPUTier } = await import("detect-gpu");
      return getGPUTier({ benchmarksURL });
    },
    createMonitor: () => createFrameMonitor(),
    setInterval: (callback, ms) => window.setInterval(callback, ms),
    clearInterval: (handle) => window.clearInterval(handle),
    now: () => performance.now(),
  });
  return browserStore;
}

/** The tier with the inputs behind it (the prototype lab and HUD show why). */
export function useTierDetails(): TierDetails {
  const tiers = store();
  return useSyncExternalStore(tiers.subscribe, tiers.getSnapshot, tiers.getServerSnapshot);
}

/** The runtime tier. Server render and hydration get 1, so the first paint is the still SVG. */
export function usePerformanceTier(): PerformanceTier {
  return useTierDetails().tier;
}
