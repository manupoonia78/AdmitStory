import { index, integer, numeric, pgEnum, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { baseColumns } from "./columns";

export const attemptKinds = ["primary", "repair", "fallback", "escalation"] as const;
export const attemptKindEnum = pgEnum("usage_attempt_kind", attemptKinds);

export const aiModes = ["live", "replay"] as const;
export const aiModeEnum = pgEnum("ai_mode", aiModes);

// Spec §10 usage_ledger, with the approved split of cache writes by TTL (5-minute
// and 1-hour writes are priced differently, §8.4) and per-attempt metadata.
// One row per API attempt; run_id groups the attempts of one ai.run() call.
export const usageLedger = pgTable(
  "usage_ledger",
  {
    ...baseColumns(),
    // SET NULL: cost history survives account deletion, anonymised (§14.4).
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    // No FKs yet: kits arrive in Phase 4 and school packs in Phase 3.
    kitId: uuid("kit_id"),
    schoolPackId: uuid("school_pack_id"),
    runId: uuid("run_id").notNull(),
    task: text("task").notNull(),
    model: text("model").notNull(),
    servedModel: text("served_model").notNull(),
    effort: text("effort"),
    attemptKind: attemptKindEnum("attempt_kind").notNull(),
    aiMode: aiModeEnum("ai_mode").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
    cacheWrite5mTokens: integer("cache_write_5m_tokens").notNull().default(0),
    cacheWrite1hTokens: integer("cache_write_1h_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    sttSeconds: numeric("stt_seconds", { precision: 12, scale: 2, mode: "number" })
      .notNull()
      .default(0),
    ttsChars: integer("tts_chars").notNull().default(0),
    livekitMinutes: numeric("livekit_minutes", { precision: 12, scale: 2, mode: "number" })
      .notNull()
      .default(0),
    webSearches: integer("web_searches").notNull().default(0),
    costUsd: numeric("cost_usd", { precision: 10, scale: 5, mode: "number" }).notNull(),
    latencyMs: integer("latency_ms").notNull(),
    promptVersion: text("prompt_version").notNull(),
    traceId: text("trace_id"),
    stopReason: text("stop_reason"),
  },
  (t) => [
    index("usage_ledger_user_id_idx").on(t.userId),
    index("usage_ledger_kit_id_idx").on(t.kitId),
    index("usage_ledger_run_id_idx").on(t.runId),
    index("usage_ledger_created_at_idx").on(t.createdAt),
  ],
);
