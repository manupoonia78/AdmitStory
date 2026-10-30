import Link from "next/link";
import type { ComponentProps } from "react";
import { cx } from "../lib/cx";

export type TextLinkProps = ComponentProps<typeof Link> & {
  /** Opens in a new tab and says so to screen readers. */
  external?: boolean;
};

// Links are always underlined: colour alone never marks a link (WCAG 1.4.1).
const STYLES = "text-signal underline decoration-1 underline-offset-[0.2em] hover:decoration-2";

export function TextLink({ external = false, className, children, ...rest }: TextLinkProps) {
  const externalProps = external ? { target: "_blank", rel: "noopener noreferrer" } : {};
  return (
    <Link className={cx(STYLES, className)} {...externalProps} {...rest}>
      {children}
      {external ? <span className="sr-only"> (opens in a new tab)</span> : null}
    </Link>
  );
}
