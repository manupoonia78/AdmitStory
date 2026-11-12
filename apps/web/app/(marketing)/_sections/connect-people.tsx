// Connect (Manu, 4 Nov 2026): every school pack comes with people from that school. The section
// is the human part of the page: the claim, three kinds of people, then a slow strip of faces.
// The faces are illustrative stock portraits, never named or shown as real alumni; the line under
// them says unlocking a school is what matches you with real people. Server markup; the strip is CSS only (components/people-carousel.tsx).

import { PeopleCarousel } from "@/components/people-carousel";
import { CONNECT_COPY } from "../_copy/landing";
import { CtaLink } from "../_ui/cta-link";
import { DisplayHeading } from "../_ui/display-heading";
import { HairlineList, HairlineRow } from "../_ui/hairline";
import { SECTION_GRID } from "../_ui/section";

export function ConnectPeopleSection() {
  return (
    <section
      id="connect"
      aria-labelledby="connect-title"
      className="relative border-y border-edge bg-depth py-24 sm:py-32 lg:py-40"
    >
      <div className={SECTION_GRID}>
        <div className="col-span-4 sm:col-span-8 lg:col-span-6">
          <p className="eyebrow mb-6">{CONNECT_COPY.eyebrow}</p>
          <DisplayHeading
            level={2}
            size="lg"
            id="connect-title"
            lines={CONNECT_COPY.headingLines}
          />
          <p className="mt-8 max-w-[36rem] text-lg leading-relaxed text-text-soft">
            {CONNECT_COPY.paragraph}
          </p>
          <CtaLink href="/pricing" variant="text" className="mt-4">
            {CONNECT_COPY.link}
          </CtaLink>
        </div>
        <div className="col-span-4 mt-12 sm:col-span-8 lg:col-span-5 lg:col-start-8 lg:mt-auto">
          <HairlineList label="Who you can talk to">
            {CONNECT_COPY.points.map((point) => (
              <HairlineRow
                key={point.figure}
                className="grid grid-cols-[6.5rem_1fr] items-baseline gap-x-5"
              >
                <p className="font-display text-[1.5rem] font-light text-accent">{point.figure}</p>
                <p className="text-base text-text">{point.line}</p>
              </HairlineRow>
            ))}
          </HairlineList>
        </div>
      </div>
      <PeopleCarousel className="mt-16 lg:mt-20" />
    </section>
  );
}
