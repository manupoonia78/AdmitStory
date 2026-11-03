import "server-only";

import { z } from "zod";
import { notFound } from "@/lib/api";

// Shared by the Workspace routes: route ids are uuids or the resource doesn't exist.

export async function idParam<K extends string>(
  context: { params: Promise<Record<K, string>> },
  key: K,
  what: string,
): Promise<string> {
  const parsed = z.guid().safeParse((await context.params)[key]);
  if (!parsed.success) notFound(what);
  return parsed.data;
}

/** Spec §12.4: refinements are rate-limited to 10 a minute. */
export const REFINE_LIMIT = { limit: 10, windowMs: 60_000 };
export const WORKSPACE_WRITE_LIMIT = { limit: 120, windowMs: 60_000 };
