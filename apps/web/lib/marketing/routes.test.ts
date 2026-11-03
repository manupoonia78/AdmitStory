import { describe, expect, it } from "vitest";
import { MARKETING_ROUTES, isMarketingRoute } from "./routes";

describe("MARKETING_ROUTES", () => {
  it("are exactly the five public pages", () => {
    expect(MARKETING_ROUTES).toEqual(["/", "/pricing", "/how-it-works", "/privacy", "/terms"]);
  });

  it("recognises marketing paths and nothing else", () => {
    expect(isMarketingRoute("/pricing")).toBe(true);
    expect(isMarketingRoute("/home")).toBe(false);
    expect(isMarketingRoute("/pricing/")).toBe(false);
  });
});
