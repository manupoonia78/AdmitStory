// @vitest-environment jsdom
import "../../test/dom";
import { act, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { filaments, motes } from "./geometry";
import { DEFAULT_IDENTITY, paramsFromIdentity } from "./params";
import { usePerformanceTier } from "./tier";
import type { TierDetails } from "./tier";
import { Voiceprint, resolveTier } from "./voiceprint";
import { VoiceprintStill } from "./voiceprint-still";

// A reduced-motion setting the tests can flip. The tier store binds matchMedia on first use, so
// this has to be in place before anything renders.
const motionListeners = new Set<() => void>();
const motionQuery = {
  matches: false,
  media: "(prefers-reduced-motion: reduce)",
  addEventListener: (_: string, listener: () => void) => motionListeners.add(listener),
  removeEventListener: (_: string, listener: () => void) => motionListeners.delete(listener),
};
window.matchMedia = (() => motionQuery) as unknown as typeof window.matchMedia;
const setReducedMotion = (matches: boolean) =>
  act(() => {
    motionQuery.matches = matches;
    for (const listener of motionListeners) listener();
  });

const voiceprintBox = (name: string) => screen.getByRole("img", { name });

describe("Voiceprint", () => {
  it("is an image named by its label, in a fixed box of the given size", () => {
    render(<Voiceprint identity={DEFAULT_IDENTITY} size={240} label="Your Voiceprint" />);
    const box = voiceprintBox("Your Voiceprint");
    expect(box.style.width).toBe("240px");
    expect(box.style.height).toBe("240px");
    // One accessible image: the still and canvas inside it are decoration.
    expect(screen.getAllByRole("img")).toHaveLength(1);
  });

  it("draws the interviewer's form in silver", () => {
    render(
      <Voiceprint identity={DEFAULT_IDENTITY} size="fill" tone="silver" label="Interviewer" />,
    );
    expect(voiceprintBox("Interviewer").style.color).toBe("var(--silver)");
  });

  it("falls back to the still SVG with a slow pulse where there is no WebGL", () => {
    render(<Voiceprint identity={DEFAULT_IDENTITY} size={200} label="Your Voiceprint" />);
    const box = voiceprintBox("Your Voiceprint");
    expect(box.dataset.renderer).toBe("still");
    expect(box.dataset.tier).toBe("1");
    expect(box.querySelector("canvas")).toBeNull();
    expect(box.querySelector("svg")).not.toBeNull();
    expect(box.querySelector(".admitstory-voiceprint-pulse")).not.toBeNull();
  });

  it("keeps a forced live tier on the still when WebGL is missing", () => {
    render(<Voiceprint identity={DEFAULT_IDENTITY} size={200} tier={3} label="Your Voiceprint" />);
    expect(voiceprintBox("Your Voiceprint").dataset.tier).toBe("1");
  });

  it("is completely still with reduced motion: no pulse", () => {
    setReducedMotion(true);
    try {
      render(<Voiceprint identity={DEFAULT_IDENTITY} size={200} label="Your Voiceprint" />);
      const box = voiceprintBox("Your Voiceprint");
      expect(box.dataset.renderer).toBe("still");
      expect(box.querySelector(".admitstory-voiceprint-pulse")).toBeNull();
    } finally {
      setReducedMotion(false);
    }
  });

  it("hides itself from assistive technology when the label is empty", () => {
    const { container } = render(<Voiceprint identity={DEFAULT_IDENTITY} size={40} label="" />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
  });

  it("reports its mood for styling and tests", () => {
    render(
      <Voiceprint identity={DEFAULT_IDENTITY} size={80} mood="listening" label="Your Voiceprint" />,
    );
    expect(voiceprintBox("Your Voiceprint").dataset.mood).toBe("listening");
  });
});

describe("resolveTier", () => {
  const details = (inputs: Partial<TierDetails["inputs"]>, tier: 1 | 2 | 3 = 3): TierDetails => ({
    tier,
    inputs: {
      reducedMotion: false,
      saveData: false,
      batterySaver: false,
      webgl: true,
      gpu: "high",
      sustainedSlow: false,
      ...inputs,
    },
  });

  it("uses the runtime tier unless one is forced", () => {
    expect(resolveTier(details({}, 2))).toBe(2);
    expect(resolveTier(details({}, 3), 1)).toBe(1);
    expect(resolveTier(details({}, 1), 3)).toBe(3);
  });

  it("lets reduced motion win over a forced tier, and needs WebGL for a live one", () => {
    expect(resolveTier(details({ reducedMotion: true }), 3)).toBe(1);
    expect(resolveTier(details({ webgl: false }), 2)).toBe(1);
  });
});

describe("usePerformanceTier", () => {
  it("is the still tier in a browser without WebGL", () => {
    expect(renderHook(() => usePerformanceTier()).result.current).toBe(1);
  });
});

describe("VoiceprintStill", () => {
  const params = paramsFromIdentity(DEFAULT_IDENTITY);

  it("uses the applicant's hue from CSS", () => {
    render(<VoiceprintStill identity={DEFAULT_IDENTITY} size={48} label="Your Voiceprint" />);
    expect(screen.getByRole("img", { name: "Your Voiceprint" }).style.color).toBe("var(--voice)");
  });

  it("draws one thread per filament and the seeded motes, the same every time", () => {
    const { container, rerender } = render(
      <VoiceprintStill identity={DEFAULT_IDENTITY} size={96} label="Mark" />,
    );
    expect(container.querySelectorAll("ellipse")).toHaveLength(params.filamentCount);
    expect(container.querySelectorAll("g > circle")).toHaveLength(motes(params).length);
    const first = container.querySelector("ellipse")?.getAttribute("rx");
    expect(first).toBe(String(filaments(params)[0]!.rx));
    const markup = container.innerHTML.replace(/_r_\w+_|«r\w+»|:r\w+:/g, "");
    rerender(<VoiceprintStill identity={{ ...DEFAULT_IDENTITY }} size={96} label="Mark" />);
    expect(container.innerHTML.replace(/_r_\w+_|«r\w+»|:r\w+:/g, "")).toBe(markup);
  });

  it("draws a faint, small seed", () => {
    const { container } = render(
      <VoiceprintStill identity={DEFAULT_IDENTITY} size={96} mood="seed" label="Mark" />,
    );
    const group = container.querySelector("svg > g");
    expect(group?.getAttribute("transform")).toContain("scale(0.55)");
    expect(group?.getAttribute("opacity")).toBe("0.5");
  });

  it("hides itself from assistive technology when the label is empty", () => {
    const { container } = render(
      <VoiceprintStill identity={DEFAULT_IDENTITY} size={32} label="" />,
    );
    expect(screen.queryByRole("img")).toBeNull();
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
});
