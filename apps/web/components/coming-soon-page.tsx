import type { CSSProperties } from "react";

export interface ComingSoonPageProps {
  title: string;
  /** One reading-size line: what this area will be for. */
  headline: string;
  /** The label above the headline, always "Coming soon". */
  status: string;
  /** One quiet line under it: what is true today, and any promise attached. */
  line: string;
  parts: readonly { name: string; line: string }[];
}

/**
 * An area that is not open yet (the Tracker). It says so plainly and describes what is coming,
 * without implying any of it works today (spec §14.5). Server-only and static: a deferred area
 * costs the bundle nothing. SPEC §6.18: the chip, the title in display-2, the headline in
 * display-3 at the soft step, the line, then the parts as rows on hairlines.
 */
export function ComingSoonPage({ title, headline, status, line, parts }: ComingSoonPageProps) {
  return (
    <div className="mx-auto flex w-full max-w-[55rem] flex-col px-5 pt-6 pb-16 sm:px-10 sm:pt-10 lg:px-14 lg:pt-14">
      <header className="flex flex-col items-start">
        <p className="enter label inline-flex h-7 items-center gap-2 rounded-full border border-edge bg-veil px-3">
          <span aria-hidden className="size-1.5 rounded-full bg-text-soft" />
          {status}
        </p>
        <h1 className="enter mt-4 text-display-2 text-text" style={{ "--i": 0.8 } as CSSProperties}>
          {title}
        </h1>
        <p
          className="enter mt-4 max-w-[26ch] text-display-3 text-balance text-text-soft"
          style={{ "--i": 1.45 } as CSSProperties}
        >
          {headline}
        </p>
        <p className="enter mt-4 max-w-[56ch] text-lg text-text-80" style={{ "--i": 2 } as CSSProperties}>
          {line}
        </p>
      </header>
      <ol className="mt-12 flex flex-col border-t border-edge">
        {parts.map((part, index) => (
          <li
            key={part.name}
            className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-2 border-b border-edge py-6"
          >
            <span aria-hidden className="pt-1 font-mono text-[12px] text-text-label">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="flex flex-col gap-1">
              <span className="text-title text-text">{part.name}</span>
              <span className="text-sm text-text-soft">{part.line}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
