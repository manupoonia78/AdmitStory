import type { z } from "zod";
import { UnknownTaskError } from "../errors";
import type { TaskDefinition } from "./define";
import { utilTitle } from "./util-title";

/**
 * Registered tasks. A task becomes callable through ai.run() only once it is listed here, has a
 * route in routing.ts, a priced model and a prompt file (spec §17 conventions). Phase 0 ships
 * util.title only.
 */
export const TASKS = {
  "util.title": utilTitle,
} as const;

export type TaskName = keyof typeof TASKS;
export type TaskInput<T extends TaskName> = z.input<(typeof TASKS)[T]["input"]>;
export type TaskOutput<T extends TaskName> = z.output<(typeof TASKS)[T]["output"]>;

export type AnyTaskDefinition = TaskDefinition<z.ZodType, z.ZodType>;

export function getTask(task: string): AnyTaskDefinition {
  if (!Object.hasOwn(TASKS, task)) throw new UnknownTaskError(task);
  return TASKS[task as TaskName] as unknown as AnyTaskDefinition;
}

export { defineTask, type TaskDefinition } from "./define";
export { UtilTitleInput, UtilTitleOutput, UTIL_TITLE_MAX_WORDS } from "../schemas";
