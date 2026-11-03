import { randomUUID } from "node:crypto";
import { SEED_SCHOOLS } from "@admitstory/shared";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Client } from "pg";
import { describe, expect, it } from "vitest";
import {
  addUserSchool,
  createChunkStore,
  createSchool,
  getKitForUserSchool,
  getLatestProfileRead,
  getUserSchool,
  listKits,
  listSchoolVotes,
  listUserSchools,
  removeUserSchool,
  requireAdmin,
  saveProfileRead,
  saveUserSchoolFit,
  updateUserSchool,
  voteForSchool,
  withdrawSchoolVote,
  type AdminContext,
} from "../src/repos";
import * as schema from "../src/schema";
import { aiPolicySeedSchools, schoolIdentity, schoolSlug } from "../src/seed/schools";

interface CapturedQuery {
  text: string;
  params: unknown[];
}

// Records SQL instead of executing it (as in repos.test.ts). Real behaviour lives in
// schools.int.test.ts.
function recordingDb(rows: unknown[] = []) {
  const queries: CapturedQuery[] = [];
  const client = {
    query: async (config: string | { text: string; values?: unknown[] }, params?: unknown[]) => {
      const text = typeof config === "string" ? config : config.text;
      queries.push({
        text,
        params: params ?? (typeof config === "string" ? [] : (config.values ?? [])),
      });
      return { rows, rowCount: rows.length, fields: [], command: "", oid: 0 };
    },
  };
  return { db: drizzle({ client: client as unknown as Client, schema }), queries };
}

