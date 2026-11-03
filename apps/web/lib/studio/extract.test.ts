import type { ExtractionOutput } from "@admitstory/ai";
import { afterEach, describe, expect, it, vi } from "vitest";

// §7.5: golden lines keep the applicant's own words in the language they spoke, with the English
// rendering stored beside them — and an English answer never gets a "rendering" of itself.

const createGoldenLines = vi.hoisted(() =>
  vi.fn(async (_db: unknown, _userId: string, lines: unknown[]) => lines),
);

vi.mock("server-only", () => ({}));
vi.mock("@/lib/ai", () => ({ ai: () => ({}) }));
vi.mock("@admitstory/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@admitstory/db")>()),
  getDb: () => ({}),
  upsertFacts: vi.fn(async () => ({ created: [], conflicted: [] })),
  upsertPeople: vi.fn(async () => []),
  createStories: vi.fn(async () => []),
  createGoldenLines,
}));

const { persistExtraction } = await import("./extract");

const output = {
  facts: [],
  story_candidates: [],
  golden_lines: [
    {
      text: "मैंने पूरी रात काम किया।",
      span: { start: 0, end: 24 },
      english: "I worked all night.",
      story_index: null,
    },
  ],
  sensitive: [],
  conflicts: [],
} as unknown as ExtractionOutput;

const userId = "00000000-0000-4000-8000-000000000001";
const base = { chapter: "work" as const, sourceId: "00000000-0000-4000-8000-0000000000a1" };

afterEach(() => vi.clearAllMocks());

describe("persistExtraction and the answer's language", () => {
  it("stores a non-English line verbatim with its English rendering", async () => {
    await persistExtraction(userId, output, { ...base, language: "hi" });
    expect(createGoldenLines.mock.calls[0]![2]).toEqual([
      expect.objectContaining({ text: "मैंने पूरी रात काम किया।", english: "I worked all night." }),
    ]);
  });

  it("drops a rendering for an English answer", async () => {
    await persistExtraction(userId, output, { ...base, language: null });
    expect(createGoldenLines.mock.calls[0]![2]).toEqual([
      expect.objectContaining({ english: null }),
    ]);
  });

  it("leaves the importer's lines as the model gave them when the language is unknown", async () => {
    await persistExtraction(userId, output, base);
    expect(createGoldenLines.mock.calls[0]![2]).toEqual([
      expect.objectContaining({ english: "I worked all night." }),
    ]);
  });
});
