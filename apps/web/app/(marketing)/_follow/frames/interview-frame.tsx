// Chapter 4, interview practice: a preview, labelled "Coming soon" (plan OVERRIDE). A still duet:
// the interviewer's silver form facing a small one in the applicant's hue, the follow-up question
// in silver Newsreader, the essay line it quotes, and talking points from the same story.
// Server-only (VoiceprintStill is server-safe), so it costs no JS.

import { VoiceprintStill } from "@admitstory/ui";
import { INTERVIEW_FRAME } from "../../_copy/follow";
import { COMING_SOON } from "../../_copy/shared";
import {
  INTERVIEWER_IDENTITY,
  SAMPLE_IDENTITY,
  SAMPLE_LINE,
  SAMPLE_QUESTION_INTERVIEW,
} from "../../_data/sample";

export function InterviewFrame() {
  return (
    <div className="relative flex h-full flex-col p-10">
      <p className="absolute right-6 top-6 rounded-control border border-edge px-2 py-0.5 text-sm text-text">
        {COMING_SOON}
      </p>
      <div className="flex items-center gap-8">
        <VoiceprintStill identity={INTERVIEWER_IDENTITY} size={120} tone="silver" label="" />
        <p className="font-reading text-[30px] leading-[1.15] text-silver">
          {SAMPLE_QUESTION_INTERVIEW}
        </p>
      </div>
      <p data-sentence-slot="" className="ml-[152px] mt-4 text-sm text-text-soft">
        {INTERVIEW_FRAME.from}: “{SAMPLE_LINE}”
      </p>
      <div className="mt-auto flex items-end gap-6">
        <div className="flex-1">
          <p className="text-sm text-text-soft">{INTERVIEW_FRAME.pointsHeading}</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {INTERVIEW_FRAME.points.map((point) => (
              <li key={point} className="text-base text-text">
                {point}
              </li>
            ))}
          </ul>
        </div>
        <VoiceprintStill identity={SAMPLE_IDENTITY} size={64} label="" />
      </div>
    </div>
  );
}
