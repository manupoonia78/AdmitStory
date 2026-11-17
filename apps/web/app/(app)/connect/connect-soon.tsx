import { buttonStyles, cx } from "@admitstory/ui";
import type { CSSProperties } from "react";
import Link from "next/link";
import { PeopleCarousel } from "@/components/people-carousel";
import { CONNECT_COMING_SOON as COPY } from "@/lib/connect/coming-soon";
import { ILLUSTRATIVE_NOTE } from "@/lib/connect/illustrative";

// Connect while it is closed (Manu, 2026-11-17): what it will be, and nothing that works today.
// The hero pairs the promise with one illustrative match, drawn in code: you on the left, three
// people from a fictional school on the right, and the wire between you says what you share.
// Then the illustrative carousel and the three parts. Server-only, CSS only: no JavaScript.
//
// The entrance (globals.css, "Connect, coming soon"), only under <html data-motion="on">:
// the headline leads with the pill fading beside it, intro and status follow 90 ms apart; the
// "You" card fades in, the wires draw out of it, and each person arrives as the wires reach
// them, with gaps that shrink (90, then 60 ms). Everything has landed by 1.4 s. The hero opts
// out of the shell's route rise so it has one entrance, not two; the blocks below keep that rise
// and nothing else.

const at = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;
const step = (i: number) => ({ "--i": i }) as CSSProperties;

/** When each person lands: just before their wire finishes drawing (260 + 700 ms). */
const ARRIVALS = [560, 650, 710] as const;

export function ConnectSoon() {
  const { match } = COPY;
  return (
    <div className="flex w-full flex-col gap-16 py-10 sm:gap-24 sm:py-14">
      <section
        aria-labelledby="connect-soon-title"
        className="mx-auto grid w-full max-w-6xl animate-none gap-10 px-5 sm:px-10 lg:grid-cols-12 lg:items-start lg:gap-x-10 lg:gap-y-14"
      >
        <div className="flex flex-col gap-6 lg:col-span-12">
          <p className="cs-fade label inline-flex h-7 items-center gap-2 self-start rounded-full border border-edge px-3">
            <span aria-hidden className="size-1.5 rounded-full bg-accent" />
            {COPY.title} · {COPY.status}
          </p>
          {/* Two lines from sm up: the plain line, then the italic one. */}
          <h1
            id="connect-soon-title"
            className="enter text-display-1 text-balance text-text"
            style={step(0)}
          >
            {COPY.headline[0]} <em className="sm:block">{COPY.headline[1]}</em>
          </h1>
        </div>
        <div className="flex flex-col gap-6 lg:col-span-5">
          <p className="enter max-w-xl text-lg text-pretty text-text-soft" style={step(1)}>
            {COPY.intro}
          </p>
          <div className="enter flex flex-col gap-5 border-t border-edge pt-5" style={step(2)}>
            <p className="max-w-xl text-pretty">
              <span className="text-text">{COPY.line}</span>{" "}
              <span className="text-text-soft">{COPY.carry}</span>
            </p>
            <Link
              href="/schools"
              className={cx(buttonStyles({ variant: "secondary" }), "self-start")}
            >
              {COPY.back}
            </Link>
          </div>
        </div>

        <figure className="plane m-0 p-5 sm:p-7 lg:col-span-7">
          <figcaption className="label">{match.label}</figcaption>
          <div className="mt-6 grid gap-6 sm:mt-8 sm:grid-cols-[minmax(0,9.5rem)_2.75rem_minmax(0,1fr)] sm:gap-0">
            <div
              className="cs-fade relative self-center rounded-[14px] border border-edge-strong p-4"
              style={at(120)}
            >
              <p className="label">{match.you.eyebrow}</p>
              <dl className="mt-3 flex flex-col gap-2.5">
                {match.you.facets.map((facet) => (
                  <div key={facet.name}>
                    <dt className="meta">{facet.name}</dt>
                    <dd className="text-sm text-text">{facet.value}</dd>
                  </div>
                ))}
              </dl>
              {/* Where the wires leave from. */}
              <span
                aria-hidden
                className="absolute top-1/2 -right-[3.5px] hidden size-1.5 -translate-y-1/2 rounded-full bg-accent sm:block"
              />
            </div>

            {/* One wire to each person. Stretched to the list's height, so each ends at its
                row's middle; the stroke stays 1px however it is stretched. */}
            {/* The div stretches with the row; an svg with a viewBox would not. */}
            <div aria-hidden className="relative hidden sm:block">
              <svg
                focusable="false"
                viewBox="0 0 44 300"
                preserveAspectRatio="none"
                fill="none"
                className="cs-wire absolute inset-0 size-full"
                style={at(260)}
              >
                {["M0 150C22 150 22 50 44 50", "M0 150H44", "M0 150C22 150 22 250 44 250"].map(
                  (d) => (
                    <path
                      key={d}
                      d={d}
                      stroke="var(--accent)"
                      strokeOpacity="0.7"
                      strokeWidth="1"
                      vectorEffect="non-scaling-stroke"
                    />
                  ),
                )}
              </svg>
            </div>

            <ul
              role="list"
              className="flex flex-col border-s border-edge ps-5 sm:divide-y sm:divide-edge sm:border-s-0 sm:ps-3"
            >
              {match.people.map((person, index) => (
                <li
                  key={person.src}
                  className="cs-arrive flex flex-1 items-center gap-3.5 py-3.5"
                  style={at(ARRIVALS[index] ?? 0)}
                >
                  {/* Already 400×500 WebP; a 48px circle crops the face. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={person.src}
                    alt=""
                    width={48}
                    height={48}
                    decoding="async"
                    className="size-12 shrink-0 rounded-full bg-depth object-cover object-top grayscale-[15%]"
                  />
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="label">{person.role}</span>
                    <span className="text-sm leading-snug text-text">{person.line}</span>
                    <span className="font-mono text-[0.75rem] leading-[1.125rem] text-accent">
                      {person.shared}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </figure>
      </section>

      <section aria-labelledby="connect-soon-people" className="flex flex-col gap-6">
        <h2
          id="connect-soon-people"
          className="mx-auto w-full max-w-6xl px-5 font-display text-[1.75rem] leading-tight text-text sm:px-10"
        >
          {COPY.peopleHeading}
        </h2>
        <PeopleCarousel note={false} />
        <p className="meta mx-auto w-full max-w-6xl px-5 sm:px-10">{ILLUSTRATIVE_NOTE}</p>
      </section>

      <section
        aria-labelledby="connect-soon-how"
        className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 sm:px-10"
      >
        <h2 id="connect-soon-how" className="font-display text-[1.75rem] leading-tight text-text">
          How it will work
        </h2>
        <ol className="grid gap-px overflow-hidden rounded-plane border border-edge bg-edge lg:grid-cols-3">
          {COPY.parts.map((part, index) => (
            <li
              key={part.name}
              className="flex min-h-40 flex-col justify-between gap-8 bg-depth p-7"
            >
              <span aria-hidden className="meta">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="flex flex-col gap-2">
                <span className="font-display text-[1.5rem] leading-tight text-text">
                  {part.name}
                </span>
                <span className="text-text-soft">{part.line}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
