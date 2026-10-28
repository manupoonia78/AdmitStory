import type { z } from "zod";
import type { TextTurn } from "../request";
import type { RouteTask } from "../routing";

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
}

export function defineTask<I extends z.ZodType, O extends z.ZodType>(
  def: TaskDefinition<I, O>,
): TaskDefinition<I, O> {
  return def;
}
