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
