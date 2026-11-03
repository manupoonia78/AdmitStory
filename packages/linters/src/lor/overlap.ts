// The Recommender Kit's deterministic overlap check (Phase 6 plan §1.17 and §3): two recommenders
// making the same point about the same story, and an essay paragraph that says what a brief
// already says. Story identity, then the trait, then content-word similarity — pure TypeScript,
// no model call and no embeddings (the embedding-based `lorOverlap` in `linters/file.ts` needs a
// live Voyage key and is not wired up). Same input, same findings, in the same order, whatever
// order the points and essays arrive in.

import { contentWords, fnv1a } from "../consistency/text";
import { excerpt } from "../text";
import {
  LOR_ESSAY_SIMILARITY,
  LOR_FACET_SIMILARITY,
  type LorEssayFacet,
  type LorFacetPoint,
  type LorOverlapFinding,
  type LorOverlapInput,
} from "./types";

/** Below this many content words a text says too little to compare. */
const MIN_CONTENT_WORDS = 3;
/** Two or three words in common are a coincidence, however short the texts. */
const MIN_SHARED_WORDS = 3;
/** Two points on the same story *and* the same trait need less text overlap to count. */
const SAME_TRAIT_RELAXATION = 0.6;

const wordSet = (text: string): Set<string> => new Set(contentWords(text));

/**
 * Overlap of two content-word sets, in [0, 1]: Dice (how much of both texts they share) averaged
 * with containment (how much of the shorter text they share). Two texts of similar length score
 * their shared share — 0.5 is half the content words — while a long essay paragraph that absorbs
 * a short talking point still scores well above the lower essay threshold.
 */
function setSimilarity(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size < MIN_CONTENT_WORDS || b.size < MIN_CONTENT_WORDS) return 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let shared = 0;
  for (const w of small) if (large.has(w)) shared += 1;
  if (shared < MIN_SHARED_WORDS) return 0;
  const dice = (2 * shared) / (a.size + b.size);
  const containment = shared / small.size;
  return (dice + containment) / 2;
}

/** Content-word overlap between two texts, in [0, 1]. Stemmed, stopwords and numbers dropped. */
export function facetSimilarity(a: string, b: string): number {
  return setSimilarity(wordSet(a), wordSet(b));
}

const storyCode = (code: string | null | undefined): string => (code ?? "").trim().toUpperCase();
const normTrait = (trait: string): string => trait.trim().toLowerCase();

interface PreparedPoint {
  point: LorFacetPoint;
  /** Stable, order-independent identity of the point. */
  key: string;
  story: string;
  trait: string;
  words: Set<string>;
}

interface PreparedParagraph {
  essay: LorEssayFacet;
  paragraphId: string;
  stories: Set<string>;
  words: Set<string>;
}

function preparePoints(points: readonly LorFacetPoint[]): PreparedPoint[] {
  const prepared: PreparedPoint[] = [];
  for (const point of points) {
    const story = storyCode(point.story);
    if (!story) continue;
    prepared.push({
      point,
      key: `${point.recommenderId}|${point.groupKey}|${point.questionId}|${point.index}`,
      story,
      trait: normTrait(point.trait),
      words: wordSet(`${point.facet} ${point.text}`),
    });
  }
  return prepared;
}

function prepareParagraphs(essays: readonly LorEssayFacet[]): PreparedParagraph[] {
  const prepared: PreparedParagraph[] = [];
  for (const essay of essays) {
    const primary = storyCode(essay.primaryStory);
    for (const paragraph of essay.paragraphs) {
      const stories = new Set(paragraph.stories.map(storyCode).filter(Boolean));
      // An essay's main story is told by the whole essay, as `lorOverlap` in file.ts reads it.
      if (primary) stories.add(primary);
      if (stories.size === 0) continue;
      prepared.push({
        essay,
        paragraphId: paragraph.id,
        stories,
        words: wordSet(paragraph.text),
      });
    }
  }
  return prepared;
}

function findingId(
  kind: LorOverlapFinding["kind"],
  story: string,
  ends: readonly string[],
): string {
  return `lor:${fnv1a([kind, story, ...[...ends].sort()].join("|"))}`;
}

/** A short, readable piece of what a point says: its facet, or the point text when it has none. */
const said = (point: LorFacetPoint): string => excerpt((point.facet || point.text).trim(), 12);

