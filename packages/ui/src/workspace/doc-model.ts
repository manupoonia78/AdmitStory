// The bridge between the draft model (paragraphs of sentences with provenance, spec Appendix I)
// and the editor's document (spec §6.8 DocCanvas). Pure and free of TipTap, so the round trip is
// unit-tested without an editor and the server can share it.
//
// In the editor every generated sentence is a run of text carrying a `yourWords` mark with its
// provenance and the exact text it was generated with (`origin`). Serialising back, a run whose
// text still equals its origin keeps its provenance untouched; anything the applicant typed or
// changed becomes their own sentence (author "user"), keeping the sources of what it was edited
// from. A NEED chip is an inline atom between sentences.

import { diffWords } from "./diff";
import { paragraphText } from "./provenance";
import { splitSentences } from "./sentences";
import type { DraftNeed, DraftParagraph, DraftSentence, SentenceKind } from "./types";

export const YOUR_WORDS_MARK = "yourWords";
export const NEED_CHIP_NODE = "needChip";
export const PARAGRAPH_NODE = "paragraph";

/** Provenance a `yourWords` mark carries. */
export interface SentenceMarkAttrs {
  /** Unique within the document: tells two neighbouring sentences apart. */
  sid: string;
  kind: SentenceKind;
  sources: string[];
  author: "ai" | "user" | null;
  /** The sentence exactly as generated or last saved. */
  origin: string;
}

export interface NeedChipAttrs {
  question: string;
  approxWords: number;
}

export interface ParagraphAttrs {
  id: string | null;
  locked: boolean;
}

/** The subset of ProseMirror JSON the canvas reads and writes. */
export interface DocMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface DocNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  text?: string;
  marks?: DocMark[];
}

export interface DocJson extends DocNode {
  type: "doc";
  content: DocNode[];
}

export interface DraftContent {
  paragraphs: DraftParagraph[];
  needs: DraftNeed[];
}

/** A short id for a paragraph the applicant created ("p-k3x9q2"). */
export function newParagraphId(): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replaceAll("-", "")
      : Math.random().toString(36).slice(2);
  return `p-${random.slice(0, 8)}`;
}

/** The editor document for a draft. Chips past the last sentence go at the paragraph's end. */
export function draftToDoc(
  paragraphs: readonly DraftParagraph[],
  needs: readonly DraftNeed[] = [],
): DocJson {
  return {
    type: "doc",
    content: paragraphs.map((paragraph) => {
      const content: DocNode[] = [];
      const last = paragraph.sentences.length - 1;
      const chipsAfter = (index: number) =>
        needs.filter(
          (need) =>
            need.paragraph_id === paragraph.id &&
            Math.min(last, Math.max(0, need.after_sentence)) === index,
        );
      const pushChips = (index: number) => {
        for (const need of chipsAfter(index)) {
          content.push({ type: "text", text: " " });
          content.push({
            type: NEED_CHIP_NODE,
            attrs: { question: need.question, approxWords: need.approx_words },
          });
        }
      };
      paragraph.sentences.forEach((sentence, index) => {
        if (index > 0) content.push({ type: "text", text: " " });
        if (sentence.text) {
          const attrs: SentenceMarkAttrs = {
            sid: `${paragraph.id}:${index}`,
            kind: sentence.kind,
            sources: [...sentence.sources],
            author: sentence.author ?? null,
            origin: sentence.text,
          };
          content.push({
            type: "text",
            text: sentence.text,
            marks: [{ type: YOUR_WORDS_MARK, attrs: { ...attrs } }],
          });
        }
        pushChips(index);
      });
      if (paragraph.sentences.length === 0) {
        for (const need of needs.filter((n) => n.paragraph_id === paragraph.id)) {
          content.push({
            type: NEED_CHIP_NODE,
            attrs: { question: need.question, approxWords: need.approx_words },
          });
        }
      }
      const attrs: ParagraphAttrs = { id: paragraph.id, locked: Boolean(paragraph.locked) };
      return {
        type: PARAGRAPH_NODE,
        attrs: { ...attrs },
        ...(content.length > 0 ? { content: mergeText(content) } : {}),
      };
    }),
  };
}

/** Joins neighbouring unmarked text nodes, as ProseMirror itself would. */
function mergeText(content: DocNode[]): DocNode[] {
  const merged: DocNode[] = [];
  for (const node of content) {
    const last = merged.at(-1);
    if (node.type === "text" && !node.marks && last?.type === "text" && !last.marks) {
      last.text = (last.text ?? "") + (node.text ?? "");
    } else {
      merged.push({ ...node });
    }
  }
  return merged;
}

function markAttrs(node: DocNode): SentenceMarkAttrs | null {
  const mark = node.marks?.find((m) => m.type === YOUR_WORDS_MARK);
  if (!mark?.attrs) return null;
  const attrs = mark.attrs;
  return {
    sid: String(attrs.sid ?? ""),
    kind: (attrs.kind as SentenceKind | undefined) ?? "composed",
    sources: Array.isArray(attrs.sources) ? attrs.sources.map(String) : [],
    author: attrs.author === "user" || attrs.author === "ai" ? attrs.author : null,
    origin: String(attrs.origin ?? ""),
  };
}

