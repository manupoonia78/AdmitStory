// How it works, in three lines (direction §4.4). The order of things and what each costs in time
// or money, with no diagram and no motion. Page theme.

import { LINES_COPY } from "../_copy/landing";
import { CtaLink } from "../_ui/cta-link";
import { DisplayHeading } from "../_ui/display-heading";
import { HairlineList, HairlineRow } from "../_ui/hairline";
import { Section } from "../_ui/section";

export function HowItWorksLines() {
  return (
    <Section labelledBy="lines-title">
      <div className="col-span-4 sm:col-span-8 lg:col-span-7">
        <DisplayHeading level={2} size="md" id="lines-title" lines={[LINES_COPY.heading]} />
      </div>
      <div className="col-span-4 mt-6 sm:col-span-6 lg:col-span-5 lg:col-start-1">
        <p className="text-lg text-text-soft">{LINES_COPY.paragraph}</p>
        <CtaLink href="/how-it-works" variant="text" className="mt-3">
          {LINES_COPY.link}
        </CtaLink>
      </div>
      <HairlineList
        ordered
        className="col-span-4 mt-14 sm:col-span-8 lg:col-span-12 lg:mt-20"
        label="Three steps"
      >
        {LINES_COPY.rows.map((row) => (
          <HairlineRow
            key={row.step}
            className="grid grid-cols-4 gap-x-4 gap-y-3 sm:grid-cols-8 sm:gap-x-6 lg:grid-cols-12"
          >
            <h3 className="col-span-4 text-display-sm text-text sm:col-span-8 lg:col-span-6">
              {row.step}
            </h3>
            <p className="col-span-4 text-lg text-text-soft sm:col-span-5 lg:col-span-4 lg:pt-2">
              {row.sentence}
            </p>
            <p className="col-span-4 text-lg text-text tabular-nums sm:col-span-3 sm:text-right lg:col-span-2 lg:pt-2">
              {row.value}
            </p>
          </HairlineRow>
        ))}
      </HairlineList>
    </Section>
  );
}
