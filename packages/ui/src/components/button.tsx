"use client";

import type { Icon } from "@phosphor-icons/react";
import { Slot } from "radix-ui";
import {
  isValidElement,
  type ButtonHTMLAttributes,
  type MouseEvent,
  type ReactElement,
  type Ref,
} from "react";
import { cx } from "../lib/cx";
import {
  BUTTON_ARROW_CLASS,
  buttonStyles,
  type ButtonSize,
  type ButtonVariant,
} from "./button-styles";

export type { ButtonSize, ButtonVariant };

function blockWhileLoading(event: MouseEvent<HTMLElement>) {
  event.preventDefault();
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /**
   * Leading Phosphor icon (regular weight): the component, or an element a server component has
   * already rendered (e.g. from "@phosphor-icons/react/ssr"), which then ships no icon code to
   * the browser. Either way it is decorative.
   */
  icon?: Icon | ReactElement;
  /**
   * Keeps the button focusable while work is in progress; clicks are ignored. Pass the
   * in-progress label as children ("Saving"): the label is the progress signal, because the
   * product has no spinners (spec §6.1). The leading icon dims while loading.
   */
  loading?: boolean;
  /**
   * The arrow in a small circle at the end of the pill, which nudges 2px on hover. For forward
   * actions only ("Start your story", "Unlock", "Continue"). Ignored at size "sm".
   */
  arrow?: boolean;
  /** Style a child element (e.g. a link) as a button instead of rendering <button>. */
  asChild?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

function LeadingIcon({
  icon,
  size,
  loading,
}: {
  icon: Icon | ReactElement;
  size: number;
  loading: boolean;
}) {
  const dim = loading ? "opacity-60" : undefined;
  if (isValidElement(icon)) {
    return (
      <span aria-hidden className={cx("inline-flex shrink-0", dim)}>
        {icon}
      </span>
    );
  }
  const IconComponent = icon;
  return <IconComponent size={size} aria-hidden className={dim} />;
}

/** A pill (SPEC §2.9). It does not lean, glow or scale up: hover is a colour step. */
export function Button({
  variant = "primary",
  size = "md",
  icon,
  loading = false,
  arrow = false,
  asChild = false,
  className,
  children,
  onClick,
  type,
  ref,
  ...rest
}: ButtonProps) {
  const withArrow = arrow && size !== "sm";
  const trailing = withArrow ? <span aria-hidden className={BUTTON_ARROW_CLASS} /> : null;
  const leading = icon ? (
    <LeadingIcon icon={icon} size={size === "sm" ? 16 : 20} loading={loading} />
  ) : null;

  const shared = {
    className: cx(buttonStyles({ variant, size, arrow: withArrow }), className),
    "aria-busy": loading || undefined,
    "aria-disabled": loading || rest["aria-disabled"] || undefined,
    onClick: loading ? blockWhileLoading : onClick,
  };

  if (asChild) {
    return (
      <Slot.Root ref={ref as Ref<HTMLElement>} {...rest} {...shared}>
        {leading}
        <Slot.Slottable>{children}</Slot.Slottable>
        {trailing}
      </Slot.Root>
    );
  }

  return (
    <button ref={ref} type={type ?? "button"} {...rest} {...shared}>
      {leading}
      {children}
      {trailing}
    </button>
  );
}
