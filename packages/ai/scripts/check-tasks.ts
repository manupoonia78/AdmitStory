// Builds each task's request without calling the API: resolves its prompt version, loads
// its canon subset, compiles its output schema to JSON Schema, and builds its messages from a
// sample input. Catches a prompt/schema mismatch, a missing canon rule or an unsupported schema
// construct before any of it costs a request.

import { loadCanon } from "../src/canon";
import { canonDirIn, findRepoRoot, promptsDirIn } from "../src/paths";
import { buildSystem, canonSubset, outputJsonSchema } from "../src/request";
import { createFilePromptSource, loadPrompt, renderPrompt } from "../src/prompts/registry";
import { TASKS } from "../src/tasks";
import { ROUTES } from "../src/routing";
import {
  KB_NORMALIZE_OFFICIAL_INPUT,
  KB_REFRESH_CHECK_INPUT,
  KIT_POSITIONING_INPUT,
  PROFILE_READ_INPUT,
  SCHOOL_FIT_INPUT,
} from "./samples/phase3";
import {
  DRAFT_NEED_FILL_INPUT,
  DRAFT_REVISE_INPUT,
  KIT_ANGLES_INPUT,
  KIT_CRITIC_INPUT,
  KIT_DRAFT_INPUT,
  KIT_GAPS_INPUT,
  KIT_SHORTFORM_INPUT,
  UTIL_CLASSIFY_INPUT,
} from "./samples/phase4";

const root = findRepoRoot(process.cwd());
if (!root) throw new Error("no repo root");
const prompts = createFilePromptSource(promptsDirIn(root));
const canon = loadCanon(canonDirIn(root));

const SAMPLES: Record<string, unknown> = {
  "studio.interviewer": {
    chapter: "work",
    chapterGathers: "Each role: why you took it, your scope and team.",
    targetSlot: "impact.biggest",
    seedQuestion: "What are you proudest of here?",
    lastAnswer: "It was 2 a.m. and the feed was dropping messages.",
    recentTurns: [{ role: "ai", text: "Where did you grow up?" }],
    digsUsedOnStory: 1,
    hurried: false,
    possibleConflicts: [{ code: "F03", key: "team_size", knownValue: "13", justSaid: "11" }],
    offerPause: true,
  },
  "studio.extract": {
    text: "I rebuilt the retry logic overnight. My manager Ravi was on a flight.",
    chapter: "work",
    targetSlot: "impact.biggest",
    knownFacts: [{ code: "F01", key: "employer_current", value: "Meridian Health Systems" }],
    knownStories: [{ code: "S01", nickname: "The night-shift fix" }],
  },
  "import.parse": {
    text: "EXPERIENCE\nSenior Software Engineer, Meridian Health Systems, since April 2024",
    documentKind: "resume",
    fileName: "resume.pdf",
    knownFacts: [],
  },
  "studio.consolidate": {
    stories: [
      {
        code: "S01",
        nickname: "The night-shift fix",
        era: "2024",
        context: "professional",
        situation: "The feed dropped messages.",
        stakes: "The go-live would have rolled back.",
        actions: ["Rewrote the retry logic"],
        result: "No dropped messages since.",
        reflection: "Ask for help earlier.",
        traits: ["delivers_under_pressure"],
        status: "partial",
        lines: [{ code: "L001", text: "It was two in the morning." }],
      },
    ],
    facts: [{ code: "F01", key: "team_size", value: "13", status: "needs_confirmation" }],
    voiceStats: {
      sentenceLengthMean: 12.4,
      sentenceLengthStdDev: 6.1,
      sentenceLengthVariation: 0.49,
      wordCount: 420,
      sentenceCount: 34,
    },
    voiceSamples: ["It was a bit of a mess."],
  },
  "eval.applicant_simulator": {
    persona: "A backend engineer moving into product.",
    style: "terse",
    groundTruth: "FACTS\n- employer: Meridian Health Systems",
    question: "What are you proudest of?",
    alreadySaid: [],
  },
  "util.title": { text: "A passage to title." },
  "profile.read": PROFILE_READ_INPUT,
  "strategy.school_fit": SCHOOL_FIT_INPUT,
  "kit.positioning_filemap": KIT_POSITIONING_INPUT,
  "kb.normalize": KB_NORMALIZE_OFFICIAL_INPUT,
  "kit.gaps": KIT_GAPS_INPUT,
  "kit.angles": KIT_ANGLES_INPUT,
  "kit.draft": KIT_DRAFT_INPUT,
  "kit.shortform": KIT_SHORTFORM_INPUT,
  "kit.critic": KIT_CRITIC_INPUT,
  "draft.revise": DRAFT_REVISE_INPUT,
  "draft.need_fill": DRAFT_NEED_FILL_INPUT,
  "util.classify": UTIL_CLASSIFY_INPUT,
  "kb.refresh_check": KB_REFRESH_CHECK_INPUT,
};

let failures = 0;
for (const [name, task] of Object.entries(TASKS)) {
  try {
    const template = await loadPrompt(prompts, task.agent);
    if (template.output !== task.outputName)
      throw new Error(`prompt declares ${template.output}, task expects ${task.outputName}`);

    // The registry is a union of task definitions, so each one's input and buildMessages are
    // narrowed apart; this script walks them generically.
    const definition = task as {
      input: { parse: (value: unknown) => unknown };
      buildMessages: (input: never) => unknown[];
    };
    const parsed = definition.input.parse(SAMPLES[name]);
    const messages = definition.buildMessages(parsed as never);
    const system = buildSystem({
      agentPrompt: renderPrompt(template),
      canon: canonSubset(canon, template),
      dossier: "APPLICANT  A-7f3 | target: MBA 2027",
    });
    const schema = outputJsonSchema(task.output);
    const route = ROUTES[name as keyof typeof ROUTES];

    const canonTokens = Math.round((system[system.length - 2]?.text.length ?? 0) / 4);
    console.log(
      `${name.padEnd(26)} ${route.model.padEnd(7)} ${String(template.version).padStart(2)}  ` +
        `system ${String(system.length)} blocks, canon ~${canonTokens}t, ` +
        `${messages.length} message(s), schema ${Object.keys((schema.properties ?? {}) as object).length} field(s)`,
    );
  } catch (error) {
    failures += 1;
    console.error(`${name}: ${(error as Error).message}`);
  }
}

console.log(
  failures === 0 ? "\nEvery task builds a valid request." : `\n${failures} task(s) failed.`,
);
process.exit(failures === 0 ? 0 : 1);
