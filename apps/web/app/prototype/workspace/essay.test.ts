import { countWords, draftText, isOwnWords, paragraphText, splitSentences } from "@admitstory/ui";
import { describe, expect, it } from "vitest";
import { NEEDS, PARAGRAPHS, PROMPT, REVISIONS, SOURCES, answerNeed, applyRevision } from "./essay";

const paragraph = (id: string) => PARAGRAPHS.find((p) => p.id === id)!;

describe("prototype essay", () => {
  it("opens at 187 of 200 words, as screen G shows", () => {
    expect(countWords(draftText(PARAGRAPHS))).toBe(187);
    expect(PROMPT.limit).toBe(200);
  });

  it("resolves every lit sentence to a source, and gives composed ones none (spec §5.8 AC)", () => {
    for (const { sentences } of PARAGRAPHS) {
      for (const sentence of sentences) {
        if (isOwnWords(sentence)) {
          expect(sentence.sources.length).toBeGreaterThan(0);
          for (const id of sentence.sources) expect(SOURCES[id], id).toBeDefined();
        } else {
          expect(sentence.sources).toEqual([]);
        }
      }
    }
    for (const { sentence } of REVISIONS) {
      for (const id of sentence.sources) expect(SOURCES[id], id).toBeDefined();
    }
  });

  it("splits each paragraph back into exactly its sentences", () => {
    for (const p of PARAGRAPHS) {
      expect(splitSentences(paragraphText(p))).toEqual(p.sentences.map((s) => s.text));
    }
  });

  it("anchors each NEED after a sentence that exists", () => {
    for (const need of NEEDS) {
      expect(paragraph(need.paragraph_id).sentences[need.after_sentence]).toBeDefined();
    }
  });

  it("uses a fictional school only", () => {
    const text = [draftText(PARAGRAPHS), PROMPT.text, ...REVISIONS.map((r) => r.sentence.text)];
    for (const line of text) expect(line).not.toMatch(/Darden|Foster|Tuck|Wharton|Harvard/);
  });
});

describe("applyRevision", () => {
  it("replaces one sentence and leaves the rest of the paragraph alone", () => {
    for (const revision of REVISIONS) {
      const before = paragraph(revision.paragraphId);
      const after = applyRevision(before, revision)!;
      expect(after.sentences[revision.sentenceIndex]).toEqual(revision.sentence);
      after.sentences.forEach((sentence, index) => {
        if (index !== revision.sentenceIndex) expect(sentence).toBe(before.sentences[index]);
      });
      expect(before.sentences[revision.sentenceIndex]).not.toEqual(revision.sentence);
    }
  });

  it("returns null once the change is already in", () => {
    const revision = REVISIONS[0]!;
    const after = applyRevision(paragraph(revision.paragraphId), revision)!;
    expect(applyRevision(after, revision)).toBeNull();
  });

  it("returns null when the sentence is gone", () => {
    const revision = { ...REVISIONS[0]!, sentenceIndex: 99 };
    expect(applyRevision(paragraph(revision.paragraphId), revision)).toBeNull();
  });
});

describe("answerNeed", () => {
  const need = NEEDS[0]!;

  it("adds the answer after its anchor as the applicant's own words", () => {
    const before = paragraph(need.paragraph_id);
    const after = answerNeed(
      before,
      need,
      "  he said   thank you, and then asked for the notes ",
      "A1",
    );
    expect(after.sentences).toHaveLength(before.sentences.length + 1);
    expect(after.sentences[need.after_sentence + 1]).toEqual({
      text: "He said thank you, and then asked for the notes.",
      kind: "verbatim",
      sources: ["A1"],
    });
  });

  it("keeps the answer's own closing punctuation", () => {
    const after = answerNeed(paragraph(need.paragraph_id), need, "“Go home and sleep.”", "A1");
    expect(after.sentences[need.after_sentence + 1]?.text).toBe("“Go home and sleep.”");
  });
});
