"use client";

// The motion bench of /prototype/system (SPEC §2.10): the page entrance, a Voiceline drawing,
// and the four springs, each replayable. The entrance and the line are the real `enter` and
// `draw-line` utilities; remounting the stage with a new key is what replays them.

import { Button, MOTION_TOKENS, cx } from "@admitstory/ui";
import { ArrowClockwiseIcon } from "@phosphor-icons/react";
import { useState, type CSSProperties } from "react";
import { wavePath } from "./_tokens";

const order = (i: number) => ({ "--i": i }) as CSSProperties;

const LINE = `${wavePath(4, { x: 0, width: 300, baseline: 40, amplitude: 22 })}H420L444 6L468 40H640`;

const SPRING_USE: Record<(typeof MOTION_TOKENS)[number], string> = {
  snap: "Toggles, presses",
  glide: "Panels, sheets, the tab rule",
  drift: "Flights, the hero's sheets",
  settle: "Long settles",
};

export function MotionBench() {
  const [run, setRun] = useState(0);
  const [far, setFar] = useState(false);

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="card flex flex-col gap-8 p-6 lg:col-span-7 lg:p-8">
        <div className="flex items-center justify-between gap-4">
          <p className="label">Entrance, then a line drawing</p>
          <Button
            size="sm"
            variant="secondary"
            icon={ArrowClockwiseIcon}
            onClick={() => setRun((value) => value + 1)}
          >
            Replay
          </Button>
        </div>
        <div key={run} className="flex flex-col gap-5">
          <p className="enter eyebrow" style={order(0)}>
            Story Studio
          </p>
          <p className="text-display-2">
            {["Start", "where", "it"].map((word, index) => (
              <span key={word} className="enter mr-[0.22em] inline-block" style={order(index + 1)}>
                {word}
              </span>
            ))}
            <em className="enter inline-block" style={order(4)}>
              changed.
            </em>
          </p>
          <p className="enter max-w-[44ch] text-text-soft" style={order(5)}>
            Eyebrow, headline word by word, then the line beneath. Each rises 24px out of an 8px
            blur over 800ms, 90ms apart.
          </p>
          <svg
            viewBox="0 0 640 46"
            fill="none"
            aria-hidden
            className="mt-2 h-auto w-full overflow-visible"
          >
            <path
              d={LINE}
              pathLength={1}
              className="draw-line stroke-accent"
              style={order(6)}
              strokeWidth="1.25"
              strokeLinejoin="miter"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
      </div>

      <div className="card flex flex-col gap-6 p-6 lg:col-span-5 lg:p-8">
        <div className="flex items-center justify-between gap-4">
          <p className="label">Springs, for what you move</p>
          <Button size="sm" variant="secondary" onClick={() => setFar((value) => !value)}>
            {far ? "Send back" : "Send across"}
          </Button>
        </div>
        <ul className="flex flex-col gap-5">
          {MOTION_TOKENS.map((token) => (
            <li key={token} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-ui">{token}</span>
                <span className="text-sm text-text-soft">{SPRING_USE[token]}</span>
              </div>
              <div className="relative h-3 border-b border-edge-strong">
                <span
                  className={cx(
                    "absolute bottom-[-0.5px] left-0 block h-3 w-full transition-[translate] motion-reduce:transition-none",
                    far ? "translate-x-[calc(100%-1.5rem)]" : "translate-x-0",
                  )}
                  style={{
                    transitionDuration: `var(--spring-${token}-duration)`,
                    transitionTimingFunction: `var(--spring-${token})`,
                  }}
                >
                  <svg width="24" height="12" viewBox="0 0 24 12" fill="none" aria-hidden>
                    <path
                      d="M0 11.5H7L12 1L17 11.5H24"
                      className="stroke-text"
                      strokeWidth="1.25"
                      strokeLinejoin="miter"
                    />
                  </svg>
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
