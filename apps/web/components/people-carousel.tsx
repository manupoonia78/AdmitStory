// The Connect strip: illustrative portraits of the kinds of people Connect will match you with
// (lib/connect/illustrative.ts). Server-safe and still (SPEC §6.16: nothing in the background
// moves): one row that scrolls sideways under a finger or trackpad, with a fade at the edges
// (globals.css .people-strip). Images load lazily, so the strip costs nothing until it is near.

import { cx } from "@admitstory/ui";
import { ILLUSTRATIVE_NOTE, ILLUSTRATIVE_PEOPLE } from "@/lib/connect/illustrative";

function Row() {
  return (
    <ul role="list" className="people-row flex shrink-0 gap-4 px-5 sm:gap-5 sm:px-10 lg:px-14">
      {ILLUSTRATIVE_PEOPLE.map((person) => (
        <li key={person.src} className="w-44 shrink-0 sm:w-52">
          <figure className="flex flex-col gap-3">
            {/* Already 400×500 WebP and lazy; next/image would only add a hop. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={person.src}
              alt=""
              width={400}
              height={500}
              loading="lazy"
              decoding="async"
              className="aspect-[4/5] w-full rounded-card bg-depth object-cover grayscale-[15%]"
            />
            <figcaption className="flex flex-col gap-1">
              <span className="label">{person.role}</span>
              <span className="text-sm leading-snug text-text">{person.line}</span>
            </figcaption>
          </figure>
        </li>
      ))}
    </ul>
  );
}

export function PeopleCarousel({ className, note = true }: { className?: string; note?: boolean }) {
  return (
    <div className={cx("flex flex-col gap-5", className)}>
      {/* Focusable, so a keyboard can scroll it (WCAG 2.1.1). */}
      <div className="people-strip" tabIndex={0} role="region" aria-label="Illustrative people">
        <Row />
      </div>
      {note ? <p className="label px-5 sm:px-10 lg:px-14">{ILLUSTRATIVE_NOTE}</p> : null}
    </div>
  );
}
