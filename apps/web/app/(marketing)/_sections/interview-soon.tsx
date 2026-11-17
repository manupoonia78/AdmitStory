// Scene 9 (SPEC §4): interview practice, which is NOT live. Small and honest: the "Coming soon"
// label, the promise verbatim, and one still of the room labelled as a preview. Nothing here says
// or implies that interview practice exists today. Server markup; the timer's arc draws once as
// the scene comes into view.

import { cx } from "@admitstory/ui";
import type { CSSProperties } from "react";
import { INTERVIEW_COPY } from "../_copy/landing";
import { COMING_SOON, INTERVIEW_COMING_SOON_LINE } from "../_copy/shared";
import { SAMPLE_QUESTION_INTERVIEW } from "../_data/sample";
import { SceneHead } from "../_ui/scene-head";
import { SECTION_GRID } from "../_ui/section";

/** 0:42 of 2:00, as a fraction of the ring. */
const ELAPSED = 42 / 120;
const R = 46;
const TURN = 2 * Math.PI * R;

export function InterviewSoon() {
  return (
    <section aria-labelledby="interview-title" className="border-y border-edge py-16 lg:py-24">
      <div className={cx(SECTION_GRID, "items-center gap-y-12")}>
        <div className="reveal col-span-4 sm:col-span-8 lg:col-span-5">
          <p className="soon-pill label">{COMING_SOON}</p>
          <SceneHead
            id="interview-title"
            lines={INTERVIEW_COPY.headingLines}
            size="2"
            className="mt-6"
          />
          <p className="mt-5 max-w-[440px] text-lg text-text-80">{INTERVIEW_COMING_SOON_LINE}</p>
        </div>
        <figure className="reveal relative col-span-4 sm:col-span-8 lg:col-span-6 lg:col-start-7">
          <p className="soon-pill soon-pill-solid label absolute -top-3.5 left-8 z-10">
            {INTERVIEW_COPY.preview}
          </p>
          <div aria-hidden="true" className="win win-free">
            <div inert className="win-screen win-room">
              <div className="win-room-main">
                <p className="win-label">{INTERVIEW_COPY.from}</p>
                <p className="win-question">{SAMPLE_QUESTION_INTERVIEW}</p>
                <div className="win-answer">
                  {INTERVIEW_COPY.answer.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </div>
              <div className="win-timer">
                <svg viewBox="0 0 100 100" fill="none" focusable="false">
                  <circle cx="50" cy="50" r={R} stroke="var(--line-strong)" strokeWidth="1" />
                  <circle
                    cx="50"
                    cy="50"
                    r={R}
                    stroke="var(--accent)"
                    strokeWidth="1.5"
                    strokeDasharray={`${(ELAPSED * TURN).toFixed(2)} ${TURN.toFixed(2)}`}
                    transform="rotate(-90 50 50)"
                    className="win-timer-arc"
                    style={{ "--arc": (ELAPSED * TURN).toFixed(2) } as CSSProperties}
                  />
                  <path d="M50 1v7" stroke="var(--accent)" strokeWidth="1.5" />
                </svg>
                <p>
                  <span>{INTERVIEW_COPY.time}</span>
                  <span className="win-label">{INTERVIEW_COPY.of}</span>
                </p>
              </div>
            </div>
          </div>
          <figcaption className="sr-only">{INTERVIEW_COPY.caption}</figcaption>
        </figure>
      </div>
    </section>
  );
}
