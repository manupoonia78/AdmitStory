import { describe, expect, it } from "vitest";
import { hashEmail, hashPortalToken, newPortalToken } from "../src/crypto/tokens";

// Phase 6 AC "token: 32-byte random, hashed" (§14.6, decision 9).

describe("portal tokens", () => {
  it("are 32 random bytes as 43 base64url characters, stored only as a sha256 hash", () => {
    const { raw, hash } = newPortalToken();
    expect(raw).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(raw, "base64url")).toHaveLength(32);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(raw);
    expect(hashPortalToken(raw)).toBe(hash);
  });

  it("never repeat", () => {
    const seen = new Set(Array.from({ length: 500 }, () => newPortalToken().raw));
    expect(seen.size).toBe(500);
  });

  it("have roughly uniform characters (no obvious bias)", () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 400; i += 1)
      for (const ch of newPortalToken().raw.slice(0, 42)) counts.set(ch, (counts.get(ch) ?? 0) + 1);
    // 16,800 characters over 64 symbols: about 262 each. Every symbol appears, none dominates.
    expect(counts.size).toBe(64);
    expect(Math.max(...counts.values())).toBeLessThan(400);
  });

  it("hash to nothing when malformed, so a bad link resolves like an unknown one", () => {
    for (const bad of ["", "short", "a".repeat(44), `${"a".repeat(42)}=`, `${"a".repeat(42)}/`])
      expect(hashPortalToken(bad)).toBe("");
  });
});

describe("hashEmail", () => {
  it("ignores case and surrounding space", () => {
    expect(hashEmail(" Ravi.Menon@Example.TEST ")).toBe(hashEmail("ravi.menon@example.test"));
    expect(hashEmail("ravi@example.test")).not.toBe(hashEmail("kavita@example.test"));
    expect(hashEmail("ravi@example.test")).toMatch(/^[0-9a-f]{64}$/);
  });
});
