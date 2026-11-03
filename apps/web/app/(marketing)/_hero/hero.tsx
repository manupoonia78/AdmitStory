// The landing hero (direction §4.2, plan §9.1): "Say one thing about yourself." Server markup:
// the Voiceprint poster (inline SVG, no request), the H1 (the LCP element: never hidden, moved or
// animated), the subline, and HeroStage, the one small client island that owns the actions.
//
// The poster is the sample applicant's form. HeroStage lays the live WebGL form over it once the
// renderer gate opens (desktop: after load, on idle; phones: on the first touch), so the page paints
// finished and the form "wakes when you arrive".

import { VoiceprintStill } from "@admitstory/ui";
import type { CSSProperties } from "react";
import { HERO_COPY } from "../_copy/hero";
import { SAMPLE_IDENTITY } from "../_data/sample";
import { DisplayHeading } from "../_ui/display-heading";
import { MarginNote } from "../_ui/notes";
import { SECTION_GRID } from "../_ui/section";
import { HeroStage } from "./hero-stage";

export function Hero() {
  return (
    <section
      id="hero"
      aria-labelledby="hero-title"
      data-theme="night"
      className="grain hero-ink relative isolate overflow-clip bg-space text-text"
      // The sample form is drawn in the brand's bronze; a visitor's own form takes their hue.
      style={{ "--voice-night": "#d4ae6a", "--voice-day": "#8a6420" } as CSSProperties}
    >
      <HeroSheets />
      <figure aria-label={HERO_COPY.formLabel} className="hero-form-box">
        <VoiceprintStill identity={SAMPLE_IDENTITY} size="fill" label="" />
      </figure>
      <div className="hero-stage relative z-10 flex min-h-svh flex-col justify-end pb-8 pt-28 sm:pb-14">
        <div className={SECTION_GRID}>
          <p className="hero-copy eyebrow col-span-4 mb-6 sm:col-span-8">{HERO_COPY.eyebrow}</p>
          <div className="hero-copy col-span-4 sm:col-span-8 lg:col-span-8">
            <DisplayHeading
              level={1}
              size="xl"
              id="hero-title"
              lines={HERO_COPY.headingLines}
              phoneLines={HERO_COPY.headingPhoneLines}
              className="max-sm:text-display-lg"
            />
          </div>
          <p className="hero-copy col-span-4 mt-6 max-w-[34rem] text-lg leading-relaxed text-text-soft sm:col-span-6 sm:mt-7 sm:text-[1.25rem] lg:col-span-5">
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

/**
 * Pages from the sample applicant's application, resting at the edges of the hero like papers on
 * a desk at night. Decorative and static: real copy so it reads as a document, never the subject.
 */
function HeroSheets() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-20 hidden lg:block">
      <div className="hero-sheet left-[-3rem] top-[16%] w-[22rem] rotate-[-7deg]">
        <p className="hero-sheet-head">Essay 1 · Northfield</p>
        <p>
          It was 2 a.m. and the feed from the lab system was dropping every fourth message. Nobody
          on the ward could see it yet, but I could.
        </p>
      </div>
      <div className="hero-sheet right-[-2rem] top-[9%] w-[20rem] rotate-[5deg]">
        <p className="hero-sheet-head">Short answer · Goals</p>
        <p>I want to learn to build teams that never need that call.</p>
      </div>
      <div className="hero-sheet bottom-[-3rem] right-[14%] w-[18rem] rotate-[-3deg]">
        <p className="hero-sheet-head">Recommender brief</p>
        <p>Ask about the go-live in March: the runbook still exists.</p>
      </div>
    </div>
  );
}
