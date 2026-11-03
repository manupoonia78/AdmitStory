import type { HTMLAttributes } from "react";
import { cx } from "../lib/cx";

/** Text for assistive technology only. */
export function VisuallyHidden({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cx("sr-only", className)} {...rest} />;
}