describe("seed school identities (Appendix H)", () => {
  const identities = SEED_SCHOOLS.map((seed) => ({ seed, ...schoolIdentity(seed) }));

  it("gives every seed school a unique URL-safe slug", () => {
    const slugs = identities.map((i) => i.slug);
    expect(new Set(slugs).size).toBe(SEED_SCHOOLS.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("knows a short name and an ISO country for every seed school", () => {
    for (const identity of identities) {
      expect(identity.shortName.length, identity.seed.name).toBeGreaterThan(0);
      expect(identity.country, identity.seed.name).toMatch(/^[A-Z]{2}$/);
    }
    expect(identities.filter((i) => i.seed.region === "us").every((i) => i.country === "US")).toBe(
      true,
    );
  });

  it("folds accents and drops parentheticals in slugs", () => {
    expect(schoolSlug("Oxford Saïd")).toBe("oxford-said");
    expect(schoolSlug("Wharton (Penn)")).toBe("wharton");
    expect(schoolSlug("UNC Kenan-Flagler")).toBe("unc-kenan-flagler");
  });

  it("falls back to the spoken name for a school outside the list", () => {
    expect(
      schoolIdentity({ name: "Fictional Harbour School (Testland)", region: "europe" }),
    ).toEqual({
      slug: "fictional-harbour-school",
      shortName: "Fictional Harbour School",
      country: null,
    });
  });

  it("seeds AI policies only for schools on the list", () => {
    const names = new Set(SEED_SCHOOLS.map((s) => s.name));
    for (const school of aiPolicySeedSchools()) expect(names.has(school), school).toBe(true);
  });
});

describe("ownership scoping for Phase 3 user repositories", () => {
  const caller = randomUUID();
  const other = randomUUID();

  const scoped: [string, (db: ReturnType<typeof recordingDb>["db"]) => Promise<unknown>][] = [
    ["addUserSchool", (db) => addUserSchool(db, caller, { schoolCycleId: other })],
    ["listUserSchools", (db) => listUserSchools(db, caller)],
    ["getUserSchool", (db) => getUserSchool(db, caller, other)],
    ["updateUserSchool", (db) => updateUserSchool(db, caller, other, { round: "R2" })],
    ["saveUserSchoolFit", (db) => saveUserSchoolFit(db, caller, other, { lane: "tech" }, 1)],
    ["voteForSchool", (db) => voteForSchool(db, caller, other)],
    ["withdrawSchoolVote", (db) => withdrawSchoolVote(db, caller, other)],
    ["listSchoolVotes", (db) => listSchoolVotes(db, caller)],
    [
      "saveProfileRead",
      (db) => saveProfileRead(db, caller, { content: { lenses: [] }, builtFromSnapshotVersion: 1 }),
    ],
    ["getLatestProfileRead", (db) => getLatestProfileRead(db, caller)],
    ["getKitForUserSchool", (db) => getKitForUserSchool(db, caller, other)],
    ["listKits", (db) => listKits(db, caller)],
  ];

  it.each(scoped)("%s binds every statement to the caller's user_id", async (_, call) => {
    const { db, queries } = recordingDb();
    await call(db).catch(() => undefined);
    expect(queries.length).toBeGreaterThan(0);
    for (const q of queries) {
      expect(q.params).toContain(caller);
      expect(q.text).toMatch(/"user_id"/);
      if (/^(select|update|delete)/i.test(q.text))
        expect(q.text).toMatch(/where .*"user_id" = \$\d+/i);
    }
  });

  it("removeUserSchool deletes only the caller's row, and only before unlock", async () => {
    const { db, queries } = recordingDb();
    await removeUserSchool(db, caller, other);
    expect(queries[0]!.text).toMatch(/^delete from "user_schools" where/i);
    expect(queries[0]!.params).toContain(caller);
    expect(queries[0]!.text).toMatch(/in \('considering', 'preview'\)/);
  });

  it("applicants cannot set preview or unlocked themselves", async () => {
    const { db, queries } = recordingDb();
    await expect(
      updateUserSchool(db, caller, other, { status: "unlocked" } as never),
    ).rejects.toThrow();
    await expect(
      updateUserSchool(db, caller, other, { status: "preview" } as never),
    ).rejects.toThrow();
    expect(queries).toHaveLength(0);
  });

  it("rejects a malformed userId before querying", async () => {
    const { db, queries } = recordingDb();
    await expect(listUserSchools(db, "user-1")).rejects.toThrow(/userId must be a UUID/);
    await expect(voteForSchool(db, "1' or '1'='1", other)).rejects.toThrow(/userId must be a UUID/);
    expect(queries).toHaveLength(0);
  });
});

describe("admin context", () => {
  it("refuses a hand-made context before touching the database", async () => {
    const { db, queries } = recordingDb();
    const forged = { db, actorId: randomUUID(), job: null } as AdminContext;
    await expect(
      createSchool(forged, {
        slug: "fictional-school",
        name: "Fictional",
        shortName: "F",
        region: "us",
      }),
    ).rejects.toThrow(/requireAdmin/);
    expect(queries).toHaveLength(0);
  });

  it("refuses a user without the admin role", async () => {
    const { db } = recordingDb([]);
    await expect(requireAdmin(db, randomUUID())).rejects.toThrow(/Admin role required/);
  });
});

describe("chunk store filters", () => {
  const embedding = Array.from({ length: 1024 }, (_, i) => (i === 0 ? 1 : 0));

  it("excludes third-party reference notes unless asked for (§9.6)", async () => {
    const { db, queries } = recordingDb();
    await createChunkStore(db).textSearch({ query: "interview", filters: {}, limit: 5 });
    const select = queries.find((q) => /^select/i.test(q.text))!;
    expect(select.text).toMatch(/"kb_sources"\."type" <> \$\d+/);
    expect(select.params).toContain("third_party_reference");
    expect(select.text).toMatch(/websearch_to_tsquery/);
  });

  it("filters by school, cycle (or evergreen), types and trust", async () => {
    const { db, queries } = recordingDb();
    const schoolId = randomUUID();
    await createChunkStore(db).vectorSearch({
      embedding,
      filters: { schoolId, cycle: "2026-27", sourceTypes: ["official", "adcom"], minTrust: 4 },
      limit: 6,
    });
    const select = queries.find((q) => /^select/i.test(q.text))!;
    expect(select.text).toMatch(/<=>/);
    expect(select.text).toMatch(/"kb_chunks"\."cycle" is null/);
    expect(select.params).toEqual(
      expect.arrayContaining([schoolId, "2026-27", "official", "adcom", 4]),
    );
    expect(queries.some((q) => /hnsw\.iterative_scan/.test(q.text))).toBe(true);
  });

  it("returns nothing without querying for an empty type list, blank query or zero limit", async () => {
    const { db, queries } = recordingDb();
    const store = createChunkStore(db);
    expect(await store.textSearch({ query: "x", filters: { sourceTypes: [] }, limit: 5 })).toEqual(
      [],
    );
    expect(await store.textSearch({ query: "   ", filters: {}, limit: 5 })).toEqual([]);
    expect(await store.vectorSearch({ embedding, filters: {}, limit: 0 })).toEqual([]);
    expect(queries).toHaveLength(0);
  });

  it("rejects an embedding of the wrong size", async () => {
    const { db } = recordingDb();
    await expect(
      createChunkStore(db).vectorSearch({ embedding: [1, 0, 0], filters: {}, limit: 5 }),
    ).rejects.toThrow(/1024/);
  });
});
