import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import type { MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/messages";
import type { MessageBatchIndividualResponse } from "@anthropic-ai/sdk/resources/messages/batches";
import { ReplayMissingError, type ValidationIssue } from "./errors";
import { tokenUsageFromApi, type LedgerSink } from "./ledger";
import { computeCostBreakdown, hasPrice } from "./pricing";
import type { AnthropicProvider, ApiMessage } from "./providers/anthropic";
import { fixturePath, readFixture, requestHash } from "./replay";
import { MODEL_IDS, type RouteTask } from "./routing";
import type { AIMode, BuiltRequest, RunContext } from "./run";
import { layersOf, parseOutput, servedModelOf, textOf } from "./output";
import { getTask, type TaskInput, type TaskName, type TaskOutput } from "./tasks";

/**
 * The Message Batches API for routes marked `batch: true` (spec §8.3, §12.1 "batch what isn't
 * urgent": knowledge ingestion, refresh checks and evals, at half the token price).
 *
 *   const submission = await ai.batch.submit("kb.normalize", inputs, ctx);   // store it
 *   const result = await ai.batch.collect(submission, { inputs, ctx });      // poll until ended
 *
 * Each request is built exactly as ai.run() builds it (route, prompt version, cached layers,
 * schema), minus the live-only server-side fallback the Batch API rejects. Results are checked
 * like ai.run() output (stop reason, JSON, Zod, and the task's own rules when the inputs are
 * passed back), but there is no repair attempt: an item that fails comes back as an error for the
 * caller to retry through ai.run().
 *
 * Ledger: one usage_ledger row per billed result, written by collect() when the batch has ended,
 * priced with the batch discount. Call collect() once per ended batch (an Inngest step memoises
 * it); a second call writes the rows again.
 *
 * Replay (AI_MODE=replay): a batch item is served from the same fixture as the equivalent ai.run()
 * call, because the fixture key is the hash of the Messages request body and a batch item's params
 * are that body without `stream: false`. Submitting checks every fixture exists (a miss throws
 * ReplayMissingError, as ai.run() would), and the replayed batch has ended at once. Live batch
 * results are not recorded; record fixtures with ai.run() (same key).
 */

export interface BatchItemRef {
  /** `item-<index>`: the Batch API's custom_id, matched to results (which arrive in any order). */
  customId: string;
  /** The replay fixture key: requestHash of the params with `stream: false`. */
  requestHash: string;
}

/** What submit() returns. Plain JSON: persist it (an Inngest step result) and pass it to collect(). */
export interface BatchSubmission<T extends TaskName = TaskName> {
  batchId: string;
  task: T;
  promptVersion: string;
  model: string;
  effort: string;
  aiMode: AIMode;
  /** ISO time; collect() measures latency from it. */
  submittedAt: string;
  userId: string | null;
  kitId: string | null;
  schoolPackId: string | null;
  /** One per input, in input order. */
  items: BatchItemRef[];
}

export type BatchItemErrorKind =
  "invalid_output" | "refusal" | "truncated" | "errored" | "expired" | "canceled" | "missing";

export type BatchItemResult<T extends TaskName> =
  | { index: number; customId: string; ok: true; output: TaskOutput<T> }
  | {
      index: number;
      customId: string;
      ok: false;
      error: { kind: BatchItemErrorKind; message: string; issues?: ValidationIssue[] };
    };

export type BatchCollectResult<T extends TaskName> =
  | { status: "in_progress"; counts: { processing: number; done: number } }
  | { status: "ended"; results: BatchItemResult<T>[] };

export interface BatchCollectOptions<T extends TaskName> {
  /** The inputs as submitted, in order: enables the task's post-parse rules (`check`). */
  inputs?: readonly TaskInput<T>[];
  /** The layers the batch was submitted with, for rules that read them. */
  ctx?: Pick<RunContext, "schoolPack" | "dossier">;
  signal?: AbortSignal;
}

export interface AIBatch {
  /**
   * Submits one request per input for a `batch: true` route. Budget and inputs are checked first;
   * nothing is sent if any input is invalid.
   */
  submit<T extends TaskName>(
    task: T,
    inputs: readonly TaskInput<T>[],
    ctx?: Omit<RunContext, "stream">,
  ): Promise<BatchSubmission<T>>;
  /** The batch's state; once ended, every item's validated output or error, in input order. */
  collect<T extends TaskName>(
    submission: BatchSubmission<T>,
    options?: BatchCollectOptions<T>,
  ): Promise<BatchCollectResult<T>>;
}

export interface BatchDeps {
  build(task: string, input: unknown, ctx: RunContext): Promise<BuiltRequest>;
  provider: AnthropicProvider;
  ledger: LedgerSink;
  aiMode: AIMode;
  replayDir(): string;
}

const REPLAY_BATCH_PREFIX = "replaybatch_";

export const customIdFor = (index: number): string => `item-${index}`;

/** The fixture key for a batch item: the body ai.run() sends for the same request. */
export function batchRequestHash(params: MessageCreateParamsNonStreaming): string {
  return requestHash({ ...params, stream: false });
}

export function createBatchClient(deps: BatchDeps): AIBatch {
  const replay = deps.aiMode === "replay";

  async function submit<T extends TaskName>(
    task: T,
    inputs: readonly TaskInput<T>[],
    ctx: Omit<RunContext, "stream"> = {},
  ): Promise<BatchSubmission<T>> {
    if (inputs.length === 0) throw new Error("A batch needs at least one input");
    const built: BuiltRequest[] = [];
    for (const input of inputs) built.push(await deps.build(task, input, ctx));
    const [first] = built;
    if (!first) throw new Error("A batch needs at least one input");
    if (!first.route.batch)
      throw new Error(`${task} is not a batch route; call ai.run() instead (routing.ts)`);

    const requests = built.map((request, index) => {
      // The Batch API rejects the server-side fallback; batch routes never plan it (routing.ts).
      const params = request.paramsFor(
        { ...request.primary, serverFallback: false },
        request.turns,
      );
      return { custom_id: customIdFor(index), params: params as MessageCreateParamsNonStreaming };
    });
    const items = requests.map((request) => ({
      customId: request.custom_id,
      requestHash: batchRequestHash(request.params),
    }));

    let batchId: string;
    if (replay) {
      for (const item of items) {
        const path = fixturePath(deps.replayDir(), task, item.requestHash);
        if (!existsSync(path)) throw new ReplayMissingError(task, item.requestHash, path);
      }
      batchId = `${REPLAY_BATCH_PREFIX}${createHash("sha256")
        .update(items.map((item) => item.requestHash).join(","))
        .digest("hex")
        .slice(0, 24)}`;
    } else {
      batchId = (await deps.provider.createBatch(requests, ctx.signal)).id;
    }

    return {
      batchId,
      task,
      promptVersion: first.prepared.promptVersion,
      model: MODEL_IDS[first.primary.model],
      effort: first.primary.effort,
      aiMode: deps.aiMode,
      submittedAt: new Date().toISOString(),
      userId: ctx.userId ?? null,
      kitId: ctx.kitId ?? null,
      schoolPackId: ctx.schoolPackId ?? null,
      items,
    };
  }

  /** Every result of an ended batch, by custom_id. */
  async function resultsOf(
    submission: BatchSubmission,
    signal?: AbortSignal,
  ): Promise<
    | { ended: false; processing: number; done: number }
    | { ended: true; byId: Map<string, MessageBatchIndividualResponse["result"]> }
  > {
    const byId = new Map<string, MessageBatchIndividualResponse["result"]>();
    if (submission.batchId.startsWith(REPLAY_BATCH_PREFIX)) {
      for (const item of submission.items) {
        const path = fixturePath(deps.replayDir(), submission.task, item.requestHash);
        if (!existsSync(path)) continue;
        const message = JSON.parse(readFixture(path).response.body) as ApiMessage;
        byId.set(item.customId, {
          type: "succeeded",
          message,
        } as MessageBatchIndividualResponse["result"]);
      }
      return { ended: true, byId };
    }
    const batch = await deps.provider.retrieveBatch(submission.batchId, signal);
    if (batch.processing_status !== "ended") {
      const counts = batch.request_counts;
      return {
        ended: false,
        processing: counts.processing,
        done: counts.succeeded + counts.errored + counts.canceled + counts.expired,
      };
    }
    for await (const entry of await deps.provider.batchResults(submission.batchId, signal))
      byId.set(entry.custom_id, entry.result);
    return { ended: true, byId };
  }

  async function collect<T extends TaskName>(
    submission: BatchSubmission<T>,
    options: BatchCollectOptions<T> = {},
  ): Promise<BatchCollectResult<T>> {
    const def = getTask(submission.task);
    if (options.inputs && options.inputs.length !== submission.items.length)
      throw new Error("collect() needs the inputs exactly as submitted");
    const state = await resultsOf(submission, options.signal);
    if (!state.ended)
      return { status: "in_progress", counts: { processing: state.processing, done: state.done } };

    const layers = layersOf(options.ctx ?? {});
    const latencyMs = Math.max(0, Date.now() - Date.parse(submission.submittedAt));
    const results: BatchItemResult<T>[] = [];

    for (const [index, item] of submission.items.entries()) {
      const fail = (kind: BatchItemErrorKind, message: string, issues?: ValidationIssue[]) =>
        results.push({
          index,
          customId: item.customId,
          ok: false,
          error: { kind, message, ...(issues ? { issues } : {}) },
        });
      const result = state.byId.get(item.customId);
      if (!result) {
        fail("missing", "No result for this item");
        continue;
      }
      if (result.type !== "succeeded") {
        fail(result.type, `The batch request ${result.type}`);
        continue;
      }

      const message = result.message as ApiMessage;
      await deps.ledger.write(ledgerEntry(submission, item, message, latencyMs));

      if (message.stop_reason === "refusal") {
        fail("refusal", "The model declined this item");
        continue;
      }
      if (message.stop_reason !== "end_turn" && message.stop_reason !== "stop_sequence") {
        fail("truncated", `Output stopped early (${message.stop_reason ?? "unknown"})`);
        continue;
      }
      let checkWith: Parameters<typeof parseOutput>[2];
      const input = options.inputs?.[index];
      if (input !== undefined) {
        const parsedInput = def.input.safeParse(input);
        if (parsedInput.success) checkWith = { input: parsedInput.data, layers };
      }
      const parsed = parseOutput(def, textOf(message), checkWith);
      if (parsed.ok)
        results.push({
          index,
          customId: item.customId,
          ok: true,
          output: parsed.value as TaskOutput<T>,
        });
      else fail("invalid_output", "Output failed validation", parsed.issues);
    }
    return { status: "ended", results };
  }

  function ledgerEntry(
    submission: BatchSubmission,
    item: BatchItemRef,
    message: ApiMessage,
    latencyMs: number,
  ) {
    const usage = tokenUsageFromApi(message.usage);
    const served = servedModelOf(message);
    const priceModel = hasPrice(served) ? served : submission.model;
    return {
      // One run per batch item, so a re-submitted item is a new run.
      runId: deterministicUuid(`${submission.batchId}:${item.customId}`),
      userId: submission.userId,
      kitId: submission.kitId,
      schoolPackId: submission.schoolPackId,
      task: submission.task as RouteTask,
      model: submission.model,
      servedModel: served,
      effort: submission.effort,
      attemptKind: "primary" as const,
      aiMode: submission.aiMode,
      ...usage,
      costUsd: computeCostBreakdown({ modelId: priceModel, usage, batch: true }).total,
      latencyMs,
      promptVersion: submission.promptVersion,
      traceId: null,
      stopReason: message.stop_reason,
    };
  }

  return { submit, collect };
}

/** A UUID-shaped id derived from a string, so a batch item's ledger rows share one run id. */
function deterministicUuid(seed: string): string {
  const hex = createHash("sha256").update(seed).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
