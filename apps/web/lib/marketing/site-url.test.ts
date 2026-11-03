import { describe, expect, it } from "vitest";
import { absoluteUrl, siteUrl } from "./site-url";

describe("siteUrl", () => {
  it("prefers SITE_URL", () => {
    const env = { SITE_URL: "https://admitstory.example", APP_URL: "http://localhost:3100" };
    expect(siteUrl(env).toString()).toBe("https://admitstory.example/");
  });

  it("falls back to APP_URL when SITE_URL is empty or malformed", () => {
    expect(siteUrl({ SITE_URL: " ", APP_URL: "http://localhost:3100" }).origin).toBe(
      "http://localhost:3100",
    );
    expect(siteUrl({ SITE_URL: "nope", APP_URL: "http://localhost:3100" }).origin).toBe(
      "http://localhost:3100",
    );
  });

  it("drops any path and builds absolute URLs from paths", () => {
    const env = { SITE_URL: "https://admitstory.example/some/path?x=1" };
    expect(siteUrl(env).toString()).toBe("https://admitstory.example/");
    expect(absoluteUrl("/pricing", env)).toBe("https://admitstory.example/pricing");
    expect(absoluteUrl("/", env)).toBe("https://admitstory.example/");
  });

  it("still answers with nothing configured", () => {
    expect(siteUrl({}).origin).toBe("http://localhost:3000");
  });
});
