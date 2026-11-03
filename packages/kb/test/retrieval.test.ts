import { parseCode } from "@admitstory/shared";
import { describe, expect, it } from "vitest";
import {
  RETRIEVAL_DEFAULTS,
  RRF_K,
  chunkForCode,
  formatRetrieved,
  hybridSearch,
  isRetrievalCode,
  matchesFilters,
  reciprocalRankFusion,
  retrievalCode,
  storeFilters,
} from "../src/retrieval";
import type { ChunkFilters, ChunkHit, ChunkStore } from "../src/types";

function hit(chunkId: string, overrides: Partial<ChunkHit> = {}): ChunkHit {
  return {
    chunkId,
    sourceId: `src-${chunkId}`,
    schoolId: "halvorsen",
    cycle: "2026-27",
    text: `Chunk ${chunkId} about interviews.`,
    sourceType: "interview_reports",
    trust: 3,
    title: `Report ${chunkId}`,
    url: null,
    verifiedAt: "2026-09-05",
    score: 0.5,
    ...overrides,
  };
}

function store(vector: ChunkHit[], text: ChunkHit[]) {
  const calls: { kind: string; limit: number; filters: ChunkFilters }[] = [];
  const s: ChunkStore = {
    vectorSearch: async (q) => {
      calls.push({ kind: "vector", limit: q.limit, filters: q.filters });
      return vector;
    },
    textSearch: async (q) => {
      calls.push({ kind: "text", limit: q.limit, filters: q.filters });
      return text;
    },
  };
  return { store: s, calls };
}

const embed = async () => [0.1, 0.2, 0.3];

describe("reciprocalRankFusion", () => {
  it("sums 1/(k + rank) across lists and ranks hits found by both first", () => {
    const fused = reciprocalRankFusion([
      [hit("a"), hit("b"), hit("c")],
      [hit("c"), hit("d"), hit("a")],
    ]);
    expect(fused.map((f) => f.hit.chunkId)).toEqual(["a", "c", "b", "d"]);
    expect(fused[0]?.fusedScore).toBeCloseTo(1 / (RRF_K + 1) + 1 / (RRF_K + 3), 12);
    expect(fused[1]?.fusedScore).toBeCloseTo(1 / (RRF_K + 3) + 1 / (RRF_K + 1), 12);
    expect(fused[3]?.fusedScore).toBeCloseTo(1 / (RRF_K + 2), 12);
  });

  it("breaks ties by chunk id and credits a duplicate only once per list", () => {
    const fused = reciprocalRankFusion([[hit("z"), hit("z")], [hit("y")]]);
    expect(fused.map((f) => f.hit.chunkId)).toEqual(["y", "z"]);
    expect(fused[1]?.fusedScore).toBeCloseTo(1 / (RRF_K + 1), 12);
  });
});

describe("retrieval codes", () => {
  it("are K codes the shared parser reads, in a range pack ids can't reach", () => {
    expect(retrievalCode(1)).toBe("K900001");
    expect(parseCode(retrievalCode(1))).toEqual({ kind: "pack", n: 900_001 });
    expect(isRetrievalCode("K900001")).toBe(true);
    expect(isRetrievalCode("K12")).toBe(false);
    expect(() => retrievalCode(0)).toThrow();
    expect(() => retrievalCode(100_000)).toThrow();
  });
});

describe("matchesFilters", () => {
  it("applies school, cycle, trust and source type, and hides third-party chunks by default", () => {
    expect(matchesFilters(hit("a"), { schoolId: "halvorsen", cycle: "2026-27", minTrust: 3 })).toBe(
      true,
    );
    expect(matchesFilters(hit("a"), { schoolId: "marrowgate" })).toBe(false);
    expect(matchesFilters(hit("a"), { cycle: "2025-26" })).toBe(false);
    expect(matchesFilters(hit("a", { cycle: null }), { cycle: "2025-26" })).toBe(true);
    expect(matchesFilters(hit("a"), { minTrust: 4 })).toBe(false);
    expect(matchesFilters(hit("a"), { sourceTypes: ["official"] })).toBe(false);
    const thirdParty = hit("t", { sourceType: "third_party_reference", trust: 2 });
    expect(matchesFilters(thirdParty, {})).toBe(false);
    expect(matchesFilters(thirdParty, { sourceTypes: ["third_party_reference"] })).toBe(true);
  });
});

