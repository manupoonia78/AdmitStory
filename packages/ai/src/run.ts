import { createHash, randomUUID } from "node:crypto";
import type { MessageCreateParamsBase } from "@anthropic-ai/sdk/resources/messages";
import { createBatchClient, type AIBatch } from "./batch";
import { checkBudget, type BudgetCaps } from "./budget";
import { loadCanon, type CanonLibrary } from "./canon";
import {
  EMBED_BATCH_SIZE,
  embedderFromEnv,
  type EmbedInputType,
  type EmbeddingProvider,
} from "./embed";
import {
  AIError,
  AIRefusalError,
  InputValidationError,
  OutputTruncatedError,
  OutputValidationError,
  ReplayMissingError,
  type ValidationIssue,
} from "./errors";
import { tokenUsageFromApi, type LedgerSink, type UsageEntry } from "./ledger";
import { canonDirIn, promptsDirIn, replayDirIn, repoRoot } from "./paths";
import {
  computeCostBreakdown,
  computeEmbeddingCost,
  hasPrice,
  type CostBreakdown,
} from "./pricing";
import {
  createFilePromptSource,
  loadPrompt,
  promptVersionLabel,
  renderPrompt,
  type PromptSource,
  type PromptTemplate,
} from "./prompts/registry";
import {
  overlayCanon,
  overlayPromptSource,
  pickActiveVersion,
  type OverlayCanonDoc,
  type RegistryOverlay,
} from "./prompts/overlay";
import {
  createAnthropicProvider,
  findCause,
  isFallbackEligible,
  toUpstreamError,
  type ApiMessage,
} from "./providers/anthropic";
import type { Fetch, RecordOptions } from "./replay";
import { buildParams, buildSystem, canonSubset, outputJsonSchema, type TextTurn } from "./request";
import {
  EMBED_ROUTE,
  MODEL_IDS,
  maxTokensForChoice,
  resolveRoute,
  type ModelChoice,
  type ResolvedRoute,
  type RouteOverride,
  type RouteTask,
} from "./routing";
import {
  getTask,
  type AnyTaskDefinition,
  type TaskInput,
  type TaskName,
  type TaskOutput,
} from "./tasks";
import type { TaskLayers } from "./tasks/define";
import { createTracer, type RunTrace, type TracingConfig } from "./tracing";
import { layersOf, parseOutput, servedModelOf, textOf, zodIssues } from "./output";

export { servedModelOf, textOf } from "./output";

export {
  LIVE_MAX_RETRIES,
  NON_STREAMING_MAX_TOKENS,
  SERVER_FALLBACK_BETA,
} from "./providers/anthropic";

export type AIMode = "live" | "replay";

/**
 * Where the runtime data is read from. Explicit dirs win; the rest are joined onto `rootDir`, or
 * onto the repo root found by walking up from process.cwd() to pnpm-workspace.yaml (see paths.ts).
 * Nothing is resolved from import.meta.url, so bundled server code (apps/web) works.
 */
export interface DataDirConfig {
  /** The repo root. Found from process.cwd() when omitted and some dir below is not given. */
  rootDir?: string;
  /** `<agent>/v<N>.md` templates. Default `<root>/packages/ai/src/prompts`. Ignored with `prompts`. */
  promptsDir?: string;
  /** Canon markdown. Default `<root>/knowledge/canon`. Ignored with `canon`. */
  canonDir?: string;
  /** Replay fixtures, read in replay mode and written when recording. Default `<root>/fixtures/llm-replays`. */
  replayDir?: string;
}

