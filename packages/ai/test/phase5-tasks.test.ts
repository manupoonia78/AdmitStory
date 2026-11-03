import { count } from "@admitstory/linters";
import { describe, expect, it } from "vitest";
import { createMemoryLedger } from "../src/ledger";
import { createAI } from "../src/run";
import type { FormsAdviseOutput, ResumeReviewOutput } from "../src/schemas";
import {
  formsAdvise,
  newNames,
  newNumbers,
  normaliseResume,
  resumeReview,
} from "../src/tasks/forms";
import { PHASE5_SAMPLES } from "../scripts/record-phase5";
import {
  ENGINEER_RESUME_TEXT,
  FORMS_ADVISE_COACH_INPUT,
  FORMS_ADVISE_INPUT,
  PHASE5_CTX,
  RESUME_REVIEW_INPUT,
} from "../scripts/samples/phase5";
import { FORMS_ADVISE_REPLIES, RESUME_REVIEW_REPLIES } from "../scripts/samples/phase5-replies";

// Phase 5 AI ACs (§5.10): every recommendation has a reason, every rewritten entry fits its limit
// by the school's counting rule, coach mode writes no entries (§14.2), and nothing is invented —
// a résumé rewrite carries no number or name that isn't in the bullet or the dossier.

const layers = { schoolPack: PHASE5_CTX.schoolPack, dossier: PHASE5_CTX.dossier };
const dossier = PHASE5_CTX.dossier ?? "";
const formsInput = formsAdvise.input.parse(FORMS_ADVISE_INPUT);
const coachInput = formsAdvise.input.parse(FORMS_ADVISE_COACH_INPUT);
const resumeInput = resumeReview.input.parse(RESUME_REVIEW_INPUT);
const clone = <T>(value: T): T => structuredClone(value);

async function replay<T>(index: number): Promise<{ output: T; calls: number }> {
  const sample = PHASE5_SAMPLES[index]!;
  const ledger = createMemoryLedger();
  const ai = createAI({ mode: "replay", ledger });
  const output = (await ai.run(sample.task, sample.input as never, sample.ctx)) as T;
  return { output, calls: ledger.entries.length };
}

describe("Phase 5 tasks in replay mode, end to end through ai.run()", () => {
  PHASE5_SAMPLES.forEach((sample, index) => {
    const mode = (sample.input as { mode?: string }).mode;
    it(`${sample.task}${mode ? ` (${mode})` : ""} returns a validated output`, async () => {
      const { output, calls } = await replay(index);
      expect(output).toBeTruthy();
      expect(calls).toBe(sample.replies.length);
    });
  });
});

describe("forms.advise (§5.10 Form Advisor)", () => {
  it("gives every recommendation a reason, in both modes", async () => {
    for (const index of [0, 1]) {
      const { output } = await replay<FormsAdviseOutput>(index);
      const items = output.sections.flatMap((s) => s.items);
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) expect(item.reason.trim().length).toBeGreaterThan(10);
    }
  });

  it("writes an entry for every item that goes in the form, within the field's limit", async () => {
    const { output } = await replay<FormsAdviseOutput>(0);
    for (const section of output.sections) {
      const spec = formsInput.sections.find((s) => s.key === section.section_key)!;
      for (const item of section.items) {
        const enters = item.recommendation === "lead_with" || item.recommendation === "include";
        expect(item.entry !== null).toBe(enters);
        if (item.entry && spec.limit)
          expect(count(item.entry.text, spec.limit.kind)).toBeLessThanOrEqual(spec.limit.value);
      }
      const entries = section.items.filter((i) => i.entry).length;
      if (spec.item_count_max) expect(entries).toBeLessThanOrEqual(spec.item_count_max);
    }
  });

  it("coach mode writes no entries but keeps reasons and pointers", async () => {
    const { output } = await replay<FormsAdviseOutput>(1);
    const items = output.sections.flatMap((s) => s.items);
    expect(items.every((i) => i.entry === null)).toBe(true);
    expect(items.some((i) => i.stronger.length > 0)).toBe(true);
  });

  it("invents no number: every number in an entry is in the dossier", async () => {
    const { output } = await replay<FormsAdviseOutput>(0);
    for (const item of output.sections.flatMap((s) => s.items))
      if (item.entry) expect(newNumbers(item.entry.text, "", dossier)).toEqual([]);
  });

  describe("rules checked in code", () => {
    const good = (): FormsAdviseOutput => clone(FORMS_ADVISE_REPLIES[1]);
    const issues = (output: FormsAdviseOutput, input = formsInput) =>
      formsAdvise.check!(output, input, layers);

    it("accepts the repaired reply", () => {
      expect(issues(good())).toEqual([]);
    });

    it("flags a combine_with item without its partner (the recorded repair)", () => {
      expect(
        issues(FORMS_ADVISE_REPLIES[0] as FormsAdviseOutput).some((i) =>
          i.path.endsWith("combine_with"),
        ),
      ).toBe(true);
    });

    it("flags an entry in coach mode", () => {
      expect(issues(good(), coachInput).some((i) => i.message.startsWith("Coach mode"))).toBe(true);
    });

    it("flags more entries than the form takes", () => {
      const output = good();
      const honors = output.sections[1]!;
      honors.items = [1, 2, 3, 4].map((n) => ({
        ...honors.items[0]!,
        id: `i${n}`,
        recommendation: "include" as const,
      }));
      expect(issues(output).some((i) => /at most 3/.test(i.message))).toBe(true);
    });

    it("flags an included item without an entry, and an entry on an item that leaves", () => {
      const output = good();
      output.sections[0]!.items[0]!.entry = null;
      output.sections[0]!.items[1]!.entry = { text: "Fixed a go-live.", sources: ["S01"] };
      const paths = issues(output).map((i) => i.path);
      expect(paths).toContain("sections.0.items.0.entry");
      expect(paths).toContain("sections.0.items.1.entry");
    });

    it("flags a cite that isn't in the dossier, an unknown section and a missing one", () => {
      const output = good();
      output.sections[0]!.items[0]!.cites = ["F99"];
      output.sections[1]!.section_key = "awards";
      const messages = issues(output).map((i) => i.message);
      expect(messages.some((m) => m.includes("F99"))).toBe(true);
      expect(messages.some((m) => m.includes('Unknown form section "awards"'))).toBe(true);
      expect(messages.some((m) => m.includes('"honors" section too'))).toBe(true);
    });

    it("flags a move to an essay that doesn't exist", () => {
      const output = good();
      output.sections[0]!.items[2]!.move_to = "essay-9";
      expect(issues(output).some((i) => i.path.endsWith("move_to"))).toBe(true);
    });
  });
});

