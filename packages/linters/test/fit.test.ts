import { describe, expect, it } from "vitest";
import { count } from "../src/count";
import { fitToLimit } from "../src/fit";
import type { LimitKind } from "../src/types";

// §5.10 AC: every rewritten entry fits its limit by the school's counting rule. fitToLimit is the
// guarantee behind the model's own counting: it only ever removes text, and the result fits.

const SAMPLES = [
  "Run a Saturday coding class for 12 government-school students in Bengaluru (since 2023). Rewrote the curriculum and recruited three colleagues; the class has run without me for six months.",
  "Promoted to Senior Software Engineer at Meridian Health Systems in April 2024, two years ahead of the usual track.",
  "Led the night-shift fix — rewrote the retry logic, widened the batch window from 30 to 90 seconds, and wrote the runbook.",
  "Coach for the under-12 football team 🏆⚽ every Sunday; we won the district cup twice.",
  "“Treasurer” of the alumni chapter: rebuilt the budget, cut costs by 18%, and doubled event attendance.",
  "Volunteer nurse at the free clinic, 2021–2024. Triaged 40 patients a shift. Trained 6 new volunteers.",
  "Founded a 40-person running club in Lagos; it now meets three times a week without me.",
  "Mentor, Women in Engineering (2022–present) — 8 mentees, 5 promoted within a year.",
  "Raised $12,000 for flood relief in 2023 with a 24-hour coding marathon 💻.",
  "Captain, university debating team: national semi-finalists, 2019. Coached first-years the following season.",
  "Organised a 300-person career fair for first-generation students; 22 got internships.",
  "Board member, neighbourhood housing association; negotiated the 2024 maintenance contract.",
  "Translated 14 public-health leaflets into Vietnamese for the city council’s clinic network.",
  "Ran 6 marathons — Berlin, Chicago, Tokyo; raised money for a children’s hospital each time.",
  "Built a volunteer rota app used by 3 food banks; cut no-shows from 30% to 8%.",
  "Teach chess to 15 kids at the community centre ♟️ on Thursdays; two now play in national juniors.",
  "Elected class representative; brought the 120-student cohort’s feedback to the dean twice a term.",
  "Started a reading circle at the plant: 25 operators, one book a month, four years running.",
  "Wrote the onboarding guide—now used by every new analyst—and run its quarterly refresh.",
  "日本語のボランティア通訳として、毎月二回、地域の病院で患者さんを支援しています。",
];

const KINDS: LimitKind[] = ["chars_incl_spaces", "chars_excl_spaces", "words"];

describe("fitToLimit (§5.10)", () => {
  it("leaves text that already fits untouched", () => {
    for (const text of SAMPLES) {
      const result = fitToLimit(text, { kind: "chars_incl_spaces", value: 1_000 });
      expect(result).toEqual({ text, trimmed: false, count: count(text, "chars_incl_spaces") });
    }
  });

  it("makes all 20 samples fit tight limits, under every counting rule", () => {
    for (const text of SAMPLES)
      for (const kind of KINDS) {
        const full = count(text, kind);
        for (const share of [0.9, 0.7, 0.5, 0.3]) {
          const value = Math.max(1, Math.floor(full * share));
          const result = fitToLimit(text, { kind, value });
          expect(count(result.text, kind), `${kind} ${value}: ${result.text}`).toBeLessThanOrEqual(
            value,
          );
          expect(result.count).toBe(count(result.text, kind));
          expect(result.trimmed).toBe(true);
        }
      }
  });

  it("only removes text: what's left is the original's own words, in order", () => {
    const words = (s: string) => s.replace(/[.,;:—–-]+$/u, "").split(/\s+/u);
    for (const text of SAMPLES.filter((t) => /\s/u.test(t))) {
      const result = fitToLimit(text, { kind: "words", value: 6 });
      const kept = words(result.text).map((w) => w.replace(/[.,;:—–-]+$/u, ""));
      const source = text.split(/\s+/u).map((w) => w.replace(/[.,;:—–-]+$/u, ""));
      expect(source.slice(0, kept.length)).toEqual(kept);
    }
  });

  it("cuts text written without spaces by characters, never to nothing", () => {
    const text = SAMPLES.at(-1)!;
    const result = fitToLimit(text, { kind: "chars_incl_spaces", value: 10 });
    expect(result.text).toBe(text.slice(0, 10));
  });

  it("drops whole trailing sentences before cutting inside one", () => {
    const text = "Rewrote the curriculum. Recruited three colleagues. The class runs without me.";
    expect(fitToLimit(text, { kind: "chars_incl_spaces", value: 55 }).text).toBe(
      "Rewrote the curriculum. Recruited three colleagues.",
    );
  });

  it("ends a cut clause cleanly, without a dangling conjunction or comma", () => {
    const result = fitToLimit(
      "Captain of the team, national semi-finalists in 2019, and coach of the first-years",
      { kind: "chars_incl_spaces", value: 60 },
    );
    expect(result.text).toBe("Captain of the team, national semi-finalists in 2019.");
  });

  it("counts an emoji as one character and curly quotes as one", () => {
    const result = fitToLimit("Coach 🏆 “every” Sunday. More.", {
      kind: "chars_incl_spaces",
      value: 23,
    });
    expect(result.text).toBe("Coach 🏆 “every” Sunday.");
    expect(result.count).toBe(23);
  });

  it("has nothing to fit without a limit", () => {
    expect(fitToLimit("  Anything at all.  ", null)).toEqual({
      text: "Anything at all.",
      trimmed: false,
      count: 0,
    });
  });
});
