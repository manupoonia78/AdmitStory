// What /prototype/system lists. The swatches paint with the live custom properties, so they
// always show what tokens.css holds; the values printed beside them are SPEC §2.1 and §2.2,
// which contrast.test.ts keeps equal to tokens.css.

export interface Swatch {
  /** The custom property that paints the swatch. */
  token: string;
  value: string;
  use: string;
}

export interface Step {
  token: string;
  /** The opacity step, as printed. */
  alpha: string;
  /** Lowest contrast on the scope's surfaces. */
  contrast: string;
  use: string;
}

export const INSTRUMENT: { surfaces: Swatch[]; steps: Step[]; status: Swatch[] } = {
  surfaces: [
    { token: "--bg", value: "#0B0A09", use: "Page, casing" },
    { token: "--surface-1", value: "fg 4%", use: "Cards on dark" },
    { token: "--surface-2", value: "fg 7%", use: "Frost fill" },
    { token: "--line", value: "fg 12%", use: "Hairlines, the flat Voiceline" },
    { token: "--line-strong", value: "fg 20%", use: "Region dividers" },
    { token: "--brass", value: "#E2B36B", use: "Primary fill, live Voiceline, caret" },
    { token: "--brass-hover", value: "#E9C283", use: "Primary fill, hovered" },
    { token: "--on-brass", value: "#14110A", use: "Text on brass" },
  ],
  steps: [
    { token: "--fg", alpha: "100", contrast: "17.5", use: "Headlines, primary text" },
    { token: "--fg-80", alpha: "80", contrast: "11.2", use: "Body copy" },
    { token: "--fg-64", alpha: "64", contrast: "7.4", use: "Secondary text; the floor under 24px" },
    { token: "--fg-60", alpha: "60", contrast: "6.6", use: "Serif accents, mono labels" },
    { token: "--fg-48", alpha: "48", contrast: "4.6", use: "24px and up, icons, placeholders" },
    { token: "--fg-40", alpha: "40", contrast: "3.5", use: "Control borders; never text" },
  ],
  status: [
    { token: "--verified", value: "#8CCBA0", use: "Confirmed" },
    { token: "--needs", value: "#A9BEE0", use: "Needs you" },
    { token: "--risk", value: "#F09080", use: "Must fix" },
    { token: "--record", value: "#F0664E", use: "Recording (never text)" },
    { token: "--silver", value: "#C9C5BC", use: "The interviewer" },
  ],
};

export const PAPER: { surfaces: Swatch[]; steps: Step[]; status: Swatch[] } = {
  surfaces: [
    { token: "--desk", value: "#ECE9E2", use: "The Day working area" },
    { token: "--paper", value: "#F7F5F0", use: "Sheets, cards" },
    { token: "--paper-raise", value: "#FCFBF8", use: "Inputs on paper" },
    { token: "--rule", value: "ink 10%", use: "Hairlines" },
    { token: "--rule-strong", value: "ink 18%", use: "Region dividers" },
    { token: "--brass-ink", value: "#85590F", use: "Margin notes, caret, Voiceline on paper" },
  ],
  steps: [
    { token: "--ink", alpha: "100", contrast: "15.3", use: "Text" },
    { token: "--ink-80", alpha: "80", contrast: "9.4", use: "Long-form body" },
    { token: "--ink-66", alpha: "66", contrast: "5.5", use: "Secondary text" },
    { token: "--ink-50", alpha: "50", contrast: "3.3", use: "Control borders, 24px and up" },
  ],
  status: [
    { token: "--verified", value: "#2A6B45", use: "Confirmed" },
    { token: "--needs", value: "#34588F", use: "Needs you" },
    { token: "--risk", value: "#A8382A", use: "Must fix" },
    { token: "--record", value: "#C8452F", use: "Recording (never text)" },
    { token: "--silver", value: "#5E5C57", use: "The interviewer" },
  ],
};

export const NIGHT_PAPER: { surfaces: Swatch[]; steps: Step[]; status: Swatch[] } = {
  surfaces: [
    { token: "--space", value: "#0B0A09", use: "The Night desk" },
    { token: "--depth", value: "#151412", use: "Cards" },
    { token: "--sheet", value: "#1C1A17", use: "Night paper: warm, never black" },
    { token: "--accent", value: "#E2B36B", use: "Margin notes, caret" },
  ],
  steps: [
    { token: "--sheet-text", alpha: "100", contrast: "14.1", use: "Text on the sheet" },
    { token: "--text-80", alpha: "80", contrast: "10.2", use: "Long-form body" },
    { token: "--text-soft", alpha: "64", contrast: "6.9", use: "Secondary text" },
    { token: "--text-label", alpha: "60", contrast: "6.2", use: "Labels, margin notes" },
    { token: "--text-faint", alpha: "48", contrast: "4.4", use: "24px and up, icons" },
  ],
  status: [
    { token: "--verified", value: "#8CCBA0", use: "Confirmed" },
    { token: "--needs", value: "#A9BEE0", use: "Needs you" },
    { token: "--risk", value: "#F09080", use: "Must fix" },
    { token: "--silver", value: "#C9C5BC", use: "The interviewer" },
  ],
};

