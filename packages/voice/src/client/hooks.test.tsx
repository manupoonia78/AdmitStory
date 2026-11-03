// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const capture = { kind: "worklet" as const, flush: vi.fn(() => Promise.resolve()), close: vi.fn() };
let onFrame: ((pcm: Int16Array) => void) | null = null;
vi.mock("./capture", () => ({
  startPcmCapture: vi.fn(
    (_context: unknown, _stream: unknown, frame: (pcm: Int16Array) => void) => {
      onFrame = frame;
      return Promise.resolve(capture);
    },
  ),
}));

const { useDictation, useReadAloud } = await import("./hooks");

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const microphone = (live: boolean) => ({
  start: vi.fn(() => Promise.resolve()),
  audio: () =>
    live
      ? {
          context: { resume: () => Promise.resolve() } as unknown as AudioContext,
          stream: {} as MediaStream,
        }
      : null,
});

describe("useDictation", () => {
  it("stops the read-aloud, then reports no microphone without starting a session", async () => {
    const onStart = vi.fn();
    const mic = microphone(false);
    const { result } = renderHook(() => useDictation({ microphone: mic, onStart }));
    let started = true;
    await act(async () => {
      started = await result.current.start();
    });
    expect(onStart).toHaveBeenCalled();
    expect(mic.start).toHaveBeenCalled();
    expect(started).toBe(false);
    expect(result.current.snapshot.state).toBe("idle");
  });

  it("taps the shared microphone and shows a refusal as a state, closing the capture", async () => {
    const { result } = renderHook(() =>
      useDictation({
        microphone: microphone(true),
        fetchToken: () => Promise.resolve({ refusal: "voice_minutes_used" }),
      }),
    );
    await act(async () => {
      await result.current.start();
    });
    expect(onFrame).not.toBeNull();
    expect(result.current.snapshot).toMatchObject({
      state: "refused",
      refusal: "voice_minutes_used",
    });
    expect(capture.close).toHaveBeenCalled();
  });

  it("starts one session when tapped again while the microphone prompt is open", async () => {
    let grant: () => void = () => {};
    const mic = {
      ...microphone(true),
      start: vi.fn(() => new Promise<void>((resolve) => (grant = resolve))),
    };
    const fetchToken = vi.fn(() => new Promise<never>(() => {}));
    const { result } = renderHook(() => useDictation({ microphone: mic, fetchToken }));
    let first: Promise<boolean> = Promise.resolve(false);
    let second = true;
    await act(async () => {
      first = result.current.start();
      second = await result.current.start();
      grant();
      await first;
    });
    expect(second).toBe(false);
    expect(await first).toBe(true);
    expect(mic.start).toHaveBeenCalledOnce();
    expect(fetchToken).toHaveBeenCalledOnce();
  });
});

describe("useReadAloud", () => {
  it("is idle until asked, and creates no audio context on render", () => {
    const AudioContext = vi.fn();
    vi.stubGlobal("AudioContext", AudioContext);
    const { result } = renderHook(() => useReadAloud());
    expect(result.current).toMatchObject({ status: "idle", clock: null, timings: [] });
    expect(AudioContext).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
