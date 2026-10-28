import { randomUUID } from "node:crypto";
import type { MessageCreateParamsBase, TextBlockParam } from "@anthropic-ai/sdk/resources/messages";
import type { z } from "zod";
import { checkBudget, type BudgetCaps } from "./budget";
import { loadCanon, type CanonLibrary } from "./canon";
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
import { computeCostBreakdown, hasPrice, type CostBreakdown } from "./pricing";
import {
  createFilePromptSource,
  loadPrompt,
  promptVersionLabel,
  renderPrompt,
  type PromptSource,
  type PromptTemplate,
} from "./prompts/registry";
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
import { createTracer, type RunTrace, type TracingConfig } from "./tracing";

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
  signal?: AbortSignal;
  /** Use the streaming transport. The result is still the validated final output. */
  stream?: boolean;
  /** Pass the user's improve_product_opt_in; false always suppresses content logging. */
  contentLoggingAllowed?: boolean;
}

export interface AI {
  run<T extends TaskName>(task: T, input: TaskInput<T>, ctx?: RunContext): Promise<TaskOutput<T>>;
  /** Flush pending traces (call before a serverless function returns). */
  flush(): Promise<void>;
}

type AttemptKind = UsageEntry["attemptKind"];

interface AttemptPlan extends ModelChoice {
  maxTokens: number;
  serverFallback: boolean;
}

interface PreparedTask {
  def: AnyTaskDefinition;
  template: PromptTemplate;
  promptVersion: string;
  system: TextBlockParam[];
  outputSchema: Record<string, unknown>;
}

function zodIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message,
  }));
}

/** The model that actually produced the response; server-side fallback may differ from the request. */
export function servedModelOf(message: ApiMessage): string {
  const iterations = "iterations" in message.usage ? message.usage.iterations : null;
  const served = iterations?.find((it) => it.type === "fallback_message");
  return served && "model" in served && served.model ? served.model : message.model;
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

function textOf(message: ApiMessage): string {
  return message.content
    .filter((block): block is Extract<typeof block, { type: "text" }> => block.type === "text")
    .map((block) => block.text)
    .join("");
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

function parseOutput(
  def: AnyTaskDefinition,
  text: string,
): { ok: true; value: unknown } | { ok: false; issues: ValidationIssue[] } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, issues: [{ path: "", message: "Reply was not valid JSON" }] };
  }
  const result = def.output.safeParse(json);
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, issues: zodIssues(result.error) };
}