export interface TypeRow {
  name: string;
  /** Size, weight, leading and tracking, as SPEC §2.4 gives them. */
  spec: string;
  className: string;
  sample: string;
  /** One to three words set in the italic accent. */
  accent?: string;
}

export const TYPE_ROWS: TypeRow[] = [
  {
    name: "display-hero",
    spec: "44–112 / 0.95 / 450 / −0.045em",
    className: "text-display-hero",
    sample: "Said once,",
    accent: "kept whole.",
  },
  {
    name: "display-1",
    spec: "36–72 / 1.0 / 450 / −0.04em",
    className: "text-display-1",
    sample: "Every school reads a",
    accent: "different you.",
  },
  {
    name: "display-2",
    spec: "28–48 / 1.05 / 500 / −0.035em",
    className: "text-display-2",
    sample: "Essays that show their thinking",
  },
  {
    name: "display-3",
    spec: "22–32 / 1.15 / 500 / −0.025em",
    className: "text-display-3",
    sample: "Tell us about a time you led without the title.",
  },
  {
    name: "title",
    spec: "18 → 20 / 1.3 / 500 / −0.015em",
    className: "text-title",
    sample: "Why Northfield, and why now",
  },
  {
    name: "body-lg",
    spec: "16 → 17 / 1.55 / 400",
    className: "text-lg text-text-80",
    sample:
      "You talk through your life once. The same story is then positioned for each school on your list, in that school's own terms.",
  },
  {
    name: "body",
    spec: "15 → 16 / 1.55 / 400",
    className: "text-base text-text-80",
    sample:
      "Each draft marks which words are yours and explains why it opens where it does, so you can argue with it.",
  },
  {
    name: "ui",
    spec: "14 / 20 / 500",
    className: "text-ui",
    sample: "Save and continue",
  },
  {
    name: "ui-sm",
    spec: "13 / 18 / 400",
    className: "text-sm text-text-soft",
    sample: "Round 2 closes on 6 January. Nothing is sent until you say so.",
  },
  {
    name: "label",
    spec: "11 mono / 16 / 500 / +0.18em, capitals",
    className: "label",
    sample: "Short-term goal",
  },
  {
    name: "note",
    spec: "11.5 mono / 18 / 400",
    className: "note",
    sample: "Leads with the decision, not the title: ownership before rank.",
  },
  {
    name: "figure",
    spec: "mono, tabular / −0.01em",
    className: "figure text-title",
    sample: "412 / 500 words · 06 Jan 2027",
  },
  {
    name: "transcript",
    spec: "Instrument Serif italic 24 → 28 → 34 / 1.2",
    className: "font-accent text-transcript italic text-text-label",
    sample: "and nobody above me was awake to ask",
  },
];

export const RADII: { token: string; value: string; use: string }[] = [
  { token: "--radius-round", value: "pill", use: "Every action" },
  { token: "--radius-frame", value: "32", use: "Product frames" },
  { token: "--radius-card", value: "24", use: "Cards, dialogs" },
  { token: "--radius-control", value: "14", use: "Fields" },
  { token: "--radius-inset", value: "8", use: "Nested things" },
  { token: "--radius-paper", value: "3", use: "Every sheet" },
];

/**
 * A stretch of someone speaking, as an SVG path: a sum of three sines under a rise-and-fall
 * envelope, so it starts and ends on the baseline. Deterministic for a seed (no Math.random: the
 * server and the client must draw the same line).
 */
export function wavePath(
  seed: number,
  {
    x = 0,
    width,
    baseline,
    amplitude,
  }: { x?: number; width: number; baseline: number; amplitude: number },
): string {
  const points: string[] = [];
  const steps = Math.max(24, Math.round(width / 3));
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const envelope = Math.sin(Math.PI * t) ** 1.6;
    const wave =
      Math.sin(t * 38 + seed * 1.7) * 0.55 +
      Math.sin(t * 71 + seed * 0.9) * 0.3 +
      Math.sin(t * 17 + seed * 2.3) * 0.15;
    const px = (x + t * width).toFixed(1);
    const py = (baseline - wave * envelope * amplitude).toFixed(2);
    points.push(`${i === 0 ? "M" : "L"}${px} ${py}`);
  }
  return points.join("");
}
