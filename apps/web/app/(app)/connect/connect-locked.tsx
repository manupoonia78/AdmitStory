import { buttonStyles, cx } from "@admitstory/ui";
import Link from "next/link";
import { PeopleCarousel } from "@/components/people-carousel";

// Connect without a school pack (Manu, 2026-11-04): the directory stays hidden. The page shows
// who a pack connects you with, as illustrative faces, and how it works, then one way forward.
// Server-only and static, so it costs the route no JavaScript.

const KINDS = [
  {
    name: "Alumni",
    line: "What the degree did for their careers, what they’d do differently, and what the school is like to belong to.",
  },
  {
    name: "Current students",
    line: "Classes, clubs and recruiting as they are this year, not as the brochure had them.",
  },
  {
    name: "Admissions-committee readers",
    line: "People who have read applications for the school, and can tell you how yours lands.",
  },
] as const;

const HOW = [
  "Unlock a school. Its people appear in your search, and the ones who work with us come first.",
  "Search by name, role, company or topic, like you would on LinkedIn, across every school we cover.",
  "Write to them here. People who work with us answer in the app; for anyone else we arrange the introduction.",
] as const;

export function ConnectLocked() {
  return (
    <div className="flex w-full flex-col gap-14 py-10 sm:py-14">
      <header className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-5 sm:px-10">
        <p className="eyebrow">Connect · comes with a school pack</p>
        <h1 className="text-display text-text">
          Talk to people <em className="text-accent">who’ve been there.</em>
        </h1>
        <p className="max-w-2xl text-lg text-text-soft">
          Unlock a school and we match you with its alumni, current students and
          admissions-committee readers who work with us, to ask what the place is really like or to
          read your why-school before you send it.
        </p>
        <Link href="/schools" className={cx(buttonStyles({ variant: "primary" }), "self-start")}>
          Unlock a school
        </Link>
      </header>

      <PeopleCarousel />

      <div className="mx-auto grid w-full max-w-5xl gap-10 px-5 sm:px-10 lg:grid-cols-2 lg:gap-16">
        <section aria-labelledby="connect-who" className="flex flex-col gap-4">
          <h2 id="connect-who" className="font-display text-[1.75rem] leading-tight text-text">
            Who you can talk to
          </h2>
          <ul role="list" className="divide-y divide-edge border-y border-edge">
            {KINDS.map((kind) => (
              <li key={kind.name} className="flex flex-col gap-1 py-4">
                <span className="text-text">{kind.name}</span>
                <span className="text-text-soft">{kind.line}</span>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="connect-how" className="flex flex-col gap-4">
          <h2 id="connect-how" className="font-display text-[1.75rem] leading-tight text-text">
            How it works
          </h2>
          <ol className="divide-y divide-edge border-y border-edge">
            {HOW.map((step, index) => (
              <li key={step} className="grid grid-cols-[2.5rem_1fr] gap-3 py-4">
                <span aria-hidden className="meta pt-1">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-text">{step}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
