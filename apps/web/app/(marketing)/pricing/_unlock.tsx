"use client";

// "Show what unlocks" (direction §5): the sample kit's deliverables as locked rows, with one switch
// above them. On: each lock lifts (opacity and a 4 px rise on snap, 60 ms apart) and the ruled
// lines give way to the draft's first two sentences, fading up one after the other (180 ms each),
// with the applicant's own words lit. Off reverses. Reduced motion: an instant swap.
//
// CSS transitions only, no Motion: the island stays a few KB. Each opening always holds its space
// (the text sits in the same grid cell as the rules), so nothing moves when it appears. While
// locked the text is transparent and aria-hidden: drawn rules, nothing to read or copy, like the
// real LockedDeliverables (it fades back out, so it can't be `invisible`; it is unselectable). Loaded by ./_unlock-island when the section is near.

import { cx } from "@admitstory/ui";
import { LockSimpleIcon } from "@phosphor-icons/react/ssr";
import { useState, type CSSProperties } from "react";
import { track } from "../_lib/track";
import type { UnlockDeliverable } from "./_data";

export interface UnlockPreviewProps {
  deliverables: readonly UnlockDeliverable[];
  heading: string;
  switchLabel: string;
  lockedWord: string;
}

const ROW_STAGGER_MS = 60;
const SENTENCE_MS = 180;

/** The transition delay for row `row`, sentence `sentence` (−1 for the lock itself). */
export function unlockDelay(on: boolean, row: number, count: number, sentence = -1): number {
  // Turning off reverses the order: the last row closes first, and the text goes before the lock.
  if (!on) return (count - 1 - row) * ROW_STAGGER_MS;
  return row * ROW_STAGGER_MS + (sentence + 1) * SENTENCE_MS;
}

const delay = (ms: number) => ({ "--delay": `${ms}ms` }) as CSSProperties;

export default function UnlockPreview({
  deliverables,
  heading,
  switchLabel,
  lockedWord,
}: UnlockPreviewProps) {
  const [on, setOn] = useState(false);
  const toggle = () => {
    const next = !on;
    setOn(next);
    track("pricing_unlock_toggle", { on: next });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h3 id="unlock-heading" className="text-lg font-medium text-text">
          {heading}
        </h3>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          onClick={toggle}
          className="inline-flex min-h-11 items-center gap-3 rounded-control px-2 font-medium text-text hover:bg-veil"
        >
          <span
            aria-hidden
            className={cx(
              "relative h-6 w-10 shrink-0 rounded-full border transition-colors duration-(--spring-snap-duration) ease-snap motion-reduce:transition-none",
              on ? "border-signal bg-signal" : "border-control bg-depth",
            )}
          >
            <span
              className={cx(
                "absolute left-0.5 top-1/2 size-4 -translate-y-1/2 rounded-full transition-[translate,background-color] duration-(--spring-snap-duration) ease-snap motion-reduce:transition-none",
                on ? "translate-x-4 bg-on-signal" : "translate-x-0 bg-control",
              )}
            />
          </span>
          {switchLabel}
        </button>
      </div>
      <ul aria-labelledby="unlock-heading" className="mt-4 flex flex-col border-t border-edge">
        {deliverables.map((item, row) => (
          <li
            key={item.key}
            data-deliverable={item.key}
            data-locked={on ? undefined : ""}
            className="flex flex-col gap-2 border-b border-edge py-4"
          >
            <span className="flex flex-wrap items-baseline justify-between gap-x-4">
              <span className="font-medium text-text">
                {item.title}
                <span className="text-sm font-normal tabular-nums text-text-soft">
                  , {item.limit}
                </span>
              </span>
              <span
                style={delay(unlockDelay(on, row, deliverables.length))}
                className={cx(
                  "inline-flex items-center gap-1 text-sm text-text-soft transition-[opacity,translate] delay-(--delay) duration-(--spring-snap-duration) ease-snap motion-reduce:transition-none",
                  on && "-translate-y-1 opacity-0",
                )}
              >
                <LockSimpleIcon size={16} aria-hidden />
                {lockedWord}
              </span>
            </span>
            <span className="text-sm text-text-soft">From the story “{item.story}”</span>
            <span className="grid pt-1">
              <span
                aria-hidden="true"
                style={delay(on ? unlockDelay(on, row, deliverables.length) : 0)}
                className={cx(
                  "col-start-1 row-start-1 flex flex-col gap-2 pt-2 transition-opacity delay-(--delay) duration-(--spring-snap-duration) ease-snap motion-reduce:transition-none",
                  on && "opacity-0",
                )}
              >
                {[100, 92, 64].map((width) => (
                  <span key={width} className="h-px bg-edge" style={{ width: `${width}%` }} />
                ))}
              </span>
              <span
                aria-hidden={on ? undefined : true}
                className={cx(
                  "col-start-1 row-start-1 max-w-essay font-reading text-read text-text",
                  !on && "select-none",
                )}
              >
                {item.opening.map((sentence, index) => {
                  const fade = cx(
                    "transition-opacity delay-(--delay) duration-180 ease-linear motion-reduce:transition-none",
                    on ? "opacity-100" : "opacity-0",
                  );
                  const style = delay(unlockDelay(on, row, deliverables.length, index));
                  return (
                    <span key={sentence.text}>
                      {index > 0 ? " " : null}
                      {sentence.own ? (
                        <mark style={style} className={fade}>
                          {sentence.text}
                        </mark>
                      ) : (
                        <span style={style} className={fade}>
                          {sentence.text}
                        </span>
                      )}
                    </span>
                  );
                })}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
