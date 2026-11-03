/**
 * Fixed inputs for the Phase 9b task eval.judge, shared by the synthetic recorder
 * (record-phase9.ts), check-tasks and the evaluation harness (src/evals). Everything is fictional
 * (spec §0): the `engineer-to-product` applicant's Halvorsen "shaped" essay draft from the Phase 4
 * replays, judged three ways: as written (clean), with an invented cost saving spliced in, and the
 * one-word short answer (whose first synthetic reply breaks the score range and is repaired).
 *
 * Changing any value here changes a request hash: re-run `pnpm --filter @admitstory/ai
 * record:phase9 --synthetic` afterwards.
 */
import type { RunContext, TaskInput } from "../../src";
import { ENGINEER_DOSSIER, HALVORSEN_PACK } from "./phase3";
import { KIT_SHORTFORM_INPUT, SHAPED_DRAFT, SHAPED_ESSAY } from "./phase4";
import { KIT_SHORTFORM_REPLIES } from "./phase4-replies";

export const PHASE9_CTX: RunContext = { contentLoggingAllowed: false };

export const SHAPED_DRAFT_TEXT = SHAPED_DRAFT.paragraphs
  .map((paragraph) => paragraph.sentences.map((sentence) => sentence.text).join(" "))
  .join("\n\n");

/** The invented claim the judge must catch (no cost figure exists in the ground truth). */
export const INVENTED_SENTENCE = "That fix cut our infrastructure costs by 40% in a quarter.";

export const SHAPED_DRAFT_WITH_INVENTION = SHAPED_DRAFT_TEXT.replace(
  "In four days I had a working fix for two of them.",
  `In four days I had a working fix for two of them. ${INVENTED_SENTENCE}`,
);

const VOICE_SAMPLE =
  "Honestly the slow pages were bugging me for weeks. I didn't want to say 'rebuild it' without numbers, so I just instrumented the thing over a weekend. Turned out it was mostly three queries.";

const PACK_EXCERPT = HALVORSEN_PACK.slice(0, 2_000);
const GROUND_TRUTH = ENGINEER_DOSSIER.slice(0, 60_000);

const FIXTURE = { applicant: "engineer-to-product", school: "Halvorsen" };

export const EVAL_JUDGE_CLEAN_INPUT: TaskInput<"eval.judge"> = {
  task: "kit.draft",
  fixture: FIXTURE,
  promptText: SHAPED_ESSAY.prompt,
  outputText: SHAPED_DRAFT_TEXT,
  groundTruth: GROUND_TRUTH,
  voiceSample: VOICE_SAMPLE,
  packExcerpt: PACK_EXCERPT,
};

export const EVAL_JUDGE_INVENTED_INPUT: TaskInput<"eval.judge"> = {
  ...EVAL_JUDGE_CLEAN_INPUT,
  outputText: SHAPED_DRAFT_WITH_INVENTION,
};

const WORD_ANSWER_TEXT = (KIT_SHORTFORM_REPLIES.at(-1)?.items[0]?.paragraphs ?? [])
  .map((paragraph) => paragraph.sentences.map((sentence) => sentence.text).join(" "))
  .join("\n\n");

export const EVAL_JUDGE_SHORT_INPUT: TaskInput<"eval.judge"> = {
  task: "kit.shortform",
  fixture: FIXTURE,
  promptText: KIT_SHORTFORM_INPUT.items[0]?.prompt ?? "",
  outputText: WORD_ANSWER_TEXT,
  groundTruth: GROUND_TRUTH,
  voiceSample: VOICE_SAMPLE,
  packExcerpt: PACK_EXCERPT,
};
