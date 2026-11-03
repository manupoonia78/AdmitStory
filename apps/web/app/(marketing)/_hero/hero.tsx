// The landing hero (direction §4.2, plan §9.1): "Say one thing about yourself." Server markup:
// the Voiceprint poster (inline SVG, no request), the H1 (the LCP element: never hidden, moved or
// animated), the subline, and HeroStage, the one small client island that owns the actions.
//
// The poster is the sample applicant's form. HeroStage lays the live WebGL form over it once the
// renderer gate opens (desktop: after load, on idle; phones: on the first touch), so the page paints
// finished and the form "wakes when you arrive".

import { VoiceprintStill } from "@admitstory/ui";
import { HERO_COPY } from "../_copy/hero";
import { SAMPLE_IDENTITY } from "../_data/sample";
import { DisplayHeading } from "../_ui/display-heading";
import { MarginNote } from "../_ui/notes";
import { sampleHueStyle } from "../_ui/sample-hue";
import { SECTION_GRID } from "../_ui/section";
import { HeroStage } from "./hero-stage";

export function Hero() {
  return (
    <section
      id="hero"
      aria-labelledby="hero-title"
      data-theme="night"
      className="grain relative isolate overflow-clip bg-space text-text"
      style={sampleHueStyle()}
    >
      <figure aria-label={HERO_COPY.formLabel} className="hero-form-box">
        <VoiceprintStill identity={SAMPLE_IDENTITY} size="fill" label="" />
      </figure>
      <div className="hero-stage relative z-10 flex min-h-svh flex-col justify-end pb-8 pt-28 sm:pb-14">
        <div className={SECTION_GRID}>
          <div className="hero-copy col-span-4 sm:col-span-8 lg:col-span-9">
            <DisplayHeading
              level={1}
              size="xl"
              id="hero-title"
              lines={HERO_COPY.headingLines}
              phoneLines={HERO_COPY.headingPhoneLines}
              className="max-sm:text-display-lg"
            />
          </div>
          <p className="hero-copy col-span-4 mt-5 font-reading text-read text-text-soft sm:col-span-6 sm:mt-6 sm:text-read-lg lg:col-span-5">
            {HERO_COPY.subline}
          </p>
          <div className="col-span-4 mt-6 sm:col-span-8 sm:mt-8 lg:col-span-8">
            <HeroStage />
          </div>
        </div>
        <MarginNote className="absolute bottom-6 right-12 hidden max-w-[14rem] text-right lg:block">
          {HERO_COPY.scrollNote}
        </MarginNote>
      </div>
      <div id="hero-end" aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px" />
    </section>
  );
}
