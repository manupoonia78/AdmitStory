import Anthropic, {
  APIConnectionError,
  APIError,
  APIUserAbortError,
  InternalServerError,
  RateLimitError,
} from "@anthropic-ai/sdk";
import type { BetaMessage } from "@anthropic-ai/sdk/resources/beta/messages";
import type { Message, MessageCreateParamsBase } from "@anthropic-ai/sdk/resources/messages";
import type {
  BatchCreateParams,
  MessageBatch,
  MessageBatchIndividualResponse,
} from "@anthropic-ai/sdk/resources/messages/batches";
import { ReplayMissingError, UpstreamError } from "../errors";
import {
  PROMPT_VERSION_HEADER,
  TASK_HEADER,
  createLiveFetch,
  createReplayFetch,
  type Fetch,
  type RecordOptions,
} from "../replay";

/**
 * The only place the Anthropic client is built (spec §17 `providers/`). run.ts plans attempts;
 * this module turns one planned request into one Messages API call over the replay or live
 * transport.
 */

/** Non-streaming requests above ~21,333 max_tokens are rejected by the SDK; stay below that. */
export const NON_STREAMING_MAX_TOKENS = 21_000;
export const SERVER_FALLBACK_BETA = "server-side-fallback-2026-07-01";
/**
 * Spec §8.3 "retry with backoff (3 tries)" is read as three retries after the first request, so a
 * persistently failing model sees 4 requests before the route's fallback is tried. The SDK owns
 * the retries and the backoff; replay mode has nothing to retry.
 */
export const LIVE_MAX_RETRIES = 3;
const REPLAY_API_KEY = "replay-mode-no-network";

export type ApiMessage = Message | BetaMessage;

export interface AnthropicProviderConfig {
  /** Replay answers from fixtures under `replayDir` and never reaches the network. */
  replay: boolean;
  /** Live mode only. Without it the SDK reads ANTHROPIC_API_KEY. */
  apiKey?: string;
  /** Fixture directory: read in replay mode, written when recording. Required for both. */
  replayDir?: string;
  /** Live mode: write every successful response as a fixture under `replayDir`. */
  record?: Omit<RecordOptions, "dir">;
  /** Live transport (tests, proxies). Defaults to the global fetch. */
  fetch?: Fetch;
}

export interface SendOptions {
  task: string;
  promptVersion: string;
  /** Live Opus/Sonnet: the beta path with `fallbacks: "default"`. */
  serverFallback: boolean;
  /** Use the streaming transport even below NON_STREAMING_MAX_TOKENS. */
  stream: boolean;
  signal?: AbortSignal;
}

export interface AnthropicProvider {
  send(params: MessageCreateParamsBase, options: SendOptions): Promise<ApiMessage>;
  /** Message Batches API (live only; replay mode serves batches from fixtures in batch.ts). */
  createBatch(requests: BatchCreateParams.Request[], signal?: AbortSignal): Promise<MessageBatch>;
  retrieveBatch(batchId: string, signal?: AbortSignal): Promise<MessageBatch>;
  batchResults(
    batchId: string,
    signal?: AbortSignal,
  ): Promise<AsyncIterable<MessageBatchIndividualResponse>>;
}

export function createAnthropicProvider(config: AnthropicProviderConfig): AnthropicProvider {
  const fixtureDir = (): string => {
    if (config.replayDir === undefined)
      throw new Error("replayDir is required to replay or record fixtures");
    return config.replayDir;
  };
  const transport: Fetch = config.replay
    ? createReplayFetch(fixtureDir())
    : createLiveFetch(
        config.fetch ?? globalThis.fetch.bind(globalThis),
        config.record ? { ...config.record, dir: fixtureDir() } : undefined,
      );

  const client = new Anthropic({
    ...(config.replay
      ? { apiKey: REPLAY_API_KEY }
      : config.apiKey
        ? { apiKey: config.apiKey }
        : {}),
    fetch: transport,
    maxRetries: config.replay ? 0 : LIVE_MAX_RETRIES,
    // Our Langfuse generations are the trace; SDK spans would duplicate them under Sentry's provider.
    openTelemetry: false,
  });

  const liveOnly = (): void => {
    if (config.replay) throw new Error("The Message Batches API is never called in replay mode");
  };
  const signalOption = (signal?: AbortSignal) => (signal ? { signal } : {});

  return {
    async createBatch(requests, signal) {
      liveOnly();
      return client.messages.batches.create({ requests }, signalOption(signal));
    },
    async retrieveBatch(batchId, signal) {
      liveOnly();
      return client.messages.batches.retrieve(batchId, null, signalOption(signal));
    },
    async batchResults(batchId, signal) {
      liveOnly();
      return client.messages.batches.results(batchId, undefined, signalOption(signal));
    },
    async send(params, options) {
      const requestOptions = {
        // Read (and stripped) by the replay/record transport; never sent upstream.
        headers: { [TASK_HEADER]: options.task, [PROMPT_VERSION_HEADER]: options.promptVersion },
        ...(options.signal ? { signal: options.signal } : {}),
      };
      const stream = options.stream || params.max_tokens > NON_STREAMING_MAX_TOKENS;
      if (options.serverFallback) {
        const beta = { ...params, betas: [SERVER_FALLBACK_BETA], fallbacks: "default" as const };
        return stream
          ? client.beta.messages.stream(beta, requestOptions).finalMessage()
          : client.beta.messages.create({ ...beta, stream: false }, requestOptions);
      }
      return stream
        ? client.messages.stream(params, requestOptions).finalMessage()
        : client.messages.create({ ...params, stream: false }, requestOptions);
    },
  };
}

export function findCause<T extends Error>(
  error: unknown,
  type: abstract new (...args: never[]) => T,
): T | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current instanceof Error; depth += 1) {
    if (current instanceof type) return current;
    current = current.cause;
  }
  return undefined;
}

/** Overload, rate limit and connection failures move to the route's fallback; 4xx never do. */
export function isFallbackEligible(error: unknown): boolean {
  return (
    error instanceof RateLimitError ||
    error instanceof InternalServerError ||
    error instanceof APIConnectionError
  );
}

/** Maps SDK errors to UpstreamError; a replay miss surfaces as itself. */
export function toUpstreamError(task: string, error: unknown): Error {
  const replayMiss = findCause(error, ReplayMissingError);
  if (replayMiss) return replayMiss;
  if (error instanceof APIUserAbortError)
    return new UpstreamError(task, null, false, true, { cause: error });
  if (error instanceof APIConnectionError)
    return new UpstreamError(task, null, true, false, { cause: error });
  if (error instanceof APIError) {
    const status = typeof error.status === "number" ? error.status : null;
    return new UpstreamError(task, status, isFallbackEligible(error), false, { cause: error });
  }
  return error instanceof Error ? error : new Error(String(error));
}
