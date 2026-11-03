import type { TokenUsage } from "./pricing";

/**
 * One row of usage_ledger per API attempt (spec §8.4 step 7, §10). This contract is declared
 * identically in packages/db; structural typing joins the two in apps/web.
 */
export interface UsageEntry {
  runId: string;
  userId: string | null;
  kitId: string | null;
  schoolPackId: string | null;
  task: string;
  model: string;
  servedModel: string;
  effort: string | null;
  attemptKind: "primary" | "repair" | "fallback" | "escalation";
  aiMode: "live" | "replay";
  inputTokens: number;
  cacheReadTokens: number;
  cacheWrite5mTokens: number;
  cacheWrite1hTokens: number;
  outputTokens: number;
  webSearches: number;
  costUsd: number;
  latencyMs: number;
  promptVersion: string;
  traceId: string | null;
  stopReason: string | null;
}

export interface LedgerSink {
  write(entry: UsageEntry): Promise<void>;
  spentByUser(userId: string): Promise<number>;
  spentByKit(kitId: string): Promise<number>;
  /** A user with an active paid entitlement is governed by the per-kit caps, not the free cap. */
  isPaidUser?(userId: string): Promise<boolean>;
}

export interface MemoryLedger extends LedgerSink {
  readonly entries: readonly UsageEntry[];
}

/** In-process ledger for tests and scripts. */
export function createMemoryLedger(seed: readonly UsageEntry[] = []): MemoryLedger {
  const entries: UsageEntry[] = [...seed];
  const sum = (pick: (e: UsageEntry) => boolean) =>
    entries.filter(pick).reduce((total, e) => total + e.costUsd, 0);
  return {
    entries,
    async write(entry) {
      entries.push({ ...entry });
    },
    async spentByUser(userId) {
      return sum((e) => e.userId === userId);
    },
    async spentByKit(kitId) {
      return sum((e) => e.kitId === kitId);
    },
  };
}

/** The usage fields we read from a Messages API response (shared by the beta and GA shapes). */
export interface ApiUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_creation?: { ephemeral_5m_input_tokens: number; ephemeral_1h_input_tokens: number } | null;
  server_tool_use?: { web_search_requests: number } | null;
}

/**
 * Normalises API usage. The 5m/1h cache-write split comes from usage.cache_creation; when only the
 * total is present we treat it as 5-minute writes, the cheaper and default TTL.
 */
export function tokenUsageFromApi(usage: ApiUsage): TokenUsage {
  const split = usage.cache_creation;
  return {
    inputTokens: usage.input_tokens,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    cacheWrite5mTokens: split
      ? split.ephemeral_5m_input_tokens
      : (usage.cache_creation_input_tokens ?? 0),
    cacheWrite1hTokens: split ? split.ephemeral_1h_input_tokens : 0,
    outputTokens: usage.output_tokens,
    webSearches: usage.server_tool_use?.web_search_requests ?? 0,
  };
}
