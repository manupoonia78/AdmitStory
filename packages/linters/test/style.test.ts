import { describe, expect, it } from "vitest";
import {
  bannedPhrases,
  constructions,
  contextRatio,
  countDashes,
  countTriplets,
  dashDensity,
  endingSummary,
  firstActionIndex,
  formatting,
  jargon,
  openingThesis,
  rhythm,
  tripletDensity,
  weHiding,
} from "../src/linters/style";
import { doc, fromText, para, s } from "./helpers";

describe("bannedPhrases (TELL-01)", () => {
  it("flags canon phrases case-insensitively, inflections included", () => {
    const d = fromText(
      "I Leveraged the data. She spearheaded the rollout. It was a testament to the team.",
    );
    const f = bannedPhrases(d);
    expect(f.map((x) => x.location.sentence)).toEqual([0, 1, 2]);
    expect(f.every((x) => x.rule_id === "bannedPhrases" && x.severity === "should")).toBe(true);
    expect(f[0]!.explanation).toContain('"Leveraged"');
  });

  it("respects word boundaries", () => {
    expect(
      bannedPhrases(fromText("The robustness tests passed. Her passions were cooking.")),
    ).toEqual([]);
    expect(bannedPhrases(fromText("A wavering voice. The delivery van."))).toEqual([]);
  });

  it("flags 'journey' about oneself only", () => {
    expect(bannedPhrases(fromText("My journey began in finance."))).toHaveLength(1);
    expect(bannedPhrases(fromText("This personal journey changed me."))).toHaveLength(1);
    expect(bannedPhrases(fromText("The journey from the village took six hours."))).toEqual([]);
  });

  it("flags Moreover/Furthermore only at sentence start, with a safe patch", () => {
    const d = doc(para("p1", "I called her.", "Moreover, she called back."));
    const [f] = bannedPhrases(d);
    expect(f?.location).toEqual({ paragraph_id: "p1", sentence: 1 });
    expect(f?.patch?.sentences?.[1]?.text).toBe("She called back.");
    expect(f?.patch?.sentences?.[0]?.text).toBe("I called her.");
    expect(bannedPhrases(fromText("It was cheaper and, moreover, faster."))).toEqual([]);
  });

  it("is quiet on clean prose", () => {
    expect(
      bannedPhrases(
        fromText("She had been on the call for forty minutes. Nobody had asked her anything."),
      ),
    ).toEqual([]);
  });
});

describe("constructions (TELL-02)", () => {
  it("flags 'It was then that I realised', announcing sentences and rhetorical openers", () => {
    const d = doc(
      para("p1", "What makes a good leader?", "It was then that I realised I had been wrong."),
      para("p2", "Let me explain how it started.", "I sat down."),
    );
    const rules = constructions(d).map((f) => f.location);
    expect(rules).toContainEqual({ paragraph_id: "p1", sentence: 0 });
    expect(rules).toContainEqual({ paragraph_id: "p1", sentence: 1 });
    expect(rules).toContainEqual({ paragraph_id: "p2", sentence: 0 });
  });

  it("flags 'not only… but also' only when it repeats", () => {
    expect(constructions(fromText("It was not only late but also cold."))).toEqual([]);
    expect(
      constructions(
        fromText("It was not only late but also cold. He was not only tired but also hungry."),
      ),
    ).toHaveLength(1);
  });

  it("does not treat a quoted question as a rhetorical opener", () => {
    expect(constructions(fromText(`"Can you stay late?" she asked.`))).toEqual([]);
  });
});

describe("formatting (TELL-03)", () => {
  it("flags headings, bullets and bold", () => {
    const d = doc(para("p1", "## Why me", "- I led the team.", "It was **hard**.", "Plain line."));
    expect(formatting(d).map((f) => f.location.sentence)).toEqual([0, 1, 2]);
  });

  it("leaves a hyphenated word or a dash alone", () => {
    expect(formatting(fromText("A well-known fix — finally."))).toEqual([]);
  });
});

describe("openingThesis (CRAFT-01)", () => {
  it.each([
    "Throughout my career, I have led teams.",
    "I have always been fascinated by healthcare.",
    "Ever since I was a child, I loved maps.",
    "In today's economy, leaders must adapt.",
    "Leadership is defined as the art of influence.",
  ])("flags %s", (opening) => {
    const [f] = openingThesis(fromText(`${opening} Then more.`));
    expect(f?.severity).toBe("should");
    expect(f?.location).toEqual({ paragraph_id: "p1", sentence: 0 });
  });

  it("passes a scene opening", () => {
    expect(
      openingThesis(fromText("The only computer in my school sat under a cloth, behind a lock.")),
    ).toEqual([]);
  });

  it("checks only the first sentence", () => {
    expect(
      openingThesis(
        fromText("The phone rang at 2 a.m. Throughout my career, that sound meant trouble."),
      ),
    ).toEqual([]);
  });
});

