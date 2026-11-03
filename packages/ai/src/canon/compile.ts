import { createHash } from "node:crypto";
import type { CanonDoc, CanonRule, CanonSelector, CompiledCanon } from "./types";

interface Index {
  docs: readonly CanonDoc[];
  getDoc(slug: string): CanonDoc;
  getRule(id: string): CanonRule;
}

const heading = (doc: CanonDoc): string => `## ${doc.title} (${doc.slug} v${doc.version})`;

/**
 * Builds the L0 canon subset for an agent (spec §8.2). Output must be
 * byte-stable for a given selector and canon version, because it sits before
 * the first cache breakpoint and is shared across all users.
 */
export function compileCanon(index: Index, selector: CanonSelector): CompiledCanon {
  const files = [...new Set(selector.files ?? [])].map((slug) => index.getDoc(slug));
  const rules = (selector.rules ?? []).map((ref) => index.getRule(ref));

  const included = new Set(files.map((doc) => doc.slug));
  const wanted = new Set(rules.filter((rule) => !included.has(rule.slug)).map((rule) => rule.id));

  const sections: string[] = [];
  const ruleIds: string[] = [];

  for (const doc of files) {
    sections.push(`${heading(doc)}\n\n${doc.body}`);
    ruleIds.push(...doc.rules.map((rule) => rule.id));
  }

  for (const doc of index.docs) {
    const picked = doc.rules.filter((rule) => wanted.has(rule.id));
    if (picked.length === 0) continue;
    sections.push(
      `${heading(doc)}\n\n${picked.map((rule) => `- **${rule.id}** ${rule.text}`).join("\n")}`,
    );
    ruleIds.push(...picked.map((rule) => rule.id));
  }

  const text = sections
    .join("\n\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();

  return { text, hash: createHash("sha256").update(text).digest("hex"), ruleIds };
}
