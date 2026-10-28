"use client";

import { CircleNotchIcon, type Icon } from "@phosphor-icons/react";
import { Slot } from "radix-ui";
import type { ButtonHTMLAttributes, MouseEvent, Ref } from "react";
import { cx } from "../lib/cx";
import { buttonStyles, type ButtonSize, type ButtonVariant } from "./button-styles";

export type { ButtonSize, ButtonVariant };

function blockWhileLoading(event: MouseEvent<HTMLElement>) {
  event.preventDefault();
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Leading Phosphor icon (regular weight). */
  icon?: Icon;
  /**
   * Keeps the button focusable while work is in progress; clicks are ignored.
   * Pass the in-progress label as children ("Saving"), since the spinner is decorative.
   */
  loading?: boolean;
  /** Style a child element (e.g. a link) as a button instead of rendering <button>. */
  asChild?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  variant = "primary",
  size = "md",
  icon: IconComponent,
  loading = false,
  asChild = false,
  className,
  children,
  onClick,
  type,
  ref,
  ...rest
}: ButtonProps) {
  const iconSize = size === "sm" ? 16 : 20;
  const leading = loading ? (
    <CircleNotchIcon size={iconSize} className="animate-spin" aria-hidden />
  ) : IconComponent ? (
    <IconComponent size={iconSize} aria-hidden />
  ) : null;

  const shared = {
    className: cx(buttonStyles({ variant, size }), className),
    "aria-busy": loading || undefined,
    "aria-disabled": loading || rest["aria-disabled"] || undefined,
    onClick: loading ? blockWhileLoading : onClick,
  };

  if (asChild) {
    return (
      <Slot.Root ref={ref as Ref<HTMLElement>} {...rest} {...shared}>
        {leading}
        <Slot.Slottable>{children}</Slot.Slottable>
      </Slot.Root>
    );
  }

  return (
    <button ref={ref} type={type ?? "button"} {...rest} {...shared}>
      {leading}
      {children}
    </button>
  );
}
