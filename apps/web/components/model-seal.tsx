// The model seal (Manu, 4 Nov 2026): the brand object that says who wrote the drafts and what it
// learned from. Redrawn for "the literary instrument" (SPEC §2.9) as a dial, not a stamp: one
// hairline ring, sixty minute-ticks with every fifth longer, the ring of mono text, the figure
// in Geist, and a single brass tick at twelve o'clock, which is the Voiceline marking "here".
// Nothing turns. Server-safe, no client code, so it costs nothing on the marketing page's first
// load and almost nothing in the app.
//
// Every word comes from lib/model-claims.ts. `ModelSealMark` is the small form for credit lines.

import { cx } from "@admitstory/ui";
import { MODEL_CREDIT, SEAL_CENTRE, SEAL_LABEL, SEAL_RING } from "@/lib/model-claims";

const RING_R = 75;
const RING_LENGTH = Math.round(2 * Math.PI * RING_R);

/** Radial ticks around a centre as one path: `count` of them from `inner` to `outer`. */
function ticks(
  centre: number,
  count: number,
  inner: number,
  outer: number,
  skip: (index: number) => boolean,
): string {
  const parts: string[] = [];
  for (let i = 0; i < count; i += 1) {
    if (skip(i)) continue;
    const angle = (i / count) * 2 * Math.PI;
    const x = Math.sin(angle);
    const y = -Math.cos(angle);
    const point = (r: number) => `${(centre + x * r).toFixed(2)} ${(centre + y * r).toFixed(2)}`;
    parts.push(`M${point(inner)}L${point(outer)}`);
  }
  return parts.join("");
}

// Minutes, with every fifth drawn longer; twelve o'clock is left for the brass tick.
const MINUTE_TICKS = ticks(100, 60, 91, 95, (i) => i % 5 === 0);
const HOUR_TICKS = ticks(100, 60, 88, 95, (i) => i % 5 !== 0 || i === 0);
const MARK_TICKS = ticks(12, 12, 7.25, 9.25, (i) => i === 0);

/**
 * The full seal. `id` must be unique on the page: the ring's text follows a path by reference.
 * Size it with the class (it fills its box).
 */
export function ModelSeal({ id, className }: { id: string; className?: string }) {
  const path = `${id}-ring`;
  return (
    <svg
      viewBox="0 0 200 200"
      role="img"
      aria-label={SEAL_LABEL}
      className={cx("block aspect-square", className)}
    >
      <defs>
        {/* A circle as a path, starting at the top and running clockwise. */}
        <path
          id={path}
          d={`M100,${100 - RING_R} a${RING_R},${RING_R} 0 1,1 0,${RING_R * 2} a${RING_R},${RING_R} 0 1,1 0,-${RING_R * 2}`}
        />
      </defs>
      <circle cx="100" cy="100" r="99.5" fill="none" className="stroke-edge-strong" />
      <path d={MINUTE_TICKS} fill="none" className="stroke-edge-strong" />
      <path d={HOUR_TICKS} fill="none" className="stroke-control" />
      <path d="M100 0.5V14" fill="none" className="stroke-accent" strokeWidth="1.5" />
      <text
        aria-hidden="true"
        className="fill-text-label font-mono uppercase"
        fontSize="10.5"
        letterSpacing="0.12em"
      >
        <textPath href={`#${path}`} textLength={RING_LENGTH} lengthAdjust="spacing">
          {SEAL_RING}
        </textPath>
      </text>
      <text
        aria-hidden="true"
        x="100"
        y="108"
        textAnchor="middle"
        className="fill-text font-ui"
        fontSize="46"
        fontWeight="450"
        letterSpacing="-0.045em"
      >
        {SEAL_CENTRE.figure}
      </text>
      <text
        aria-hidden="true"
        x="100"
        y="127"
        textAnchor="middle"
        className="fill-text-label font-mono uppercase"
        fontSize="7.5"
        letterSpacing="0.16em"
      >
        {SEAL_CENTRE.label}
      </text>
    </svg>
  );
}

/** The small seal: the ring, twelve ticks and the brass tick. Decorative; the credit names it. */
export function ModelSealMark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      fill="none"
      className={cx("shrink-0", className)}
    >
      <circle cx="12" cy="12" r="11.5" className="stroke-control" />
      <path d={MARK_TICKS} className="stroke-control" />
      <path d="M12 0.5V9.25" className="stroke-accent" strokeWidth="1.5" />
    </svg>
  );
}

/** "Drafted by the AdmitStories model, trained on …" with the small seal. */
export function ModelCredit({
  className,
  text = MODEL_CREDIT,
}: {
  className?: string;
  text?: string;
}) {
  return (
    <p className={cx("flex items-center gap-2.5 text-sm text-text-soft", className)}>
      <ModelSealMark />
      <span>{text}</span>
    </p>
  );
}
