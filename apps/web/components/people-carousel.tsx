// The Connect carousel: illustrative portraits of the kinds of people a school pack connects you
// with (lib/connect/illustrative.ts). Server-safe and CSS only (globals.css .people-strip): one
// row drawn twice and slid by half its width, paused on hover or focus, a still wrapped row under
// reduced motion. The second copy is hidden from assistive technology. Images load lazily, so
// the strip costs nothing until it is near the screen.

import { cx } from "@admitstory/ui";
import { ILLUSTRATIVE_NOTE, ILLUSTRATIVE_PEOPLE } from "@/lib/connect/illustrative";

function Row({ hidden = false }: { hidden?: boolean }) {
  return (
    <ul
      aria-hidden={hidden || undefined}
      role={hidden ? undefined : "list"}
      className="people-row flex shrink-0 gap-4 pe-4 sm:gap-5 sm:pe-5"
    >
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
              className="aspect-[4/5] w-full rounded-plane bg-depth object-cover grayscale-[15%]"
            />
            <figcaption className="flex flex-col gap-1">
              <span className="meta">{person.role}</span>
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
      <div className="people-strip">
        <div className="people-track flex w-max">
          <Row />
          <Row hidden />
        </div>
      </div>
      {note ? <p className="meta px-4 sm:px-8 lg:px-12">{ILLUSTRATIVE_NOTE}</p> : null}
    </div>
  );
}
