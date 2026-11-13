// Server-safe: no "use client", so server components can style links as buttons.
import { cx } from "../lib/cx";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";
export type ButtonSize = "lg" | "md" | "sm";
type ButtonShape = "label" | "icon";

// Every action is a pill (SPEC §2.9). Geist 14/20 at 500. Hover is a colour step over 200 ms,
// pressed is 0.98 over 100 ms; nothing scales above 1. The focus ring is the global one: 2px in
// the text colour, 3px off, so it shows on the brass fill too.
const BASE =
  "relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-full text-ui " +
  "transition-[color,background-color,border-color,scale] duration-(--dur-hover) ease-rise " +
  "active:scale-[0.98] active:duration-(--dur-press) motion-reduce:active:scale-100 " +
  "disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100 " +
  "aria-disabled:cursor-not-allowed aria-disabled:opacity-45 aria-disabled:active:scale-100";

// Text on --signal and --risk fills is --on-signal in both themes. Primary is brass on dark and
// ink on paper (--signal). Secondary is the flat frost. Quiet is text alone.
const VARIANTS: Record<ButtonVariant, Record<ButtonShape, string>> = {
  primary: {
    label: "gloss bg-signal text-on-signal",
    icon: "gloss bg-signal text-on-signal",
  },
  secondary: {
    label:
      "frost-flat text-text hover:bg-frost-hover [--btn-arrow-bg:var(--frost-hover)] [--btn-arrow-fg:var(--text)]",
    icon: "frost-flat text-text hover:bg-frost-hover",
  },
  quiet: {
    label:
      "bg-transparent text-text underline decoration-transparent decoration-1 underline-offset-4 hover:decoration-current " +
      "[--btn-arrow-bg:var(--frost)] [--btn-arrow-fg:var(--text)]",
    icon: "bg-transparent text-text hover:bg-veil",
  },
  danger: {
    label: "gloss [--gloss-hover:color-mix(in_srgb,var(--risk)_92%,white)] bg-risk text-on-signal",
    icon: "gloss [--gloss-hover:color-mix(in_srgb,var(--risk)_92%,white)] bg-risk text-on-signal",
  },
};

// Small controls stay 36px visually but get a 44px hit area.
const HIT_AREA =
  "before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2";

const SIZES: Record<ButtonShape, Record<ButtonSize, string>> = {
  label: {
    lg: "min-h-13 px-6",
    md: "min-h-11 px-5",
    sm: `min-h-9 px-4 ${HIT_AREA}`,
  },
  icon: {
    lg: "size-13",
    md: "size-11",
    sm: "size-9 before:absolute before:left-1/2 before:top-1/2 before:size-11 before:-translate-1/2",
  },
};

// With the arrow circle the pill is tighter on the right, so the circle sits 8 / 6px inside it.
const WITH_ARROW: Record<ButtonSize, string> = {
  lg: "pr-2 [--btn-arrow-size:2.25rem]",
  md: "pr-1.5 [--btn-arrow-size:2rem]",
  sm: "",
};

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
  /**
   * Leaves room for the arrow circle: put `<span aria-hidden className="btn-arrow" />` (or
   * `<ButtonArrow />`) last inside the element. For forward actions only ("Start your story",
   * "Unlock", "Continue"); `lg` and `md` only.
   */
  arrow?: boolean;
}

export function buttonStyles({
  variant = "primary",
  size = "md",
  shape = "label",
  arrow = false,
}: ButtonStyleOptions = {}): string {
  return cx(
    BASE,
    VARIANTS[variant][shape],
    SIZES[shape][size],
    arrow && shape === "label" && WITH_ARROW[size],
  );
}

/** Class of the arrow circle; the element is decorative, so give it `aria-hidden`. */
export const BUTTON_ARROW_CLASS = "btn-arrow";
