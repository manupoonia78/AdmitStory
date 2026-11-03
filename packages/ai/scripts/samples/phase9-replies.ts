/**
 * Hand-authored eval.judge replies for samples/phase9.ts (no API key was available when Phase 9b
 * was built). Re-record live with `pnpm --filter @admitstory/ai record:phase9`.
 */
import type { TaskOutput } from "../../src";
import { INVENTED_SENTENCE } from "./phase9";

export const EVAL_JUDGE_CLEAN_REPLY: TaskOutput<"eval.judge"> = {
  scores: { story_quality: 4, voice_fidelity: 4, prompt_coverage: 4, school_fit: 3 },
  invented_facts: [],
  must_fix: [],
  summary:
    "A specific, well-paced story with real numbers from the record and a plain voice. The learning paragraph is thinner than the action; give the reflection one concrete behaviour he changed.",
};

export const EVAL_JUDGE_INVENTED_REPLY: TaskOutput<"eval.judge"> = {
  scores: { story_quality: 4, voice_fidelity: 4, prompt_coverage: 4, school_fit: 3 },
  invented_facts: [
    {
      text: INVENTED_SENTENCE,
      why: "The ground truth records the slow queries and the fix, but no cost figure and no infrastructure saving.",
    },
  ],
  must_fix: [
    {
      rule_id: null,
      text: "Remove the 40% infrastructure saving: it is not in the record and he could not defend it in an interview.",
    },
  ],
  summary:
    "Strong story, but it claims a 40% cost cut the record does not support. Remove it; the real result (the faster pages and the plan the team adopted) is enough.",
};

/** First reply breaks the 1–5 range (story_quality 6); the repair turn fixes it. */
export const EVAL_JUDGE_SHORT_REPLIES: unknown[] = [
  {
    scores: { story_quality: 6, voice_fidelity: 4, prompt_coverage: 5, school_fit: 3 },
    invented_facts: [],
    must_fix: [],
    summary: "One word and one true reason, in his voice. Within the limit.",
  },
  {
    scores: { story_quality: 5, voice_fidelity: 4, prompt_coverage: 5, school_fit: 3 },
    invented_facts: [],
    must_fix: [],
    summary: "One word and one true reason, in his voice. Within the limit.",
  },
];
