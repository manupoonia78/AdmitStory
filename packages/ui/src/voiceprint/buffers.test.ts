import { describe, expect, it } from "vitest";
import { TIER_BUDGETS, drawingRatio, filamentBuffers, particleBuffers } from "./buffers";
import { filaments } from "./geometry";
import { DEFAULT_IDENTITY, paramsFromIdentity } from "./params";

const params = paramsFromIdentity(DEFAULT_IDENTITY);

describe("TIER_BUDGETS", () => {
  it("gives tier 2 fewer points, no halo and a lower pixel ratio than tier 3", () => {
    expect(TIER_BUDGETS[2].pointsPerFilament).toBeLessThan(TIER_BUDGETS[3].pointsPerFilament);
    expect(TIER_BUDGETS[2].particles).toBeLessThan(TIER_BUDGETS[3].particles);
    expect(TIER_BUDGETS[2].halo).toBe(0);
    expect(TIER_BUDGETS[2].maxDpr).toBeLessThan(TIER_BUDGETS[3].maxDpr);
  });
});

describe("drawingRatio", () => {
  it("caps the device pixel ratio per tier", () => {
    expect(drawingRatio(400, 400, 3, TIER_BUDGETS[3])).toBe(2);
    expect(drawingRatio(400, 400, 3, TIER_BUDGETS[2])).toBe(1.5);
    expect(drawingRatio(400, 400, 1, TIER_BUDGETS[3])).toBe(1);
  });

  it("drops below the cap for very large canvases", () => {
    const ratio = drawingRatio(2560, 1440, 2, TIER_BUDGETS[3]);
    expect(ratio).toBeLessThan(2);
    expect(2560 * 1440 * ratio * ratio).toBeLessThanOrEqual(TIER_BUDGETS[3].maxPixels + 1);
  });
});

describe("filamentBuffers", () => {
  it("lays one loop of points per filament of the still render", () => {
    const buffers = filamentBuffers(params, 100);
    expect(buffers.count).toBe(params.filamentCount * 100);
    expect(buffers.t).toHaveLength(buffers.count);
    expect(buffers.orbit).toHaveLength(buffers.count * 4);
    expect(buffers.center).toHaveLength(buffers.count * 2);
    expect(buffers.t[99]).toBeCloseTo(0.99, 5);
    expect(buffers.t[100]).toBe(0);
  });

  it("projects to the still's ellipses: radius rx, tilt acos(ry / rx), y flipped", () => {
    const [first] = filaments(params);
    const buffers = filamentBuffers(params, 10);
    const [turn, tilt, radius] = buffers.orbit;
    expect(radius).toBeCloseTo(first!.rx / 50, 5);
    expect(Math.cos(tilt!) * first!.rx).toBeCloseTo(first!.ry, 3);
    expect(turn).toBeCloseTo((-first!.rotate * Math.PI) / 180, 5);
    expect(buffers.center[1]).toBeCloseTo(-(first!.cy - 50) / 50, 5);
  });

  it("is the same for the same identity", () => {
    expect(filamentBuffers(params, 20)).toEqual(filamentBuffers({ ...params }, 20));
  });
});

describe("particleBuffers", () => {
  it("fills the inside of the unit sphere", () => {
    const { position, count } = particleBuffers(params.seed, 500);
    expect(count).toBe(500);
    for (let i = 0; i < count; i += 1) {
      const r = Math.hypot(position[i * 3]!, position[i * 3 + 1]!, position[i * 3 + 2]!);
      expect(r).toBeLessThanOrEqual(0.85 + 1e-6);
      expect(r).toBeGreaterThanOrEqual(0.15 - 1e-6);
    }
  });
});
