// Linters about the deliverable's place in the school's file (§8.8): the limit, the prompt's
// parts, and repetition across this school's essays, form fields and recommender briefs.

import { countAfterNormalize, unitLabel } from "../count";
import { at, draftText, excerpt, finding, labelOf, paragraphText, wordTokens } from "../text";
import type { DraftDoc, Finding, LintContext } from "../types";

/* limit -------------------------------------------------------------------------------------- */

export const LIMIT_UNDER_SHARE = 0.85;

export function limit(draft: DraftDoc, ctx: LintContext = {}): Finding[] {
  const rule = ctx.limit;
  if (!rule || rule.value <= 0) return [];
  const n = countAfterNormalize(draftText(draft), rule.kind);
  if (n > rule.value) {
    const over = n - rule.value;
    return [
      finding(
        "limit",
        "must",
        at(null),
        `${over} ${unitLabel(rule.kind, over)} over the ${rule.value}-${unitLabel(rule.kind, 1)} limit.`,
        `Cut to ${rule.value} ${unitLabel(rule.kind)}`,
      ),
    ];
  }
  if (n < rule.value * LIMIT_UNDER_SHARE) {
    return [
      finding(
        "limit",
        "consider",
        at(null),
        `At ${n} of ${rule.value} ${unitLabel(rule.kind)}, this leaves more than 15% of the space unused.`,
        "Add a specific detail where the story moves fastest.",
      ),
    ];
  }
  return [];
}

/* storyReuse --------------------------------------------------------------------------------- */

export function storyReuse(_draft: DraftDoc, ctx: LintContext = {}): Finding[] {
  const d = ctx.deliverable;
  if (!d?.primaryStory) return [];
  const other = d.otherDeliverables.find(
    (o) => o.key !== d.key && o.primaryStory === d.primaryStory,
  );
  if (!other) return [];
  return [
    finding(
      "storyReuse",
      "must",
      at(null),
      `This story is already the main story of ${labelOf(other)}, so this essay should show something new.`,
      "Suggest another story",
    ),
  ];
}

/* lineReuse ---------------------------------------------------------------------------------- */

export const NGRAM = 6;

/** Six-word sequences of normalised tokens (lowercase, straight apostrophes, punctuation dropped). */
export function ngrams(text: string, n = NGRAM): Set<string> {
  const tokens = wordTokens(text);
  const grams = new Set<string>();
  for (let i = 0; i + n <= tokens.length; i++) grams.add(tokens.slice(i, i + n).join(" "));
  return grams;
}

/**
 * A sentence that shares a six-word sequence with another deliverable or form field of the same
 * school is a must fix. The caller passes only this school's material: reuse across schools is
 * fine and encouraged (§8.8, CRAFT-18), so it is never checked here.
 */
export function lineReuse(draft: DraftDoc, ctx: LintContext = {}): Finding[] {
  const d = ctx.deliverable;
  if (!d) return [];
  const sources = [
    ...d.otherDeliverables
      .filter((o) => o.key !== d.key)
      .map((o) => ({ label: labelOf(o), grams: ngrams(o.plainText) })),
    ...d.formFields.map((text) => ({ label: "your application form", grams: ngrams(text) })),
  ];
  if (sources.length === 0) return [];
  const findings: Finding[] = [];
  for (const p of draft.paragraphs) {
    p.sentences.forEach((s, i) => {
      const grams = [...ngrams(s.text)];
      for (const source of sources) {
        const shared = grams.find((g) => source.grams.has(g));
        if (!shared) continue;
        findings.push(
          finding(
            "lineReuse",
            "must",
            at(p.id, i),
            `This repeats a line from ${source.label} ("${excerpt(shared, NGRAM)}").`,
            "Say it a new way here, or cut it from one of the two.",
          ),
        );
        break;
      }
    });
  }
  return findings;
}

/* lorOverlap --------------------------------------------------------------------------------- */

export const LOR_OVERLAP_THRESHOLD = 0.85;

/**
 * An essay paragraph saying what a recommender brief bullet already says about the same story.
 * Similarity is injected (embeddings live in packages/ai). Without brief bullets or a similarity
 * function, which is every draft until Phase 6 creates briefs, this does nothing.
 */
export function lorOverlap(draft: DraftDoc, ctx: LintContext = {}): Finding[] {
  const bullets = ctx.deliverable?.briefBullets ?? [];
  const similarity = ctx.similarity;
  if (bullets.length === 0 || !similarity) return [];
  const findings: Finding[] = [];
  for (const p of draft.paragraphs) {
    const stories = new Set(p.sentences.flatMap((s) => s.sources).filter((c) => /^S\d+$/i.test(c)));
    if (ctx.deliverable?.primaryStory) stories.add(ctx.deliverable.primaryStory);
    const text = paragraphText(p);
    const hit = bullets.find(
      (b) => b.story && stories.has(b.story) && similarity(text, b.text) > LOR_OVERLAP_THRESHOLD,
    );
    if (!hit) continue;
    findings.push(
      finding(
        "lorOverlap",
        "should",
        at(p.id),
        "This paragraph shows the same facet of the story as your recommender's brief.",
        "Show a different side of the story here.",
      ),
    );
  }
  return findings;
}

/* promptParts (CRAFT-20) --------------------------------------------------------------------- */

const norm = (text: string) =>
  text
    .trim()
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\s]+/g, " ")
    .replace(/[\s.?!:;,]+$/u, "");

/**
 * A part counts as answered when the Writer's `prompt_parts_answered` maps it to a paragraph that
 * still exists. Parts match by text (case, spacing and end punctuation ignored); when the Writer
 * reworded a part, its entry at the same position stands in for it.
 */
export function promptParts(draft: DraftDoc, ctx: LintContext = {}): Finding[] {
  const input = ctx.promptParts;
  if (!input || input.parts.length === 0) return [];
  const ids = new Set(draft.paragraphs.map((p) => p.id));
  const declared = new Set(input.parts.map(norm));
  const answered = new Map<string, string[]>();
  for (const a of input.answered) {
    const key = norm(a.part);
    answered.set(key, [
      ...(answered.get(key) ?? []),
      ...a.paragraph_ids.filter((id) => ids.has(id)),
    ]);
  }
  const byPosition = (i: number): string[] => {
    const a = input.answered[i];
    return a && !declared.has(norm(a.part)) ? a.paragraph_ids.filter((id) => ids.has(id)) : [];
  };
  return input.parts.flatMap((part, i) => {
    const exact = answered.get(norm(part));
    if ((exact ?? byPosition(i)).length > 0) return [];
    return [
      finding(
        "promptParts",
        "must",
        at(null),
        `The prompt asks "${excerpt(part, 12)}" and no paragraph answers it yet.`,
        `Answer part ${i + 1} of the prompt better`,
      ),
    ];
  });
}
