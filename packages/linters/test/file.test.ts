import { describe, expect, it } from "vitest";
import { limit, lineReuse, lorOverlap, ngrams, promptParts, storyReuse } from "../src/linters/file";
import type { DeliverableContext } from "../src/types";
import { doc, fromText, para } from "./helpers";

const deliverable = (over: Partial<DeliverableContext> = {}): DeliverableContext => ({
  key: "essay_1",
  label: "Essay 1",
  primaryStory: "S01",
  otherDeliverables: [],
  formFields: [],
  ...over,
});

describe("limit", () => {
  it("is a must fix when over the pack's word limit", () => {
    const [f] = limit(fromText("one two three four five six"), {
      limit: { kind: "words", value: 5 },
    });
    expect(f).toMatchObject({
      rule_id: "limit",
      severity: "must",
      location: { paragraph_id: null, sentence: null },
    });
    expect(f?.explanation).toBe("1 word over the 5-word limit.");
  });

  it("counts characters the way the pack says, after portal normalisation", () => {
    const d = fromText("“Hi” there.");
    expect(limit(d, { limit: { kind: "chars_incl_spaces", value: 11 } })).toEqual([]);
    expect(limit(d, { limit: { kind: "chars_excl_spaces", value: 10 } })).toEqual([]);
    expect(limit(d, { limit: { kind: "chars_excl_spaces", value: 9 } })[0]?.severity).toBe("must");
  });

  it("is a consider when under 85% of the limit", () => {
    const [f] = limit(fromText("one two three four five six seven eight"), {
      limit: { kind: "words", value: 10 },
    });
    expect(f?.severity).toBe("consider");
  });

  it("is quiet within range or without a rule", () => {
    expect(
      limit(fromText("one two three four five six seven eight nine"), {
        limit: { kind: "words", value: 10 },
      }),
    ).toEqual([]);
    expect(limit(fromText("one two"))).toEqual([]);
  });
});

describe("storyReuse", () => {
  it("is a must fix when another deliverable of this school has the same primary story", () => {
    const ctx = {
      deliverable: deliverable({
        otherDeliverables: [
          { key: "essay_2", label: "Essay 2", primaryStory: "S01", plainText: "" },
        ],
      }),
    };
    const [f] = storyReuse(fromText("Anything."), ctx);
    expect(f?.severity).toBe("must");
    expect(f?.explanation).toContain("Essay 2");
  });

  it("passes a different story, and ignores the deliverable itself", () => {
    const ctx = {
      deliverable: deliverable({
        otherDeliverables: [
          { key: "essay_2", primaryStory: "S02", plainText: "" },
          { key: "essay_1", primaryStory: "S01", plainText: "" },
        ],
      }),
    };
    expect(storyReuse(fromText("Anything."), ctx)).toEqual([]);
    expect(storyReuse(fromText("Anything."))).toEqual([]);
  });
});

describe("lineReuse", () => {
  const essay2 = "The night shift had not slept in two days when the generator failed.";

  it("normalises case, punctuation and curly apostrophes into six-word sequences", () => {
    expect(ngrams("It’s the END, of the world now!")).toEqual(
      new Set(["it's the end of the world", "the end of the world now"]),
    );
  });

  it("is a must fix for a six-word overlap with another deliverable of this school", () => {
    const d = doc(
      para("p1", "I remember it well.", "By then the NIGHT shift had not slept, again."),
    );
    const ctx = {
      deliverable: deliverable({
        otherDeliverables: [
          { key: "essay_2", label: "Essay 2", primaryStory: "S02", plainText: essay2 },
        ],
      }),
    };
    const f = lineReuse(d, ctx);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ severity: "must", location: { paragraph_id: "p1", sentence: 1 } });
    expect(f[0]?.explanation).toContain("Essay 2");
  });

  it("checks form fields too", () => {
    const d = fromText("I managed a portfolio of nine retail clients in Pune.");
    const ctx = {
      deliverable: deliverable({
        formFields: ["Managed a portfolio of nine retail clients across two cities"],
      }),
    };
    expect(lineReuse(d, ctx)[0]?.explanation).toContain("application form");
  });

  it("passes a five-word overlap and only ever sees this school's material", () => {
    const d = fromText("The night shift had not eaten.");
    const ctx = {
      deliverable: deliverable({
        otherDeliverables: [{ key: "essay_2", primaryStory: null, plainText: essay2 }],
      }),
    };
    expect(lineReuse(d, ctx)).toEqual([]);
    expect(lineReuse(fromText(essay2))).toEqual([]);
  });
});

