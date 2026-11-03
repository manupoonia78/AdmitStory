// The layout /privacy and /terms share (direction §7–8, plan §9.5.1). The heading at display size
// with the date it was last updated, then each section as an <h2 id>: a plain summary in Newsreader
// on the left, the full text on the right. From 1280 px a sticky contents list sits in the left
// margin; narrower, the contents are a <details> at the top and each summary sits above its text.
// Follows the page theme. Server-only, no client code.

import type { ReactNode } from "react";
import { DisplayHeading } from "../_ui/display-heading";
import { Section } from "../_ui/section";
import {
  LEGAL_DRAFT,
  LEGAL_DRAFT_NOTE,
  LEGAL_UPDATED,
  type LegalBlock,
  type LegalSection,
} from "./legal-types";

export function updatedOn(isoDate: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

function Block({ block }: { block: LegalBlock }) {
  if (typeof block === "string") return <p>{block}</p>;
  return (
    <ul role="list" className="flex flex-col gap-2 border-l border-edge pl-4">
      {block.list.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function ContentsLinks({ sections }: { sections: readonly LegalSection[] }) {
  return (
    <ol role="list" className="flex flex-col">
      {sections.map((section) => (
        <li key={section.id}>
          <a
            href={`#${section.id}`}
            className="inline-flex min-h-11 items-center text-sm text-text-soft underline-offset-4 hover:text-text hover:underline xl:min-h-9"
          >
            {section.title}
          </a>
        </li>
      ))}
    </ol>
  );
}

export interface LegalLayoutProps {
  title: string;
  titleId: string;
  contentsLabel: string;
  sections: readonly LegalSection[];
  /** The page's one hero moment, between the heading and the sections (privacy's diagram). */
  hero?: ReactNode;
}

export function LegalLayout({ title, titleId, contentsLabel, sections, hero }: LegalLayoutProps) {
  return (
    <Section labelledBy={titleId} spacing="compact">
      <header className="col-span-4 sm:col-span-8 lg:col-span-12">
        <DisplayHeading level={1} size="md" id={titleId} lines={[title]} />
        <p className="mt-4 text-sm text-text-soft">
          Last updated <time dateTime={LEGAL_UPDATED}>{updatedOn(LEGAL_UPDATED)}</time>
        </p>
        {LEGAL_DRAFT ? <p className="mt-1 text-sm text-text-soft">{LEGAL_DRAFT_NOTE}</p> : null}
      </header>

      {hero ? <div className="col-span-4 mt-14 sm:col-span-8 lg:col-span-12">{hero}</div> : null}

      <details className="col-span-4 mt-14 border-y border-edge sm:col-span-8 lg:col-span-12 xl:hidden">
        <summary className="flex min-h-11 cursor-pointer items-center text-base font-medium text-text">
          {contentsLabel}
        </summary>
        <div className="pb-4">
          <ContentsLinks sections={sections} />
        </div>
      </details>

      <div className="col-span-4 mt-6 sm:col-span-8 lg:col-span-12 xl:mt-16 xl:grid xl:grid-cols-12 xl:gap-x-6">
        {/* pt: the first section's rule and py-10 (41 px), less half the 36 px link minus half the
            32 px heading, so the first link sits level with the first <h2>. */}
        <nav aria-label={contentsLabel} className="hidden xl:col-span-2 xl:block xl:pt-[39px]">
          <div className="sticky top-28">
            <ContentsLinks sections={sections} />
          </div>
        </nav>
        <div className="xl:col-span-10">
          {sections.map((section) => (
            <section
              key={section.id}
              aria-labelledby={section.id}
              className="grid gap-y-4 border-t border-edge py-10 first:border-t-0 xl:first:border-t lg:grid-cols-12 lg:gap-x-6 xl:grid-cols-10"
            >
              <h2
                id={section.id}
                className="scroll-mt-28 text-read-lg font-semibold text-text lg:col-span-12 xl:col-span-10"
              >
                {section.title}
              </h2>
              <p className="max-w-[34rem] font-reading text-read text-text lg:col-span-5 xl:col-span-4">
                {section.summary}
              </p>
              <div className="flex max-w-[40rem] flex-col gap-3 text-base leading-[22px] text-text-soft lg:col-span-7 xl:col-span-6">
                {section.body.map((block, index) => (
                  <Block key={index} block={block} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </Section>
  );
}
