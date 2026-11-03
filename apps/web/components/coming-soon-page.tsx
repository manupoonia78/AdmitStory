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
 * An area that is not open yet (Interview Studio, Connect, Tracker). It says so plainly and
 * describes what is coming, without implying any of it works today (spec §14.5). Server-only and
 * static: a deferred area costs the bundle nothing. The parts sit in a ruled grid of paper cells.
 */
export function ComingSoonPage({ title, headline, status, line, parts }: ComingSoonPageProps) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-5 py-10 sm:px-10 sm:py-14">
      <header className="flex flex-col gap-5 border-b border-edge pb-10">
        <p className="eyebrow">{status}</p>
        <h1 className="text-display text-text">{title}</h1>
        <p className="max-w-[28ch] font-display text-[1.625rem] leading-[1.25] text-balance text-text-soft sm:text-[2rem]">
          {headline}
        </p>
        <p className="max-w-prose text-text-soft">{line}</p>
      </header>
      <ol className="grid gap-px overflow-hidden rounded-plane border border-edge bg-edge sm:grid-cols-2">
        {parts.map((part, index) => (
          <li key={part.name} className="flex min-h-44 flex-col justify-between gap-8 bg-depth p-7">
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
    </div>
  );
}