export interface AIConfig extends DataDirConfig {
  mode: AIMode;
  /** Live mode only. Replay mode uses a dummy key and never reaches the network. */
  apiKey?: string;
  ledger: LedgerSink;
  /** Live mode: write every successful response to the replay fixtures. */
  record?: boolean;
  recordOptions?: Pick<RecordOptions, "synthetic" | "note">;
  canon?: CanonLibrary;
  prompts?: PromptSource;
  tracing?: TracingConfig;
  routeOverrides?: () => Promise<Partial<Record<RouteTask, RouteOverride>>>;
  /**
   * Prompt versions (with A/B weights), route overrides and canon documents published from the
   * admin console, laid over the files (prompts/overlay.ts). Its route overrides win over
   * `routeOverrides` for the same task. Ignored for canon when `canon` is given.
   */
  overlay?: RegistryOverlay;
  /**
   * The embedding provider for ai.embed(), or a factory called on first use. Without one,
   * embedding throws; createAIFromEnv picks Voyage or the localhost-only fake.
   */
  embedder?: EmbeddingProvider | (() => EmbeddingProvider);
  /** Send prompt input/output to Langfuse (still per-call gated by ctx.contentLoggingAllowed). */
  contentLogging?: boolean;
  /** Live transport (tests, proxies). Defaults to the global fetch. */
  fetch?: Fetch;
  budgetCaps?: BudgetCaps;
}

export interface RunContext {
  userId?: string;
  kitId?: string;
  schoolPackId?: string;
  /**
   * L1 (spec §8.2): a published school pack's `compiled_prompt`, cached for an hour. Compiled once
   * per pack version, never assembled per request.
   */
  schoolPack?: string;
  /**
   * L2 (spec §8.2): the applicant's compact dossier snapshot, cached for five minutes. Built by the
   * Consolidator and stored, so every call in one kit pipeline sends the identical string.
   */
  dossier?: string;
  signal?: AbortSignal;
  /** Use the streaming transport. The result is still the validated final output. */
  stream?: boolean;
  /** Pass the user's improve_product_opt_in; false always suppresses content logging. */
  contentLoggingAllowed?: boolean;
  /**
   * §8.3 escalation: run on the route's escalation choice instead of its primary model. Set only
   * when selectEscalation() says so (the Critic failed this deliverable twice); at most once per
   * deliverable per request. A budget downgrade still wins. Ledger rows say "escalation".
   */
  escalate?: boolean;
}

export interface EmbedContext {
  userId?: string;
  kitId?: string;
  schoolPackId?: string;
  /** "document" when indexing (default), "query" when searching. */
  inputType?: EmbedInputType;
  signal?: AbortSignal;
}

export interface AI {
  run<T extends TaskName>(task: T, input: TaskInput<T>, ctx?: RunContext): Promise<TaskOutput<T>>;
  /**
   * Embeds texts for the knowledge base (§8.9): one 1024-dimension unit vector per text, in input
   * order. One usage_ledger row (task `kb.embed`) per provider request.
   */
  embed(texts: readonly string[], ctx?: EmbedContext): Promise<number[][]>;
  /** The Message Batches API for routes marked `batch` (§12.1: −50%). See batch.ts. */
  batch: AIBatch;
  /** Flush pending traces (call before a serverless function returns). */
  flush(): Promise<void>;
}

type AttemptKind = UsageEntry["attemptKind"];

export interface AttemptPlan extends ModelChoice {
  maxTokens: number;
  serverFallback: boolean;
}

export interface PreparedTask {
  def: AnyTaskDefinition;
  template: PromptTemplate;
  promptVersion: string;
  /**
   * The layers that are identical for every request on this prompt version (spec §8.2): the
   * rendered prompt and its canon subset. The per-user layers — a school pack and the compact
   * dossier — are added per request, after these, so the long-lived prefix still caches.
   */
  stableLayers: { agentPrompt: string; canon: string };
  outputSchema: Record<string, unknown>;
}

