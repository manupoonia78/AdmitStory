import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { APP_NAME } from "@admitstory/shared";
import { z } from "zod";
import { defaultPromptsDir, promptsDirIn, rootAtImport } from "../paths";
import { parseFrontMatter } from "./front-matter";

/**
 * `<repo>/packages/ai/src/prompts`, from the repo root found at import time (see paths.ts). Prefer
 * passing a dir; createFilePromptSource() with no argument resolves the root when called.
 */
export const PROMPTS_DIR: string = promptsDirIn(rootAtImport());

const RULE_ID = /^[A-Z]+-\d+$/;

const Header = z
  .object({
    agent: z.string().regex(/^[a-z]+(\.[a-z_]+)+$/),
    version: z.string().regex(/^[1-9]\d*$/),
    canon: z.array(z.string().min(1)).default([]),
    output: z.string().min(1),
    notes: z.string().default(""),
  })
  .strict();

export interface PromptTemplate {
  agent: string;
  version: number;
  /** Canon file slugs to include in full. */
  canonFiles: string[];
  /** Individual canon rule IDs to include (as written; the canon loader normalises them). */
  canonRules: string[];
  /** Name of the task's output schema; checked against the task registry. */
  output: string;
  notes: string;
  /** The template text with {{placeholders}} unrendered. */
  body: string;
}

/**
 * Where prompt templates come from. Files today; Phase 3 adds a DB overlay that publishes new
 * versions from the admin console without a deploy.
 */
export interface PromptSource {
  versions(agent: string): Promise<readonly PromptTemplate[]>;
}

export function parsePromptFile(source: string, fileLabel: string): PromptTemplate {
  const { meta, body } = parseFrontMatter(source, fileLabel);
  const parsed = Header.safeParse(meta);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(header)"}: ${i.message}`)
      .join("; ");
    throw new Error(`${fileLabel}: invalid prompt header: ${detail}`);
  }
  const header = parsed.data;
  if (body === "") throw new Error(`${fileLabel}: prompt body is empty`);
  return {
    agent: header.agent,
    version: Number(header.version),
    canonFiles: header.canon.filter((ref) => !RULE_ID.test(ref)),
    canonRules: header.canon.filter((ref) => RULE_ID.test(ref)),
    output: header.output,
    notes: header.notes,
    body,
  };
}

/**
 * Reads `<dir>/<agent>/v<N>.md`. File name, header agent and header version must agree. The
 * default dir is resolved from the repo root found from process.cwd() (throws if there is none).
 */
export function createFilePromptSource(dir: string = defaultPromptsDir()): PromptSource {
  const cache = new Map<string, readonly PromptTemplate[]>();
  return {
    async versions(agent) {
      const cached = cache.get(agent);
      if (cached) return cached;
      let files: string[];
      try {
        files = readdirSync(join(dir, agent)).filter((name) => /^v[1-9]\d*\.md$/.test(name));
      } catch {
        files = [];
      }
      const templates = files.map((name) => {
        const label = `prompts/${agent}/${name}`;
        const template = parsePromptFile(readFileSync(join(dir, agent, name), "utf8"), label);
        if (template.agent !== agent)
          throw new Error(`${label}: header agent "${template.agent}" must be "${agent}"`);
        if (`v${template.version}.md` !== name)
          throw new Error(`${label}: header version must match the file name`);
        return template;
      });
      const sorted = Object.freeze(templates.sort((a, b) => a.version - b.version));
      cache.set(agent, sorted);
      return sorted;
    },
  };
}

/** The highest version of an agent's prompt, or the exact version requested. */
export async function loadPrompt(
  source: PromptSource,
  agent: string,
  version?: number,
): Promise<PromptTemplate> {
  const all = await source.versions(agent);
  if (all.length === 0) throw new Error(`No prompt found for agent "${agent}"`);
  if (version === undefined) return all[all.length - 1] as PromptTemplate;
  const match = all.find((t) => t.version === version);
  if (!match) throw new Error(`Prompt ${agent}@v${version} does not exist`);
  return match;
}

export function promptVersionLabel(template: Pick<PromptTemplate, "agent" | "version">): string {
  return `${template.agent}@v${template.version}`;
}

const PLACEHOLDER = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;

/**
 * Fills {{APP_NAME}} and {{var}} placeholders. Throws if any placeholder has no value, so a typo
 * never ships a literal "{{...}}" to the model. Values must be static per prompt version: the
 * result is placed before a cache breakpoint (spec §8.2).
 */
export function renderPrompt(
  template: Pick<PromptTemplate, "agent" | "version" | "body">,
  vars: Readonly<Record<string, string>> = {},
): string {
  const values: Record<string, string> = { APP_NAME, ...vars };
  const missing = new Set<string>();
  const text = template.body.replace(PLACEHOLDER, (whole, name: string) => {
    const value = values[name];
    if (value === undefined) {
      missing.add(name);
      return whole;
    }
    return value;
  });
  if (missing.size > 0) {
    throw new Error(
      `Prompt ${promptVersionLabel(template)} is missing variables: ${[...missing].join(", ")}`,
    );
  }
  return text;
}
