// @vitest-environment jsdom
import "../../test/dom";
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { viewTransitionsSupported } from "./route-transition";
import { SharedElement, flipFrom } from "./shared-element";
import { VIEW_TRANSITION_CSS } from "./view-transition-styles";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("flipFrom", () => {
  it("is the transform that puts the new box back on the old one", () => {
    const card = { left: 40, top: 300, width: 200, height: 120 };
    const hero = { left: 0, top: 80, width: 800, height: 360 };
    expect(flipFrom(card, hero)).toEqual({ x: 40, y: 220, scaleX: 0.25, scaleY: 1 / 3 });
  });

  it("does not divide by zero for an element with no size yet", () => {
    const empty = { left: 0, top: 0, width: 0, height: 0 };
    expect(flipFrom({ left: 5, top: 5, width: 10, height: 10 }, empty)).toEqual({
      x: 5,
      y: 5,
      scaleX: 1,
      scaleY: 1,
    });
  });
});

describe("viewTransitionsSupported", () => {
  it("follows document.startViewTransition", () => {
    expect(viewTransitionsSupported({} as Document)).toBe(false);
    expect(viewTransitionsSupported({ startViewTransition: () => {} } as unknown as Document)).toBe(
      true,
    );
    expect(viewTransitionsSupported(undefined)).toBe(false);
  });
});

describe("SharedElement without the View Transitions API (jsdom)", () => {
  function boxes(...rects: { left: number; top: number; width: number; height: number }[]) {
    const queue = [...rects];
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      () => (queue.shift() ?? rects.at(-1)) as DOMRect,
    );
  }

  it("flies the arriving twin from where the departing one was", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query }));
    // Departure measured on unmount, then the arrival's own box.
    boxes(
      { left: 40, top: 300, width: 200, height: 120 },
      { left: 0, top: 80, width: 800, height: 360 },
    );

    const card = render(<SharedElement name="story-night-shift">Card</SharedElement>);
    card.unmount();
    const { container } = render(<SharedElement name="story-night-shift">Hero</SharedElement>);
    const hero = container.querySelector<HTMLElement>('[data-shared-element="story-night-shift"]');
    // Set before the first paint, so the flight starts exactly at the card.
    expect(hero?.style.transformOrigin).toBe("0 0");
    expect(hero?.style.transform).toBe("translate(40px, 220px) scale(0.25, 0.3333333333333333)");
  });

  it("only fades in with reduced motion", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
    }));
    boxes(
      { left: 40, top: 300, width: 200, height: 120 },
      { left: 0, top: 80, width: 800, height: 360 },
    );

    render(<SharedElement name="story-park">Card</SharedElement>).unmount();
    const { container } = render(<SharedElement name="story-park">Hero</SharedElement>);
    const hero = container.querySelector<HTMLElement>('[data-shared-element="story-park"]');
    expect(hero?.style.transform).toBe("");
    expect(hero?.style.opacity).toBe("0");
  });

  it("does not fly on first arrival", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query }));
    const { container } = render(<SharedElement name="story-fresh">Hero</SharedElement>);
    const hero = container.querySelector<HTMLElement>('[data-shared-element="story-fresh"]');
    expect(hero?.style.transform).toBe("");
  });
});

describe("view transition rules", () => {
  it("never block input and fall back to 120 ms fades with reduced motion", () => {
    expect(VIEW_TRANSITION_CSS).toContain("::view-transition { pointer-events: none; }");
    const reduced = VIEW_TRANSITION_CSS.slice(
      VIEW_TRANSITION_CSS.indexOf("@media (prefers-reduced-motion: reduce)"),
    );
    expect(reduced).toContain("::view-transition-group(*) { animation: none !important; }");
    expect(reduced).toContain("as-vt-fade-in 120ms linear");
    expect(reduced).not.toContain("as-vt-rise");
  });

  it("move only on the spring tokens", () => {
    const timings = [...VIEW_TRANSITION_CSS.matchAll(/var\(--spring-([a-z]+)\)/g)].map((m) => m[1]);
    expect(new Set(timings)).toEqual(new Set(["glide", "drift"]));
    expect(VIEW_TRANSITION_CSS).not.toMatch(/ease-in|ease-out|cubic-bezier/);
  });
});