function costOf(message: ApiMessage, requestedModel: string, servedModel: string): CostBreakdown {
  const usage = tokenUsageFromApi(message.usage);
  let priceModel = servedModel;
  if (!hasPrice(servedModel)) {
    // Never lose a paid response over a missing price row; record at the requested model's price.
    console.warn(
      `[ai] No price for served model ${servedModel}; costing at ${requestedModel}. Update pricing.ts.`,
    );
    priceModel = requestedModel;
  }
  // A fallback-served turn bills each hop at its own model's rates. A hop that names no model ran
  // on the requested model ("message") or on the served fallback model ("fallback_message").
  const iterations = "iterations" in message.usage ? (message.usage.iterations ?? []) : [];
  if (iterations.some((it) => it.type === "fallback_message")) {
    const hops = iterations.filter((it) => it.type === "message" || it.type === "fallback_message");
    const parts = hops.map((it) => {
      const named =
        "model" in it && it.model
          ? it.model
          : it.type === "fallback_message"
            ? servedModel
            : requestedModel;
      const model = hasPrice(named) ? named : priceModel;
      return computeCostBreakdown({
        modelId: model,
        usage: { ...tokenUsageFromApi(it), webSearches: 0 },
      });
    });
    const searches = computeCostBreakdown({
      modelId: priceModel,
      usage: {
        inputTokens: 0,
        cacheReadTokens: 0,
        cacheWrite5mTokens: 0,
        cacheWrite1hTokens: 0,
        outputTokens: 0,
        webSearches: usage.webSearches,
      },
    });
    return [...parts, searches].reduce((sum, p) => ({
      input: sum.input + p.input,
      cacheRead: sum.cacheRead + p.cacheRead,
      cacheWrite5m: sum.cacheWrite5m + p.cacheWrite5m,
      cacheWrite1h: sum.cacheWrite1h + p.cacheWrite1h,
      output: sum.output + p.output,
      webSearch: sum.webSearch + p.webSearch,
      total: sum.total + p.total,
    }));
  }
  return computeCostBreakdown({ modelId: priceModel, usage });
}

function repairInstruction(issues: readonly ValidationIssue[]): string {
  const lines = issues.map((issue) => `- ${issue.path || "(root)"}: ${issue.message}`);
  return [
    "Your previous reply did not pass validation:",
    ...lines,
    "Reply again with the complete JSON object, fixing these problems and keeping everything else as it was.",
  ].join("\n");
}

/**
 * The repair conversation: the original turns, the model's reply, then the issues as the final
 * user turn (no prefill). The API rejects an assistant turn with empty content, so an empty or
 * whitespace-only reply is left out and the instruction is appended to the final user turn
 * instead of being sent as a second consecutive user turn.
 */
export function repairTurns(
  turns: readonly TextTurn[],
  reply: string,
  issues: readonly ValidationIssue[],
): TextTurn[] {
  const instruction = repairInstruction(issues);
  if (reply.trim() !== "") {
    return [
      ...turns,
      { role: "assistant", content: reply },
      { role: "user", content: instruction },
    ];
  }
  const last = turns.at(-1);
  if (last?.role === "user") {
    return [
      ...turns.slice(0, -1),
      {
        role: "user",
        content: `${last.content}\n\nYour previous reply was empty.\n${instruction}`,
      },
    ];
  }
  return [...turns, { role: "user", content: `Your previous reply was empty.\n${instruction}` }];
}

