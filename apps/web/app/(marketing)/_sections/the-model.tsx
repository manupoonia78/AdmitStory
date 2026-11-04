// The model (Manu, 4 Nov 2026): what's selling is the model, so the page says what it was trained
// on. A Night plane: the seal on the left, the claim and a ledger of what it learned from on the
// right, each row led by its figure in the display serif. One motion only, the seal's slow ring.
// Copy and figures: lib/model-claims.ts.

import { ModelSeal } from "@/components/model-seal";
import { MODEL_COPY, MODEL_CORPUS } from "@/lib/model-claims";
import { DisplayHeading } from "../_ui/display-heading";
import { HairlineList, HairlineRow } from "../_ui/hairline";
import { Section } from "../_ui/section";

export function TheModelSection() {
  return (
    <Section id="the-model" labelledBy="model-title" theme="night">
      <div className="col-span-4 sm:col-span-8 lg:col-span-4 lg:row-span-2">
        <ModelSeal
          id="model-seal"
          className="mx-auto w-[min(17rem,72vw)] lg:sticky lg:top-28 lg:mx-0 lg:w-full lg:max-w-[22rem]"
        />
      </div>
      <div className="col-span-4 mt-14 sm:col-span-8 lg:col-span-7 lg:col-start-6 lg:mt-0">
        <p className="eyebrow mb-6">{MODEL_COPY.eyebrow}</p>
        <DisplayHeading level={2} size="lg" id="model-title" lines={MODEL_COPY.headingLines} />
        <p className="mt-8 max-w-[36rem] text-lg leading-relaxed text-text-soft">
          {MODEL_COPY.paragraph}
        </p>
      </div>
      <div className="col-span-4 mt-14 sm:col-span-8 lg:col-span-7 lg:col-start-6 lg:mt-16">
        <HairlineList label={MODEL_COPY.ledgerLabel}>
          {MODEL_CORPUS.map((row) => (
            <HairlineRow
              key={row.title}
              className="grid grid-cols-[5.5rem_1fr] gap-x-5 sm:grid-cols-[8rem_1fr] sm:gap-x-8"
            >
              <p
                aria-hidden="true"
                className="font-display text-display-sm font-light text-accent tabular-nums [line-height:1]"
              >
                {row.figure}
              </p>
              <div>
                <h3 className="text-lg text-text">
                  <span className="sr-only">{row.figure} </span>
                  {row.title}
                </h3>
                <p className="mt-1.5 max-w-[34rem] text-base text-text-soft">{row.line}</p>
              </div>
            </HairlineRow>
          ))}
        </HairlineList>
        <p className="mt-10 max-w-[34rem] font-reading text-xl text-text [line-height:1.4]">
          {MODEL_COPY.yoursLine}
        </p>
      </div>
    </Section>
  );
}
