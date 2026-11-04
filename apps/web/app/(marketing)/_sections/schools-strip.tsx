// The schools we cover (Manu, 4 Nov 2026): a slow strip of every school with a verified pack,
// right under the hero. Names are set in the display serif rather than shown as crests: the crests
// are the schools' marks, and a typeset roll reads as editorial, like a masthead's contributors.
// Pure CSS: one row drawn twice and slid by half its width, paused on hover, and laid out as a
// still, wrapped list under reduced motion. The second copy is hidden from assistive technology.

import { COVERED_SCHOOLS } from "../_data/schools";

function Roll({ hidden = false }: { hidden?: boolean }) {
  return (
    <ul
      aria-hidden={hidden || undefined}
      className="schools-roll flex shrink-0 items-baseline"
      role={hidden ? undefined : "list"}
    >
      {COVERED_SCHOOLS.map((school) => (
        <li key={school.name} className="flex shrink-0 items-baseline gap-3 px-7 sm:px-10">
          <span className="font-display text-[1.75rem] font-light leading-none tracking-[-0.01em] text-text sm:text-[2.25rem]">
            {school.name}
          </span>
          <span className="meta hidden text-text-soft sm:inline">{school.place}</span>
        </li>
      ))}
    </ul>
  );
}

export function SchoolsStrip() {
  return (
    <section
      aria-labelledby="schools-strip-title"
      className="relative border-b border-edge bg-depth py-10 sm:py-14"
    >
      <div className="mx-auto mb-7 flex w-full max-w-[1440px] flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-4 sm:px-8 lg:px-12">
        <h2 id="schools-strip-title" className="eyebrow">
          {`${COVERED_SCHOOLS.length} schools, verified for 2026–27`}
        </h2>
        <p className="meta text-text-soft">
          Every deadline, prompt and limit checked at the source
        </p>
      </div>
      <div className="schools-strip">
        <div className="schools-track flex w-max">
          <Roll />
          <Roll hidden />
        </div>
      </div>
    </section>
  );
}
