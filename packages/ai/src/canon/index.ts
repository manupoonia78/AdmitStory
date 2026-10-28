import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { canonDirIn, defaultCanonDir, rootAtImport } from "../paths";
import { compileCanon } from "./compile";
import { parseFrontMatter } from "./front-matter";
import { extractRules, normalizeRuleId } from "./rules";
import type { CanonDoc, CanonLibrary, CanonRule } from "./types";

export type { CanonDoc, CanonLibrary, CanonRule, CanonSelector, CompiledCanon } from "./types";
export { normalizeRuleId } from "./rules";

/**
 * `<repo>/knowledge/canon`, from the repo root found at import time (see paths.ts). Prefer passing
 * a dir; loadCanon() with no argument resolves the root when called.
 */
export const CANON_DIR: string = canonDirIn(rootAtImport());

function readDoc(dir: string, fileName: string): CanonDoc {
  const source = readFileSync(join(dir, fileName), "utf8").replace(/\r\n?/g, "\n");
  const { meta, content } = parseFrontMatter(source, fileName);
  const expectedSlug = fileName.slice(0, -".md".length);
  if (meta.slug !== expectedSlug) {
    throw new Error(
      `Canon file ${fileName}: front matter slug "${meta.slug}" must match the file name`,
    );
  }

  const lines = content.replace(/^\n+/, "").split("\n");
  if (lines[0] !== `# ${meta.title}`) {
    throw new Error(
      `Canon file ${fileName}: first line after front matter must be "# ${meta.title}"`,
    );
  }
  const body = lines
    .slice(1)
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();

  const rules = extractRules(body, meta.slug).map((rule) => Object.freeze(rule));
  return Object.freeze({ ...meta, body, rules: Object.freeze(rules) as CanonRule[] });
}

/**
 * Loads and validates every canon file (spec §9.4, Appendix A). Throws on any defect. The default
 * dir is resolved from the repo root found from process.cwd() (throws if there is none).
 */
export function loadCanon(dir: string = defaultCanonDir()): CanonLibrary {
  const fileNames = readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .sort();
  if (fileNames.length === 0) throw new Error(`No canon files found in ${dir}`);

  const docs = Object.freeze(fileNames.map((name) => readDoc(dir, name)));
  const docsBySlug = new Map(docs.map((doc) => [doc.slug, doc]));
  const rulesById = new Map<string, CanonRule>();
  for (const doc of docs) {
    for (const rule of doc.rules) {
      const existing = rulesById.get(rule.id);
      if (existing) {
        throw new Error(
          `Duplicate canon rule ID ${rule.id} in ${existing.slug}.md and ${rule.slug}.md`,
        );
      }
      rulesById.set(rule.id, rule);
    }
  }

  const library: CanonLibrary = {
    docs,
    getDoc(slug) {
      const doc = docsBySlug.get(slug);
      if (!doc) throw new Error(`Unknown canon file "${slug}"`);
      return doc;
    },
    getRule(ref) {
      const rule = rulesById.get(normalizeRuleId(ref));
      if (!rule) throw new Error(`Unknown canon rule "${ref}"`);
      return rule;
    },
    compile: (selector) => compileCanon(library, selector),
  };
  return library;
}
