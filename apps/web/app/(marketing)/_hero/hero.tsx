// The landing hero (SPEC §3): "voice becomes story becomes essays". Server markup throughout.
//
// One line crosses the hero: the horizon. Under the headline it lies flat; across the stage it is
// a voice. A fictional applicant's sentence rests on it, and above the sentence are the openings
// of three essays built from it, each with a margin note saying why.
//
// What the server sends is the poster: the finished picture, still. It is what a visitor sees
// first, what stays under reduced motion or without JavaScript, and the H1 in it is the LCP
// element. HeroLoopGate (a few hundred bytes) waits for load, idle and the hero being in view,
// then imports ./hero-loop, which takes the same markup over and plays the other two applicants.
// All three are in the HTML (two hidden), so the loop carries no copy and nothing shifts.

import { buttonStyles, cx, estimateWordTimings } from "@admitstory/ui";
import Link from "next/link";
import type { CSSProperties } from "react";
import { ModelSealMark } from "@/components/model-seal";
import { MODEL_NAME, TRAINED_ON } from "@/lib/model-claims";
import { HERO_COPY, HERO_FACTS, HERO_SAMPLES, type HeroSample } from "../_copy/hero";
import { trackAttributes } from "../_lib/track";
import { START_FREE_HREF } from "../_ui/cta-link";
import { SECTION_GRID } from "../_ui/section";
import { sheetSerif } from "../_ui/sheet-serif";
import { HeroLoopGate } from "./hero-loop-gate";
import {
  LINE_BASE,
  LINE_HEIGHT,
  LINE_LG,
  LINE_STROKE,
  posterPath,
  type LineForm,
} from "./voiceline-shape";

/** Where "See how it works" lands: scene 3. */
const HOW_HREF = "#how";

/** The `enter` utility steps in 90 ms; the hero's order is set in milliseconds (SPEC §3.5). */
function enterAt(ms: number): CSSProperties {
  return { "--i": ms / 90 } as CSSProperties;
}

/** A believable speaking pace for the sample: about a quarter of a second a word. */
const SPEECH = { wpm: 215, clausePauseMs: 140, sentencePauseMs: 300 } as const;

export function Hero() {
  return (
    <section
      id="hero"
      aria-labelledby="hero-title"
      data-theme="night"
      className="hero grain bg-space text-text"
    >
      <div className="hero-main">
        <div className={cx(SECTION_GRID, "hero-grid")}>
          <div className="hero-copy col-span-4 sm:col-span-8 lg:col-span-7">
            <p className="eyebrow enter" style={enterAt(60)}>
              {HERO_COPY.eyebrow}
            </p>
            <HeroHeading />
            {/* Still from the first frame: it is the largest text above the fold, so it is the
                LCP element and must not wait on the entrance (Manu, 2026-11-17; SPEC §3.7). */}
            <p className="mt-5 text-lg text-text-80 sm:max-w-[520px] lg:mt-7 lg:max-w-[460px]">
              {HERO_COPY.subline}
            </p>
            <div
              className="enter mt-7 flex flex-col gap-3 sm:flex-row lg:mt-9"
              style={enterAt(640)}
            >
              <Link
                href={START_FREE_HREF}
                className={buttonStyles({ size: "lg", arrow: true })}
                {...trackAttributes("cta_start_free", { location: "hero" })}
              >
                {HERO_COPY.primary}
                <span aria-hidden="true" className="btn-arrow max-sm:ml-auto" />
              </Link>
              <a href={HOW_HREF} className={buttonStyles({ variant: "secondary", size: "lg" })}>
                {HERO_COPY.secondary}
              </a>
            </div>
            <a
              href="#the-model"
              className="enter mt-6 inline-flex min-h-11 items-center gap-3 text-sm text-text-soft transition-colors duration-(--dur-hover) hover:text-text lg:mt-8"
              style={enterAt(700)}
            >
              <ModelSealMark size={28} />
              <span>
                <span className="text-text-80">{MODEL_NAME}</span> · trained on {TRAINED_ON}
              </span>
            </a>
          </div>

          <div aria-hidden="true" className="hero-stage col-span-4 sm:col-span-8 lg:col-span-5">
            <div className="hero-fans">
              <div className="hero-fan">
                <span className="hero-leaf hero-slot" />
                <span className="hero-leaf hero-slot" />
                <span className="hero-leaf hero-slot" />
              </div>
              {HERO_SAMPLES.map((sample, index) => (
                <HeroFan key={sample.who} sample={sample} off={index > 0} />
              ))}
            </div>
            <div className="hero-says">
              {HERO_SAMPLES.map((sample, index) => (
                <HeroSay key={sample.who} sample={sample} off={index > 0} />
              ))}
            </div>
          </div>
          <p className="sr-only">{HERO_COPY.stageDescription}</p>
        </div>

        <div aria-hidden="true" data-hero-horizon="" className="hero-horizon">
          <PosterLine form={LINE_LG} className="hero-line-lg" />
          <PosterLine form={LINE_BASE} className="hero-line-base" />
          <canvas />
        </div>
      </div>

      <div className={cx(SECTION_GRID, "hero-strip")}>
        <ul role="list" className="contents">
          {HERO_FACTS.map((fact, index) => (
            <li key={fact.lead}>
              <span className="label block">{String(index + 1).padStart(2, "0")}</span>
              <p className="mt-2 text-ui font-normal text-text-soft lg:max-w-[272px]">
                <span className="font-medium text-text">{fact.lead}</span> {fact.rest}
              </p>
            </li>
          ))}
        </ul>
        <div className="hero-sample-note">
          <p className="label">{HERO_COPY.sampleNote}</p>
          <button
            type="button"
            hidden
            data-hero-pause=""
            data-pause-label={HERO_COPY.pause}
            data-play-label={HERO_COPY.play}
            aria-label={HERO_COPY.pause}
            className={cx(
              buttonStyles({ variant: "secondary", size: "sm", shape: "icon" }),
              "hero-pause",
            )}
          >
            <svg aria-hidden="true" viewBox="0 0 12 12" width="12" height="12" fill="currentColor">
              <path className="hero-pause-bars" d="M2.5 1.5h2.25v9H2.5zM7.25 1.5H9.5v9H7.25z" />
              <path className="hero-pause-play" d="M3 1.4v9.2L10.5 6z" />
            </svg>
          </button>
        </div>
      </div>
      <HeroLoopGate />
    </section>
  );
}

