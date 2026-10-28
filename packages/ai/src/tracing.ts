import { LangfuseSpanProcessor } from "@langfuse/otel";
import {
  LangfuseOtelSpanAttributes,
  setLangfuseTracerProvider,
  startObservation,
  type LangfuseSpan,
} from "@langfuse/tracing";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import type { UsageEntry } from "./ledger";

/**
 * Langfuse tracing (spec §8.4 step 8). Uses its own TracerProvider, never registered globally:
 * Sentry owns the global OpenTelemetry provider in apps/web.
 */
export interface TracingConfig {
  publicKey?: string;
  secretKey?: string;
  /** LANGFUSE_HOST. Passed explicitly because Langfuse v6 reads LANGFUSE_BASE_URL by default. */
  host?: string;
  environment?: string;
  release?: string;
  /** Field names whose values are masked wherever they appear in logged input/output. */
  redact?: readonly string[];
  /** Replaces the Langfuse OTLP exporter (tests). */
  exporter?: SpanProcessorParams["exporter"];
}

type SpanProcessorParams = NonNullable<ConstructorParameters<typeof LangfuseSpanProcessor>[0]>;

/** Masked even when content logging is on (spec §8.4: sensitive fields redacted by default). */
export const DEFAULT_REDACTED_FIELDS = [
  "email",
  "phone",
  "address",
  "dateOfBirth",
  "sensitive",
  "sensitiveNotes",
] as const;

export interface RunTraceMeta {
  task: string;
  runId: string;
  promptVersion: string;
  aiMode: "live" | "replay";
  userId?: string;
  kitId?: string;
  schoolPackId?: string;
  logContent: boolean;
  input: unknown;
}

export interface AttemptTrace {
  entry: UsageEntry;
  startedAt: Date;
  maxTokens: number;
  thinking: string;
  costDetails: Record<string, number>;
  output?: unknown;
  error?: string;
}

export interface RunTrace {
  readonly traceId: string | null;
  attempt(attempt: AttemptTrace): void;
  failedAttempt(args: {
    model: string;
    attemptKind: UsageEntry["attemptKind"];
    startedAt: Date;
    error: string;
  }): void;
  end(result: { output?: unknown; error?: string }): void;
}

export interface Tracer {
  startRun(meta: RunTraceMeta): RunTrace;
  flush(): Promise<void>;
}

const NOOP_RUN: RunTrace = { traceId: null, attempt() {}, failedAttempt() {}, end() {} };
export const NOOP_TRACER: Tracer = { startRun: () => NOOP_RUN, flush: async () => {} };

export function redact(value: unknown, fields: ReadonlySet<string>): unknown {
  if (Array.isArray(value)) return value.map((item) => redact(item, fields));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [
        key,
        fields.has(key) ? "[redacted]" : redact(inner, fields),
      ]),
    );
  }
  return value;
}

let sharedProvider: NodeTracerProvider | null = null;

/** No-op unless both Langfuse keys are present. */
export function createTracer(config: TracingConfig | undefined): Tracer {
  if (!config?.publicKey || !config.secretKey) return NOOP_TRACER;

  // Langfuse resolves its tracer from one module-level provider, so all AI clients share it and the
  // first configuration wins.
  if (!sharedProvider) {
    sharedProvider = new NodeTracerProvider({
      spanProcessors: [
        new LangfuseSpanProcessor({
          publicKey: config.publicKey,
          secretKey: config.secretKey,
          ...(config.host ? { baseUrl: config.host } : {}),
          ...(config.environment ? { environment: config.environment } : {}),
          ...(config.release ? { release: config.release } : {}),
          ...(config.exporter ? { exporter: config.exporter } : {}),
        }),
      ],
    });
    setLangfuseTracerProvider(sharedProvider);
  }
  const provider = sharedProvider;
  const redactFields = new Set<string>([...DEFAULT_REDACTED_FIELDS, ...(config.redact ?? [])]);

  return {
    startRun(meta) {
      const content = (value: unknown) =>
        meta.logContent ? { value: redact(value, redactFields) } : null;
      const input = content(meta.input);
      const root: LangfuseSpan = startObservation(`ai.run ${meta.task}`, {
        ...(input ? { input: input.value } : {}),
        version: meta.promptVersion,
        metadata: {
          task: meta.task,
          runId: meta.runId,
          promptVersion: meta.promptVersion,
          aiMode: meta.aiMode,
        },
      });
      root.otelSpan.setAttribute(LangfuseOtelSpanAttributes.TRACE_NAME, meta.task);
      if (meta.userId)
        root.otelSpan.setAttribute(LangfuseOtelSpanAttributes.TRACE_USER_ID, meta.userId);
      const tags = [meta.aiMode, ...(meta.kitId ? ["kit"] : [])];
      root.otelSpan.setAttribute(LangfuseOtelSpanAttributes.TRACE_TAGS, tags);

      return {
        traceId: root.traceId,
        attempt(a) {
          const output = content(a.output);
          const generation = startObservation(
            `${meta.task} ${a.entry.attemptKind}`,
            {
              ...(input ? { input: input.value } : {}),
              ...(output ? { output: output.value } : {}),
              model: a.entry.servedModel,
              modelParameters: {
                effort: a.entry.effort ?? "default",
                maxTokens: a.maxTokens,
                thinking: a.thinking,
              },
              usageDetails: {
                input: a.entry.inputTokens,
                cache_read_input_tokens: a.entry.cacheReadTokens,
                cache_creation_5m_input_tokens: a.entry.cacheWrite5mTokens,
                cache_creation_1h_input_tokens: a.entry.cacheWrite1hTokens,
                output: a.entry.outputTokens,
                web_search_requests: a.entry.webSearches,
              },
              // Our own prices, so Langfuse never applies its price table.
              costDetails: a.costDetails,
              metadata: {
                promptVersion: meta.promptVersion,
                task: meta.task,
                runId: meta.runId,
                attemptKind: a.entry.attemptKind,
                aiMode: meta.aiMode,
                requestedModel: a.entry.model,
                stopReason: a.entry.stopReason,
                latencyMs: a.entry.latencyMs,
                ...(meta.kitId ? { kitId: meta.kitId } : {}),
                ...(meta.schoolPackId ? { schoolPackId: meta.schoolPackId } : {}),
              },
              ...(a.error ? { level: "ERROR" as const, statusMessage: a.error } : {}),
            },
            {
              asType: "generation",
              startTime: a.startedAt,
              parentSpanContext: root.otelSpan.spanContext(),
            },
          );
          generation.end();
        },
        failedAttempt(f) {
          startObservation(
            `${meta.task} ${f.attemptKind}`,
            {
              model: f.model,
              level: "ERROR",
              statusMessage: f.error,
              metadata: {
                task: meta.task,
                runId: meta.runId,
                attemptKind: f.attemptKind,
                aiMode: meta.aiMode,
              },
            },
            {
              asType: "generation",
              startTime: f.startedAt,
              parentSpanContext: root.otelSpan.spanContext(),
            },
          ).end();
        },
        end(result) {
          const output = content(result.output);
          root.update({
            ...(output ? { output: output.value } : {}),
            ...(result.error ? { level: "ERROR" as const, statusMessage: result.error } : {}),
          });
          root.end();
        },
      };
    },
    flush: () => provider.forceFlush(),
  };
}
