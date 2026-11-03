// @vitest-environment jsdom
import "../../test/dom";
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

let pathname = "/home";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

const { RouteTransition } = await import("./route-transition");

afterEach(() => {
  pathname = "/home";
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, "startViewTransition");
});

function content(container: HTMLElement) {
  const node = container.querySelector<HTMLElement>('[data-slot="route-content"]');
  if (!node) throw new Error("no route content");
  return node;
}

describe("RouteTransition", () => {
  it("does not animate the first render", () => {
    const { container } = render(<RouteTransition>Home</RouteTransition>);
    expect(content(container).style.opacity).toBe("");
  });

  it("hides the new view before paint when it falls back to Motion (no View Transitions API)", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query }));
    const { container, rerender } = render(<RouteTransition>Home</RouteTransition>);
    pathname = "/tracker";
    rerender(<RouteTransition>Tracker</RouteTransition>);
    // Motion loads lazily; until it does, the entering view is held at its first frame.
    expect(content(container).style.opacity).toBe("0");
  });

  it("leaves the work to the browser when the View Transitions API exists", () => {
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: () => {},
    });
    const { container, rerender } = render(<RouteTransition>Home</RouteTransition>);
    pathname = "/tracker";
    rerender(<RouteTransition>Tracker</RouteTransition>);
    expect(content(container).style.opacity).toBe("");
  });

  it("clears its inline styles when a newer navigation interrupts it", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query }));
    const { container, rerender, unmount } = render(<RouteTransition>Home</RouteTransition>);
    pathname = "/tracker";
    rerender(<RouteTransition>Tracker</RouteTransition>);
    const node = content(container);
    unmount();
    expect(node.style.opacity).toBe("");
    expect(node.style.transform).toBe("");
  });
});
