// How it works, in three steps (direction §4.4, redesigned 4 Nov 2026). Each step shows what it
// hands you rather than describing it: a line of the Studio transcript, the first lines of a
// Profile Read, a school pack's file map. A rail above the three carries time and cost, so the
// order of things reads at a glance. Server markup and CSS only; the sheets rise into place on
// scroll where the browser has scroll-driven animations (marketing.css .steps-sheet).

import { cx } from "@admitstory/ui";
import type { ReactNode } from "react";
import { FICTIONAL_NOTE } from "../_copy/shared";
import { LINES_COPY } from "../_copy/landing";
import { SAMPLE_LINE } from "../_data/sample";
import { CtaLink } from "../_ui/cta-link";
import { DisplayHeading } from "../_ui/display-heading";
import { Section } from "../_ui/section";

/** A fixed waveform for the transcript sheet: the sample applicant's answer, drawn once. */
const WAVE = [
  3, 5, 8, 6, 10, 14, 9, 12, 7, 4, 6, 11, 15, 12, 8, 5, 9, 13, 10, 6, 4, 7, 12, 16, 11, 7, 5, 8, 10,
  6, 3, 5, 9, 12, 8, 4,
] as const;

export function HowItWorksLines() {
  const [studio, read, pack] = LINES_COPY.rows;
  return (
    <Section labelledBy="lines-title">
      <div className="col-span-4 sm:col-span-8 lg:col-span-6">
        <p className="eyebrow mb-6">{LINES_COPY.eyebrow}</p>
        <DisplayHeading level={2} size="lg" id="lines-title" lines={LINES_COPY.headingLines} />
      </div>
      <div className="col-span-4 mt-6 sm:col-span-6 lg:col-span-4 lg:col-start-8 lg:mt-auto">
        <p className="text-lg text-text-soft">{LINES_COPY.paragraph}</p>
        <CtaLink href="/how-it-works" variant="text" className="mt-3">
          {LINES_COPY.link}
        </CtaLink>
      </div>

      <ol
        aria-label={LINES_COPY.label}
        role="list"
        className="steps col-span-4 mt-16 grid gap-14 sm:col-span-8 lg:col-span-12 lg:mt-24 lg:grid-cols-3 lg:grid-rows-[auto_1fr_auto_auto_auto] lg:gap-x-8 lg:gap-y-0"
      >
        <Step row={studio}>
          <Sheet header={LINES_COPY.transcript.header}>
            <p className="text-sm text-text-soft">{LINES_COPY.transcript.question}</p>
            <div aria-hidden="true" className="mt-5 flex h-8 items-center gap-[3px]">
              {WAVE.map((height, index) => (
                <span
                  key={index}
                  className="steps-bar w-[3px] rounded-full bg-accent"
                  style={{ height: `${height * 2}px` }}
                />
              ))}
            </div>
            <p className="mt-4 font-reading text-[1.0625rem] leading-snug text-text">
              “{SAMPLE_LINE}”
            </p>
            <p className="mt-5 inline-flex items-center gap-2 self-start rounded-full border border-accent/40 px-3 py-1 text-sm text-text">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
              <span className="meta">{LINES_COPY.transcript.found}</span>
              {LINES_COPY.transcript.story}
            </p>
          </Sheet>
        </Step>

        <Step row={read}>
          <Sheet header={LINES_COPY.read.header}>
            <p className="font-display text-[1.375rem] leading-tight text-text">
              {LINES_COPY.read.headline}
            </p>
            <dl className="mt-5 divide-y divide-edge border-y border-edge text-sm">
              {[LINES_COPY.read.strength, LINES_COPY.read.doubt].map((line) => (
                <div key={line.label} className="grid grid-cols-[4.5rem_1fr] gap-3 py-3">
                  <dt className="meta pt-0.5">{line.label}</dt>
                  <dd className="text-text">{line.text}</dd>
                </div>
              ))}
            </dl>
            <p className="meta mt-4 flex items-center gap-2">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
              {LINES_COPY.read.footer}
            </p>
          </Sheet>
        </Step>

        <Step row={pack}>
          <Sheet header={LINES_COPY.pack.header}>
            <ul role="list" className="divide-y divide-edge border-y border-edge text-sm">
              {LINES_COPY.pack.files.map((file) => (
                <li key={file.what} className="flex items-baseline justify-between gap-4 py-2.5">
                  <span className="text-text">{file.what}</span>
                  <span className="truncate text-right text-text-soft">{file.story}</span>
                </li>
              ))}
            </ul>
            <p className="meta mt-4 flex items-center gap-2">
              <CheckGlyph />
              {LINES_COPY.pack.status}
            </p>
          </Sheet>
        </Step>
      </ol>
      <p className="meta col-span-4 mt-10 sm:col-span-8 lg:col-span-12">{FICTIONAL_NOTE}</p>
    </Section>
  );
}

type Row = (typeof LINES_COPY.rows)[number];

/** One step: the rail stop (when, and what it costs), the sheet, then the step in words. */
function Step({ row, children }: { row: Row; children: ReactNode }) {
  return (
    <li className="steps-step relative flex flex-col lg:row-span-5 lg:grid lg:grid-rows-subgrid">
      <div className="steps-rail relative mb-6 flex items-center gap-3">
        <span
          aria-hidden="true"
          className="relative z-10 grid size-9 place-items-center rounded-full border border-accent/50 bg-space font-mono text-xs text-accent"
        >
          {row.n}
        </span>
        <span className="meta">{row.rail}</span>
        <span className="ms-auto font-display text-[1.25rem] text-text tabular-nums">
          {row.value}
        </span>
      </div>
      {children}
      <p className="eyebrow mt-8">{row.kicker}</p>
      <h3 className="mt-3 font-display text-display-sm text-text">{row.step}</h3>
      <p className="mt-3 max-w-[30rem] text-lg text-text-soft">{row.sentence}</p>
    </li>
  );
}

/** A sheet of the product, set like a page lifted from the app. Decorative copy, real layout. */
function Sheet({ header, children }: { header: string; children: ReactNode }) {
  return (
    <div
      className={cx(
        "steps-sheet plane flex min-h-[19rem] flex-col p-6",
        "shadow-[0_30px_60px_-34px_rgb(26_23_19/0.45)]",
      )}
    >
      <p className="meta mb-5 flex items-center justify-between">
        <span>{header}</span>
        <span aria-hidden="true" className="flex gap-1">
          <span className="size-1.5 rounded-full bg-edge" />
          <span className="size-1.5 rounded-full bg-edge" />
          <span className="size-1.5 rounded-full bg-edge" />
        </span>
      </p>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}

function CheckGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3 text-accent">
      <path d="M2 6.5 5 9l5-6" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