describe("endingSummary (CRAFT-14)", () => {
  it("flags a last paragraph that starts with a summary marker", () => {
    const d = fromText("The van broke down.\n\nIn conclusion, this taught me resilience.");
    expect(endingSummary(d)).toEqual([
      expect.objectContaining({
        severity: "should",
        location: { paragraph_id: "p2", sentence: 0 },
      }),
    ]);
  });

  it("flags a last paragraph dominated by summary lines", () => {
    const d = fromText(
      "The van broke down.\n\nShe drove home. This taught me patience. I learned the value of listening.",
    );
    expect(endingSummary(d)).toHaveLength(1);
  });

  it("passes an ending that lands on an image", () => {
    const d = fromText(
      "The van broke down.\n\nThe next Monday, the same van was parked outside, washed.",
    );
    expect(endingSummary(d)).toEqual([]);
  });
});

describe("weHiding (CRAFT-08)", () => {
  it("flags a paragraph with two or more 'we' and no 'I'", () => {
    expect(weHiding(fromText("We shipped the fix. We were proud."))).toHaveLength(1);
  });

  it("passes when the applicant appears, and ignores 'we' inside dialogue", () => {
    expect(weHiding(fromText("We shipped the fix. We were proud, and I said so."))).toEqual([]);
    expect(weHiding(fromText(`"We can't, we won't," she said. Nobody moved.`))).toEqual([]);
  });
});

describe("tripletDensity", () => {
  it("counts three-part lists and rejects clause boundaries", () => {
    expect(countTriplets("I was curious, driven, and resilient.")).toBe(1);
    expect(countTriplets("We covered strategy, operations and finance.")).toBe(1);
    expect(countTriplets("When I arrived, the team and I sat down.")).toBe(0);
  });

  it("flags more than one per 150 words", () => {
    const d = fromText("I was curious, driven, and resilient. The work was fast, messy and loud.");
    const [f] = tripletDensity(d);
    expect(f?.severity).toBe("consider");
  });

  it("passes a single list", () => {
    expect(tripletDensity(fromText("I was curious, driven, and resilient. Then I left."))).toEqual(
      [],
    );
  });
});

describe("rhythm (CRAFT-04)", () => {
  it("flags uniform sentence lengths", () => {
    const d = fromText(
      "I walked into the room at nine. She looked up from her desk then. We talked about the plan for weeks. He wrote the numbers on the board. They agreed to try it next month.",
    );
    expect(rhythm(d)).toEqual([
      expect.objectContaining({ rule_id: "rhythm", severity: "consider" }),
    ]);
  });

  it("passes varied lengths", () => {
    const d = fromText(
      "I walked into the room at nine and found the whole night shift waiting for me by the broken printer. Nobody spoke. She looked up. Then the regional director, who had flown in that morning without telling anyone, asked me what I planned to do. I told him.",
    );
    expect(rhythm(d)).toEqual([]);
  });

  it("does not judge fewer than five sentences", () => {
    expect(rhythm(fromText("One two three. Four five six."))).toEqual([]);
  });
});

describe("dashDensity", () => {
  it("counts em dashes and spaced en dashes", () => {
    expect(countDashes("a—b – c -- d well-known")).toBe(3);
  });

  it("flags more than one dash per 100 words", () => {
    expect(dashDensity(fromText("I called—twice—and waited. Then—nothing."))).toHaveLength(1);
  });

  it("never flags a single dash", () => {
    expect(dashDensity(fromText("I called—and waited."))).toEqual([]);
  });
});

describe("contextRatio (CRAFT-09)", () => {
  const background =
    "The hospital served four districts. Its records system was twenty years old. Staff turnover was high. Budgets were tight every year.";

  it("flags more than 15% background before the action (heuristic)", () => {
    const d = fromText(
      `${background} I called the night nurse at two. She picked up on the first ring.`,
    );
    expect(firstActionIndex(d)).toBe(4);
    const [f] = contextRatio(d);
    expect(f?.severity).toBe("should");
    expect(f?.location).toEqual({ paragraph_id: "p1", sentence: 4 });
  });

  it("uses the Critic's tag when given", () => {
    const d = fromText(`${background} I called the night nurse at two.`);
    expect(contextRatio(d, { firstActionSentence: { paragraph_id: "p1", sentence: 0 } })).toEqual(
      [],
    );
  });

  it("passes when the story starts at once, and stays quiet when no action is found", () => {
    expect(
      contextRatio(
        fromText("I called the night nurse at two. The hospital served four districts."),
      ),
    ).toEqual([]);
    expect(contextRatio(fromText(background))).toEqual([]);
  });
});

describe("jargon (CRAFT-19)", () => {
  it("flags an unexplained domain acronym once", () => {
    const f = jargon(fromText("We missed every KPI. The KPIs kept slipping."));
    expect(f).toHaveLength(1);
    expect(f[0]?.location).toEqual({ paragraph_id: "p1", sentence: 0 });
  });

  it("passes an explained acronym and common ones", () => {
    expect(jargon(fromText("We tracked key performance indicators (KPIs) weekly."))).toEqual([]);
    expect(jargon(fromText("The OKR (objective and key result) was clear."))).toEqual([]);
    expect(jargon(fromText("The CEO wanted an MBA hire."))).toEqual([]);
  });

  it("takes extra terms from context", () => {
    expect(jargon(fromText("The HCP said no."), { jargonTerms: ["HCP"] })).toHaveLength(1);
  });

  it("works on composed sentences too", () => {
    expect(jargon(doc(para("p1", s("EBITDA rose.", "composed", []))))).toHaveLength(1);
  });
});