/**
 * The H1, word by word, so each word can rise in turn. Every word is in the markup at full
 * opacity; the hidden start exists only once the head script has set data-motion (render.css,
 * `enter`).
 */
function HeroHeading() {
  const lines = HERO_COPY.headingLines.map((line) => line.split(" "));
  return (
    <h1
      id="hero-title"
      className="mt-6 font-display text-display-hero text-text [font-kerning:normal]"
    >
      {lines.map((words, lineIndex) => {
        // How many words came before this line: each word rises 90 ms after the one before.
        const before = lines.slice(0, lineIndex).reduce((count, line) => count + line.length, 0);
        return (
          <span key={lineIndex} className="block">
            {words.map((text, index) => {
              const Tag = text === HERO_COPY.headingAccent ? "em" : "span";
              return (
                <span key={index}>
                  {index > 0 ? " " : null}
                  <Tag className="enter inline-block" style={enterAt(120 + 90 * (before + index))}>
                    {text}
                  </Tag>
                </span>
              );
            })}{" "}
          </span>
        );
      })}
    </h1>
  );
}

/** Three sheets of paper fanned like a hand of cards. Paper is Day, whatever the page is. */
function HeroFan({ sample, off }: { sample: HeroSample; off: boolean }) {
  return (
    <div data-hero-fan="" data-off={off ? "" : undefined} className="hero-fan">
      {sample.sheets.map((sheet) => (
        <article
          key={sheet.title}
          data-theme="day"
          data-hero-sheet=""
          className="hero-leaf hero-sheet"
        >
          <div className="hero-sheet-margin">
            <p className="hero-sheet-title">{sheet.title}</p>
            <p data-hero-note="" className="hero-sheet-note">
              {sheet.note}
            </p>
            <p className="hero-sheet-count">
              {sheet.count.written} / {sheet.count.limit}
              <br />
              words
            </p>
          </div>
          <div className="hero-sheet-body">
            <p className="hero-sheet-kicker">First draft</p>
            <p className={cx(sheetSerif.className, "hero-sheet-text")}>
              {sheet.before ? `${sheet.before} ` : null}
              {sheet.said ? (
                <>
                  <mark data-hero-mark="" className="sheet-mark">
                    {sheet.said}
                  </mark>{" "}
                </>
              ) : null}
              {sheet.after}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}

/** The sentence, one span a word, each carrying when it is said (the loop reads data-s/e). */
function HeroSay({ sample, off }: { sample: HeroSample; off: boolean }) {
  const timings = estimateWordTimings(sample.sentence, SPEECH);
  const last = timings.length - 1;
  return (
    <div data-hero-say="" data-off={off ? "" : undefined} className="hero-say">
      <p data-hero-who="" className="label">
        Spoken · {sample.who}
      </p>
      <p className="hero-say-line">
        {timings.map((timing, index) => (
          <span key={`${index}-${timing.word}`}>
            {index > 0 ? " " : null}
            <span data-w="" data-s={timing.startMs} data-e={timing.endMs} className="hero-word">
              {index === 0 ? "“" : null}
              {timing.word}
              {index === last ? "”" : null}
            </span>
          </span>
        ))}
      </p>
    </div>
  );
}

/** The Voiceline, frozen mid-sentence, as one SVG path. The canvas draws this same frame first. */
function PosterLine({ form, className }: { form: LineForm; className: string }) {
  const id = `hero-line-${form.ref}`;
  return (
    <svg
      className={className}
      viewBox={`0 0 ${form.ref} ${LINE_HEIGHT}`}
      preserveAspectRatio="none"
      fill="none"
      focusable="false"
    >
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" x2={form.ref} y1="0" y2="0">
          <stop offset={form.tint[0]} style={{ stopColor: "var(--hero-line)" }} />
          <stop offset={form.tint[1]} style={{ stopColor: "var(--accent)" }} />
        </linearGradient>
      </defs>
      <path
        d={posterPath(form)}
        stroke={`url(#${id})`}
        strokeWidth={LINE_STROKE}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
