import { describe, expect, it } from "vitest";
import { prototypesEnabled } from "./enabled";

describe("prototypesEnabled", () => {
  it("is on outside production", () => {
    expect(prototypesEnabled({ NODE_ENV: "development" })).toBe(true);
    expect(prototypesEnabled({ NODE_ENV: "test" })).toBe(true);
  });

  it("is off in production unless PROTOTYPES_ENABLED=1", () => {
    expect(prototypesEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(prototypesEnabled({ NODE_ENV: "production", PROTOTYPES_ENABLED: "true" })).toBe(false);
    expect(prototypesEnabled({ NODE_ENV: "production", PROTOTYPES_ENABLED: "1" })).toBe(true);
  });
});
