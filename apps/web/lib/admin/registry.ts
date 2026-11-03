import "server-only";

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CANON_DIR,
  ROUTABLE_MODEL_KEYS,
  RouteOverride,
  TASKS,
  parseCanonDoc,
  resolveDataDirs,
} from "@admitstory/ai";
import { AdminActionError } from "./errors";

export { withFrontMatterVersion } from "./front-matter";

// The canon editor and prompt registry's file side (spec §5.18, §9.4): the repo files are the seed
// and the fallback; the database holds the versions published from the console.

/* Canon -------------------------------------------------------------------------------------- */

export interface CanonFile {
  slug: string;
  title: string;
  version: number;
  content: string;
  ruleIds: string[];
}

export function canonFiles(): CanonFile[] {
  if (!existsSync(CANON_DIR)) return [];
  return readdirSync(CANON_DIR)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => {
      const content = readFileSync(join(CANON_DIR, name), "utf8");
      const doc = parseCanonDoc(content, name);
      return {
        slug: doc.slug,
        title: doc.title,
        version: doc.version,
        content,
        ruleIds: doc.rules.map((rule) => rule.id),
      };
    });
}

/**
 * Validates a canon document as the loader will read it and returns its rule ids (§9.4: stable ids
 * the Critic cites). Throws the parser's own message, which names the defect.
 */
export function canonRuleIds(slug: string, content: string): string[] {
  try {
    return parseCanonDoc(content, `${slug}.md`).rules.map((rule) => rule.id);
  } catch (error) {
    throw new AdminActionError(
      error instanceof Error ? error.message.slice(0, 600) : "That canon document doesn't parse.",
      422,
    );
  }
}

/* Prompts ------------------------------------------------------------------------------------ */

/** Every agent with a prompt: the ai.run task names, in a stable order. */
export function promptAgents(): string[] {
  return [...new Set(Object.values(TASKS).map((task) => task.agent))].sort();
}

export interface PromptFile {
  version: number;
  template: string;
}

/** The file versions of one agent's prompt, newest first. */
export function promptFiles(agent: string): PromptFile[] {
  if (!promptAgents().includes(agent)) return [];
  const dir = join(resolveDataDirs().promptsDir, agent);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .flatMap((name) => {
      const match = /^v([1-9]\d*)\.md$/.exec(name);
      return match
        ? [{ version: Number(match[1]), template: readFileSync(join(dir, name), "utf8") }]
        : [];
    })
    .sort((a, b) => b.version - a.version);
}

/** The front matter's `agent:` and `version:`, as the registry overlay checks them. */
export function promptHeader(template: string): { agent: string | null; version: number | null } {
  const head = /^---\n([\s\S]*?)\n---/.exec(template.replace(/\r\n?/g, "\n"))?.[1] ?? "";
  const agent = /^agent:\s*(\S+)\s*$/m.exec(head)?.[1] ?? null;
  const version = /^version:\s*(\d+)\s*$/m.exec(head)?.[1];
  return { agent, version: version ? Number(version) : null };
}

/** A route override from the console: a model key only, never a model ID (§8.3, §0). */
export function routeOverrideFor(model: string | null | undefined): Record<string, unknown> | null {
  if (!model) return null;
  if (!(ROUTABLE_MODEL_KEYS as readonly string[]).includes(model))
    throw new AdminActionError(`Choose one of ${ROUTABLE_MODEL_KEYS.join(", ")}.`, 422);
  return RouteOverride.parse({ model });
}

/** Checks a template's header against the version it is stored as. */
export function assertPromptTemplate(agent: string, version: string, template: string): void {
  const header = promptHeader(template);
  const number = Number(/^v([1-9]\d*)$/.exec(version)?.[1]);
  if (header.agent !== agent)
    throw new AdminActionError(`The template's front matter must say "agent: ${agent}".`, 422);
  if (header.version !== number)
    throw new AdminActionError(`The template's front matter must say "version: ${number}".`, 422);
}
