// Server-safe: no "use client", so server components can style links as buttons.
import { cx } from "../lib/cx";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";
export type ButtonSize = "md" | "sm";
type ButtonShape = "label" | "icon";

const BASE =
  "relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-control font-medium " +
  "transition-colors duration-(--duration-quick) " +
  "disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60";

// Text on --ink and --risk fills is --paper in both modes; secondary borders use
// --slate so the control edge meets 3:1 (WCAG 1.4.11). Status colours never sit on
// --ink-soft, so danger hovers by deepening its own fill.
const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-ink text-paper hover:bg-ink/90",
  secondary: "border border-slate bg-paper text-ink hover:bg-ink-soft",
  quiet: "bg-transparent text-ink hover:bg-ink-soft",
  danger: "bg-risk text-paper hover:bg-risk/90",
};

// Small controls stay 36px visually but get a 44px hit area (spec §6.9).
const HIT_AREA =
  "before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2";

const SIZES: Record<ButtonShape, Record<ButtonSize, string>> = {
  label: {
    md: "min-h-11 px-4 text-base",
    sm: `min-h-9 px-3 text-sm ${HIT_AREA}`,
  },
  icon: {
    md: "size-11",
    sm: "size-9 before:absolute before:left-1/2 before:top-1/2 before:size-11 before:-translate-1/2",
  },
};

export function buttonStyles({
  variant = "primary",
  size = "md",
  shape = "label",
}: { variant?: ButtonVariant; size?: ButtonSize; shape?: ButtonShape } = {}): string {
  return cx(BASE, VARIANTS[variant], SIZES[shape][size]);
}
