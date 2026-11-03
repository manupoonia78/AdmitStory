import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Client } from "pg";
import { describe, expect, it } from "vitest";
import {
  confirmAgeAndTerms,
  costForKit,
  costForUser,
  getProfile,
  grantRole,
  hasRole,
  listRoles,
  onUserCreated,
  ProfilePatch,
  recordUsage,
  updateProfile,
} from "../src/repos";
import * as schema from "../src/schema";
import type { UsageEntry } from "../src/types";

interface CapturedQuery {
  text: string;
  params: unknown[];
}

// A pg client stand-in that records SQL instead of executing it, so ownership
// scoping can be checked without a database. Real behaviour lives in *.int.test.ts.
function recordingDb() {
  const queries: CapturedQuery[] = [];
  const client = {
    query: async (config: string | { text: string; values?: unknown[] }, params?: unknown[]) => {
      const text = typeof config === "string" ? config : config.text;
      queries.push({
        text,
        params: params ?? (typeof config === "string" ? [] : (config.values ?? [])),
      });
      return { rows: [], rowCount: 0, fields: [], command: "", oid: 0 };
    },
  };
  return { db: drizzle({ client: client as unknown as Client, schema }), queries };
}

function entry(overrides: Partial<UsageEntry> = {}): UsageEntry {
  return {
    runId: randomUUID(),
    userId: randomUUID(),
    kitId: null,
    schoolPackId: null,
    task: "util.title",
    model: "model-under-test",
    servedModel: "model-under-test",
    effort: null,
    attemptKind: "primary",
    aiMode: "replay",
    inputTokens: 120,
    cacheReadTokens: 0,
    cacheWrite5mTokens: 0,
    cacheWrite1hTokens: 0,
    outputTokens: 12,
    webSearches: 0,
    costUsd: 0.00042,
    latencyMs: 350,
    promptVersion: "util.title@v1",
    traceId: null,
    stopReason: "end_turn",
    ...overrides,
  };
}

describe("ownership scoping (spec §10, §14.4)", () => {
  const caller = randomUUID();

  const scoped: [string, (db: ReturnType<typeof recordingDb>["db"]) => Promise<unknown>][] = [
    ["getProfile", (db) => getProfile(db, caller)],
    ["updateProfile", (db) => updateProfile(db, caller, { displayName: "Synthetic Applicant" })],
    ["confirmAgeAndTerms", (db) => confirmAgeAndTerms(db, caller, "2026-10")],
    ["listRoles", (db) => listRoles(db, caller)],
    ["hasRole", (db) => hasRole(db, caller, "admin")],
    ["grantRole", (db) => grantRole(db, caller, "expert")],
    ["costForUser", (db) => costForUser(db, caller)],
  ];

  it.each(scoped)("%s binds every statement to the caller's user_id", async (_, call) => {
    const { db, queries } = recordingDb();
    await call(db);
    expect(queries.length).toBeGreaterThan(0);
    for (const q of queries) {
      expect(q.params).toContain(caller);
      expect(q.text).toMatch(/"user_id"/);
      if (/^(select|update|delete)/i.test(q.text))
        expect(q.text).toMatch(/where .*"user_id" = \$\d+/i);
    }
  });

  it("onUserCreated writes only the given user's profile and applicant role", async () => {
    const { db, queries } = recordingDb();
    await onUserCreated(db, caller);
    const writes = queries.filter((q) => /^insert/i.test(q.text));
    expect(writes.map((q) => q.text.match(/^insert into "(\w+)"/i)?.[1])).toEqual([
      "profiles",
      "roles",
    ]);
    for (const q of writes) {
      expect(q.params).toContain(caller);
      expect(q.text).toMatch(/on conflict .* do nothing/i);
    }
    expect(writes[1]!.params).toContain("applicant");
  });

  it("costForKit is scoped by kit_id", async () => {
    const { db, queries } = recordingDb();
    const kitId = randomUUID();
    await expect(costForKit(db, kitId)).resolves.toBe(0);
    expect(queries[0]!.text).toMatch(/where "usage_ledger"\."kit_id" = \$1/);
    expect(queries[0]!.params).toEqual([kitId]);
  });

  it.each([
    ["empty", ""],
    ["not a uuid", "user-1"],
    ["sql fragment", "1' or '1'='1"],
  ])("rejects a %s userId before querying", async (_, bad) => {
    const { db, queries } = recordingDb();
    await expect(getProfile(db, bad)).rejects.toThrow(/userId must be a UUID/);
    await expect(updateProfile(db, bad, { readAloud: false })).rejects.toThrow(
      /userId must be a UUID/,
    );
    await expect(listRoles(db, bad)).rejects.toThrow(/userId must be a UUID/);
    expect(queries).toHaveLength(0);
  });
});

describe("ProfilePatch", () => {
  it("accepts a typical first-run patch and normalises it", () => {
    expect(
      ProfilePatch.parse({
        targetIntake: 2027,
        programType: "full_time_mba",
        country: " in ",
        timezone: "Asia/Kolkata",
        studioMode: "standard",
        gpa: 8.4,
        gpaScale: 10,
        languages: ["English", "Hindi"],
      }),
    ).toEqual({
      targetIntake: 2027,
      programType: "full_time_mba",
      country: "IN",
      timezone: "Asia/Kolkata",
      studioMode: "standard",
      gpa: 8.4,
      gpaScale: 10,
      languages: ["English", "Hindi"],
    });
  });

  it("allows clearing nullable fields", () => {
    expect(ProfilePatch.parse({ displayName: null, studioMode: null })).toEqual({
      displayName: null,
      studioMode: null,
    });
  });

  it.each([
    ["unknown keys (e.g. userId)", { userId: randomUUID() }],
    ["consent columns", { termsVersion: "v1" }],
    ["invalid time zone", { timezone: "Mars/Olympus" }],
    ["non-ISO country", { country: "India" }],
    ["unknown studio mode", { studioMode: "marathon" }],
    ["fractional intake", { targetIntake: 2027.5 }],
    ["gpa above scale", { gpa: 4.2, gpaScale: 4 }],
    ["blank display name", { displayName: "   " }],
  ])("rejects %s", (_, patch) => {
    expect(ProfilePatch.safeParse(patch).success).toBe(false);
  });

  it("updateProfile validates before writing", async () => {
    const { db, queries } = recordingDb();
    await expect(updateProfile(db, randomUUID(), { keepAudio: "yes" } as never)).rejects.toThrow();
    expect(queries).toHaveLength(0);
  });

  it("updateProfile with an empty patch only reads", async () => {
    const { db, queries } = recordingDb();
    await updateProfile(db, randomUUID(), {});
    expect(queries).toHaveLength(1);
    expect(queries[0]!.text).toMatch(/^select/i);
  });
});

describe("recordUsage validation", () => {
  it("writes a valid entry", async () => {
    const { db, queries } = recordingDb();
    await recordUsage(db, entry());
    expect(queries[0]!.text).toMatch(/^insert into "usage_ledger"/);
  });

  it.each([
    ["NaN cost", { costUsd: Number.NaN }],
    ["negative cost", { costUsd: -0.01 }],
    ["negative tokens", { outputTokens: -1 }],
    ["fractional tokens", { inputTokens: 1.5 }],
    ["non-uuid run id", { runId: "run-1" }],
    ["unknown attempt kind", { attemptKind: "retry" as UsageEntry["attemptKind"] }],
  ])("rejects %s", async (_, overrides) => {
    const { db, queries } = recordingDb();
    await expect(recordUsage(db, entry(overrides))).rejects.toThrow();
    expect(queries).toHaveLength(0);
  });
});
