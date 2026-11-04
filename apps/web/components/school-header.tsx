import Link from "next/link";
import type { SchoolTabId, SchoolTabsView } from "@/lib/school/tabs";

// The band across the top of everything inside a school (school workspace redesign): back to
// the list, the school's name, and one tab per kind of thing the school asks for. Plain markup,
// so it renders the same on the server and inside client screens.

export function SchoolHeader({ view, active }: { view: SchoolTabsView; active: SchoolTabId }) {
  return (
    <header className="flex flex-col gap-3 px-1 pt-1 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
      <div className="flex min-w-0 items-baseline gap-3">
        <Link
          href="/schools"
          className="meta shrink-0 text-text-soft underline-offset-4 hover:text-text hover:underline"
        >
          Schools /
        </Link>
        <h1 className="truncate font-display text-[1.75rem] leading-none tracking-[-0.015em] text-text">
          {view.school}
        </h1>
        <span className="meta shrink-0 text-text-soft">{view.cycle}</span>
      </div>
      <nav
        aria-label={`${view.school} application`}
        className="-mx-1 overflow-x-auto"
        data-no-swipe
      >
        <ul className="flex min-w-max items-center gap-1 rounded-full border border-edge bg-depth p-1">
          {view.tabs.map((tab) => {
            const current = tab.id === active;
            return (
              <li key={tab.id}>
                <Link
                  href={tab.href}
                  aria-current={current ? "page" : undefined}
                  className={
                    current
                      ? "flex min-h-9 items-center gap-1.5 rounded-full bg-signal px-4 text-sm font-medium text-on-signal"
                      : "flex min-h-9 items-center gap-1.5 rounded-full px-4 text-sm text-text-soft transition-colors hover:bg-veil hover:text-text"
                  }
                >
                  {tab.label}
                  {tab.needs ? (
                    <span
                      className={current ? "tabular-nums opacity-80" : "tabular-nums text-needs"}
                      aria-label={`${tab.needs} need you`}
                    >
                      {tab.needs}
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
