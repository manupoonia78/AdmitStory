// Scene 3 (SPEC §4): how it works, in four steps: Tell, Position, Draft, Refine. It folds in the
// old three-step section, "follow one sentence" (and its GSAP) and the screens stepper.
//
// The server markup is complete on its own: four steps, each with its product window. On wide
// screens ./how-stepper marks the scene live, the CSS then stacks the windows in one pinned place
// (marketing.css, .how), and the window swaps as each step crosses the viewport: stepped, never
// scrubbed. Phones get no pin: each step is followed by its window.

import { cx } from "@admitstory/ui";
import type { CSSProperties } from "react";
import { HOW_COPY } from "../_copy/landing";
import { TEXT_LINK } from "../_ui/cta-link";
import { SceneHead } from "../_ui/scene-head";
import { SECTION_GRID } from "../_ui/section";
import Link from "next/link";
import { HowStepper } from "./how-stepper";
import { HOW_WINDOWS } from "./how-windows";

const SCENE_ID = "how";

export function HowScene() {
  return (
    <section id={SCENE_ID} aria-labelledby="how-title" className="how py-20 sm:py-28 lg:py-40">
      <div className={cx(SECTION_GRID, "reveal")}>
        <SceneHead
          id="how-title"
          eyebrow={HOW_COPY.eyebrow}
          lines={HOW_COPY.headingLines}
          className="col-span-4 sm:col-span-8 lg:col-span-7"
        />
        <div className="col-span-4 mt-6 sm:col-span-6 lg:col-span-4 lg:col-start-9 lg:mt-auto">
          <p className="text-lg text-text-soft">{HOW_COPY.paragraph}</p>
          <Link href="/how-it-works" className={cx(TEXT_LINK, "mt-2")}>
            {HOW_COPY.link}
          </Link>
        </div>
      </div>

      <div className={cx(SECTION_GRID, "mt-14 lg:mt-24")}>
        <ol
          role="list"
          aria-label={HOW_COPY.stepsLabel}
          className="how-steps col-span-4 sm:col-span-8 lg:col-span-12"
        >
          {HOW_COPY.steps.map((step, index) => {
            const Window = HOW_WINDOWS[index];
            return (
              <li
                key={step.verb}
                data-how-step=""
                data-on={index === 0 ? "" : undefined}
                className="how-step"
                style={{ "--n": index + 1 } as CSSProperties}
              >
                <div data-how-text="" className="how-text">
                  <div className="reveal">
                    <p className="label">
                      {String(index + 1).padStart(2, "0")} · {step.verb}
                    </p>
                    <h3 className="mt-4 font-display text-display-3 text-text">{step.title}</h3>
                    <p className="mt-3 max-w-[360px] text-base text-text-soft">{step.body}</p>
                    <p className="soon-pill label mt-5">
                      {step.paid ? HOW_COPY.pack : HOW_COPY.free}
                    </p>
                  </div>
                </div>
                <figure className="how-window">
                  <div aria-hidden="true">{Window ? <Window /> : null}</div>
                  <figcaption className="sr-only">{step.caption}</figcaption>
                </figure>
              </li>
            );
          })}
        </ol>
        <p className="label col-span-4 mt-10 sm:col-span-8 lg:col-span-12 lg:mt-0">
          {HOW_COPY.note}
        </p>
      </div>
      <HowStepper target={SCENE_ID} />
    </section>
  );
}
