import { describe, expect, it } from "vitest";
import {
  BATCH_DISCOUNT,
  PRICING_SOURCE,
  PRICING_VERIFIED_AT,
  UnknownModelPriceError,
  computeCost,
  computeCostBreakdown,
  type TokenUsage,
} from "../src/pricing";
import { MODEL_IDS } from "../src/routing";

const M = 1_000_000;
const usage = (u: Partial<TokenUsage>): TokenUsage => ({
  inputTokens: 0,
  cacheReadTokens: 0,
  cacheWrite5mTokens: 0,
  cacheWrite1hTokens: 0,
  outputTokens: 0,
  webSearches: 0,
  ...u,
});

/** [input, 5m write, 1h write, cache read, output] in USD per MTok, verified 2026-10-24. */
const PINNED: [string, number[]][] = [
  [MODEL_IDS.opus, [4, 5, 8, 0.2, 20]],
  [MODEL_IDS.sonnet, [2, 2.5, 4, 0.1, 10]],
  [MODEL_IDS.haiku, [0.1, 0.125, 0.2, 0.01, 0.5]],
  [MODEL_IDS.opus5, [5, 6.25, 10, 0.5, 25]],
  [MODEL_IDS.opus48, [5, 6.25, 10, 0.5, 25]],
  [MODEL_IDS.sonnet5, [2, 2.5, 4, 0.2, 10]],
];

describe("pricing", () => {
  it("records its source and verification date", () => {
    expect(PRICING_SOURCE).toBe("https://platform.claude.com/docs/en/about-claude/pricing");
    expect(PRICING_VERIFIED_AT).toBe("2026-10-24");
  });

  it.each(PINNED)("prices %s per the published rates", (modelId, [input, w5, w1, read, output]) => {
    const c = (u: Partial<TokenUsage>) => computeCost({ modelId, usage: usage(u) });
    expect(c({ inputTokens: 10_000 })).toBeCloseTo((10_000 * input!) / M, 12);
    expect(c({ cacheWrite5mTokens: 10_000 })).toBeCloseTo((10_000 * w5!) / M, 12);
    expect(c({ cacheWrite1hTokens: 10_000 })).toBeCloseTo((10_000 * w1!) / M, 12);
    expect(c({ cacheReadTokens: 10_000 })).toBeCloseTo((10_000 * read!) / M, 12);
    expect(c({ outputTokens: 10_000 })).toBeCloseTo((10_000 * output!) / M, 12);
  });

  it("switches Haiku to the long-context tier above 100K total prompt tokens", () => {
    const at = computeCostBreakdown({
      modelId: MODEL_IDS.haiku,
      usage: usage({ inputTokens: 100_000, outputTokens: 1_000 }),
    });
    expect(at.input).toBeCloseTo(0.01, 12);
    expect(at.output).toBeCloseTo(0.0005, 12);

    // 60K fresh + 30K cached + 10,001 cache write = 100,001 prompt tokens → every part at the >100K rates.
    const above = computeCostBreakdown({
      modelId: MODEL_IDS.haiku,
      usage: usage({
        inputTokens: 60_000,
        cacheReadTokens: 30_000,
        cacheWrite1hTokens: 10_001,
        outputTokens: 1_000,
      }),
    });
    expect(above.input).toBeCloseTo((60_000 * 0.5) / M, 12);
    expect(above.cacheRead).toBeCloseTo((30_000 * 0.05) / M, 12);
    expect(above.cacheWrite1h).toBeCloseTo((10_001 * 1) / M, 12);
    expect(above.output).toBeCloseTo((1_000 * 2.5) / M, 12);
    expect(
      computeCostBreakdown({
        modelId: MODEL_IDS.haiku,
        usage: usage({ cacheWrite5mTokens: 200_000 }),
      }).cacheWrite5m,
    ).toBeCloseTo((200_000 * 0.625) / M, 12);
  });

  it("halves token costs on the Batch API, stacking with cache rates", () => {
    expect(BATCH_DISCOUNT).toBe(0.5);
    const u = usage({
      inputTokens: 1_000,
      cacheReadTokens: 50_000,
      cacheWrite1hTokens: 8_000,
      outputTokens: 2_000,
    });
    const live = computeCost({ modelId: MODEL_IDS.sonnet, usage: u });
    const batch = computeCost({ modelId: MODEL_IDS.sonnet, usage: u, batch: true });
    expect(batch).toBeCloseTo(live / 2, 12);
    expect(live).toBeCloseTo((1_000 * 2 + 50_000 * 0.1 + 8_000 * 4 + 2_000 * 10) / M, 12);
  });

  it("charges $10 per 1,000 web searches, not discounted by batch", () => {
    const u = usage({ webSearches: 3 });
    expect(computeCost({ modelId: MODEL_IDS.haiku, usage: u })).toBeCloseTo(0.03, 12);
    expect(computeCost({ modelId: MODEL_IDS.haiku, usage: u, batch: true })).toBeCloseTo(0.03, 12);
  });

  it("throws for an unpriced model", () => {
    expect(() => computeCost({ modelId: "not-a-model", usage: usage({ inputTokens: 1 }) })).toThrow(
      UnknownModelPriceError,
    );
  });
});
