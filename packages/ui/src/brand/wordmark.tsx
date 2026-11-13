// Server-safe: no hooks, no client code. The AdmitStories mark and wordmark (SPEC §2.9).

/**
 * The mark: the Voiceline making its peak. A flat line that rises once, which also reads as a
 * capital A. One stroke, mitre joins, no fill: brass on dark, ink on paper (--signal).
 * Decorative; the wordmark beside it, or the surrounding link, names it.
 */
export function BrandMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="var(--signal)"
      strokeWidth="1.75"
      strokeLinejoin="miter"
      strokeMiterlimit="8"
      strokeLinecap="butt"
      className={`shrink-0 ${className ?? ""}`}
    >
      <path d="M2 16H8.4L12 5.5L15.6 16H22" />
    </svg>
  );
}

/**
 * "AdmitStories": "Admit" in Geist 500, "Stories" in Instrument Serif italic a step larger so
 * the x-heights meet. One colour at full strength; the wordmark is the one place the italic is
 * not quietened. `size` is the mark's box: the type is three quarters of it (24 gives 18px).
 */
export function Wordmark({
  size = 24,
  mark = true,
  className,
}: {
  size?: number;
  /** Set false for the type alone. */
  mark?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 text-text ${className ?? ""}`}>
      {mark ? <BrandMark size={size} /> : null}
      <span
        className="font-ui font-medium tracking-[-0.02em]"
        style={{ fontSize: size * 0.75, lineHeight: 1 }}
      >
        Admit
        <span
          className="font-accent font-normal italic tracking-[-0.01em]"
          style={{ fontSize: "1.12em" }}
        >
          Stories
        </span>
      </span>
    </span>
  );
}