interface Segment {
  text: string;
  attrs: SentenceMarkAttrs | null;
  /** Untouched: one whole generated sentence, exactly as it was. */
  anchor: boolean;
}

const startsWithSpace = (text: string) => /^\s/u.test(text);
const endsWithSpace = (text: string) => /\s$/u.test(text);
const blank = (text: string) => text.trim() === "";
const endsSentence = (text: string) => /[.!?…]["'”’)\]]*\s*$/u.test(text);

function original(attrs: SentenceMarkAttrs): DraftSentence {
  return {
    text: attrs.origin,
    kind: attrs.kind,
    sources: [...attrs.sources],
    ...(attrs.author ? { author: attrs.author } : {}),
  };
}

/**
 * One paragraph's sentences from its inline content, and the character offset of each chip.
 * Untouched sentences come back exactly as they went in. Text the applicant changed or added is
 * re-split into sentences; each is theirs ("verbatim", author "user": the applicant's own words),
 * citing the sources of the generated sentences it overlaps, so nothing loses its trail.
 */
function readParagraph(content: readonly DocNode[]): {
  sentences: DraftSentence[];
  chips: { offset: number; attrs: NeedChipAttrs }[];
  ends: number[];
} {
  const segments: Segment[] = [];
  const chips: { offset: number; attrs: NeedChipAttrs }[] = [];
  let offset = 0;
  for (const node of content) {
    if (node.type === NEED_CHIP_NODE) {
      chips.push({
        offset,
        attrs: {
          question: String(node.attrs?.question ?? ""),
          approxWords: Number(node.attrs?.approxWords ?? 0),
        },
      });
      // A chip separates text like a space would.
      segments.push({ text: " ", attrs: null, anchor: false });
      offset += 1;
      continue;
    }
    if (node.type !== "text" || !node.text) continue;
    const attrs = markAttrs(node);
    const last = segments.at(-1);
    if (last && (last.attrs?.sid ?? null) === (attrs?.sid ?? null)) {
      last.text += node.text;
    } else {
      segments.push({ text: node.text, attrs, anchor: false });
    }
    offset += node.text.length;
  }
  for (const segment of segments) {
    segment.anchor = segment.attrs !== null && segment.text === segment.attrs.origin;
  }

  // Text typed flush against an untouched sentence, or an unfinished phrase before one ("Today
  // The runbook…"), is part of that sentence: it is now an edit of it.
  let changed = true;
  while (changed) {
    changed = false;
    segments.forEach((segment, index) => {
      if (segment.anchor || blank(segment.text)) return;
      const next = segments[index + 1];
      const previous = segments[index - 1];
      if (next?.anchor && (!endsWithSpace(segment.text) || !endsSentence(segment.text))) {
        next.anchor = false;
        changed = true;
      }
      if (previous?.anchor && !startsWithSpace(segment.text)) {
        previous.anchor = false;
        changed = true;
      }
    });
  }

  const sentences: DraftSentence[] = [];
  const ends: number[] = [];
  let position = 0;
  let run: { text: string; start: number; parts: { from: number; to: number; seg: Segment }[] } = {
    text: "",
    start: 0,
    parts: [],
  };

  const flush = () => {
    if (!blank(run.text)) {
      let cursor = 0;
      for (const piece of splitSentences(run.text)) {
        const from = run.text.indexOf(piece, cursor);
        const to = from + piece.length;
        cursor = to;
        const overlapping = run.parts.filter(
          (part) => part.seg.attrs && part.from < to && part.to > from,
        );
        const only = overlapping.length === 1 ? overlapping[0]?.seg.attrs : null;
        if (only && only.origin === piece) {
          sentences.push(original(only));
        } else {
          const sources = [
            ...new Set(overlapping.flatMap((part) => part.seg.attrs?.sources ?? [])),
          ];
          sentences.push({ text: piece, kind: "verbatim", sources, author: "user" });
        }
        ends.push(run.start + to);
      }
    }
    run = { text: "", start: position, parts: [] };
  };

  for (const segment of segments) {
    if (segment.anchor && segment.attrs) {
      flush();
      sentences.push(original(segment.attrs));
      ends.push(position + segment.text.length);
      position += segment.text.length;
      run.start = position;
      continue;
    }
    const from = run.text.length;
    run.text += segment.text;
    run.parts.push({ from, to: run.text.length, seg: segment });
    position += segment.text.length;
  }
  flush();
  return { sentences, chips, ends };
}

/**
 * The draft model from an editor document. Paragraph ids stay as they were; a paragraph without
 * one (split off with Enter) or with a duplicate (pasted) gets a fresh id from `createId`.
 * Each chip comes back as a need placed after the last sentence that ends before it.
 */
export function docToDraft(doc: DocNode, createId: () => string = newParagraphId): DraftContent {
  const paragraphs: DraftParagraph[] = [];
  const needs: DraftNeed[] = [];
  const seen = new Set<string>();
  for (const node of doc.content ?? []) {
    if (node.type !== PARAGRAPH_NODE) continue;
    let id = typeof node.attrs?.id === "string" && node.attrs.id ? node.attrs.id : null;
    if (!id || seen.has(id)) {
      const fresh = createId();
      id = fresh;
      for (let n = 2; seen.has(id); n += 1) id = `${fresh}-${n}`;
    }
    seen.add(id);
    const { sentences, chips, ends } = readParagraph(node.content ?? []);
    paragraphs.push({
      id,
      sentences,
      ...(node.attrs?.locked ? { locked: true } : {}),
    });
    for (const chip of chips) {
      const before = ends.filter((end) => end <= chip.offset).length;
      needs.push({
        paragraph_id: id,
        after_sentence: Math.max(0, before - 1),
        question: chip.attrs.question,
        approx_words: chip.attrs.approxWords,
      });
    }
  }
  return { paragraphs, needs };
}

/** True when two drafts say the same thing with the same provenance and locks. */
export function sameDraft(a: readonly DraftParagraph[], b: readonly DraftParagraph[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((paragraph, index) => {
    const other = b[index];
    if (!other || other.id !== paragraph.id) return false;
    if (Boolean(other.locked) !== Boolean(paragraph.locked)) return false;
    if (other.sentences.length !== paragraph.sentences.length) return false;
    return paragraph.sentences.every((sentence, i) => {
      const o = other.sentences[i];
      return (
        o !== undefined &&
        o.text === sentence.text &&
        o.kind === sentence.kind &&
        (o.author ?? "ai") === (sentence.author ?? "ai") &&
        o.sources.join(",") === sentence.sources.join(",")
      );
    });
  });
}

/** Ids of paragraphs that differ between two versions: changed, added or removed. */
export function changedParagraphIds(
  before: readonly DraftParagraph[],
  after: readonly DraftParagraph[],
): string[] {
  const old = new Map(before.map((p) => [p.id, p]));
  const changed: string[] = [];
  for (const paragraph of after) {
    const previous = old.get(paragraph.id);
    if (!previous || !sameDraft([previous], [paragraph])) changed.push(paragraph.id);
    old.delete(paragraph.id);
  }
  return [...changed, ...old.keys()];
}

/** Marks a word in a revision under review: struck out ("removed") or new ("added"). */
export const DIFF_MORPH_MARK = "diffMorph";

/** A paragraph's place in a review, which the canvas styles (spec §6.6 "Diffs morph"). */
export type ParagraphReview = "pending" | "kept" | "undone";

export interface ReviewChange {
  paragraphId: string;
  op: "replace" | "insert_after" | "delete";
  anchorId?: string;
  before: DraftParagraph | null;
  after: DraftParagraph | null;
}

function diffParagraph(
  id: string,
  before: string,
  after: string,
  review: ParagraphReview,
): DocNode {
  const content: DocNode[] = [];
  diffWords(before, after).forEach((token, index) => {
    if (index > 0) content.push({ type: "text", text: " " });
    content.push({
      type: "text",
      text: token.text,
      ...(token.kind === "same"
        ? {}
        : { marks: [{ type: DIFF_MORPH_MARK, attrs: { change: token.kind } }] }),
    });
  });
  return {
    type: PARAGRAPH_NODE,
    attrs: { id, locked: false, review },
    ...(content.length > 0 ? { content: mergeText(content) } : {}),
  };
}

/**
 * The document while a revision is under review: each changed paragraph shows its word diff in
 * place (removed words struck, added words underlined), tagged with its decision so the canvas
 * can morph it; untouched paragraphs read as usual. Read-only: the canvas locks editing meanwhile.
 */
export function reviewToDoc(
  paragraphs: readonly DraftParagraph[],
  needs: readonly DraftNeed[],
  changes: readonly ReviewChange[],
  decisions: Readonly<Record<string, ParagraphReview>>,
): DocJson {
  const base = draftToDoc(paragraphs, needs);
  const content: DocNode[] = [];
  base.content.forEach((node, index) => {
    const paragraph = paragraphs[index];
    const change = changes.find((c) => c.op !== "insert_after" && c.paragraphId === paragraph?.id);
    if (paragraph && change) {
      content.push(
        diffParagraph(
          paragraph.id,
          paragraphText(paragraph),
          change.after ? paragraphText(change.after) : "",
          decisions[change.paragraphId] ?? "pending",
        ),
      );
    } else {
      content.push(node);
    }
    for (const insert of changes) {
      if (insert.op !== "insert_after" || insert.anchorId !== paragraph?.id || !insert.after) {
        continue;
      }
      content.push(
        diffParagraph(
          insert.paragraphId,
          "",
          paragraphText(insert.after),
          decisions[insert.paragraphId] ?? "pending",
        ),
      );
    }
  });
  return { type: "doc", content };
}
