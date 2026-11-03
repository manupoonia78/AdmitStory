// Start free (direction §4.10). A Night band: a still 240 px Voiceprint, the one centred display
// line on the page, and two actions. The form is the sample applicant's until the idle island
// finds the visitor's own (they spoke or wrote in the hero), and it swaps in the same box, so
// nothing shifts.

import { FINAL_COPY } from "../_copy/landing";
import { SIGN_IN, START_FREE } from "../_copy/shared";
import { CtaLink, START_FREE_HREF } from "../_ui/cta-link";
import { DisplayHeading } from "../_ui/display-heading";
import { sampleHueStyle } from "../_ui/sample-hue";
import { Section } from "../_ui/section";
import { FinalVoiceprintIsland } from "./final-voiceprint-island";

export function FinalCall() {
  return (
    <Section labelledBy="final-title" theme="night" className="border-t border-edge">
      <div className="col-span-4 flex flex-col items-center text-center sm:col-span-8 lg:col-span-12">
        <div className="size-[240px]" style={sampleHueStyle()}>
          <FinalVoiceprintIsland islandClassName="size-full" />
        </div>
        <DisplayHeading
          level={2}
          size="lg"
          id="final-title"
          lines={[FINAL_COPY.heading]}
          className="mt-12 max-w-[14ch] sm:max-w-[18ch]"
        />
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <CtaLink href={START_FREE_HREF} track="final-call">
            {START_FREE}
          </CtaLink>
          <CtaLink href="/sign-in" variant="text">
            {SIGN_IN}
          </CtaLink>
        </div>
      </div>
    </Section>
  );
}