describe("resume.review (§5.10 Résumé Pass)", () => {
  const good = (): ResumeReviewOutput => clone(RESUME_REVIEW_REPLIES[1]);
  const issues = (output: ResumeReviewOutput) =>
    resumeReview.check!(output, resumeInput, { dossier });

  it("accepts the repaired reply, whose originals are word for word from the résumé", async () => {
    const { output } = await replay<ResumeReviewOutput>(2);
    expect(issues(output)).toEqual([]);
    const source = normaliseResume(ENGINEER_RESUME_TEXT);
    for (const bullet of output.sections.flatMap((s) => s.roles.flatMap((r) => r.bullets)))
      expect(source).toContain(normaliseResume(bullet.original));
  });

  it("gives every bullet feedback and keeps rewrites free of invented numbers and names", async () => {
    const { output } = await replay<ResumeReviewOutput>(2);
    for (const bullet of output.sections.flatMap((s) => s.roles.flatMap((r) => r.bullets))) {
      expect(bullet.feedback.length).toBeGreaterThan(10);
      if (!bullet.rewrite) continue;
      expect(newNumbers(bullet.rewrite.text, bullet.original, dossier)).toEqual([]);
      expect(newNames(bullet.rewrite.text, bullet.original, dossier)).toEqual([]);
    }
  });

  it("flags the invented 30% of the first reply (the recorded repair)", () => {
    const found = issues(RESUME_REVIEW_REPLIES[0] as ResumeReviewOutput);
    expect(found.some((i) => i.message.includes("30%"))).toBe(true);
  });

  it("matches numbers by kind: 30 seconds in the dossier doesn't license 30%", () => {
    expect(newNumbers("cut tickets by 30%", "", "window from 30 to 90 seconds")).toEqual(["30%"]);
    expect(newNumbers("thirteen people", "", "a team of 13")).toEqual([]);
    expect(newNumbers("about 1,100 records", "about 1,100 records", "")).toEqual([]);
  });

  it("flags a reworded original, a new name and mismatched placeholders", () => {
    const output = good();
    const role = output.sections[0]!.roles[0]!;
    role.bullets[0]!.original = "Owned the scheduling module for every hospital";
    role.bullets[1]!.rewrite!.text = "Rewrote retry logic with Kubernetes Operators at Meridian";
    role.bullets[2]!.rewrite!.needs = [];
    const messages = issues(output).map((i) => i.message);
    expect(messages.some((m) => m.startsWith("The original bullet is not in the résumé"))).toBe(
      true,
    );
    expect(messages.some((m) => m.includes("Kubernetes Operators"))).toBe(true);
    expect(messages.some((m) => m.startsWith("Placeholders must be"))).toBe(true);
  });

  it("ignores short acronyms and words that start a sentence", () => {
    expect(newNames("Built ICU dashboards. Shipped it for the US team", "", "")).toEqual([]);
  });

  it("flags a section order that names a section twice or one that doesn't exist", () => {
    const output = good();
    output.section_order.order = ["s1", "s1", "s9"];
    expect(issues(output).some((i) => i.path === "section_order.order")).toBe(true);
  });
});
