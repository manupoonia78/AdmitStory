import { cx } from "../lib/cx";

export interface SkipLinkProps {
  /** id of the element to jump to; it should have tabIndex={-1} so it can take focus. */
  targetId?: string;
  className?: string;
}

/** First focusable element on every page; hidden until focused. */
export function SkipLink({ targetId = "main", className }: SkipLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      className={cx(
        "sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50",
        "focus:rounded-control focus:bg-paper focus:px-4 focus:py-3 focus:text-ink focus:underline focus:shadow-overlay",
        className,
      )}
    >
      Skip to content
    </a>
  );
}
