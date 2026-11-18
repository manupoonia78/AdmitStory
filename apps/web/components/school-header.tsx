import { CaretLeftIcon } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import type { SchoolTabId, SchoolTabsView } from "@/lib/school/tabs";

// The band across the top of everything inside a school (SPEC §6.6): back to the list, the
// school's name and cycle, then one text tab per kind of thing the school asks for, on a hairline.
// The tabs are links (each is its own route), so the rule under the current one doesn't slide: a
// route change is instant. Plain markup, so it renders the same on the server and inside client
// screens.

export function SchoolHeader({ view, active }: { view: SchoolTabsView; active: SchoolTabId }) {
  return (
    <header className="flex min-w-0 flex-col">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <Link
          href="/schools"
          className="label -ml-1 inline-flex min-h-11 items-center gap-1 self-center rounded-full pr-2 pl-1 text-text-label transition-colors duration-(--dur-hover) hover:text-text"
        >
          <CaretLeftIcon size={12} weight="bold" aria-hidden />
          Schools
        </Link>
        <h1 className="min-w-0 truncate text-display-3 text-text">{view.school}</h1>
        <span className="label">{view.cycle}</span>
      </div>
      <nav
        aria-label={`${view.school} application`}
        className="school-tabs mt-3 -mx-1 overflow-x-auto px-1 [scrollbar-width:none]"
        data-no-swipe
      >
        <ul className="flex min-w-max items-end gap-7 border-b border-edge">
          {view.tabs.map((tab) => {
            const current = tab.id === active;
            return (
              <li key={tab.id}>
                <Link
                  href={tab.href}
                  aria-current={current ? "page" : undefined}
                  className={
                    current
                      ? "-mb-px flex min-h-11 items-center gap-2 border-b-[1.25px] border-text text-ui text-text"
                      : "-mb-px flex min-h-11 items-center gap-2 border-b-[1.25px] border-transparent text-ui text-text-soft transition-colors duration-(--dur-hover) hover:text-text"
                  }
                >
                  {tab.label}
                  {tab.needs ? (
                    <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-needs px-1 font-mono text-[11px] leading-none font-medium text-on-signal tabular-nums">
                      <span aria-hidden>{tab.needs}</span>
                      <span className="sr-only">{`, ${tab.needs} need you`}</span>
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
