import { cx } from "../lib/cx";

/**
 * The Voiceline's peak (SPEC §1.1): the one sharp rise that marks "here" on a line, drawn as the
 * mark's chevron with mitre joins. It takes `currentColor`; size it with the class. Server-safe.
 */
export function Peak({
  className,
  strokeWidth = 1.5,
}: {
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg aria-hidden viewBox="0 0 20 28" fill="none" className={cx("overflow-visible", className)}>
      <path
        d="M0 27.5 L10 1 L20 27.5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinejoin="miter"
        strokeMiterlimit="8"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
