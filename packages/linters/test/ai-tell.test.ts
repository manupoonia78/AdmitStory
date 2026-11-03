import { describe, expect, it } from "vitest";
import { AI_TELL_NOTE, aiTellIndex } from "../src/ai-tell";
import { fromText } from "./helpers";

const HUMAN = `The only computer in my school sat under a cloth, behind a lock. Mr Dutta had the key.

I asked him for it every Friday for a term. He said no eleven times. The twelfth time he handed it over without looking up, and I ran.

By June I had taught four other kids to type. Nobody asked me to.`;

const GENERATED = `Throughout my career, I have been passionate about leveraging data to drive transformative change.

At my firm, I spearheaded a robust initiative that was strategic, scalable, and impactful. We worked across teams, functions, and regions to deliver results.

In conclusion, this journey has taught me the value of leadership. These experiences have prepared me to embark on the next chapter.`;

describe("aiTellIndex", () => {
  it("says a scene-led, varied draft sounds like you", () => {
    const index = aiTellIndex(fromText(HUMAN));
    expect(index.verdict).toBe("sounds_like_you");
    expect(index.label).toBe("Sounds like you");
    expect(index.reasons).toEqual([]);
  });

  it("says a draft full of tells sounds generated, with its reasons", () => {
    const index = aiTellIndex(fromText(GENERATED));
    expect(index.verdict).toBe("sounds_generated");
    const rules = index.reasons.map((r) => r.rule_id);
    expect(rules).toEqual(
      expect.arrayContaining(["bannedPhrases", "openingThesis", "endingSummary", "tripletDensity"]),
    );
    expect(index.reasons[0]?.weight).toBeGreaterThanOrEqual(index.reasons.at(-1)!.weight);
  });

  it("calls a draft with a couple of tells mixed", () => {
    const index = aiTellIndex(
      fromText(
        `Throughout my career, I have liked maps. ${HUMAN.replace("I ran.", "I leveraged it.")}`,
      ),
    );
    expect(index.verdict).toBe("mixed");
  });

  it("never claims to predict a detector", () => {
    expect(AI_TELL_NOTE).toMatch(/doesn't predict what any detector will say/);
    expect(AI_TELL_NOTE).not.toMatch(/undetectable|detector-proof|bypass/i);
  });
});
