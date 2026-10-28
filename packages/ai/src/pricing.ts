import { MODEL_IDS } from "./routing";

/**
 * Token prices as config (spec §8.4, §12). Update these and PRICING_VERIFIED_AT together whenever
 * the published prices change.
 */
export const PRICING_SOURCE = "https://platform.claude.com/docs/en/about-claude/pricing";
export const PRICING_VERIFIED_AT = "2026-10-24";

/** USD per million tokens. */
export interface TokenRates {
  input: number;
  cacheWrite5m: number;
  cacheWrite1h: number;
  cacheRead: number;
  output: number;
}

export interface PriceTier extends TokenRates {
  /** Inclusive upper bound on total prompt tokens for this tier; null = no bound. */
  maxPromptTokens: number | null;
}

export interface ModelPrice {
  /** Ordered from smallest prompt bound to largest; the last tier has maxPromptTokens null. */
  tiers: readonly PriceTier[];
}

const flat = (rates: TokenRates): ModelPrice => ({ tiers: [{ ...rates, maxPromptTokens: null }] });

const OPUS_5_RATES: TokenRates = {
  input: 5,
  cacheWrite5m: 6.25,
  cacheWrite1h: 10,
  cacheRead: 0.5,
  output: 25,
};

export const MODEL_PRICES: Readonly<Record<string, ModelPrice>> = {
  [MODEL_IDS.opus]: flat({
    input: 4,
    cacheWrite5m: 5,
    cacheWrite1h: 8,
    cacheRead: 0.2,
    output: 20,
  }),
  [MODEL_IDS.sonnet]: flat({
    input: 2,
    cacheWrite5m: 2.5,
    cacheWrite1h: 4,
    cacheRead: 0.1,
    output: 10,
  }),
  [MODEL_IDS.haiku]: {
    // The tier is chosen per request by total prompt size (input + cache read + cache write).
    tiers: [
      {
        maxPromptTokens: 100_000,
        input: 0.1,
        cacheWrite5m: 0.125,
        cacheWrite1h: 0.2,
        cacheRead: 0.01,
        output: 0.5,
      },
      {
        maxPromptTokens: null,
        input: 0.5,
        cacheWrite5m: 0.625,
        cacheWrite1h: 1,
        cacheRead: 0.05,
        output: 2.5,
      },
    ],
  },
  [MODEL_IDS.opus5]: flat(OPUS_5_RATES),
  [MODEL_IDS.opus48]: flat(OPUS_5_RATES),
  [MODEL_IDS.sonnet5]: flat({
    input: 2,
    cacheWrite5m: 2.5,
    cacheWrite1h: 4,
    cacheRead: 0.2,
    output: 10,
  }),
};

/** Batch API discount; stacks with the cache multipliers. Applies to tokens, not tool fees. */
export const BATCH_DISCOUNT = 0.5;
export const WEB_SEARCH_USD_PER_1000 = 10;

/** Normalised token counts for one API response (see ledger.ts for the mapping from the API). */
export interface TokenUsage {
  inputTokens: number;
  cacheReadTokens: number;
  cacheWrite5mTokens: number;
  cacheWrite1hTokens: number;
  outputTokens: number;
  webSearches: number;
}

export interface CostBreakdown {
  input: number;
  cacheRead: number;
  cacheWrite5m: number;
  cacheWrite1h: number;
  output: number;
  webSearch: number;
  total: number;
}

export class UnknownModelPriceError extends Error {
  override readonly name = "UnknownModelPriceError";
  constructor(readonly modelId: string) {
    super(`No price configured for model "${modelId}". Add it to MODEL_PRICES in pricing.ts.`);
  }
}

export function hasPrice(modelId: string): boolean {
  return Object.hasOwn(MODEL_PRICES, modelId);
}

export function promptTokens(usage: TokenUsage): number {
  return (
    usage.inputTokens + usage.cacheReadTokens + usage.cacheWrite5mTokens + usage.cacheWrite1hTokens
  );
}

function tierFor(price: ModelPrice, prompt: number): PriceTier {
  const tier = price.tiers.find((t) => t.maxPromptTokens === null || prompt <= t.maxPromptTokens);
  if (!tier) throw new Error("Price tiers must end with an unbounded tier");
  return tier;
}

export function computeCostBreakdown(args: {
  modelId: string;
  usage: TokenUsage;
  batch?: boolean;
}): CostBreakdown {
  const price = MODEL_PRICES[args.modelId];
  if (!price) throw new UnknownModelPriceError(args.modelId);
  const { usage } = args;
  const tier = tierFor(price, promptTokens(usage));
  const factor = (args.batch ? BATCH_DISCOUNT : 1) / 1_000_000;

  const parts = {
    input: usage.inputTokens * tier.input * factor,
    cacheRead: usage.cacheReadTokens * tier.cacheRead * factor,
    cacheWrite5m: usage.cacheWrite5mTokens * tier.cacheWrite5m * factor,
    cacheWrite1h: usage.cacheWrite1hTokens * tier.cacheWrite1h * factor,
    output: usage.outputTokens * tier.output * factor,
    webSearch: (usage.webSearches * WEB_SEARCH_USD_PER_1000) / 1000,
  };
  const total =
    parts.input +
    parts.cacheRead +
    parts.cacheWrite5m +
    parts.cacheWrite1h +
    parts.output +
    parts.webSearch;
  return { ...parts, total };
}

/** USD cost of one response. Throws UnknownModelPriceError for an unpriced model. */
export function computeCost(args: { modelId: string; usage: TokenUsage; batch?: boolean }): number {
  return computeCostBreakdown(args).total;
}
