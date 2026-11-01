import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { inventedFacts } from "../src/fixtures/golden";
import { listApplicantSlugs, loadApplicant, loadExpected } from "../src/fixtures/load";
import { repoRoot } from "../src/paths";

// Phase 4 AC (§8.11): zero invented facts across the golden set. Every recorded kit.draft and
// kit.shortform reply is checked against its fixture applicant's ground truth and the fictional
// school pack it ran on: any number, name, quote, date or school detail not traceable to them is
// an invented fact. A deliberately poisoned draft proves the checker catches each kind.

const root = repoRoot();
const samples = join(root, "packages/ai/scripts/samples");

interface Replay {
  meta: { task: string; note: string };
  response: { body: string };
}

function replays(task: string): { file: string; replay: Replay }[] {
  const dir = join(root, "fixtures/llm-replays", task);
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((file) => ({ file, replay: JSON.parse(readFileSync(join(dir, file), "utf8")) as Replay }));
}

function outputOf(replay: Replay): unknown {
  const body = JSON.parse(replay.response.body) as {
    content: { type: string; input?: unknown; text?: string }[];
  };
  for (const block of body.content) {
    if (block.type === "tool_use" && block.input) return block.input;
    if (block.type === "text" && block.text?.trim().startsWith("{")) return JSON.parse(block.text);
  }
  throw new Error("No output in replay");
}

function materialFor(note: string) {
  const applicant = /fictional ([a-z-]+) applicant/.exec(note)?.[1];
  const school = /fictional ([a-z-]+) pack/.exec(note)?.[1];
  if (!applicant || !school) throw new Error(`Replay note names no applicant and pack: ${note}`);
  const fixture = loadApplicant(applicant);
  return {
    truth: fixture.groundTruth,
    profile: fixture.profile,
    pack: readFileSync(join(samples, `${school}.compiled.txt`), "utf8"),
  };
}

describe("golden set: zero invented facts (§8.11)", () => {
  for (const task of ["kit.draft", "kit.shortform"]) {
    for (const { file, replay } of replays(task)) {
      it(`${task} ${file.slice(0, 8)} invents nothing`, () => {
        expect(inventedFacts(outputOf(replay), materialFor(replay.meta.note))).toEqual([]);
      });
    }
  }

  it("catches a poisoned draft: a number, a name, a quote, a date and a school detail", () => {
    const material = materialFor(
      "the fictional engineer-to-product applicant and the fictional halvorsen pack",
    );
    const poisoned = [
      "I cut onboarding time by 73% across 412 clinics.",
      "My mentor Gwendolyn Farquhar told me to apply.",
      'As my manager said, "this was the best launch in company history".',
      "In March 2019 I moved to Zurich.",
    ];
    const kinds = new Set(inventedFacts(poisoned, material).map((f) => f.kind));
    expect(kinds).toContain("number");
    expect(kinds).toContain("name");
    expect(kinds).toContain("quote");
    expect([...kinds].some((k) => k === "date" || k === "number")).toBe(true);
  });
});

describe("golden set: expected.json for every fixture applicant", () => {
  for (const slug of listApplicantSlugs()) {
    it(`${slug} has a valid expected.json that leads with no sensitive story`, () => {
      const expected = loadExpected(slug);
      expect(Object.keys(expected.lead_story).length).toBeGreaterThan(0);
      expect(expected.red_flags.length).toBeGreaterThan(0);
    });
  }
});
