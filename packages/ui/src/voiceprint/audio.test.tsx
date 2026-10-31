// @vitest-environment jsdom
import "../../test/dom";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMicrophone } from "./audio";

// A fake microphone: getUserMedia, a Web Audio graph that produces a steady 150 Hz voice, and a
// manual animation-frame queue so the test decides when frames run.

const SAMPLE_RATE = 48000;

class FakeTrack extends EventTarget {
  stop = vi.fn();
}

class FakeAnalyser {
  fftSize = 2048;
  smoothingTimeConstant = 0.8;
  get frequencyBinCount() {
    return this.fftSize / 2;
  }
  getFloatTimeDomainData(target: Float32Array) {
    for (let i = 0; i < target.length; i += 1) {
      let sample = 0;
      for (let h = 1; h <= 4; h += 1)
        sample += Math.sin((2 * Math.PI * 150 * h * i) / SAMPLE_RATE) / h;
      target[i] = 0.2 * sample;
    }
  }
  getFloatFrequencyData(target: Float32Array) {
    target.fill(-40);
  }
}

const contexts: FakeContext[] = [];
class FakeContext {
  sampleRate = SAMPLE_RATE;
  close = vi.fn(() => Promise.resolve());
  resume = vi.fn(() => Promise.resolve());
  source = { connect: vi.fn(), disconnect: vi.fn() };
  constructor() {
    contexts.push(this);
  }
  createMediaStreamSource() {
    return this.source;
  }
  createAnalyser() {
    return new FakeAnalyser();
  }
}

let frames = new Map<number, FrameRequestCallback>();
let nextFrame = 1;
let clock = 0;
const runFrames = (count: number) =>
  act(() => {
    for (let i = 0; i < count; i += 1) {
      clock += 1000 / 60;
      const due = [...frames.values()];
      frames = new Map();
      for (const callback of due) callback(clock);
    }
  });

let track: FakeTrack;
const getUserMedia = vi.fn();

beforeEach(() => {
  contexts.length = 0;
  frames = new Map();
  track = new FakeTrack();
  getUserMedia.mockReset();
  getUserMedia.mockResolvedValue({ getAudioTracks: () => [track], getTracks: () => [track] });
  vi.stubGlobal("AudioContext", FakeContext);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(nextFrame, callback);
    return nextFrame++;
  });
  vi.stubGlobal("cancelAnimationFrame", (handle: number) => frames.delete(handle));
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });
});

describe("useMicrophone", () => {
  it("is idle with a silent signal until started", () => {
    const { result } = renderHook(() => useMicrophone());
    expect(result.current.status).toBe("idle");
    expect(result.current.signal.current).toEqual({ amplitude: 0, centroid: 0, pitchDelta: 0 });
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("asks for the microphone with echo cancellation and noise suppression", async () => {
    const { result } = renderHook(() => useMicrophone());
    await act(() => result.current.start());
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: expect.objectContaining({ echoCancellation: true, noiseSuppression: true }),
    });
    expect(result.current.status).toBe("live");
  });

  it("writes the live signal every frame without re-rendering", async () => {
    let renders = 0;
    const onFrame = vi.fn();
    const { result } = renderHook(() => {
      renders += 1;
      return useMicrophone({ onFrame });
    });
    await act(() => result.current.start());
    const before = renders;
    runFrames(90);
    expect(renders).toBe(before);
    expect(onFrame).toHaveBeenCalledTimes(90);
    expect(result.current.signal.current.amplitude).toBeGreaterThan(0);
    expect(onFrame.mock.calls.at(-1)?.[0].pitchHz).toBeCloseTo(150, -1);
  });

  it("releases the tracks and closes the audio context on stop", async () => {
    const { result } = renderHook(() => useMicrophone());
    await act(() => result.current.start());
    runFrames(10);
    act(() => result.current.stop());
    expect(track.stop).toHaveBeenCalled();
    expect(contexts[0]!.close).toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
    expect(result.current.signal.current).toEqual({ amplitude: 0, centroid: 0, pitchDelta: 0 });
    expect(frames.size).toBe(0);
  });

  it("shares its stream and context for dictation while live, and only then", async () => {
    const { result } = renderHook(() => useMicrophone());
    expect(result.current.audio()).toBeNull();
    await act(() => result.current.start());
    const audio = result.current.audio();
    expect(audio?.context).toBe(contexts[0]);
    expect(audio?.stream.getAudioTracks()).toEqual([track]);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    act(() => result.current.stop());
    expect(result.current.audio()).toBeNull();
  });

  it("cleans up on unmount", async () => {
    const { result, unmount } = renderHook(() => useMicrophone());
    await act(() => result.current.start());
    unmount();
    expect(track.stop).toHaveBeenCalled();
    expect(frames.size).toBe(0);
  });

  it("reports a blocked microphone as denied and closes the context", async () => {
    getUserMedia.mockRejectedValue(new DOMException("Permission denied", "NotAllowedError"));
    const { result } = renderHook(() => useMicrophone());
    await act(() => result.current.start());
    expect(result.current.status).toBe("denied");
    expect(contexts[0]!.close).toHaveBeenCalled();
  });

  it("reports a missing device as an error", async () => {
    getUserMedia.mockRejectedValue(new DOMException("No device", "NotFoundError"));
    const { result } = renderHook(() => useMicrophone());
    await act(() => result.current.start());
    expect(result.current.status).toBe("error");
  });

  it("is unsupported without getUserMedia", async () => {
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });
    const { result } = renderHook(() => useMicrophone());
    await act(() => result.current.start());
    expect(result.current.status).toBe("unsupported");
    expect(contexts).toHaveLength(0);
  });

  it("drops a permission that arrives after stop()", async () => {
    let grant: (stream: unknown) => void = () => {};
    getUserMedia.mockReturnValue(new Promise((resolve) => (grant = resolve)));
    const { result } = renderHook(() => useMicrophone());
    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.start();
    });
    expect(result.current.status).toBe("requesting");
    act(() => result.current.stop());
    expect(result.current.status).toBe("idle");
    await act(async () => {
      grant({ getAudioTracks: () => [track], getTracks: () => [track] });
      await pending;
    });
    expect(track.stop).toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
  });

  it("notices when the device goes away mid-session", async () => {
    const { result } = renderHook(() => useMicrophone());
    await act(() => result.current.start());
    act(() => {
      track.dispatchEvent(new Event("ended"));
    });
    expect(result.current.status).toBe("error");
    expect(frames.size).toBe(0);
  });
});
