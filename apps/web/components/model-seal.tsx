// The model seal (Manu, 4 Nov 2026): the brand object that says who wrote the drafts and what it
// learned from. A stamp, not a badge: hairline rings, a ring of mono text turning very slowly
// (still under reduced motion), a serif figure at the centre. Server-safe, no client code, so it
// costs nothing on the marketing page's first load and almost nothing in the app.
//
// Copy lives in lib/model-claims.ts. `ModelSealMark` is the small form for credit lines.

import { cx } from "@admitstory/ui";
import { MODEL_CREDIT, SEAL_CENTRE, SEAL_LABEL, SEAL_RING } from "@/lib/model-claims";

const RING_R = 77;
const RING_LENGTH = Math.round(2 * Math.PI * RING_R);

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
      <circle cx="100" cy="100" r="99" fill="none" className="stroke-edge" strokeWidth="1" />
      <circle
        cx="100"
        cy="100"
        r="93"
        fill="none"
        className="stroke-accent"
        strokeWidth="4"
        strokeDasharray="0.7 3.6"
        opacity="0.55"
      />
      <g className="seal-turn">
        <text
          aria-hidden="true"
          className="fill-text-soft font-mono uppercase"
          fontSize="10.5"
          letterSpacing="0.12em"
        >
          <textPath href={`#${path}`} textLength={RING_LENGTH} lengthAdjust="spacing">
            {SEAL_RING}
          </textPath>
        </text>
      </g>
      <circle cx="100" cy="100" r="62" fill="none" className="stroke-accent" strokeWidth="1" />
      <text
        aria-hidden="true"
        x="100"
        y="104"
        textAnchor="middle"
        className="fill-text font-display"
        fontSize="50"
        fontWeight="300"
        letterSpacing="-0.02em"
      >
        {SEAL_CENTRE.figure}
      </text>
      <text
        aria-hidden="true"
        x="100"
        y="126"
        textAnchor="middle"
        className="fill-text-soft font-mono uppercase"
        fontSize="7.5"
        letterSpacing="0.16em"
      >
        {SEAL_CENTRE.label}
      </text>
    </svg>
  );
}

/** The small seal: a toothed ring around the italic "a". Decorative; the credit names it. */
export function ModelSealMark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={cx("shrink-0", className)}
    >
      <circle
        cx="12"
        cy="12"
        r="10.5"
        fill="none"
        className="stroke-accent"
        strokeWidth="2"
        strokeDasharray="0.6 1.6"
      />
      <circle cx="12" cy="12" r="7.6" fill="none" className="stroke-accent" strokeWidth="0.8" />
      <text
        x="12"
        y="15.6"
        textAnchor="middle"
        className="fill-text font-display italic"
        fontSize="11"
      >
        a
      </text>
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
