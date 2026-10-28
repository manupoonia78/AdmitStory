import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Where the runtime data lives: prompt templates, canon and replay fixtures.
 *
 * These are resolved from the repo root found at runtime, never with
 * `new URL(<dir>, import.meta.url)`. Bundlers (Turbopack, webpack) treat that pattern as an asset
 * import, and a directory cannot be imported, so apps/web would fail to build. Plain `node:path`
 * joins on a root found from `process.cwd()` work the same under vitest, tsx and `next start`.
 */

/** Marks the repo root in a checkout. */
export const WORKSPACE_MARKER = "pnpm-workspace.yaml";

const PROMPTS_SUBDIR = ["packages", "ai", "src", "prompts"] as const;
const CANON_SUBDIR = ["knowledge", "canon"] as const;
const REPLAY_SUBDIR = ["fixtures", "llm-replays"] as const;

/**
 * A checkout has pnpm-workspace.yaml. A traced deployment (Vercel copies only the data files listed
 * in apps/web/next.config.ts) has packages/ai/src/prompts but no workspace file.
 */
function isRepoRoot(dir: string): boolean {
  return existsSync(join(dir, WORKSPACE_MARKER)) || existsSync(join(dir, ...PROMPTS_SUBDIR));
}

/**
 * Walks up from `start` to the first directory containing pnpm-workspace.yaml (or, in a traced
 * deployment without it, packages/ai/src/prompts). Null when there is none.
 */
export function findRepoRoot(start: string = process.cwd()): string | null {
  let dir = start;
  for (;;) {
    if (isRepoRoot(dir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** Like findRepoRoot, but throws an error that says how to fix it. */
export function repoRoot(start: string = process.cwd()): string {
  const root = findRepoRoot(start);
  if (root === null) {
    throw new Error(
      `@admitstory/ai could not find the repo root (no ${WORKSPACE_MARKER} above ${start}). ` +
        "Run from inside the repo or pass rootDir (or promptsDir, canonDir and replayDir) to createAI.",
    );
  }
  return root;
}

export interface DataDirs {
  /** `<root>/packages/ai/src/prompts`: `<agent>/v<N>.md` templates. */
  promptsDir: string;
  /** `<root>/knowledge/canon`. */
  canonDir: string;
  /** `<root>/fixtures/llm-replays`: `<task>/<sha256>.json`. */
  replayDir: string;
}

export const promptsDirIn = (root: string): string => join(root, ...PROMPTS_SUBDIR);
export const canonDirIn = (root: string): string => join(root, ...CANON_SUBDIR);
export const replayDirIn = (root: string): string => join(root, ...REPLAY_SUBDIR);

export interface DataDirOptions extends Partial<DataDirs> {
  /** The repo root. Found from process.cwd() when omitted. */
  rootDir?: string;
}

/**
 * Explicit dirs win; the rest are joined onto `rootDir`, or onto the repo root found from
 * process.cwd(). The root is only looked up when some dir is not given explicitly.
 */
export function resolveDataDirs(options: DataDirOptions = {}): DataDirs {
  let root: string | undefined = options.rootDir;
  const base = (): string => (root ??= repoRoot());
  return {
    promptsDir: options.promptsDir ?? promptsDirIn(base()),
    canonDir: options.canonDir ?? canonDirIn(base()),
    replayDir: options.replayDir ?? replayDirIn(base()),
  };
}

/** The default prompts dir, resolved now (throws if the repo root cannot be found). */
export const defaultPromptsDir = (): string => promptsDirIn(repoRoot());
export const defaultCanonDir = (): string => canonDirIn(repoRoot());
export const defaultReplayDir = (): string => replayDirIn(repoRoot());

/**
 * Import-time value for the legacy `PROMPTS_DIR`/`CANON_DIR`/`REPLAY_DIR` constants. Never throws,
 * so importing the package cannot fail; falls back to process.cwd() when no root is found.
 */
export function rootAtImport(): string {
  return findRepoRoot() ?? process.cwd();
}
