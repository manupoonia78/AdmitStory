import type { z } from "zod";
import type { ValidationIssue } from "../errors";
import type { TextTurn } from "../request";
import type { RouteTask } from "../routing";

/** The per-request cached layers a task can read (spec §8.2 L1 and L2). */
export interface TaskLayers {
  schoolPack?: string;
  dossier?: string;
}

/**
 * One ai.run() task: its schemas and how its input becomes messages. The system prompt comes from
 * the prompt registry; buildMessages produces only the turns after the cached prefix.
 */
export interface TaskDefinition<I extends z.ZodType, O extends z.ZodType> {
  name: RouteTask;
  /** Prompt registry agent directory (several tasks may share an agent). */
  agent: string;
  input: I;
  output: O;
  /** Must equal the `output` field in the prompt header, so prompt and schema stay paired. */
  outputName: string;
  buildMessages(input: z.output<I>): TextTurn[];
  /**
   * Layers the task cannot run without. A missing one is an InputValidationError before any call:
   * the Strategist without the dossier would plan from nothing.
   */
  requires?: readonly (keyof TaskLayers)[];
  /**
   * Rules a JSON Schema cannot express, checked after the Zod parse (cited codes exist, a story
   * is primary once). Issues get the same single repair attempt as a schema failure.
   */
  check?(output: z.output<O>, input: z.output<I>, layers: TaskLayers): ValidationIssue[];
  /** For a route with web search: the domains it may search (§8.3, the school's official sites). */
  allowedDomains?(input: z.output<I>): readonly string[];
}

export function defineTask<I extends z.ZodType, O extends z.ZodType>(
  def: TaskDefinition<I, O>,
): TaskDefinition<I, O> {
  return def;
}
