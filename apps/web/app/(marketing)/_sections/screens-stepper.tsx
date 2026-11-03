"use client";

// "Previous" and "Next" for the screens row (direction §4.5), on pointer devices only: touch has
// the swipe and keyboards have the focusable row. Scrolls by one exhibit; the row's own snap
// settles it. Kept tiny: it is in the landing page's first load.

export function ScreensStepper({
  target,
  previous,
  next,
}: {
  target: string;
  previous: string;
  next: string;
}) {
  const step = (direction: 1 | -1) => {
    const row = document.getElementById(target);
    const item = row?.firstElementChild;
    if (!row || !item) return;
    const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    row.scrollBy({
      left: direction * (item.getBoundingClientRect().width + gap),
      behavior: reduce ? "auto" : "smooth",
    });
  };
  const button =
    "inline-flex min-h-11 items-center rounded-control px-3 text-base text-text-soft hover:text-text";
  return (
    <div className="mt-4 hidden gap-2 pointer-fine:flex">
      <button type="button" aria-controls={target} className={button} onClick={() => step(-1)}>
        {previous}
      </button>
      <button type="button" aria-controls={target} className={button} onClick={() => step(1)}>
        {next}
      </button>
    </div>
  );
}
