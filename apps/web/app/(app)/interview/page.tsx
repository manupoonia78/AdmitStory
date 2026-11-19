import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { requireOnboardedUser } from "@/lib/app-user";
import { INTERVIEW_COMING_SOON as COPY } from "@/lib/interview/coming-soon";
import { ROOM_STILL as ROOM } from "./room-still";
import "./interview.css";

export const metadata: Metadata = { title: COPY.title };

// Interview Studio is deferred (docs/phase-7-interview-studio.md), with a promise: kit owners get
// it at no extra cost when it opens, which is why the line under the headline is COPY.promise.
//
// The page is a still of the room (SPEC §6.18), labelled a preview, on a frame that is always
// Night. Its one moment: the timer's arc draws to 0:42 as the page enters (CSS, interview.css).
// Server-only: no JavaScript.

const R = 46;
const TURN = 2 * Math.PI * R;
const ARC = ROOM.fraction * TURN;

/** The silver line where the interviewer has just spoken: a still wave, then flat. */
function stillWave(): string {
  const points: string[] = [];
  for (let x = 0; x <= 120; x += 2) {
    const fade = Math.sin((Math.PI * x) / 120);
    const y = 12 + Math.sin(x / 6.2) * 7 * fade + Math.sin(x / 2.7 + 1) * 2.2 * fade;
    points.push(`${x === 0 ? "M" : "L"}${x} ${y.toFixed(2)}`);
  }
  return points.join(" ");
}

export default async function Page() {
  await requireOnboardedUser();
  return (
    <div className="mx-auto flex w-full max-w-[70rem] flex-col px-5 pt-6 pb-16 sm:px-10 sm:pt-10 lg:px-14 lg:pt-14">
      <header className="flex flex-col items-start">
        <p className="enter label inline-flex h-7 items-center gap-2 rounded-full border border-edge bg-veil px-3">
          <span aria-hidden className="size-1.5 rounded-full bg-text-soft" />
          {COPY.status}
        </p>
        <h1 className="enter mt-4 text-display-2 text-text" style={{ "--i": 0.8 } as CSSProperties}>
          {COPY.title}
        </h1>
        <p
          className="enter mt-4 max-w-[26ch] text-display-3 text-balance text-text-soft"
          style={{ "--i": 1.45 } as CSSProperties}
        >
          {COPY.headline}
        </p>
        <p
          className="enter mt-4 max-w-[56ch] text-lg text-text-80"
          style={{ "--i": 2 } as CSSProperties}
        >
          {COPY.promise}
        </p>
      </header>

      <figure className="room-still" data-theme="night" aria-label="A preview of the interview room">
        <figcaption className="room-still-tag label">{ROOM.label}</figcaption>
        <div className="room-still-body" aria-hidden="true" inert>
          <div className="min-w-0">
            <p className="label">{ROOM.from}</p>
            <p className="mt-4 max-w-[22ch] text-display-3 text-balance text-text">{ROOM.question}</p>
            <div className="room-still-transcript mt-8">
              {ROOM.transcript.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </div>
          <div className="room-still-timer">
            <svg viewBox="0 0 100 100" fill="none" focusable="false">
              <circle cx="50" cy="50" r={R} stroke="var(--line-strong)" strokeWidth="1" />
              <circle
                cx="50"
                cy="50"
                r={R}
                stroke="var(--accent)"
                strokeWidth="1.5"
                strokeDasharray={`${ARC.toFixed(2)} ${TURN.toFixed(2)}`}
                transform="rotate(-90 50 50)"
                className="room-still-arc"
                style={{ "--arc": ARC.toFixed(2) } as CSSProperties}
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <span className="room-still-time">
              <span className="font-mono text-[20px] tabular-nums text-text">{ROOM.elapsed}</span>
              <span className="label mt-1">{ROOM.of}</span>
            </span>
          </div>
          <div className="room-still-horizon">
            <svg viewBox="0 0 120 24" preserveAspectRatio="none" fill="none" focusable="false">
              <path
                d={stillWave()}
                stroke="var(--silver)"
                strokeWidth="1.25"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <span className="room-still-rule" />
          </div>
        </div>
      </figure>

      <section aria-labelledby="interview-parts" className="mt-12">
        <h2 id="interview-parts" className="label">
          {ROOM.partsLabel}
        </h2>
        <ol className="mt-4 grid border-t border-edge lg:grid-cols-2 lg:gap-x-10">
          {COPY.parts.map((part, index) => (
            <li
              key={part.name}
              className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-2 border-b border-edge py-6"
            >
              <span aria-hidden className="pt-1 font-mono text-[12px] text-text-label">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-title text-text">{part.name}</span>
                <span className="text-sm text-text-soft">{part.line}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
