// The Recommenders page's list (SPEC §6.13): one row per person on hairlines, the whole row a link
// to their page. Name and role, the schools they write for as chips, and their status as a line.
// Server-safe: no state, no shortcuts (the detail page's side list keeps J and K).

import type { RecommenderListItem } from "@admitstory/shared/kit";
import { roleLine } from "./recommender-text";
import { StatusLine } from "./status-line";

export interface RecommenderRowsProps {
  items: readonly RecommenderListItem[];
  hrefFor: (id: string) => string;
}

export function RecommenderRows({ items, hrefFor }: RecommenderRowsProps) {
  return (
    <ul className="flex flex-col border-t border-edge">
      {items.map((item, index) => (
        <li key={item.id} className="border-b border-edge">
          <a
            href={hrefFor(item.id)}
            className="-mx-3 grid gap-x-8 gap-y-4 rounded-[16px] px-3 py-6 transition-colors duration-200 hover:bg-veil sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_15rem] sm:items-center"
          >
            <span className="flex min-w-0 flex-col gap-1">
              <span className="truncate text-title text-text">{item.name}</span>
              <span className="truncate text-sm text-text-soft">{roleLine(item)}</span>
            </span>
            <span className="flex min-w-0 flex-wrap gap-1.5">
              {item.schools.length > 0 ? (
                item.schools.map((school) => (
                  <span key={school.userSchoolId} className="chip h-7 px-3">
                    {school.name}
                  </span>
                ))
              ) : (
                <span className="text-sm text-text-soft">No schools yet</span>
              )}
            </span>
            <StatusLine status={item.status} line={item.statusLine} index={index} />
          </a>
        </li>
      ))}
    </ul>
  );
}