/** Model output for the Langfuse generation: parsed JSON when it parses, so redaction applies. */
function traceOutput(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function templateKey(template: PromptTemplate): string {
  return createHash("sha256")
    .update(
      JSON.stringify([template.body, template.canonFiles, template.canonRules, template.output]),
    )
    .digest("hex")
    .slice(0, 16);
}

/** Everything a request needs before the first attempt: shared by ai.run() and ai.batch.submit(). */
export interface BuiltRequest {
  def: AnyTaskDefinition;
  route: ResolvedRoute;
  prepared: PreparedTask;
  /** The validated input. */
  input: unknown;
  layers: TaskLayers;
  turns: TextTurn[];
  primary: AttemptPlan;
  /** "escalation" when ctx.escalate moved the first attempt to the route's escalation choice. */
  primaryKind: "primary" | "escalation";
  planFor(choice: ModelChoice): AttemptPlan;
  paramsFor(plan: AttemptPlan, messages: readonly TextTurn[]): MessageCreateParamsBase;
}

export function createAI(config: AIConfig): AI {
  const replay = config.mode === "replay";
  // Data dirs: explicit config, else `rootDir`, else the repo root found from process.cwd(). The
  // root is only looked up for a dir this client actually needs.
  let root: string | undefined = config.rootDir;
  const rootDir = (): string => (root ??= repoRoot());
  const needsReplayDir = replay || config.record === true;
  const replayDir = (): string => config.replayDir ?? replayDirIn(rootDir());

  const provider = createAnthropicProvider({
    replay,
    ...(config.apiKey ? { apiKey: config.apiKey } : {}),
    ...(needsReplayDir ? { replayDir: replayDir() } : {}),
    ...(config.record ? { record: { ...config.recordOptions } } : {}),
    ...(config.fetch ? { fetch: config.fetch } : {}),
  });

  const filePrompts =
    config.prompts ?? createFilePromptSource(config.promptsDir ?? promptsDirIn(rootDir()));
  const prompts = config.overlay ? overlayPromptSource(filePrompts, config.overlay) : filePrompts;
  const tracer = createTracer(config.tracing);
  const aiMode: AIMode = config.mode;
  let fileCanon: CanonLibrary | undefined;
  // The last overlay canon answer and the library built from it; the overlay's TTL cache hands back
  // the same array until something is published, so the library is rebuilt only then.
  let overlayCanonMemo:
    { docs: readonly OverlayCanonDoc[]; library: CanonLibrary; fingerprint: string } | undefined;
  const prepared = new Map<string, PreparedTask>();

  async function canonFor(): Promise<{ library: CanonLibrary; fingerprint: string }> {
    if (config.canon) return { library: config.canon, fingerprint: "config" };
    fileCanon ??= loadCanon(config.canonDir ?? canonDirIn(rootDir()));
    if (!config.overlay) return { library: fileCanon, fingerprint: "files" };
    const docs = await config.overlay.canonDocs();
    if (overlayCanonMemo?.docs !== docs)
      overlayCanonMemo = { docs, ...overlayCanon(fileCanon, docs) };
    return overlayCanonMemo;
  }

  async function prepare(
    def: AnyTaskDefinition,
    version?: number,
    source: PromptSource = prompts,
  ): Promise<PreparedTask> {
    const template = await loadPrompt(source, def.agent, version);
    if (template.output !== def.outputName) {
      throw new Error(
        `Prompt ${promptVersionLabel(template)} declares output ${template.output}, task expects ${def.outputName}`,
      );
    }
    const needsCanon = template.canonFiles.length > 0 || template.canonRules.length > 0;
    const canon = needsCanon ? await canonFor() : undefined;
    // Keyed by content, not object identity, so a re-read of the same published version reuses the
    // same prepared layers and the cached prefix stays byte-identical.
    const key = `${def.name}:${promptVersionLabel(template)}:${templateKey(template)}:${canon?.fingerprint ?? "-"}`;
    const cached = prepared.get(key);
    if (cached) return cached;
    const task: PreparedTask = {
      def,
      template,
      promptVersion: promptVersionLabel(template),
      stableLayers: {
        agentPrompt: renderPrompt(template),
        canon: canon ? canonSubset(canon.library, template) : "",
      },
      outputSchema: outputJsonSchema(def.output),
    };
    prepared.set(key, task);
    return task;
  }

  /**
   * The route and prompt version for a call: the task's override (config, then overlay) pins a
   * version if it names one; otherwise the overlay's active versions split traffic by user; else
   * the newest file. A served version's own route override applies on top of the task's.
   */
  async function resolve(
    def: AnyTaskDefinition,
    ctx: Pick<RunContext, "userId">,
  ): Promise<{ route: ResolvedRoute; prepared: PreparedTask }> {
    const none: Partial<Record<RouteTask, unknown>> = {};
    const [configured, published] = await Promise.all([
      config.routeOverrides ? config.routeOverrides() : none,
      config.overlay ? config.overlay.routeOverrides() : none,
    ]);
    const taskOverride: unknown = Object.hasOwn(published, def.name)
      ? published[def.name]
      : configured[def.name];
    let route = resolveRoute(def.name, taskOverride);
    let version = route.promptVersion;
    if (version === undefined && config.overlay) {
      const rows = await config.overlay.promptVersions(def.agent);
      const active = pickActiveVersion(rows, def.agent, ctx.userId);
      // A published version nobody has activated is a candidate, not the default: without an
      // active one, the newest file serves, read from the files so a draft that reuses a file's
      // version number cannot stand in for it.
      if (!active && rows.length > 0)
        return { route, prepared: await prepare(def, undefined, filePrompts) };
      if (active) {
        version = active.version;
        if (active.routeOverride) {
          const { promptVersion: _pinned, ...versionOverride } = active.routeOverride;
          route = resolveRoute(def.name, {
            ...(isRecord(taskOverride) ? taskOverride : {}),
            ...versionOverride,
          });
        }
      }
    }
    return { route, prepared: await prepare(def, version) };
  }

  async function build(task: string, rawInput: unknown, ctx: RunContext): Promise<BuiltRequest> {
    // 1. Route, prompt version and schemas.
    const def = getTask(task);
    const { route, prepared: preparedTask } = await resolve(def, ctx);

    // 2. Budget: downgrade or refuse before spending anything.
    const decision = await checkBudget({
      ledger: config.ledger,
      userId: ctx.userId ?? null,
      kitId: ctx.kitId ?? null,
      route,
      ...(config.budgetCaps ? { caps: config.budgetCaps } : {}),
    });

    // 3. Request: validated input and layers, cached system layers, then the task's turns.
    const parsedInput = def.input.safeParse(rawInput);
    if (!parsedInput.success) throw new InputValidationError(task, zodIssues(parsedInput.error));
    const layers = layersOf(ctx);
    const missing = (def.requires ?? []).filter((layer) => layers[layer] === undefined);
    if (missing.length > 0)
      throw new InputValidationError(
        task,
        missing.map((layer) => ({
          path: `ctx.${layer}`,
          message: `${def.name} needs the ${layer} layer`,
        })),
      );
    if (ctx.escalate && !route.escalation)
      throw new InputValidationError(task, [
        { path: "ctx.escalate", message: `${def.name} has no escalation route` },
      ]);
    const turns = def.buildMessages(parsedInput.data);
    const allowedDomains = def.allowedDomains?.(parsedInput.data);

    const planFor = (choice: ModelChoice): AttemptPlan => ({
      ...choice,
      maxTokens: maxTokensForChoice(route, choice),
      serverFallback: choice.model !== "haiku" && !route.batch,
    });
    // A budget downgrade wins over an escalation: the caps are the harder rule (§12.4).
    const downgraded = decision === "downgrade" && route.downgrade !== undefined;
    const escalated = !downgraded && ctx.escalate === true && route.escalation !== undefined;
    const primary: AttemptPlan =
      downgraded && route.downgrade
        ? planFor(route.downgrade)
        : escalated && route.escalation
          ? planFor(route.escalation)
          : {
              model: route.model,
              effort: route.effort,
              thinking: route.thinking,
              maxTokens: route.maxTokens,
              serverFallback: route.serverFallback,
            };

    return {
      def,
      route,
      prepared: preparedTask,
      input: parsedInput.data,
      layers,
      turns,
      primary,
      primaryKind: escalated ? "escalation" : "primary",
      planFor,
      paramsFor: (plan, messages) =>
        buildParams({
          choice: plan,
          maxTokens: plan.maxTokens,
          system: buildSystem({ ...preparedTask.stableLayers, ...layers }),
          messages,
          outputSchema: preparedTask.outputSchema,
          tools: route.tools,
          ...(allowedDomains ? { allowedDomains } : {}),
        }),
    };
  }

  function callApi(
    task: PreparedTask,
    params: MessageCreateParamsBase,
    plan: AttemptPlan,
    ctx: RunContext,
  ): Promise<ApiMessage> {
    return provider.send(params, {
      task: task.def.name,
      promptVersion: task.promptVersion,
      serverFallback: plan.serverFallback,
      stream: ctx.stream === true,
      ...(ctx.signal ? { signal: ctx.signal } : {}),
    });
  }

  async function run<T extends TaskName>(
    task: T,
    input: TaskInput<T>,
    ctx: RunContext = {},
  ): Promise<TaskOutput<T>> {
    const built = await build(task, input, ctx);
    const { def, route, prepared: preparedTask, turns } = built;
    const checkWith = { input: built.input, layers: built.layers };

    const runId = randomUUID();
    const trace: RunTrace = tracer.startRun({
      task,
      runId,
      promptVersion: preparedTask.promptVersion,
      aiMode,
      ...(ctx.userId ? { userId: ctx.userId } : {}),
      ...(ctx.kitId ? { kitId: ctx.kitId } : {}),
      ...(ctx.schoolPackId ? { schoolPackId: ctx.schoolPackId } : {}),
      logContent: config.contentLogging === true && ctx.contentLoggingAllowed !== false,
      input: built.input,
    });

    const attempt = async (
      plan: AttemptPlan,
      kind: AttemptKind,
      messages: readonly TextTurn[],
    ): Promise<ApiMessage> => {
      const params = built.paramsFor(plan, messages);
      const startedAt = new Date();
      let message: ApiMessage;
      try {
        message = await callApi(preparedTask, params, plan, ctx);
      } catch (error) {
        trace.failedAttempt({
          model: MODEL_IDS[plan.model],
          attemptKind: kind,
          startedAt,
          error: error instanceof Error ? error.name : "error",
        });
        throw error;
      }

      // 7. One ledger row per attempt that returned (and was billed), including refusals.
      const requestedModel = MODEL_IDS[plan.model];
      const servedModel = servedModelOf(message);
      const usage = tokenUsageFromApi(message.usage);
      const cost = costOf(message, requestedModel, servedModel);
      const entry: UsageEntry = {
        runId,
        userId: ctx.userId ?? null,
        kitId: ctx.kitId ?? null,
        schoolPackId: ctx.schoolPackId ?? null,
        task,
        model: requestedModel,
        servedModel,
        effort: plan.effort,
        attemptKind: kind,
        aiMode,
        ...usage,
        costUsd: cost.total,
        latencyMs: Date.now() - startedAt.getTime(),
        promptVersion: preparedTask.promptVersion,
        traceId: trace.traceId,
        stopReason: message.stop_reason,
      };
      await config.ledger.write(entry);
      trace.attempt({
        entry,
        startedAt,
        maxTokens: plan.maxTokens,
        thinking: plan.thinking,
        costDetails: {
          input: cost.input,
          cache_read_input_tokens: cost.cacheRead,
          cache_creation_5m_input_tokens: cost.cacheWrite5m,
          cache_creation_1h_input_tokens: cost.cacheWrite1h,
          output: cost.output,
          web_search_requests: cost.webSearch,
          total: cost.total,
        },
        output: traceOutput(textOf(message)),
      });
      return message;
    };

    // 6a. Stop reason before content: refusals and truncation never reach the parser.
    const checkStop = (message: ApiMessage, plan: AttemptPlan): void => {
      switch (message.stop_reason) {
        case "end_turn":
        case "stop_sequence":
          return;
        case "refusal":
          throw new AIRefusalError(task, message.stop_details?.category ?? null);
        default:
          throw new OutputTruncatedError(task, plan.maxTokens, message.stop_reason ?? "unknown");
      }
    };

    try {
      // 5. Call with SDK retries, then the route's fallback on retryable failures only.
      let plan = built.primary;
      let message: ApiMessage;
      try {
        message = await attempt(plan, built.primaryKind, turns);
      } catch (error) {
        if (!route.fallback || !isFallbackEligible(error) || findCause(error, ReplayMissingError))
          throw error;
        plan = built.planFor(route.fallback);
        message = await attempt(plan, "fallback", turns);
      }

      // 6b. Validate (schema, then the task's own rules); one repair attempt with the issues,
      // ending on a user turn (no prefill).
      checkStop(message, plan);
      const firstText = textOf(message);
      let parsed = parseOutput(def, firstText, checkWith);
      if (!parsed.ok) {
        const repaired = await attempt(
          plan,
          "repair",
          repairTurns(turns, firstText, parsed.issues),
        );
        checkStop(repaired, plan);
        parsed = parseOutput(def, textOf(repaired), checkWith);
        if (!parsed.ok) throw new OutputValidationError(task, parsed.issues);
      }

      trace.end({ output: parsed.value });
      return parsed.value as TaskOutput<T>;
    } catch (error) {
      const mapped = error instanceof AIError ? error : toUpstreamError(task, error);
      trace.end({ error: mapped instanceof Error ? mapped.name : "error" });
      throw mapped;
    }
  }

  let embedder: EmbeddingProvider | undefined;
  const embedderOf = (): EmbeddingProvider => {
    if (embedder) return embedder;
    if (!config.embedder) throw new Error("No embedder configured: pass `embedder` to createAI()");
    embedder = typeof config.embedder === "function" ? config.embedder() : config.embedder;
    return embedder;
  };

  async function embed(texts: readonly string[], ctx: EmbedContext = {}): Promise<number[][]> {
    if (texts.length === 0) return [];
    const provider = embedderOf();
    const inputType = ctx.inputType ?? "document";
    const runId = randomUUID();
    const vectors: number[][] = [];
    for (let start = 0; start < texts.length; start += EMBED_BATCH_SIZE) {
      const slice = texts.slice(start, start + EMBED_BATCH_SIZE);
      const startedAt = Date.now();
      const result = await provider.embed(slice, inputType, ctx.signal);
      await config.ledger.write({
        runId,
        userId: ctx.userId ?? null,
        kitId: ctx.kitId ?? null,
        schoolPackId: ctx.schoolPackId ?? null,
        task: EMBED_ROUTE.task,
        model: provider.model,
        servedModel: provider.model,
        effort: null,
        attemptKind: "primary",
        // The fake embedder ran nothing real, which is what "replay" means in the ledger.
        aiMode: provider.fake ? "replay" : "live",
        inputTokens: result.tokens,
        cacheReadTokens: 0,
        cacheWrite5mTokens: 0,
        cacheWrite1hTokens: 0,
        outputTokens: 0,
        webSearches: 0,
        costUsd: computeEmbeddingCost(provider.model, result.tokens),
        latencyMs: Date.now() - startedAt,
        promptVersion: `${EMBED_ROUTE.task}:${inputType}`,
        traceId: null,
        stopReason: null,
      });
      vectors.push(...result.vectors);
    }
    return vectors;
  }

  const batch = createBatchClient({
    build: (task, input, ctx) => build(task, input, ctx),
    provider,
    ledger: config.ledger,
    aiMode,
    replayDir: () => replayDir(),
  });

  return { run, embed, batch, flush: () => tracer.flush() };
}

/**
 * The default client for apps: AI_MODE (replay unless "live"), ANTHROPIC_API_KEY, LANGFUSE_*.
 * Content logging is on outside production; in production it stays off until opt-in is wired.
 * Embeddings use Voyage when VOYAGE_API_KEY is set, else the localhost-only fake (embed.ts).
 * `overlay` lays prompt versions, route overrides and canon published from the admin console over
 * the files (apps/web builds it from packages/db).
 * `dirs` sets where prompts, canon and replay fixtures are read from (see DataDirConfig); by
 * default they are found under the repo root located from process.cwd().
 */
export function createAIFromEnv(
  ledger: LedgerSink,
  env: NodeJS.ProcessEnv = process.env,
  dirs: DataDirConfig = {},
  overlay?: RegistryOverlay,
): AI {
  const raw = env.AI_MODE?.trim() || "replay";
  if (raw !== "replay" && raw !== "live")
    throw new Error(`AI_MODE must be "replay" or "live", got "${raw}"`);
  if (raw === "live" && !env.ANTHROPIC_API_KEY)
    throw new Error("ANTHROPIC_API_KEY is required when AI_MODE=live");
  const production = env.NODE_ENV === "production";
  return createAI({
    mode: raw,
    ...(env.ANTHROPIC_API_KEY ? { apiKey: env.ANTHROPIC_API_KEY } : {}),
    ledger,
    embedder: embedderFromEnv(env),
    tracing: {
      ...(env.LANGFUSE_PUBLIC_KEY ? { publicKey: env.LANGFUSE_PUBLIC_KEY } : {}),
      ...(env.LANGFUSE_SECRET_KEY ? { secretKey: env.LANGFUSE_SECRET_KEY } : {}),
      ...(env.LANGFUSE_HOST ? { host: env.LANGFUSE_HOST } : {}),
      environment: env.NODE_ENV ?? "development",
    },
    contentLogging: !production,
    ...(overlay ? { overlay } : {}),
    ...dirs,
  });
}
