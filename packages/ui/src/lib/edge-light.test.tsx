// @vitest-environment jsdom
import "../../test/dom";
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EdgeLight, attachEdgeLight, edgeLightPoint, frameThrottle } from "./edge-light";

const BOX = { left: 100, top: 50, width: 200, height: 80 };

function stubMatchMedia(matching: string[]) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: matching.includes(query),
    media: query,
  }));
}

/** A pointermove jsdom can dispatch (it has no PointerEvent constructor). */
function pointer(type: string, init: { x?: number; y?: number; pointerType?: string } = {}) {
  const event = new MouseEvent(type, { clientX: init.x ?? 0, clientY: init.y ?? 0 });
  Object.defineProperty(event, "pointerType", { value: init.pointerType ?? "mouse" });
  return event;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("edgeLightPoint", () => {
  it("is the pointer's offset from the box's top-left corner", () => {
    expect(edgeLightPoint(BOX, 150, 70)).toEqual({ x: 50, y: 20 });
  });

  it("stays on the box when the pointer is outside it", () => {
    expect(edgeLightPoint(BOX, 0, 500)).toEqual({ x: 0, y: 80 });
    expect(edgeLightPoint(BOX, 999, -10)).toEqual({ x: 200, y: 0 });
  });
});

describe("frameThrottle", () => {
  it("applies only the latest value, once per frame", () => {
    const frames: FrameRequestCallback[] = [];
    const apply = vi.fn();
    const throttle = frameThrottle<number>(apply, (cb) => frames.push(cb), vi.fn());
    throttle.push(1);
    throttle.push(2);
    throttle.push(3);
    expect(frames).toHaveLength(1);
    frames[0]?.(0);
    expect(apply).toHaveBeenCalledExactlyOnceWith(3);
  });

  it("drops a queued value when cancelled", () => {
    const caf = vi.fn();
    const apply = vi.fn();
    const throttle = frameThrottle<number>(apply, () => 7, caf);
    throttle.push(1);
    throttle.cancel();
    expect(caf).toHaveBeenCalledWith(7);
    expect(apply).not.toHaveBeenCalled();
  });
});

describe("attachEdgeLight", () => {
  function plane() {
    const node = document.createElement("div");
    node.getBoundingClientRect = () =>
      ({ ...BOX, right: 300, bottom: 130, x: 100, y: 50 }) as DOMRect;
    document.body.append(node);
    return node;
  }

  it("writes the pointer position on the next frame and turns the light off on leave", () => {
    stubMatchMedia([]);
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    const node = plane();
    const detach = attachEdgeLight(node);
    node.dispatchEvent(pointer("pointermove", { x: 160, y: 90 }));
    expect(node.style.getPropertyValue("--edge-x")).toBe("60px");
    expect(node.style.getPropertyValue("--edge-y")).toBe("40px");
    expect(node.style.getPropertyValue("--edge-on")).toBe("1");

    node.dispatchEvent(pointer("pointerleave"));
    expect(node.style.getPropertyValue("--edge-on")).toBe("0");
    detach();
  });

  it("ignores touch and stays dark with reduced motion", () => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    const node = plane();
    stubMatchMedia([]);
    const detach = attachEdgeLight(node);
    node.dispatchEvent(pointer("pointermove", { x: 160, y: 90, pointerType: "touch" }));
    expect(node.style.getPropertyValue("--edge-on")).toBe("");

    stubMatchMedia(["(prefers-reduced-motion: reduce)"]);
    node.dispatchEvent(pointer("pointermove", { x: 160, y: 90 }));
    expect(node.style.getPropertyValue("--edge-on")).toBe("");
    detach();
  });
});

describe("EdgeLight", () => {
  it("is decorative and hidden under reduced motion", () => {
    const { container } = render(<EdgeLight />);
    const light = container.querySelector('[data-slot="edge-light"]');
    expect(light?.getAttribute("aria-hidden")).toBe("true");
    expect(light?.className).toContain("motion-reduce:hidden");
    expect(light?.className).toContain("pointer-events-none");
  });
});