describe("storeFilters", () => {
  it("sends the third-party default to the store explicitly, so those chunks can't take top-20 slots", () => {
    const pushed = storeFilters({ schoolId: "halvorsen" });
    expect(pushed.schoolId).toBe("halvorsen");
    expect(pushed.sourceTypes).toHaveLength(6);
    expect(pushed.sourceTypes).not.toContain("third_party_reference");
    const explicit = { sourceTypes: ["third_party_reference" as const] };
    expect(storeFilters(explicit)).toBe(explicit);
  });
});

describe("hybridSearch (§8.9)", () => {
  it("asks each index for its top 20 and returns the top 6 fused, with codes", async () => {
    const vector = Array.from({ length: 20 }, (_, i) => hit(`v${String(i).padStart(2, "0")}`));
    const text = [hit("v03"), hit("v01"), ...Array.from({ length: 18 }, (_, i) => hit(`t${i}`))];
    const { store: s, calls } = store(vector, text);
    const filters = { schoolId: "halvorsen", cycle: "2026-27" };
    const result = await hybridSearch(s, embed, "interview questions", filters);
    const pushed = storeFilters(filters);
    expect(calls).toEqual([
      { kind: "vector", limit: RETRIEVAL_DEFAULTS.vectorK, filters: pushed },
      { kind: "text", limit: RETRIEVAL_DEFAULTS.textK, filters: pushed },
    ]);
    expect(result.chunks.map((c) => c.chunkId)).toEqual(["v01", "v03", "v00", "t0", "v02", "t1"]);
    expect(result.chunks.map((c) => c.code)).toEqual([
      "K900001",
      "K900002",
      "K900003",
      "K900004",
      "K900005",
      "K900006",
    ]);
    expect(result.nextCodeStart).toBe(7);
    expect(result.chunks.every((c) => c.citable)).toBe(true);
    expect(chunkForCode(result, "k900002")?.chunkId).toBe("v03");
    expect(chunkForCode(result, "K12")).toBeUndefined();
  });

  it("re-applies the filters to whatever the store returns", async () => {
    const { store: s } = store(
      [
        hit("ok"),
        hit("other-school", { schoolId: "marrowgate" }),
        hit("tp", { sourceType: "third_party_reference" }),
      ],
      [hit("low-trust", { trust: 1 })],
    );
    const result = await hybridSearch(s, embed, "q", { schoolId: "halvorsen", minTrust: 2 });
    expect(result.chunks.map((c) => c.chunkId)).toEqual(["ok"]);
  });

  it("stays within the token budget, skipping a chunk that doesn't fit for a smaller one", async () => {
    const big = "word ".repeat(400).trim();
    const { store: s } = store([hit("a", { text: big }), hit("b", { text: big }), hit("c")], []);
    const result = await hybridSearch(s, embed, "q", {}, { maxTokens: 500 });
    expect(result.chunks.map((c) => c.chunkId)).toEqual(["a", "c"]);
    expect(result.tokenCount).toBeLessThanOrEqual(500);
    expect(result.tokenCount).toBe(result.chunks.reduce((sum, c) => sum + c.tokenCount, 0));
  });

  it("marks stale and unverified chunks as background only", async () => {
    const { store: s } = store(
      [hit("fresh"), hit("old", { verifiedAt: "2025-10-01" }), hit("never", { verifiedAt: null })],
      [],
    );
    const result = await hybridSearch(s, embed, "q", { cycle: "2026-27" });
    expect(Object.fromEntries(result.chunks.map((c) => [c.chunkId, c.citable]))).toEqual({
      fresh: true,
      old: false,
      never: false,
    });
    const block = formatRetrieved(result);
    expect(block).toContain(
      "K900001 [interview_reports 2026-09-05] Report fresh\nChunk fresh about interviews.",
    );
    expect(block).toContain("K900002 [interview_reports 2025-10-01 background-only] Report old");
    expect(block).toContain("K900003 [interview_reports unverified background-only] Report never");
  });

  it("never marks a third-party chunk citable, even when the caller asks for one", async () => {
    const { store: s } = store([hit("tp", { sourceType: "third_party_reference", trust: 2 })], []);
    const result = await hybridSearch(s, embed, "q", {
      cycle: "2026-27",
      sourceTypes: ["third_party_reference"],
    });
    expect(result.chunks.map((c) => [c.chunkId, c.citable])).toEqual([["tp", false]]);
  });

  it("continues numbering from codeStart so two searches in one prompt don't collide", async () => {
    const { store: s } = store([hit("a"), hit("b")], []);
    const result = await hybridSearch(s, embed, "q", {}, { codeStart: 7, limit: 1 });
    expect(result.chunks.map((c) => c.code)).toEqual(["K900007"]);
    expect(result.nextCodeStart).toBe(8);
  });
});
