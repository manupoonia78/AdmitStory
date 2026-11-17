// Scene 6 (SPEC §4): the model, as an instrument panel. The dial seal and the claim on the left,
// and on the right the ledger of what it learned from, typeset as a table on hairlines that draw
// as it comes into view. Every word and figure is from lib/model-claims.ts; nothing is added here.

import type { CSSProperties } from "react";
import { ModelSeal } from "@/components/model-seal";
import { MODEL_COPY, MODEL_CORPUS } from "@/lib/model-claims";
import { SceneHead } from "../_ui/scene-head";
import { Section } from "../_ui/section";

export function TheModelSection() {
  return (
    <Section id="the-model" labelledBy="model-title">
      <div className="reveal col-span-4 self-start sm:col-span-8 lg:sticky lg:top-28 lg:col-span-4">
        <ModelSeal id="model-seal" className="w-[200px] lg:w-[240px]" />
        <SceneHead
          id="model-title"
          eyebrow={MODEL_COPY.eyebrow}
          lines={MODEL_COPY.headingLines}
          size="2"
          className="mt-10"
        />
        <p className="mt-5 max-w-[400px] text-base text-text-soft">{MODEL_COPY.paragraph}</p>
      </div>
      <div className="reveal col-span-4 mt-14 sm:col-span-8 lg:col-span-7 lg:col-start-6 lg:mt-0">
        <ul role="list" aria-label={MODEL_COPY.ledgerLabel}>
          {MODEL_CORPUS.map((row, index) => (
            <li
              key={row.title}
              className="ledger-row grid grid-cols-[88px_minmax(0,1fr)] gap-x-4 py-7 lg:grid-cols-[144px_minmax(0,1fr)] lg:gap-x-6"
              style={{ "--k": index } as CSSProperties}
            >
              <p
                aria-hidden="true"
                className="figure text-[1.75rem] leading-none text-text lg:text-[2.5rem]"
              >
                {row.figure}
              </p>
              <div>
                <h3 className="text-title text-text">
                  <span className="sr-only">{row.figure} </span>
                  {row.title}
                </h3>
                <p className="mt-1.5 max-w-[520px] text-base text-text-soft">{row.line}</p>
              </div>
            </li>
          ))}
        </ul>
        {/* The rule under the last row runs the full column; the line itself is held to a measure. */}
        <div className="ledger-row pt-10">
          <p className="max-w-[560px] font-accent text-[1.5rem] leading-[1.25] tracking-[-0.005em] text-text-80 italic lg:text-[1.75rem]">
            {MODEL_COPY.yoursLine}
          </p>
        </div>
      </div>
    </Section>
  );
}
