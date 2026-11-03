import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createMemoryLedger } from "../src/ledger";
import {
  WORKSPACE_MARKER,
  findRepoRoot,
  repoRoot,
  resolveDataDirs,
  canonDirIn,
  promptsDirIn,
  replayDirIn,
} from "../src/paths";
import { REPLAY_DIR } from "../src/replay";
import { createAI, createAIFromEnv } from "../src/run";
import { UTIL_TITLE_SAMPLE } from "../scripts/util-title-sample";

// Tests may use import.meta.url: they are never bundled by apps/web.
const PACKAGE_DIR = fileURLToPath(new URL("..", import.meta.url));
const REPO = join(PACKAGE_DIR, "..", "..");

/** A directory outside the repo that holds only the traced data, like a Vercel function bundle. */
function tracedRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "traced-root-"));
  cpSync(promptsDirIn(REPO), promptsDirIn(root), { recursive: true });
  cpSync(canonDirIn(REPO), canonDirIn(root), { recursive: true });
  cpSync(replayDirIn(REPO), replayDirIn(root), { recursive: true });
  return root;
}

describe("repo root", () => {
  it("walks up to pnpm-workspace.yaml from any directory inside the repo", () => {
    expect(findRepoRoot(join(PACKAGE_DIR, "src", "prompts"))).toBe(REPO);
    expect(findRepoRoot(join(REPO, "apps", "web"))).toBe(REPO);
    expect(statSync(join(REPO, WORKSPACE_MARKER)).isFile()).toBe(true);
  });

  it("recognises a traced deployment that has the prompts but no workspace file", () => {
    const root = tracedRoot();
    const cwd = join(root, "apps", "web");
    mkdirSync(cwd, { recursive: true });
    expect(findRepoRoot(cwd)).toBe(root);
  });

  it("returns null outside the repo, and repoRoot says how to fix it", () => {
    const outside = mkdtempSync(join(tmpdir(), "no-repo-"));
    expect(findRepoRoot(outside)).toBeNull();
    expect(() => repoRoot(outside)).toThrow(/pass rootDir/);
  });
});

describe("data dirs", () => {
  it("prefers explicit dirs, then rootDir, then the root found from process.cwd()", () => {
    expect(resolveDataDirs({ rootDir: "/r", replayDir: "/x" })).toEqual({
      promptsDir: join("/r", "packages", "ai", "src", "prompts"),
      canonDir: join("/r", "knowledge", "canon"),
      replayDir: "/x",
    });
    // Fully explicit: the root is never looked up.
    expect(resolveDataDirs({ promptsDir: "/p", canonDir: "/c", replayDir: "/x" })).toEqual({
      promptsDir: "/p",
      canonDir: "/c",
      replayDir: "/x",
    });
    expect(resolveDataDirs().replayDir).toBe(REPLAY_DIR);
    expect(REPLAY_DIR).toBe(join(REPO, "fixtures", "llm-replays"));
  });

  it("createAIFromEnv serves util.title from an explicit rootDir outside the repo", async () => {
    const ledger = createMemoryLedger();
    const ai = createAIFromEnv(ledger, { NODE_ENV: "test" }, { rootDir: tracedRoot() });
    await expect(ai.run("util.title", { text: UTIL_TITLE_SAMPLE })).resolves.toHaveProperty(
      "title",
    );
    expect(ledger.entries).toHaveLength(1);
  });

  it("createAI uses explicit dirs over rootDir", async () => {
    const root = tracedRoot();
    const ai = createAI({
      mode: "replay",
      ledger: createMemoryLedger(),
      rootDir: mkdtempSync(join(tmpdir(), "wrong-root-")),
      promptsDir: promptsDirIn(root),
      canonDir: canonDirIn(root),
      replayDir: replayDirIn(root),
    });
    await expect(ai.run("util.title", { text: UTIL_TITLE_SAMPLE })).resolves.toHaveProperty(
      "title",
    );
  });
});

describe("bundle safety", () => {
  // Turbopack and webpack treat `new URL(<path>, import.meta.url)` as an asset import, and a
  // directory cannot be imported, so apps/web fails to build. Runtime code must not use it.
  it("no runtime source file resolves a path from import.meta.url", () => {
    const srcDir = join(PACKAGE_DIR, "src");
    const files = (readdirSync(srcDir, { recursive: true }) as string[])
      .map((name) => join(srcDir, name))
      .filter((path) => /\.ts$/.test(path) && !/\.test\.ts$/.test(path));
    expect(files.length).toBeGreaterThan(10);
    const code = (path: string) =>
      readFileSync(path, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
    const offenders = files.filter((path) => /import\.meta/.test(code(path)));
    expect(offenders.map((path) => relative(dirname(srcDir), path))).toEqual([]);
  });
});
