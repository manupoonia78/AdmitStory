// @vitest-environment jsdom
import "../../test/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MAGNETIC_MAX_PX, attachMagnetic, magneticOffset, mergeRefs } from "./magnetic";

const BOX = { left: 0, top: 0, width: 120, height: 44 };

function stubMatchMedia(matching: string[]) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: matching.includes(query),
    media: query,
  }));
}

function pointer(type: string, init: { x?: number; y?: number; pointerType?: string } = {}) {
  const event = new MouseEvent(type, { clientX: init.x ?? 0, clientY: init.y ?? 0 });
  Object.defineProperty(event, "pointerType", { value: init.pointerType ?? "mouse" });
  return event;
}

function button() {
  const node = document.createElement("button");
  let pull = { x: 0, y: 0 };
  // The box moves with the pull, as a real one would.
  node.getBoundingClientRect = () =>
    ({ ...BOX, left: BOX.left + pull.x, top: BOX.top + pull.y }) as DOMRect;
  const read = () => {
    const [x = "0", y = "0"] = node.style.translate.split(" ");
    pull = { x: parseFloat(x) || 0, y: parseFloat(y) || 0 };
    return pull;
  };
  document.body.append(node);
  return { node, read };
}

afterEach(() => vi.unstubAllGlobals());

describe("magneticOffset", () => {
  it("is zero at the centre and the maximum at the edges", () => {
    expect(magneticOffset(BOX, 60, 22)).toEqual({ x: 0, y: 0 });
    expect(magneticOffset(BOX, 120, 44)).toEqual({ x: MAGNETIC_MAX_PX, y: MAGNETIC_MAX_PX });
    expect(magneticOffset(BOX, 0, 0)).toEqual({ x: -MAGNETIC_MAX_PX, y: -MAGNETIC_MAX_PX });
  });

  it("never pulls further than 6px, even from outside the element", () => {
    expect(magneticOffset(BOX, 900, -400)).toEqual({ x: 6, y: -6 });
  });

  it("grows in proportion to the distance from the centre", () => {
    expect(magneticOffset(BOX, 90, 22)).toEqual({ x: 3, y: 0 });
  });
});

describe("attachMagnetic", () => {
  function everyFrameAtOnce() {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
  }

  it("pulls towards a fine pointer and snaps back when it leaves", () => {
    everyFrameAtOnce();
    stubMatchMedia(["(pointer: fine)"]);
    const { node, read } = button();
    const detach = attachMagnetic(node);

    node.dispatchEvent(pointer("pointermove", { x: 120, y: 22 }));
    expect(read()).toEqual({ x: 6, y: 0 });
    // Measured from the resting box: the same pointer position keeps the same pull.
    node.dispatchEvent(pointer("pointermove", { x: 120, y: 22 }));
    expect(read()).toEqual({ x: 6, y: 0 });

    node.dispatchEvent(pointer("pointerleave"));
    expect(node.style.translate).toBe("");
    detach();
  });

  it("does nothing on coarse pointers, with reduced motion or while disabled", () => {
    everyFrameAtOnce();
    const { node } = button();
    const detach = attachMagnetic(node);

    stubMatchMedia([]);
    node.dispatchEvent(pointer("pointermove", { x: 120, y: 22 }));
    expect(node.style.translate).toBe("");

    stubMatchMedia(["(pointer: fine)", "(prefers-reduced-motion: reduce)"]);
    node.dispatchEvent(pointer("pointermove", { x: 120, y: 22 }));
    expect(node.style.translate).toBe("");

    stubMatchMedia(["(pointer: fine)"]);
    node.setAttribute("aria-disabled", "true");
    node.dispatchEvent(pointer("pointermove", { x: 120, y: 22 }));
    expect(node.style.translate).toBe("");

    node.dispatchEvent(pointer("pointermove", { x: 120, y: 22, pointerType: "touch" }));
    expect(node.style.translate).toBe("");
    detach();
  });
});

describe("mergeRefs", () => {
  it("feeds object and callback refs and runs their cleanups", () => {
    const object = { current: null as HTMLElement | null };
    const cleanup = vi.fn();
    const callback = vi.fn(() => cleanup);
    const plain = vi.fn();
    const node = document.createElement("div");

    const release = mergeRefs<HTMLElement>(object, callback, plain, undefined)(node);
    expect(object.current).toBe(node);
    expect(callback).toHaveBeenCalledWith(node);
    expect(plain).toHaveBeenCalledWith(node);

    (release as () => void)();
    expect(object.current).toBeNull();
    expect(cleanup).toHaveBeenCalledOnce();
    expect(plain).toHaveBeenLastCalledWith(null);
  });
});
