// Real screens (direction §4.5): captures of the real app in a native sideways scroller with snap.
// No motion, no mock-ups. A capture that hasn't been taken is left out (_data/screens.ts), and with
// fewer than two the row isn't drawn at all: the heading and its paragraph stand alone.

import Image from "next/image";
import { SCREENS_COPY } from "../_copy/landing";
import { availableScreens } from "../_data/screens";
import { DisplayHeading } from "../_ui/display-heading";
import { Section } from "../_ui/section";
import { AppPreview } from "./app-preview";
import { ScreensStepper } from "./screens-stepper";

const SCROLLER_ID = "real-screens-row";

export function RealScreens() {
  const screens = availableScreens();
  return (
    <Section labelledBy="screens-title" className="overflow-x-clip">
      <div className="col-span-4 sm:col-span-8 lg:col-span-7">
        <DisplayHeading level={2} size="md" id="screens-title" lines={[SCREENS_COPY.heading]} />
      </div>
      <p className="col-span-4 mt-6 text-lg text-text-soft sm:col-span-6 lg:col-span-5 lg:col-start-1">
        {SCREENS_COPY.paragraph}
      </p>
      {screens.length >= 2 ? (
        <div className="col-span-4 mt-14 sm:col-span-8 lg:col-span-12 lg:mt-20">
          <ul
            id={SCROLLER_ID}
            role="list"
            // Focusable, so keyboard users can scroll it with the arrow keys.
            tabIndex={0}
            aria-label={SCREENS_COPY.regionLabel}
            data-lenis-prevent-horizontal=""
            className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto overscroll-x-contain px-4 pb-4 [scrollbar-width:thin] sm:-mx-8 sm:scroll-px-8 sm:gap-6 sm:px-8 lg:-mx-12 lg:scroll-px-12 lg:px-12"
          >
            {screens.map((screen) => (
              <li
                key={screen.id}
                data-screen={screen.id}
                className="w-[88vw] shrink-0 snap-start lg:w-[880px]"
              >
                <figure>
                  <div className="plane overflow-hidden p-0">
                    <Image
                      src={screen.file}
                      width={screen.width}
                      height={screen.height}
                      alt={screen.alt}
                      sizes="(min-width:1024px) 880px, 88vw"
                      loading="lazy"
                      className="block h-auto w-full"
                    />
                  </div>
                  <figcaption className="mt-4 max-w-[36rem]">
                    <span className="block text-lg font-semibold text-text">{screen.name}</span>
                    <span className="mt-1 block text-base text-text-soft">{screen.caption}</span>
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
          <ScreensStepper
            target={SCROLLER_ID}
            previous={SCREENS_COPY.previous}
            next={SCREENS_COPY.next}
          />
        </div>
      ) : (
        <div className="col-span-4 mt-14 sm:col-span-8 lg:col-span-12 lg:mt-20">
          <AppPreview />
        </div>
      )}
    </Section>
  );
}
