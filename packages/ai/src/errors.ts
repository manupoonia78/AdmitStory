/**
 * Typed errors thrown by ai.run(). Messages never contain model output or applicant text, so they
 * are safe to log and to show (after mapping) to users.
 */
export abstract class AIError extends Error {
  abstract readonly code: string;
}

export type BudgetScope = "kit" | "user";

/** A hard cost cap was reached before any API call was made (spec §12.4). */
export class BudgetExceededError extends AIError {
  override readonly name = "BudgetExceededError";
  readonly code = "budget_exceeded";
  constructor(
    readonly scope: BudgetScope,
    readonly capUsd: number,
    readonly spentUsd: number,
  ) {
    super(
      `AI budget reached for this ${scope}: spent $${spentUsd.toFixed(2)} of $${capUsd.toFixed(2)}`,
    );
  }
}

/** The model (and any server-side fallback) declined the request. */
export class AIRefusalError extends AIError {
  override readonly name = "AIRefusalError";
  readonly code = "refusal";
  constructor(
    readonly task: string,
    readonly category: string | null,
  ) {
    super(`The model declined task ${task}${category ? ` (category: ${category})` : ""}`);
  }
}

/** The response hit max_tokens (or the context window) before the output was complete. */
export class OutputTruncatedError extends AIError {
  override readonly name = "OutputTruncatedError";
  readonly code = "output_truncated";
  constructor(
    readonly task: string,
    readonly maxTokens: number,
    readonly stopReason: string,
  ) {
    super(`Output for ${task} was cut off (${stopReason}, max_tokens ${maxTokens})`);
  }
}

export interface ValidationIssue {
  path: string;
  message: string;
}

/** The output failed its Zod schema twice (original + one repair attempt). */
export class OutputValidationError extends AIError {
  override readonly name = "OutputValidationError";
  readonly code = "output_invalid";
  constructor(
    readonly task: string,
    readonly issues: readonly ValidationIssue[],
  ) {
    super(
      `Output for ${task} failed validation: ${issues.map((i) => `${i.path || "(root)"}: ${i.message}`).join("; ")}`,
    );
  }
}

/** The caller's input failed the task's input schema; no API call was made. */
export class InputValidationError extends AIError {
  override readonly name = "InputValidationError";
  readonly code = "input_invalid";
  constructor(
    readonly task: string,
    readonly issues: readonly ValidationIssue[],
  ) {
    super(
      `Input for ${task} is invalid: ${issues.map((i) => `${i.path || "(root)"}: ${i.message}`).join("; ")}`,
    );
  }
}

/** The API failed after retries and any route fallback, or the call was aborted. */
export class UpstreamError extends AIError {
  override readonly name = "UpstreamError";
  readonly code = "upstream";
  constructor(
    readonly task: string,
    readonly status: number | null,
    readonly retryable: boolean,
    readonly aborted: boolean,
    options?: { cause?: unknown },
  ) {
    super(
      aborted
        ? `Request for ${task} was aborted`
        : `Model API error for ${task}${status === null ? " (connection)" : ` (HTTP ${status})`}`,
      options,
    );
  }
}

/** AI_MODE=replay and no fixture matches the request. */
export class ReplayMissingError extends AIError {
  override readonly name = "ReplayMissingError";
  readonly code = "replay_missing";
  constructor(
    readonly task: string,
    readonly hash: string,
    readonly path: string,
  ) {
    super(
      `No replay fixture for ${task} (request hash ${hash}). Expected ${path}. ` +
        `Record it with AI_MODE=live and record enabled (see packages/ai/README.md), or re-run the task's record script.`,
    );
  }
}

export class UnknownTaskError extends AIError {
  override readonly name = "UnknownTaskError";
  readonly code = "unknown_task";
  constructor(readonly task: string) {
    super(
      `Unknown AI task "${task}". Register it in packages/ai/src/tasks before calling ai.run().`,
    );
  }
}