function briefBriefFindings(byStory: Map<string, PreparedPoint[]>): LorOverlapFinding[] {
  const findings: LorOverlapFinding[] = [];
  for (const [story, bucket] of byStory) {
    for (let i = 0; i < bucket.length; i += 1) {
      for (let j = i + 1; j < bucket.length; j += 1) {
        const one = bucket[i];
        const two = bucket[j];
        if (!one || !two) continue;
        // One recommender restating a point to another school is expected; two of them saying the
        // same thing about the same story is the waste LOR-03 warns about.
        if (one.point.recommenderId === two.point.recommenderId) continue;
        const score = setSimilarity(one.words, two.words);
        const threshold =
          one.trait === two.trait
            ? LOR_FACET_SIMILARITY * SAME_TRAIT_RELAXATION
            : LOR_FACET_SIMILARITY;
        if (score < threshold) continue;
        const [a, b] = one.key <= two.key ? [one, two] : [two, one];
        findings.push({
          id: findingId("brief_brief", story, [a.key, b.key]),
          kind: "brief_brief",
          severity: "should",
          story,
          facet: a.point.facet,
          a: a.point,
          b: b.point,
          explanation:
            `${a.point.recommenderLabel} and ${b.point.recommenderLabel} make the same point about ` +
            `this story: "${said(a.point)}" and "${said(b.point)}".`,
          fix_hint: `Give ${b.point.recommenderLabel} another side of the story, or another story.`,
        });
      }
    }
  }
  return findings;
}

function briefEssayFindings(
  points: readonly PreparedPoint[],
  paragraphs: readonly PreparedParagraph[],
): LorOverlapFinding[] {
  const findings: LorOverlapFinding[] = [];
  for (const point of points) {
    // One finding per point and essay: the paragraph that says it most nearly.
    const best = new Map<string, { paragraph: PreparedParagraph; score: number }>();
    for (const paragraph of paragraphs) {
      if (!paragraph.stories.has(point.story)) continue;
      const score = setSimilarity(point.words, paragraph.words);
      if (score < LOR_ESSAY_SIMILARITY) continue;
      const current = best.get(paragraph.essay.deliverableId);
      if (
        !current ||
        score > current.score ||
        (score === current.score && paragraph.paragraphId < current.paragraph.paragraphId)
      ) {
        best.set(paragraph.essay.deliverableId, { paragraph, score });
      }
    }
    for (const { paragraph } of best.values()) {
      const { essay, paragraphId } = paragraph;
      findings.push({
        id: findingId("brief_essay", point.story, [
          point.key,
          `${essay.deliverableId}|${paragraphId}`,
        ]),
        kind: "brief_essay",
        severity: "should",
        story: point.story,
        facet: point.point.facet,
        a: point.point,
        b: { deliverableId: essay.deliverableId, label: essay.label, paragraphId },
        explanation:
          `${essay.label} shows the same side of this story as ${point.point.recommenderLabel}'s ` +
          `brief: "${said(point.point)}".`,
        fix_hint: `Show a different side of the story in ${essay.label}, or change the talking point.`,
      });
    }
  }
  return findings;
}

const KIND_ORDER: readonly LorOverlapFinding["kind"][] = ["brief_brief", "brief_essay"];
const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Shared facets between two recommenders' briefs, and between a brief and an essay, on the same
 * story. Both sides must draw on the same story code before any text is compared; the trait is
 * what lowers the bar between two talking points. Dismissed ids are left out, as in
 * `checkConsistency`.
 */
export function checkLorOverlap(input: LorOverlapInput): LorOverlapFinding[] {
  const points = preparePoints(input.points);
  if (points.length === 0) return [];
  const byStory = new Map<string, PreparedPoint[]>();
  for (const point of points) {
    const bucket = byStory.get(point.story);
    if (bucket) bucket.push(point);
    else byStory.set(point.story, [point]);
  }
  const paragraphs = prepareParagraphs(input.essays);
  const dismissed = input.dismissed ?? new Set<string>();
  const unique = new Map<string, LorOverlapFinding>();
  for (const finding of [
    ...briefBriefFindings(byStory),
    ...briefEssayFindings(points, paragraphs),
  ]) {
    if (dismissed.has(finding.id) || unique.has(finding.id)) continue;
    unique.set(finding.id, finding);
  }
  return [...unique.values()].sort(
    (a, b) =>
      KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
      compare(a.story, b.story) ||
      compare(a.facet, b.facet) ||
      compare(a.id, b.id),
  );
}
