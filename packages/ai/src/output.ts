import type { z } from "zod";
import type { ValidationIssue } from "./errors";
import type { ApiMessage } from "./providers/anthropic";
import type { AnyTaskDefinition } from "./tasks";
import type { TaskLayers } from "./tasks/define";

// Reading a model reply, shared by ai.run() (run.ts) and the batch collector (batch.ts).

export function zodIssues(error: z.ZodError): ValidationIssue[] {
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

/**
 * The answer text: the text blocks after the last tool or fallback block. A web-search turn
 * interleaves text with search blocks, and a server-side fallback can leave the declining model's
 * partial text before its `fallback` block; neither is part of the final JSON.
 */
export function textOf(message: ApiMessage): string {
  const blocks = message.content as readonly { type: string; text?: string }[];
  let start = 0;
  blocks.forEach((block, index) => {
    if (block.type !== "text" && block.type !== "thinking" && block.type !== "redacted_thinking")
      start = index + 1;
  });
  return blocks
    .slice(start)
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("");
}

/**
 * Parses and validates a reply: JSON, then the Zod schema, then the task's post-parse rules
 * (`check`) when the input is known. Shared by ai.run() and the batch collector.
 */
export function parseOutput(
  def: AnyTaskDefinition,
  text: string,
  checkWith?: { input: unknown; layers: TaskLayers },
): { ok: true; value: unknown } | { ok: false; issues: ValidationIssue[] } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, issues: [{ path: "", message: "Reply was not valid JSON" }] };
  }
  const result = def.output.safeParse(json);
  if (!result.success) return { ok: false, issues: zodIssues(result.error) };
  if (def.check && checkWith) {
    const issues = def.check(result.data, checkWith.input, checkWith.layers);
    if (issues.length > 0) return { ok: false, issues };
  }
  return { ok: true, value: result.data };
}

/** The L1/L2 layers a call carries, without empty strings. */
export function layersOf(ctx: { schoolPack?: string; dossier?: string }): TaskLayers {
  return {
    ...(ctx.schoolPack?.trim() ? { schoolPack: ctx.schoolPack } : {}),
    ...(ctx.dossier?.trim() ? { dossier: ctx.dossier } : {}),
  };
}