describe("lorOverlap", () => {
  const bullets = [{ story: "S01", text: "She rebuilt the night roster after the outage." }];
  const same = () => 0.9;

  it("does nothing without brief bullets or a similarity function", () => {
    const d = fromText("I rebuilt the roster.");
    expect(lorOverlap(d, { deliverable: deliverable(), similarity: same })).toEqual([]);
    expect(lorOverlap(d, { deliverable: deliverable({ briefBullets: bullets }) })).toEqual([]);
  });

  it("is a should fix above 0.85 on the same story", () => {
    const d = fromText("I rebuilt the roster.");
    const [f] = lorOverlap(d, {
      deliverable: deliverable({ briefBullets: bullets }),
      similarity: same,
    });
    expect(f).toMatchObject({
      rule_id: "lorOverlap",
      severity: "should",
      location: { paragraph_id: "p1", sentence: null },
    });
  });

  it("passes a different story or a lower similarity", () => {
    const d = fromText("I rebuilt the roster.");
    const other = [{ story: "S07", text: bullets[0]!.text }];
    expect(
      lorOverlap(d, {
        deliverable: deliverable({ primaryStory: null, briefBullets: other }),
        similarity: same,
      }),
    ).toEqual([]);
    expect(
      lorOverlap(d, {
        deliverable: deliverable({ briefBullets: bullets }),
        similarity: () => 0.85,
      }),
    ).toEqual([]);
  });
});

describe("promptParts (CRAFT-20)", () => {
  const parts = ["What are your goals?", "Why now?"];

  it("is a must fix for each part no paragraph answers", () => {
    const d = doc(para("p1", "I want to run a clinic."));
    const f = promptParts(d, {
      promptParts: { parts, answered: [{ part: "what are your goals?", paragraph_ids: ["p1"] }] },
    });
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({
      severity: "must",
      fix_hint: "Answer part 2 of the prompt better",
    });
  });

  it("ignores mappings to paragraphs that no longer exist", () => {
    const d = doc(para("p1", "I want to run a clinic."));
    const answered = [
      { part: parts[0]!, paragraph_ids: ["p1"] },
      { part: parts[1]!, paragraph_ids: ["p9"] },
    ];
    expect(promptParts(d, { promptParts: { parts, answered } })).toHaveLength(1);
  });

  it("matches a reworded part by position, but not one that names another part", () => {
    const d = doc(para("p1", "Goals."), para("p2", "Now."));
    const reworded = [
      { part: "Your goals", paragraph_ids: ["p1"] },
      { part: "Why is now the right time", paragraph_ids: ["p2"] },
    ];
    expect(promptParts(d, { promptParts: { parts, answered: reworded } })).toEqual([]);
    const sameTwice = [
      { part: "What are your goals", paragraph_ids: ["p1"] },
      { part: "what are your goals?", paragraph_ids: ["p2"] },
    ];
    expect(promptParts(d, { promptParts: { parts, answered: sameTwice } })).toHaveLength(1);
  });

  it("passes when every part is mapped", () => {
    const d = doc(para("p1", "Goals."), para("p2", "Now."));
    const answered = [
      { part: parts[0]!, paragraph_ids: ["p1"] },
      { part: parts[1]!, paragraph_ids: ["p2"] },
    ];
    expect(promptParts(d, { promptParts: { parts, answered } })).toEqual([]);
    expect(promptParts(d)).toEqual([]);
  });
});
