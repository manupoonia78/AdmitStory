import { describe, expect, it } from "vitest";
import { filaments, seededRandom } from "./geometry";
import { DEFAULT_IDENTITY, paramsFromIdentity } from "./params";

const params = paramsFromIdentity(DEFAULT_IDENTITY);

describe("seededRandom", () => {
  it("repeats for a seed and stays in [0, 1)", () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    for (let i = 0; i < 100; i += 1) {
      const value = a();
      expect(value).toBe(b());
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("filaments", () => {
  it("draws one filament per filamentCount, the same every time", () => {
    expect(filaments(params)).toHaveLength(params.filamentCount);
    expect(filaments(params)).toEqual(filaments({ ...params }));
  });

  it("draws different speakers differently", () => {
    expect(filaments({ ...params, seed: params.seed + 1 })).not.toEqual(filaments(params));
  });

  it("keeps a symmetric speaker centred and pulls a lopsided one off centre", () => {
    for (const f of filaments({ ...params, asymmetry: 0 })) {
      expect([f.cx, f.cy]).toEqual([50, 50]);
    }
    const offset = filaments({ ...params, asymmetry: 1 }).map((f) =>
      Math.hypot(f.cx - 50, f.cy - 50),
    );
    expect(Math.min(...offset)).toBeGreaterThan(2);
  });
});
