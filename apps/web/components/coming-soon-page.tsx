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
 * static: a deferred area costs the bundle nothing. The studio object for the area floats to the
 * right; the parts sit on glass tiles in front of it.
 */
export function ComingSoonPage({ title, headline, status, line, parts }: ComingSoonPageProps) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 py-10 sm:px-10 sm:py-16">
      <header className="flex max-w-2xl flex-col gap-6">
        <p className="inline-flex w-fit items-center gap-2.5 rounded-full border border-edge px-3.5 py-1.5 text-sm font-medium text-text glass-control">
          <span aria-hidden className="relative flex size-2">
            <span className="absolute inset-0 rounded-full bg-signal opacity-70 motion-safe:animate-ping" />
            <span className="relative size-2 rounded-full bg-signal shadow-[0_0_10px_var(--signal)]" />
          </span>
          {status}
        </p>
        <h1 className="text-display-lg text-text">{title}</h1>
        <p className="max-w-[30ch] font-reading text-read-lg text-balance text-text sm:text-[1.75rem] sm:leading-[1.3]">
          {headline}
        </p>
        <p className="max-w-prose text-text-soft">{line}</p>
      </header>
      <ol className="grid gap-4 sm:grid-cols-2">
        {parts.map((part, index) => (
          <li
            key={part.name}
            className="group plane relative flex min-h-40 flex-col justify-between gap-6 overflow-hidden p-6"
          >
            <span
              aria-hidden
              className="font-ui text-sm font-medium tabular-nums text-signal [text-shadow:0_0_12px_var(--signal)]"
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="flex flex-col gap-2">
              <span className="text-lg font-semibold text-text">{part.name}</span>
              <span className="text-text-soft">{part.line}</span>
            </span>
            <span
              aria-hidden
              className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--signal)_30%,transparent),transparent_70%)] opacity-60 transition-opacity duration-(--spring-glide-duration) group-hover:opacity-100"
            />
          </li>
        ))}
      </ol>
    </div>
  );
}
