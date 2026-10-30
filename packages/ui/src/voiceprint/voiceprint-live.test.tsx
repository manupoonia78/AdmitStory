// @vitest-environment jsdom
import "../../test/dom";
import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RendererEvents, RendererInputs } from "./renderer";
import type { TierDetails } from "./tier";

// The live path, with the tier fixed at 3 and the WebGL renderer replaced by a recorder: the
// component's job is to load the renderer after mount, crossfade it in after its first frame,
// keep it updated, and fall back to the still when it can't run.

const details: TierDetails = {
  tier: 3,
  inputs: {
    reducedMotion: false,
    saveData: false,
    batterySaver: false,
    webgl: true,
    gpu: "high",
    sustainedSlow: false,
  },
};

vi.mock("./tier", () => ({ useTierDetails: () => details }));

const created: { inputs: RendererInputs; events: RendererEvents }[] = [];
const update = vi.fn();
const dispose = vi.fn();
let failCreate = false;

vi.mock("./renderer", () => ({
  createVoiceprintRenderer: (
    _host: HTMLElement,
    _canvas: HTMLCanvasElement,
    inputs: RendererInputs,
    events: RendererEvents,
  ) => {
    if (failCreate) throw new Error("WebGL is unavailable");
    created.push({ inputs, events });
    return { update, dispose };
  },
}));

const { Voiceprint } = await import("./voiceprint");
const { DEFAULT_IDENTITY } = await import("./params");

beforeEach(() => {
  created.length = 0;
  update.mockClear();
  dispose.mockClear();
  failCreate = false;
});

const box = () => screen.getByRole("img", { name: "Your Voiceprint" });

describe("Voiceprint at a live tier", () => {
  it("shows the still until the renderer's first frame, then crossfades to the canvas", async () => {
    render(<Voiceprint identity={DEFAULT_IDENTITY} size={300} label="Your Voiceprint" />);
    expect(box().dataset.renderer).toBe("still");
    const canvas = box().querySelector("canvas")!;
    expect(canvas.className).toContain("opacity-0");

    await waitFor(() => expect(created).toHaveLength(1));
    expect(created[0]!.inputs.tier).toBe(3);
    act(() => created[0]!.events.onFirstFrame());
    expect(box().dataset.renderer).toBe("webgl");
    expect(canvas.className).toContain("opacity-100");
    // The still stays in the box underneath, faded out, so a lost context can fall back to it.
    expect(box().querySelector("svg")).not.toBeNull();
  });

  it("passes mood and signal changes to the running renderer without remounting it", async () => {
    const signal = { current: { amplitude: 0, centroid: 0, pitchDelta: 0 } };
    const { rerender } = render(
      <Voiceprint identity={DEFAULT_IDENTITY} size={300} signal={signal} label="Your Voiceprint" />,
    );
    await waitFor(() => expect(created).toHaveLength(1));
    rerender(
      <Voiceprint
        identity={DEFAULT_IDENTITY}
        size={300}
        signal={signal}
        mood="listening"
        tier={2}
        label="Your Voiceprint"
      />,
    );
    expect(update).toHaveBeenLastCalledWith(
      expect.objectContaining({ mood: "listening", tier: 2, signal }),
    );
    expect(created).toHaveLength(1);
  });

  it("goes back to the still while the context is lost", async () => {
    render(<Voiceprint identity={DEFAULT_IDENTITY} size={300} label="Your Voiceprint" />);
    await waitFor(() => expect(created).toHaveLength(1));
    act(() => created[0]!.events.onFirstFrame());
    act(() => created[0]!.events.onLost());
    expect(box().dataset.renderer).toBe("still");
  });

  it("disposes the renderer when it unmounts or drops to the still tier", async () => {
    const { rerender, unmount } = render(
      <Voiceprint identity={DEFAULT_IDENTITY} size={300} label="Your Voiceprint" />,
    );
    await waitFor(() => expect(created).toHaveLength(1));
    rerender(
      <Voiceprint identity={DEFAULT_IDENTITY} size={300} tier={1} label="Your Voiceprint" />,
    );
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(box().querySelector("canvas")).toBeNull();
    unmount();
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("falls back to the pulsing still when WebGL can't start", async () => {
    failCreate = true;
    render(<Voiceprint identity={DEFAULT_IDENTITY} size={300} label="Your Voiceprint" />);
    await waitFor(() => expect(box().querySelector("canvas")).toBeNull());
    expect(box().dataset.renderer).toBe("still");
    expect(box().querySelector(".admitstory-voiceprint-pulse")).not.toBeNull();
  });
});
