// Loading inside the casing (SPEC §6.10): the page frame with hairlines where the real lines will
// sit, at their baselines, not grey blocks, and nothing shimmering. It fades in only after 300 ms
// (`.app-loading` in globals.css), so a quick navigation never shows it. Server-only: no JS.

const ROWS = [0, 1, 2] as const;

export default function Loading() {
  return (
    <div
      aria-busy="true"
      className="app-loading mx-auto flex w-full max-w-[55rem] flex-col px-5 pt-6 pb-14 sm:px-10 sm:pt-10 lg:px-14 lg:pt-14"
    >
      <p className="sr-only" role="status">
        Loading
      </p>
      <span aria-hidden className="flex h-4 items-end">
        <span className="h-px w-24 bg-edge" />
      </span>
      <span aria-hidden className="mt-3 flex flex-col gap-[0.55em] text-display-2">
        <span className="flex h-[1.05em] items-end">
          <span className="h-px w-80 max-w-full bg-edge" />
        </span>
        <span className="flex h-[1.05em] items-end sm:hidden">
          <span className="h-px w-40 bg-edge" />
        </span>
      </span>
      <span aria-hidden className="mt-4 flex h-7 items-end">
        <span className="h-px w-[30rem] max-w-full bg-edge" />
      </span>
      <span aria-hidden className="mt-12 flex flex-col">
        {ROWS.map((row) => (
          <span key={row} className="h-[72px] border-t border-edge" />
        ))}
      </span>
    </div>
  );
}
