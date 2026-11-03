export {
  createAI,
  createAIFromEnv,
  LIVE_MAX_RETRIES,
  NON_STREAMING_MAX_TOKENS,
  type AI,
  type AIConfig,
  type DataDirConfig,
  type AIMode,
  type EmbedContext,
  type RunContext,
} from "./run";
export {
  type AIBatch,
  type BatchCollectOptions,
  type BatchCollectResult,
  type BatchItemErrorKind,
  type BatchItemResult,
  type BatchSubmission,
} from "./batch";
export {
  EMBED_BATCH_SIZE,
  EmbedConfigError,
  createFakeEmbedder,
  createVoyageEmbedder,
  embedderFromEnv,
  fakeEmbedding,
  type EmbedInputType,
  type EmbeddingProvider,
} from "./embed";
export {
  OVERLAY_TTL_MS,
  abBucket,
  createRegistryOverlay,
  pickActiveVersion,
  type OverlayCanonDoc,
  type OverlayPromptVersion,
  type RegistryOverlay,
  type RegistryOverlaySource,
} from "./prompts/overlay";
export {
  AIError,
  AIRefusalError,
  BudgetExceededError,
  InputValidationError,
  OutputTruncatedError,
  OutputValidationError,
  ReplayMissingError,
  UnknownTaskError,
  UpstreamError,
  type BudgetScope,
  type ValidationIssue,
} from "./errors";
export {
  EFFORTS,
  EMBED_ROUTE,
  MODEL_IDS,
  ROUTABLE_MODEL_KEYS,
  ROUTES,
  RouteOverride,
  isRouteTask,
  resolveRoute,
  type Effort,
  type ModelChoice,
  type ModelId,
  type ModelKey,
  type ResolvedRoute,
  type RoutableModelKey,
  type Route,
  type RouteTask,
  type Thinking,
} from "./routing";
export {
  BATCH_DISCOUNT,
  EMBEDDING_PRICES_USD_PER_MTOK,
  MODEL_PRICES,
  PRICING_SOURCE,
  PRICING_VERIFIED_AT,
  UnknownModelPriceError,
  WEB_SEARCH_USD_PER_1000,
  computeCost,
  computeCostBreakdown,
  computeEmbeddingCost,
  type CostBreakdown,
  type TokenUsage,
} from "./pricing";
export {
  createMemoryLedger,
  tokenUsageFromApi,
  type LedgerSink,
  type MemoryLedger,
  type UsageEntry,
} from "./ledger";
export { BUDGET_CAPS, checkBudget, type BudgetCaps, type BudgetDecision } from "./budget";
export {
  CRITIC_PASS_SCORE,
  FAILS_BEFORE_ESCALATION,
  STRUCTURAL_RULES,
  criticFailsStructure,
  selectEscalation,
  type EscalationDecision,
  type EscalationState,
} from "./escalation";
export {
  KIT_GENERATION_ESTIMATE_USD,
  KIT_GENERATION_RANGE_USD,
  KIT_GENERATION_TYPICAL_USD,
  estimateKitCost,
  type KitCostEstimate,
  type KitLedgerRow,
} from "./cost";
// Post-parse rules of the kit writers, for the app to re-run on stored outputs and user edits.
export { applyPatches, patchGuardIssues, type PatchRules } from "./tasks/draft";
export {
  CRITIC_FIX_HINT_MAX_WORDS,
  angleIssues,
  coachIssues,
  criticIssues,
  expectedFormat,
  isCut,
  limitLabel,
  promptPartIssues,
  shortformIssues,
} from "./tasks/kit-writing";
export {
  dossierIndex,
  draftProvenanceIssues,
  materialFor,
  normaliseLine,
  packIndex,
  type DossierIndex,
  type Material,
  type PackIndex,
} from "./tasks/provenance";
export { TASKS, type TaskInput, type TaskName, type TaskOutput } from "./tasks";
// Task input and output schemas, so feature code can type the values it hands to and gets from
// ai.run() without importing from src/schemas directly.
export * from "./schemas";
export {
  createFilePromptSource,
  loadPrompt,
  renderPrompt,
  type PromptSource,
  type PromptTemplate,
} from "./prompts/registry";
export { retrievalBlocks, untrustedBlock, type RetrievedChunk } from "./request";
export { REPLAY_DIR, requestHash } from "./replay";
export { findRepoRoot, resolveDataDirs, type DataDirs } from "./paths";
export type { TracingConfig } from "./tracing";
export * from "./canon";
// The evaluation harness (spec §8.11). Node-only: it reads fixtures from disk.
export * from "./fixtures";
