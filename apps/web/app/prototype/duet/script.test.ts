import { describe, expect, it } from "vitest";
import { MOCK, TURNS, advanceScript, captionsAt, planDuet, speakerAt } from "./script";

const plan = planDuet(TURNS);

describe("live mock script", () => {
  it("names a fictional school and keeps its details as separate items", () => {
    expect(MOCK.title).toBe("Northfield mock");
    expect(MOCK.details).toEqual(["Admissions officer", "File-read", "30 min"]);
    for (const detail of MOCK.details) expect(detail).not.toMatch(/[·|]/);
  });

  it("alternates speakers, opening and closing with the interviewer", () => {
    TURNS.forEach((turn, i) => {
      expect(turn.speaker).toBe(i % 2 === 0 ? "interviewer" : "you");
      expect(turn.text).not.toMatch(/!/);
    });
    expect(TURNS.at(-1)?.speaker).toBe("interviewer");
  });
});

describe("planDuet", () => {
  it("puts a gap between turns and keeps each speaker's voice in its own turns", () => {
    for (let i = 1; i < plan.turns.length; i += 1) {
      expect(plan.turns[i]!.startMs).toBeGreaterThan(plan.turns[i - 1]!.endMs);
    }
    for (const span of plan.spans.interviewer) {
      expect(speakerAt(plan, span.startMs)).toBe("interviewer");
    }
    for (const span of plan.spans.you) expect(speakerAt(plan, span.startMs)).toBe("you");
  });

  it("keeps caption timings relative to the start of each turn", () => {
    for (const turn of plan.turns) {
      expect(turn.words[0]?.startMs).toBe(0);
      expect(turn.startMs + (turn.words.at(-1)?.endMs ?? 0)).toBe(turn.endMs);
    }
  });
});

describe("speakerAt", () => {
  it("is nobody before the first word, between turns and after the last", () => {
    const [first, second] = plan.turns;
    expect(speakerAt(plan, 0)).toBeNull();
    expect(speakerAt(plan, first!.startMs)).toBe("interviewer");
    expect(speakerAt(plan, first!.endMs + 1)).toBeNull();
    expect(speakerAt(plan, second!.startMs)).toBe("you");
    expect(speakerAt(plan, plan.endMs + 1)).toBeNull();
  });
});

describe("captionsAt", () => {
  it("shows nothing before the first question", () => {
    expect(captionsAt(plan, 0)).toEqual({ interviewer: null, you: null });
  });

  it("keeps the question up while you answer, and clears your answer at the next question", () => {
    expect(captionsAt(plan, plan.turns[1]!.startMs)).toEqual({ interviewer: 0, you: 1 });
    expect(captionsAt(plan, plan.turns[2]!.startMs - 1)).toEqual({ interviewer: 0, you: 1 });
    expect(captionsAt(plan, plan.turns[2]!.startMs)).toEqual({ interviewer: 2, you: null });
  });
});

describe("advanceScript", () => {
  it("runs freely when you are not waiting", () => {
    expect(advanceScript(plan, 1000, 16, false)).toBe(1016);
    expect(advanceScript(plan, 1000, -5, false)).toBe(1000);
  });

  it("holds just before the interviewer's next turn while you need a moment", () => {
    const next = plan.turns[2]!.startMs;
    const held = advanceScript(plan, next - 10, 500, true);
    expect(held).toBe(next - 1);
    expect(speakerAt(plan, held)).toBeNull();
    expect(advanceScript(plan, held, 500, true)).toBe(held);
    expect(advanceScript(plan, held, 500, false)).toBe(held + 500);
  });

  it("never cuts off a question already under way", () => {
    const question = plan.turns[2]!;
    const during = question.startMs + 100;
    expect(advanceScript(plan, during, 50, true)).toBe(during + 50);
  });
});
