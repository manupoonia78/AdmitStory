import type { ValidationIssue } from "../errors";
import { untrustedBlock } from "../request";
import { EvalJudgeInput, EvalJudgeOutput } from "../schemas/evals";
import { defineTask } from "./define";

const normalise = (text: string) =>
  text.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();

/** eval.judge (spec §8.11): scores one output against its fixture's ground truth. */
export const evalJudge = defineTask({
  name: "eval.judge",
  agent: "eval.judge",
  input: EvalJudgeInput,
  output: EvalJudgeOutput,
  outputName: "EvalJudgeOutput",
  buildMessages: (input) => [
    {
      role: "user",
      content: [
        `Task under evaluation: ${input.task}`,
        `Fixture: ${input.fixture.applicant}${input.fixture.school ? ` applying to ${input.fixture.school}` : ""}`,
        input.promptText ? untrustedBlock("question", input.promptText) : "",
        untrustedBlock("ground_truth", input.groundTruth),
        input.voiceSample ? untrustedBlock("voice_sample", input.voiceSample) : "",
        input.packExcerpt ? untrustedBlock("school_pack", input.packExcerpt) : "",
        untrustedBlock("output", input.outputText),
        "Judge the output against the rubric. Quote invented facts exactly as they appear in the output.",
      ]
        .filter((part) => part !== "")
        .join("\n\n"),
    },
  ],
  check(output, input): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const haystack = normalise(input.outputText);
    output.invented_facts.forEach((fact, i) => {
      if (!haystack.includes(normalise(fact.text)))
        issues.push({
          path: `invented_facts.${i}.text`,
          message: "Quote the invented fact exactly as it appears in the output",
        });
    });
    const words = output.summary.split(/\s+/).filter(Boolean).length;
    if (words > 60)
      issues.push({ path: "summary", message: `The summary is ${words} words; keep it to 60` });
    return issues;
  },
});
