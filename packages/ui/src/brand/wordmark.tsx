// Server-safe: no hooks, no client code. The AdmitStory mark and wordmark (paper redesign).

/**
 * The mark: an ink tile holding a serif italic "a", the first letter of the story. Decorative;
 * the wordmark beside it, or the surrounding link, names it.
 */
export function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-[28%] bg-text font-display text-space italic"
      style={{ width: size, height: size, fontSize: size * 0.78, lineHeight: 1 }}
    >
      <span style={{ translate: "0 -0.06em" }}>a</span>
    </span>
  );
}

/** "AdmitStory" set in the display serif, "Story" in the accent italic. */
export function Wordmark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <BrandMark size={size} />
      <span
        className="font-display tracking-[-0.01em] text-text"
        style={{ fontSize: size * 0.82, lineHeight: 1 }}
      >
        Admit<em className="text-accent">Story</em>
      </span>
    </span>
  );
}
