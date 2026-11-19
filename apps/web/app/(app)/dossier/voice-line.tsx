import type { VoiceprintIdentity } from "@admitstory/shared";

// The applicant's Voiceprint as a line (SPEC §6.11, Voice tab): a still wave across the column,
// shaped by their numbers with the mapping the Studio's live line and the kit's glyph use (pitch
// sets the wavelength, range the height, pace a second ripple, pause rhythm the quiet gaps). It
// replaces the orb. Server-safe, an SVG path in the applicant's hue.

const WIDTH = 560;
const HEIGHT = 64;

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

export function voiceLinePath(identity: VoiceprintIdentity): string {
  const wavelength = 52 + clamp((identity.avgPitchHz - 110) / 60, 0, 1) * 40;
  const amp = 10 + clamp((identity.pitchRangeSemitones - 4) / 10, 0, 1) * 12;
  const ripple = 0.25 + clamp((identity.paceWpm - 110) / 70, 0, 1) * 0.35;
  const gaps = 0.15 + clamp(identity.pauseRhythm, 0, 1) * 0.35;
  const points: string[] = [];
  for (let x = 0; x <= WIDTH; x += 4) {
    const t = x / WIDTH;
    // An envelope that breathes: louder in phrases, quieter in the pauses between them.
    const phrase = Math.max(0, Math.sin(Math.PI * t * 3.2 + 0.4)) ** (1 + gaps * 2);
    const fade = Math.sin(Math.PI * t);
    const y =
      HEIGHT / 2 -
      fade *
        phrase *
        amp *
        (Math.sin((2 * Math.PI * x) / wavelength) +
          ripple * Math.sin((2 * Math.PI * x * 2.3) / wavelength + 1));
    points.push(`${x === 0 ? "M" : "L"}${x} ${y.toFixed(1)}`);
  }
  return points.join(" ");
}

export function VoiceLine({ identity }: { identity: VoiceprintIdentity }) {
  return (
    <svg
      role="img"
      aria-label="Your Voiceprint, drawn as a line"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      className="h-16 w-full max-w-[35rem] overflow-visible"
      fill="none"
    >
      <path
        d={voiceLinePath(identity)}
        stroke="var(--voice)"
        strokeWidth={1.25}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
