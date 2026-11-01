import { describe, expect, it } from "vitest";
import { selectEscalation, criticFailsStructure } from "../src/escalation";
import { estimateKitCost, KIT_GENERATION_RANGE_USD } from "../src/cost";
import { createMemoryLedger } from "../src/ledger";
import { ROUTES } from "../src/routing";
import { createAI } from "../src/run";
import { applyPatches, patchGuardIssues } from "../src/tasks/draft";
import { PHASE4_SAMPLES } from "../scripts/record-phase4";

// Phase 4 AI ACs (§5.7, §5.8, §8.3, §8.6): every writing task runs end to end in replay mode
// through ai.run(), patches never touch locked or hand-edited paragraphs, escalation happens once
// after two structural failures, and a kit's cost comes from the ledger.

describe("Phase 4 tasks in replay mode, end to end through ai.run()", () => {
  for (const sample of PHASE4_SAMPLES) {
    const mode = (sample.input as { mode?: string }).mode;
    it(`${sample.task}${mode ? ` (${mode})` : ""} returns a validated output`, async () => {
      const ledger = createMemoryLedger();
      const ai = createAI({ mode: "replay", ledger });
      const output = await ai.run(sample.task, sample.input as never, sample.ctx);
      expect(output).toBeTruthy();
      expect(ledger.entries.length).toBe(sample.replies.length);
      expect(ledger.entries[0]?.task).toBe(sample.task);
      if (sample.task === "kit.draft") {
        const draft = output as { draft: unknown; coach: unknown };
        // Exactly one of the two, matching the mode (§8.10).
        expect(mode === "coach" ? draft.coach : draft.draft).not.toBeNull();
        expect(mode === "coach" ? draft.draft : draft.coach).toBeNull();
      }
      if (sample.task === "kit.critic") {
        const scores = (output as { scores: Record<string, number> }).scores;
        for (const v of Object.values(scores)) expect(v).toBeGreaterThanOrEqual(1);
      }
    });
  }
});

const sentence = (text: string) => ({ text, kind: "composed" as const, sources: [] });
const paragraphs = [
  { id: "p1", sentences: [sentence("One.")] },
  { id: "p2", sentences: [sentence("Two.")] },
  { id: "p3", sentences: [sentence("Three.")] },
];

describe("patch guards (§8.6, §5.8)", () => {
  const rules = {
    paragraphIds: ["p1", "p2", "p3"],
    targets: ["p2"],
    locked: ["p1"],
    userEdited: ["p3"],
  };

  it("allows a patch on a targeted, unlocked, untouched paragraph", () => {
    const patches = [
      { op: "replace" as const, paragraph_id: "p2", sentences: [sentence("Two, better.")] },
    ];
    expect(patchGuardIssues(patches, rules)).toEqual([]);
    const next = applyPatches(paragraphs, patches, () => "p4");
    expect(next.map((p) => p.sentences[0]!.text)).toEqual(["One.", "Two, better.", "Three."]);
  });

  it("rejects a locked, a hand-edited or an untargeted paragraph", () => {
    for (const id of ["p1", "p3"])
      expect(
        patchGuardIssues([{ op: "replace", paragraph_id: id, sentences: [sentence("x")] }], {
          ...rules,
          targets: ["p1", "p2", "p3"],
        }).length,
      ).toBeGreaterThan(0);
    expect(
      patchGuardIssues([{ op: "delete", paragraph_id: "p3", sentences: null }], rules).length,
    ).toBeGreaterThan(0);
  });
});

describe("escalation (§8.3)", () => {
  const pass = { findings: [], scores: { answers_prompt: 4, story_quality: 4, voice_fidelity: 4 } };
  const fail = { findings: [], scores: { answers_prompt: 2, story_quality: 4, voice_fidelity: 4 } };

  it("accepts a passing draft, retries the first failure, escalates the second, once", () => {
    expect(criticFailsStructure(fail)).toBe(true);
    expect(selectEscalation("kit.draft", { reports: [pass], escalated: false }).action).toBe(
      "accept",
    );
    expect(selectEscalation("kit.draft", { reports: [fail], escalated: false }).action).toBe(
      "retry",
    );
    const second = selectEscalation("kit.draft", { reports: [fail, fail], escalated: false });
    expect(second.action).toBe(ROUTES["kit.draft"].escalation ? "escalate" : "keep");
    expect(
      selectEscalation("kit.draft", { reports: [fail, fail, fail], escalated: true }).action,
    ).toBe("keep");
  });
});

describe("kit cost from the ledger (§12.2)", () => {
  it("sums ledger rows and compares them with the expected range", () => {
    const estimate = estimateKitCost([
      { task: "kit.positioning_filemap", costUsd: 0.32 },
      { task: "kit.draft", costUsd: 0.6 },
      { task: "kit.critic", costUsd: 0.2 },
      { task: "kit.shortform", costUsd: 0.25 },
    ] as never);
    expect(estimate.totalUsd).toBeCloseTo(1.37, 2);
    expect(estimate.totalUsd).toBeGreaterThanOrEqual(KIT_GENERATION_RANGE_USD.low);
    expect(estimate.totalUsd).toBeLessThanOrEqual(KIT_GENERATION_RANGE_USD.high);
  });
});
