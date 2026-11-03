// Shared contract with packages/ai (defined identically there; structural typing
// joins the two in apps/web). Keep both copies in sync.

export interface UsageEntry {
  /** Groups every API attempt of one ai.run() call. */
  runId: string;
  userId: string | null;
  kitId: string | null;
  schoolPackId: string | null;
  /** e.g. "util.title" */
  task: string;
  /** Requested model ID. */
  model: string;
  /** Model that actually served (a server-side fallback may differ). */
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
  /** Computed by packages/ai pricing.ts. */
  costUsd: number;
  latencyMs: number;
  /** e.g. "util.title@v1" */
  promptVersion: string;
  traceId: string | null;
  stopReason: string | null;
}

export interface LedgerSink {
  write(entry: UsageEntry): Promise<void>;
  /** USD */
  spentByUser(userId: string): Promise<number>;
  /** USD */
  spentByKit(kitId: string): Promise<number>;
  /**
   * True when the user holds an active school-kit entitlement (Phase 4): paying users are exempt
   * from the free-user cap and governed by the per-kit caps instead (§12.4).
   */
  isPaidUser?(userId: string): Promise<boolean>;
}

/**
 * A voice usage_ledger row (Phase 2): dictation seconds or read-aloud characters, priced by
 * packages/voice. `model` is the provider; voice rows have no tokens, effort or prompt.
 */
export interface VoiceUsageEntry {
  runId: string;
  userId: string;
  task: "voice.stt" | "voice.tts";
  model: string;
  sttSeconds: number;
  ttsChars: number;
  costUsd: number;
  latencyMs: number;
  aiMode: "live" | "replay";
}

/* Retrieval contract with packages/kb ------------------------------------------------------- */
// Defined identically in packages/kb, which owns it; structural typing joins the two. Keep both
// copies in sync (spec §8.9).

export type KbSourceType =
  | "official"
  | "adcom"
  | "insider"
  | "interview_reports"
  | "coach_notes"
  | "third_party_reference"
  | "press";

export interface ChunkFilters {
  schoolId?: string;
  cycle?: string;
  sourceTypes?: KbSourceType[];
  minTrust?: number;
}

export interface ChunkHit {
  chunkId: string;
  sourceId: string;
  schoolId: string | null;
  cycle: string | null;
  text: string;
  sourceType: KbSourceType;
  trust: number;
  title: string;
  url: string | null;
  /** ISO date. */
  verifiedAt: string | null;
  score: number;
}

export interface ChunkStore {
  vectorSearch(q: {
    embedding: number[];
    filters: ChunkFilters;
    limit: number;
  }): Promise<ChunkHit[]>;
  textSearch(q: { query: string; filters: ChunkFilters; limit: number }): Promise<ChunkHit[]>;
}
