// The superscript source mark after a school figure (spec §5.5 AC: every number carries source +
// year). The mark is a link to its numbered footnote under the table, so the source is never only
// in a hover label, and its accessible name carries the full source. Hover or focus also shows the
// source beside it, drawn in CSS: no tooltip library reaches the route's first load (§6.11), and
// the table stays a server component.

import { cx } from "../lib/cx";
import { citationText } from "./citation";
import type { Citation } from "./types";

export interface CitationMarkProps {
  citation: Citation;
  /** The footnote's number. */
  index: number;
  /** The id of the footnote it links to. */
  footnoteId: string;
  locale?: string;
  className?: string;
}

export function CitationMark({
  citation,
  index,
  footnoteId,
  locale,
  className,
}: CitationMarkProps) {
  const text = citationText(citation, locale);
  return (
    // The hover and focus label is CSS-generated from data-source, so it isn't page text: the
    // link's accessible name already carries the source, and copying the table copies the figures.
    <span
      data-source={text}
      className="group/cite relative inline-block after:invisible after:absolute after:bottom-full after:left-1/2 after:z-10 after:mb-1 after:w-max after:max-w-64 after:-translate-x-1/2 after:rounded-control after:border after:border-edge after:bg-depth after:px-2 after:py-1 after:text-xs after:leading-snug after:text-text after:opacity-0 after:transition-opacity after:duration-150 after:content-[attr(data-source)] focus-within:after:visible focus-within:after:opacity-100 hover:after:visible hover:after:opacity-100 motion-reduce:after:transition-none"
    >
      <a
        href={`#${footnoteId}`}
        aria-label={`Source ${index}: ${text}`}
        data-citation={index}
        className={cx(
          "relative ml-0.5 rounded-control align-super text-sm leading-none tabular-nums text-signal no-underline hover:underline",
          // A 24px target (WCAG 2.2 2.5.8) around a small mark.
          "before:absolute before:left-1/2 before:top-1/2 before:size-6 before:-translate-1/2",
          className,
        )}
      >
        {index}
      </a>
    </span>
  );
}
