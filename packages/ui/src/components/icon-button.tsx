// Server-safe. From a server component, pass an icon from "@phosphor-icons/react/ssr".
import type { Icon } from "@phosphor-icons/react";
import type { ButtonHTMLAttributes, Ref } from "react";
import { cx } from "../lib/cx";
import { buttonStyles, type ButtonSize, type ButtonVariant } from "./button-styles";

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "aria-label"
> {
  /** Required: an icon-only control has no other accessible name. */
  "aria-label": string;
  icon: Icon;
  variant?: ButtonVariant;
  size?: ButtonSize;
  ref?: Ref<HTMLButtonElement>;
}

export function IconButton({
  icon: IconComponent,
  variant = "quiet",
  size = "md",
  className,
  type,
  ref,
  ...rest
}: IconButtonProps) {
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      className={cx(buttonStyles({ variant, size, shape: "icon" }), className)}
      {...rest}
    >
      <IconComponent size={20} aria-hidden />
    </button>
  );
}
