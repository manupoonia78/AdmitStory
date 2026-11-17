// Scene 12 (SPEC §4): the final call. One centred sentence, one brass button, and the horizon back
// again under it: a flat hairline across the whole page with a single peak, the mark, beneath the
// button. It draws from the left as the scene comes into view. The model's credit sits under the
// line. No second action here: "Sign in" is in the nav above and the footer below.

import { buttonStyles, cx } from "@admitstory/ui";
import Link from "next/link";
import { ModelSealMark } from "@/components/model-seal";
import { MODEL_CREDIT } from "@/lib/model-claims";
import { FINAL_COPY } from "../_copy/landing";
import { START_STORY } from "../_copy/shared";
import { trackAttributes } from "../_lib/track";
import { START_FREE_HREF } from "../_ui/cta-link";

// A 3200 × 56 strip cut to the page's width around its centre, so the peak keeps its shape at any
// width. The flat run stops either side of the peak; the peak is the mark's own rise.
const HALF = 1600;
const PEAK = `M${HALF - 15} 48L${HALF} 6L${HALF + 15} 48`;

export function FinalCall() {
  return (
    <section
      aria-labelledby="final-title"
      className="reveal overflow-clip pt-24 pb-20 lg:pt-40 lg:pb-32"
    >
      <div className="mx-auto flex max-w-[1440px] flex-col items-center px-4 text-center sm:px-8">
        <h2 id="final-title" className="font-display text-display-1 text-text">
          <span className="block">
            {FINAL_COPY.before} <em>{FINAL_COPY.accent}</em>
          </span>{" "}
          <span className="block">{FINAL_COPY.after}</span>
        </h2>
        <Link
          href={START_FREE_HREF}
          className={cx(buttonStyles({ size: "lg", arrow: true }), "mt-10")}
          {...trackAttributes("cta_start_free", { location: "final-call" })}
        >
          {START_STORY}
          <span aria-hidden="true" className="btn-arrow" />
        </Link>
      </div>
      <svg
        aria-hidden="true"
        viewBox="0 0 3200 56"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        focusable="false"
        className="mt-8 block h-14 w-full"
      >
        <path
          d={`M0 48H${HALF - 15}M${HALF + 15} 48H3200`}
          stroke="var(--line-strong)"
          strokeWidth="1.25"
        />
        <path
          d={PEAK}
          pathLength="1"
          stroke="var(--accent)"
          strokeWidth="1.5"
          strokeLinejoin="miter"
          className="scene-draw"
        />
      </svg>
      <p className="mx-auto mt-8 flex max-w-[420px] flex-col items-center gap-3 px-4 text-center text-sm text-text-soft">
        <ModelSealMark />
        <span>{MODEL_CREDIT}</span>
      </p>
    </section>
  );
}
