// The Story Studio tasks (spec §8.5.1–8.5.3) and the document importer (§8.5.2). Each one turns its
// typed input into the message turns that follow the cached system prefix: the canon subset, the
// school pack and the compact dossier are layers ai.run() adds, never part of these messages.

import { untrustedBlock } from "../request";
import {
  ApplicantSimulatorInput,
  ApplicantSimulatorOutput,
  ExtractionOutput,
  ImportParseInput,
  StudioConsolidateInput,
  StudioConsolidateOutput,
  StudioExtractInput,
  StudioInterviewerInput,
  StudioInterviewerOutput,
} from "../schemas";
import { defineTask } from "./define";

/** A labelled block of facts for a prompt, one per line, or a short "none" line. */
function lines(label: string, entries: readonly string[]): string {
  return entries.length === 0 ? `${label}: none` : `${label}:\n${entries.join("\n")}`;
}

export const studioInterviewer = defineTask({
  name: "studio.interviewer",
  agent: "studio.interviewer",
  input: StudioInterviewerInput,
  output: StudioInterviewerOutput,
  outputName: "StudioInterviewerOutput",
  buildMessages: (input) => {
    const history = input.recentTurns
      .map((turn) => `${turn.role === "ai" ? "You" : "Applicant"}: ${turn.text}`)
      .join("\n");

    const briefing = [
      `Chapter: ${input.chapter} — ${input.chapterGathers}`,
      `Target slot: ${input.targetSlot}`,
      `Seed question to rephrase and personalise: ${input.seedQuestion}`,
      `DIG turns already used on the current story: ${input.digsUsedOnStory}`,
      input.hurried ? "The applicant is short on time: prefer NEXT and keep it short." : null,
      input.offerPause
        ? "A pause point is due: you may note that this is a good place to stop."
        : null,
      lines(
        "Facts the last answer may contradict",
        input.possibleConflicts.map(
          (conflict) =>
            `  ${conflict.code} ${conflict.key}: known "${conflict.knownValue}", just said "${conflict.justSaid}"`,
        ),
      ),
    ]
      .filter((line): line is string => line !== null)
      .join("\n");

    const answer =
      input.lastAnswer.trim() === ""
        ? "This is the first question of the session: there is no last answer."
        : untrustedBlock("last_answer", input.lastAnswer);

    return [
      {
        role: "user",
        content: [
          briefing,
          history === "" ? "" : untrustedBlock("recent_turns", history),
          answer,
          "Decide your move and ask your one question.",
        ]
          .filter((part) => part !== "")
          .join("\n\n"),
      },
    ];
  },
});

export const studioExtract = defineTask({
  name: "studio.extract",
  agent: "studio.extract",
  input: StudioExtractInput,
  output: ExtractionOutput,
  outputName: "ExtractionOutput",
  buildMessages: (input) => {
    const context = [
      `Chapter: ${input.chapter}`,
      input.targetSlot ? `The question targeted the slot: ${input.targetSlot}` : null,
      input.language && !/^en(-|$)/i.test(input.language)
        ? `Language of the answer: ${input.language} (not English: follow the rules for answers in another language)`
        : null,
      lines(
        "Known facts (for conflicts; do not re-report them as new facts)",
        input.knownFacts.map(
          (fact) => `  ${fact.code} ${fact.key} = ${JSON.stringify(fact.value)}`,
        ),
      ),
      lines(
        "Stories already on the shelf (do not propose these again)",
        input.knownStories.map((story) => `  ${story.code} ${JSON.stringify(story.nickname)}`),
      ),
    ]
      .filter((line): line is string => line !== null)
      .join("\n");

    return [
      {
        role: "user",
        content: [
          context,
          untrustedBlock("answer", input.text),
          "Extract the facts, story candidates, golden lines, sensitive spans and conflicts. Character offsets count from 0 into the answer text above, excluding the block tags.",
        ].join("\n\n"),
      },
    ];
  },
});

export const importParse = defineTask({
  name: "import.parse",
  agent: "import.parse",
  input: ImportParseInput,
  output: ExtractionOutput,
  outputName: "ExtractionOutput",
  buildMessages: (input) => {
    const context = [
      `Document kind: ${input.documentKind}`,
      input.fileName === "" ? null : `File name: ${input.fileName}`,
      lines(
        "Known facts (for conflicts; do not re-report them as new facts)",
        input.knownFacts.map(
          (fact) => `  ${fact.code} ${fact.key} = ${JSON.stringify(fact.value)}`,
        ),
      ),
    ]
      .filter((line): line is string => line !== null)
      .join("\n");

    return [
      {
        role: "user",
        content: [
          context,
          untrustedBlock("document", input.text),
          "Extract from the document. Character offsets count from 0 into the document text above, excluding the block tags.",
        ].join("\n\n"),
      },
    ];
  },
});

export const studioConsolidate = defineTask({
  name: "studio.consolidate",
  agent: "studio.consolidate",
  input: StudioConsolidateInput,
  output: StudioConsolidateOutput,
  outputName: "StudioConsolidateOutput",
  buildMessages: (input) => {
    const stories = input.stories
      .map((story) =>
        [
          `${story.code} ${JSON.stringify(story.nickname)} | ${story.context} ${story.era} | ${story.status}`,
          `  traits: ${story.traits.join(", ") || "—"}`,
          `  sit: ${story.situation || "—"}`,
          `  stk: ${story.stakes || "—"}`,
          `  act: ${story.actions.join("; ") || "—"}`,
          `  res: ${story.result || "—"}`,
          `  refl: ${story.reflection || "—"}`,
          story.lines.length === 0
            ? "  lines: none"
            : `  lines: ${story.lines.map((line) => `${line.code} ${JSON.stringify(line.text)}`).join(" | ")}`,
        ].join("\n"),
      )
      .join("\n");

    const facts = input.facts
      .map((fact) => `${fact.code} ${fact.key} = ${JSON.stringify(fact.value)} [${fact.status}]`)
      .join("\n");

    const stats = input.voiceStats;
    const statLine = [
      `sentences: ${stats.sentenceCount}`,
      `words: ${stats.wordCount}`,
      `mean length: ${stats.sentenceLengthMean.toFixed(1)}w`,
      `std dev: ${stats.sentenceLengthStdDev.toFixed(1)}`,
      `coefficient of variation: ${stats.sentenceLengthVariation.toFixed(2)}`,
    ].join(" | ");

    return [
      {
        role: "user",
        content: [
          `Sentence statistics, computed from the applicant's own words: ${statLine}`,
          untrustedBlock("stories", stories),
          untrustedBlock("facts", facts),
          untrustedBlock("voice_samples", input.voiceSamples.join("\n")),
          "Consolidate: merges, statuses, nicknames, golden lines to keep, fact conflicts, brand, positioning line, voice card and notes.",
        ].join("\n\n"),
      },
    ];
  },
});

export const applicantSimulator = defineTask({
  name: "eval.applicant_simulator",
  agent: "eval.applicant_simulator",
  input: ApplicantSimulatorInput,
  output: ApplicantSimulatorOutput,
  outputName: "ApplicantSimulatorOutput",
  buildMessages: (input) => [
    {
      role: "user",
      content: [
        `Speaking style: ${input.style}`,
        untrustedBlock("persona", input.persona),
        untrustedBlock("ground_truth", input.groundTruth),
        input.alreadySaid.length === 0
          ? "You have not said anything yet this session."
          : untrustedBlock("already_said", input.alreadySaid.join("\n---\n")),
        `The interviewer asks: ${input.question}`,
        "Answer as this person would, out loud.",
      ].join("\n\n"),
    },
  ],
});
