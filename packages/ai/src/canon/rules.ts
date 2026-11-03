import type { CanonRule } from "./types";

const NUMBERED = /^([A-Z]+)-(\d+)$/;
const WORD = /^[A-Z]+(?:-[A-Z]+)+$/;

/**
 * Canonical rule ID for a reference. Prompts may cite "CRAFT-3" (spec §8.5);
 * the canon stores "CRAFT-07"-style IDs (spec §9.4). Word IDs such as
 * ARCH-GOALS pass through unchanged.
 */
export function normalizeRuleId(ref: string): string {
  const upper = ref.trim().toUpperCase();
  const numbered = NUMBERED.exec(upper);
  if (numbered) {
    const [, prefix = "", digits = ""] = numbered;
    const n = Number(digits);
    if (n < 1) throw new Error(`Invalid canon rule ID "${ref}": numbers start at 01`);
    return `${prefix}-${String(n).padStart(2, "0")}`;
  }
  if (WORD.test(upper)) return upper;
  throw new Error(`Invalid canon rule ID "${ref}"`);
}

// A token that is trying to be a rule ID. Lowercase or unpadded variants count,
// so a typo in a canon file fails loudly instead of silently becoming prose.
function looksLikeRuleId(token: string): boolean {
  return /^[A-Za-z]+-\d+$/.test(token) || /^[A-Z]{2,}-[A-Za-z0-9-]+$/.test(token);
}

function assertCanonicalId(token: string, slug: string): string {
  let normalized: string | undefined;
  try {
    normalized = normalizeRuleId(token);
  } catch {
    normalized = undefined;
  }
  if (normalized !== token) {
    throw new Error(`Canon file ${slug}.md: malformed rule ID "${token}"`);
  }
  return token;
}

// "- **LENS-01** text" or "- **ARCH-GOALS — Title.** text"
function parseBullet(line: string, slug: string): CanonRule | null {
  const token = /^- \*\*([^\s*]+)/.exec(line)?.[1];
  if (!token || !looksLikeRuleId(token)) return null;
  const id = assertCanonicalId(token, slug);
  const rest = line.slice(`- **${token}`.length);

  let text: string | undefined;
  if (rest.startsWith("**")) {
    text = rest.slice(2).trim();
  } else if (rest.startsWith(" — ")) {
    const end = rest.indexOf("**");
    const title = end === -1 ? "" : rest.slice(3, end).trim();
    if (title !== "") text = `**${title}**${rest.slice(end + 2)}`.trim();
  }
  if (!text) throw new Error(`Canon file ${slug}.md: rule ${id} has no text`);
  return { id, slug, text };
}

// "| FLAG-01 | Flag | Mitigation |" → text "Flag — Mitigation"
function parseTableRow(line: string, slug: string): CanonRule | null {
  const cells = line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
  const [first = "", ...rest] = cells;
  if (!looksLikeRuleId(first)) return null;
  const id = assertCanonicalId(first, slug);
  const text = rest.filter((cell) => cell !== "").join(" — ");
  if (!text) throw new Error(`Canon file ${slug}.md: rule ${id} has no text`);
  return { id, slug, text };
}

/** Extracts rules from a canon body; everything else stays prose (spec Appendix A). */
export function extractRules(body: string, slug: string): CanonRule[] {
  const rules: CanonRule[] = [];
  let inFence = false;
  let last: CanonRule | null = null;

  for (const line of body.split("\n")) {
    if (line.trimStart().startsWith("```")) {
      inFence = !inFence;
      last = null;
      continue;
    }
    if (inFence) continue;

    let rule: CanonRule | null = null;
    if (line.startsWith("- **")) rule = parseBullet(line, slug);
    else if (line.startsWith("|")) rule = parseTableRow(line, slug);

    if (rule) {
      rules.push(rule);
      last = rule;
    } else if (last && /^\s{2,}\S/.test(line) && !line.trimStart().startsWith("- ")) {
      // Wrapped continuation of a bullet rule.
      last.text = `${last.text} ${line.trim()}`;
    } else {
      last = null;
    }
  }
  return rules;
}
