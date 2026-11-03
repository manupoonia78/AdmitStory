import { describe, expect, it } from "vitest";
import { changedParagraphIds, docToDraft, draftToDoc, sameDraft, type DocNode } from "./doc-model";
import type { DraftNeed, DraftParagraph } from "./types";

const PARAGRAPHS: DraftParagraph[] = [
  {
    id: "p1",
    sentences: [
      // Two sentences to splitSentences, one to the model: provenance must survive regardless.
      { text: "He said: “Go.” Then he left.", kind: "verbatim", sources: ["L041"] },
      { text: "Nobody else could see it yet.", kind: "composed", sources: [] },
      { text: "I kept both of them on one line.", kind: "adapted", sources: ["C2", "F12"] },
    ],
  },
  {
    id: "p2",
    locked: true,
    sentences: [{ text: "The runbook is still on page one.", kind: "composed", sources: ["S03"] }],
  },
];

const NEEDS: DraftNeed[] = [
  {
    paragraph_id: "p1",
    after_sentence: 1,
    question: "What did your manager say?",
    approx_words: 20,
  },
];

let counter = 0;
const ids = () => `new-${(counter += 1)}`;

/** The inline content of paragraph `index`, for hand edits. */
function inline(doc: DocNode, index: number): DocNode[] {
  return doc.content?.[index]?.content ?? [];
}

describe("draftToDoc / docToDraft", () => {
  it("round-trips provenance, locks and chips exactly", () => {
    const doc = draftToDoc(PARAGRAPHS, NEEDS);
    const back = docToDraft(doc, ids);
    expect(back.paragraphs).toEqual(PARAGRAPHS);
    expect(back.needs).toEqual(NEEDS);
    expect(sameDraft(back.paragraphs, PARAGRAPHS)).toBe(true);
  });

  it("survives a JSON round trip (as stored or sent over the wire)", () => {
    const doc = JSON.parse(JSON.stringify(draftToDoc(PARAGRAPHS, NEEDS))) as DocNode;
    expect(docToDraft(doc, ids).paragraphs).toEqual(PARAGRAPHS);
  });

  it("marks an edited sentence as the user's and keeps its sources; untouched ones stay", () => {
    const doc = draftToDoc(PARAGRAPHS);
    const node = inline(doc, 0).find((n) => n.text?.startsWith("Nobody"));
    if (!node) throw new Error("missing sentence");
    node.text = "Nobody else on the night shift could see it yet.";
    const { paragraphs } = docToDraft(doc, ids);
    const [first, second, third] = paragraphs[0]?.sentences ?? [];
    expect(first).toEqual(PARAGRAPHS[0]?.sentences[0]);
    expect(second).toEqual({
      text: "Nobody else on the night shift could see it yet.",
      kind: "verbatim",
      sources: [],
      author: "user",
    });
    expect(third).toEqual(PARAGRAPHS[0]?.sentences[2]);
    expect(paragraphs[1]).toEqual(PARAGRAPHS[1]);
  });

  it("turns typed text after a sentence into new sentences of the user's", () => {
    const doc = draftToDoc([PARAGRAPHS[1] as DraftParagraph]);
    inline(doc, 0).push({ type: "text", text: " It took me a week. Then I slept." });
    const { paragraphs } = docToDraft(doc, ids);
    expect(paragraphs[0]?.locked).toBe(true);
    expect(paragraphs[0]?.sentences).toEqual([
      PARAGRAPHS[1]?.sentences[0],
      { text: "It took me a week.", kind: "verbatim", sources: [], author: "user" },
      { text: "Then I slept.", kind: "verbatim", sources: [], author: "user" },
    ]);
  });

  it("treats text typed flush against a sentence as an edit of that sentence", () => {
    const doc = draftToDoc([PARAGRAPHS[1] as DraftParagraph]);
    inline(doc, 0).unshift({ type: "text", text: "Today " });
    const sentences = docToDraft(doc, ids).paragraphs[0]?.sentences;
    expect(sentences).toEqual([
      {
        text: "Today The runbook is still on page one.",
        kind: "verbatim",
        sources: ["S03"],
        author: "user",
      },
    ]);
  });

  it("gives a split-off or duplicated paragraph a fresh id and keeps the rest", () => {
    const doc = draftToDoc(PARAGRAPHS);
    doc.content.push({ type: "paragraph", attrs: { id: null, locked: false } });
    doc.content.push({
      type: "paragraph",
      attrs: { id: "p1", locked: false },
      content: [{ type: "text", text: "Pasted again." }],
    });
    const { paragraphs } = docToDraft(doc, () => "fresh");
    const fresh = paragraphs.map((p) => p.id);
    expect(fresh.slice(0, 2)).toEqual(["p1", "p2"]);
    expect(new Set(fresh).size).toBe(fresh.length);
    expect(paragraphs[2]?.sentences).toEqual([]);
  });

  it("places a chip after the last sentence before it, and keeps out-of-range chips", () => {
    const doc = draftToDoc(PARAGRAPHS, [
      { paragraph_id: "p2", after_sentence: 9, question: "How many?", approx_words: 5 },
    ]);
    expect(docToDraft(doc, ids).needs).toEqual([
      { paragraph_id: "p2", after_sentence: 0, question: "How many?", approx_words: 5 },
    ]);
  });
});

describe("changedParagraphIds", () => {
  it("lists changed, added and removed paragraphs", () => {
    const after: DraftParagraph[] = [
      { id: "p1", sentences: [{ text: "New.", kind: "composed", sources: [] }] },
      { id: "p3", sentences: [] },
    ];
    expect(changedParagraphIds(PARAGRAPHS, after)).toEqual(["p1", "p3", "p2"]);
    expect(changedParagraphIds(PARAGRAPHS, PARAGRAPHS)).toEqual([]);
  });
});
