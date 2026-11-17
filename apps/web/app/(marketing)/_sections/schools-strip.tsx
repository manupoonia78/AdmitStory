// Scene 2 (SPEC §4): the schools with a verified pack, typeset. One band between two hairlines,
// static: no logos, no scroller, no script. On wide screens the sixteen names run as two justified
// rows like a masthead; the rows are cut here so their gaps come out alike, and every name
// but a row's last grows to share the row's spare width, its dot centred in the gap.

import { Fragment } from "react";
import { STRIP_COPY } from "../_copy/landing";
import { COVERED_SCHOOLS } from "../_data/schools";
import { SECTION_GRID } from "../_ui/section";

/** About how many letters of this type fit across the names' column. */
const ROW_LETTERS = 96;

/**
 * The index of the last name in the first row: the cut that leaves the two rows with the most
 * alike gaps between names (a row's spare width shared among its gaps).
 */
function rowBreak(names: readonly string[]): number {
  const letters = names.map((name) => name.length);
  const total = letters.reduce((sum, count) => sum + count, 0);
  let best = 0;
  let bestDifference = Infinity;
  let first = letters[0] ?? 0;
  for (let count = 2; count <= names.length - 2; count += 1) {
    first += letters[count - 1] ?? 0;
    const gapOne = (ROW_LETTERS - first) / (count - 1);
    const gapTwo = (ROW_LETTERS - (total - first)) / (names.length - count - 1);
    const difference = Math.abs(gapOne - gapTwo);
    if (difference < bestDifference) {
      bestDifference = difference;
      best = count - 1;
    }
  }
  return best;
}

export function SchoolsStrip() {
  const names = COVERED_SCHOOLS.map((school) => school.name);
  const rowEnd = rowBreak(names);
  const last = names.length - 1;
  return (
    <section aria-labelledby="schools-strip-title" className="border-y border-edge-strong">
      <div className={`${SECTION_GRID} items-center gap-y-4 py-7 xl:py-5`}>
        <h2
          id="schools-strip-title"
          className="label col-span-4 sm:col-span-8 lg:col-span-12 xl:col-span-3"
        >
          <span className="xl:block">
            {names.length} {STRIP_COPY.schools}
          </span>{" "}
          <span className="xl:block">{STRIP_COPY.verified}</span>
        </h2>
        <ul
          role="list"
          className="strip-names col-span-4 sm:col-span-8 lg:col-span-12 xl:col-span-9"
        >
          {names.map((name, index) => (
            <Fragment key={name}>
              <li
                data-row-end={index === rowEnd || index === last ? "" : undefined}
                data-last={index === last ? "" : undefined}
                className="strip-name"
              >
                {name}
              </li>
              {index === rowEnd ? <li aria-hidden="true" className="strip-break" /> : null}
            </Fragment>
          ))}
        </ul>
      </div>
    </section>
  );
}
