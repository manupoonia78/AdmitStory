// The layout /privacy and /terms share (SPEC §4.2): paper, for reading. The page is one sheet
// from the top of the window to a rounded foot where the dark footer begins; the nav stays the
// dark pill above it. The head sits in columns 5–12; under it, from 1024 px, a sticky contents
// list in columns 1–3, each section's number hanging in column 4, and the text in columns 5–11
// at 68ch: the plain summary in the reading serif's italic, then the full text. Narrower, the
// contents are a <details> above the sections. Server-only, no client code.
//
// `readingLine` (/terms): a brass line grows down the contents list's rule as the sections are
// read, on a scroll-driven view timeline. No script; absent where unsupported and under reduced
// motion (marketing.css, .legal-read).

import type { CSSProperties, ReactNode } from "react";
import { cx } from "@admitstory/ui";
import { SECTION_GRID } from "../_ui/section";
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

const number = (index: number) => String(index + 1).padStart(2, "0");

function Block({ block }: { block: LegalBlock }) {
  if (typeof block === "string") return <p>{block}</p>;
  return (
    <ul role="list" className="legal-list">
      {block.list.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function ContentsLinks({ sections }: { sections: readonly LegalSection[] }) {
  return (
    <ol role="list" className="legal-contents-list">
      {sections.map((section, index) => (
        <li key={section.id}>
          <a href={`#${section.id}`}>
            <span aria-hidden="true" className="legal-contents-number">
              {number(index)}
            </span>
            {section.title}
          </a>
        </li>
      ))}
    </ol>
  );
}

export interface LegalLayoutProps {
  titleLines: readonly string[];
  titleId: string;
  contentsLabel: string;
  sections: readonly LegalSection[];
  /** The page's one moment, between the head and the sections (privacy's voice path). */
  hero?: ReactNode;
  /** The reading line along the contents (terms). */
  readingLine?: boolean;
}

export function LegalLayout({
  titleLines,
  titleId,
  contentsLabel,
  sections,
  hero,
  readingLine = false,
}: LegalLayoutProps) {
  const last = titleLines.length - 1;
  return (
    <div data-theme="day" className={cx("legal", readingLine && "legal-reading")}>
      <header className={cx(SECTION_GRID, "legal-head")}>
        <div className="col-span-4 sm:col-span-8 lg:col-span-8 lg:col-start-5">
          <p className="label enter" style={{ "--i": 0 } as CSSProperties}>
            Legal · last updated <time dateTime={LEGAL_UPDATED}>{updatedOn(LEGAL_UPDATED)}</time>
          </p>
          <h1 id={titleId} className="mt-6 font-display text-display-1 text-text">
            {titleLines.map((line, index) => (
              <span
                key={line}
                className="enter block"
                style={{ "--i": index === 0 ? 0.8 : 1.45 } as CSSProperties}
              >
                {index === last && last > 0 ? <em>{line}</em> : line}
                {index < last ? " " : null}
              </span>
            ))}
          </h1>
          {LEGAL_DRAFT ? (
            <p className="enter mt-5 text-sm text-text-soft" style={{ "--i": 2 } as CSSProperties}>
              {LEGAL_DRAFT_NOTE}
            </p>
          ) : null}
        </div>
      </header>

      {hero ? <div className={cx(SECTION_GRID, "mt-16 lg:mt-24")}>{hero}</div> : null}

      <div className={cx(SECTION_GRID, "legal-body")}>
        <details className="legal-contents-details col-span-4 sm:col-span-8">
          <summary>{contentsLabel}</summary>
          <ContentsLinks sections={sections} />
        </details>

        <nav aria-label={contentsLabel} className="legal-contents">
          <div className="legal-contents-inner">
            <p className="label">{contentsLabel}</p>
            <div className="legal-contents-rule">
              {readingLine ? <span aria-hidden="true" className="legal-read" /> : null}
              <ContentsLinks sections={sections} />
            </div>
          </div>
        </nav>

        <div className="legal-sections col-span-4 sm:col-span-8 lg:col-span-8 lg:col-start-4">
          {sections.map((section, index) => (
            <section key={section.id} aria-labelledby={section.id} className="legal-section">
              <p aria-hidden="true" className="label legal-number">
                {number(index)}
              </p>
              <div className="legal-text">
                <h2 id={section.id} className="legal-h2">
                  {section.title}
                </h2>
                <p className="legal-summary">{section.summary}</p>
                <div className="legal-full">
                  {section.body.map((block, blockIndex) => (
                    <Block key={blockIndex} block={block} />
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