export function createAI(config: AIConfig): AI {
  const replay = config.mode === "replay";
  // Data dirs: explicit config, else `rootDir`, else the repo root found from process.cwd(). The
  // root is only looked up for a dir this client actually needs.
  let root: string | undefined = config.rootDir;
  const rootDir = (): string => (root ??= repoRoot());
  const needsReplayDir = replay || config.record === true;

  const provider = createAnthropicProvider({
    replay,
    ...(config.apiKey ? { apiKey: config.apiKey } : {}),
    ...(needsReplayDir ? { replayDir: config.replayDir ?? replayDirIn(rootDir()) } : {}),
    ...(config.record ? { record: { ...config.recordOptions } } : {}),
    ...(config.fetch ? { fetch: config.fetch } : {}),
  });

  const prompts =
    config.prompts ?? createFilePromptSource(config.promptsDir ?? promptsDirIn(rootDir()));
  const tracer = createTracer(config.tracing);
  const aiMode: AIMode = config.mode;
  let canon: CanonLibrary | undefined = config.canon;
  const prepared = new Map<string, PreparedTask>();

  async function prepare(def: AnyTaskDefinition, version?: number): Promise<PreparedTask> {
    const template = await loadPrompt(prompts, def.agent, version);
    const key = `${def.name}:${promptVersionLabel(template)}`;
    const cached = prepared.get(key);
    if (cached) return cached;
    if (template.output !== def.outputName) {
      throw new Error(
        `Prompt ${promptVersionLabel(template)} declares output ${template.output}, task expects ${def.outputName}`,
      );
    }
    const needsCanon = template.canonFiles.length > 0 || template.canonRules.length > 0;
    if (needsCanon) canon ??= loadCanon(config.canonDir ?? canonDirIn(rootDir()));
    const task: PreparedTask = {
      def,
      template,
      promptVersion: promptVersionLabel(template),
      system: buildSystem({
        agentPrompt: renderPrompt(template),
        canon: needsCanon && canon ? canonSubset(canon, template) : "",
      }),
      outputSchema: outputJsonSchema(def.output),
    };
    prepared.set(key, task);
    return task;
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
    // 1. Route, prompt version and schemas.
    const def = getTask(task);
    const overrides = config.routeOverrides ? await config.routeOverrides() : {};
    const route: ResolvedRoute = resolveRoute(def.name, overrides[def.name]);
    const prepared = await prepare(def, route.promptVersion);

    // 2. Budget: downgrade or refuse before spending anything.
    const decision = await checkBudget({
      ledger: config.ledger,
      userId: ctx.userId ?? null,
      kitId: ctx.kitId ?? null,
      route,
      ...(config.budgetCaps ? { caps: config.budgetCaps } : {}),
    });

    // 3. Request: validated input, cached system layers, then the task's turns.
    const parsedInput = def.input.safeParse(input);
    if (!parsedInput.success) throw new InputValidationError(task, zodIssues(parsedInput.error));
    const turns = def.buildMessages(parsedInput.data);

    const planFor = (choice: ModelChoice, maxTokens?: number): AttemptPlan => ({
      ...choice,
      maxTokens: maxTokens ?? maxTokensForChoice(route, choice),
      serverFallback: choice.model !== "haiku" && !route.batch,
    });
    const primary: AttemptPlan =
      decision === "downgrade" && route.downgrade
        ? planFor(route.downgrade)
        : {
            model: route.model,
            effort: route.effort,
            thinking: route.thinking,
            maxTokens: route.maxTokens,
            serverFallback: route.serverFallback,
          };

    const runId = randomUUID();
    const trace: RunTrace = tracer.startRun({
      task,
      runId,
      promptVersion: prepared.promptVersion,
      aiMode,
      ...(ctx.userId ? { userId: ctx.userId } : {}),
      ...(ctx.kitId ? { kitId: ctx.kitId } : {}),
      ...(ctx.schoolPackId ? { schoolPackId: ctx.schoolPackId } : {}),
      logContent: config.contentLogging === true && ctx.contentLoggingAllowed !== false,
      input: parsedInput.data,
    });

    const attempt = async (
      plan: AttemptPlan,
      kind: AttemptKind,
      messages: readonly TextTurn[],
    ): Promise<ApiMessage> => {
      const params = buildParams({
        choice: plan,
        maxTokens: plan.maxTokens,
        system: prepared.system,
        messages,
        outputSchema: prepared.outputSchema,
        tools: route.tools,
      });
      const startedAt = new Date();
      let message: ApiMessage;
      try {
        message = await callApi(prepared, params, plan, ctx);
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
        promptVersion: prepared.promptVersion,
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
      let plan = primary;
      let message: ApiMessage;
      try {
        message = await attempt(plan, "primary", turns);
      } catch (error) {
        if (!route.fallback || !isFallbackEligible(error) || findCause(error, ReplayMissingError))
          throw error;
        plan = planFor(route.fallback);
        message = await attempt(plan, "fallback", turns);
      }

      // 6b. Validate; one repair attempt with the Zod issues, ending on a user turn (no prefill).
      checkStop(message, plan);
      const firstText = textOf(message);
      let parsed = parseOutput(def, firstText);
      if (!parsed.ok) {
        const repaired = await attempt(
          plan,
          "repair",
          repairTurns(turns, firstText, parsed.issues),
        );
        checkStop(repaired, plan);
        parsed = parseOutput(def, textOf(repaired));
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

  return { run, flush: () => tracer.flush() };
}

/**
 * The default client for apps: AI_MODE (replay unless "live"), ANTHROPIC_API_KEY, LANGFUSE_*.
 * Content logging is on outside production; in production it stays off until opt-in is wired.
 * `dirs` sets where prompts, canon and replay fixtures are read from (see DataDirConfig); by
 * default they are found under the repo root located from process.cwd().
 */
export function createAIFromEnv(
  ledger: LedgerSink,
  env: NodeJS.ProcessEnv = process.env,
  dirs: DataDirConfig = {},
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
    tracing: {
      ...(env.LANGFUSE_PUBLIC_KEY ? { publicKey: env.LANGFUSE_PUBLIC_KEY } : {}),
      ...(env.LANGFUSE_SECRET_KEY ? { secretKey: env.LANGFUSE_SECRET_KEY } : {}),
      ...(env.LANGFUSE_HOST ? { host: env.LANGFUSE_HOST } : {}),
      environment: env.NODE_ENV ?? "development",
    },
    contentLogging: !production,
    ...dirs,
  });
}
