// Hairline lists (plan §3.3): rows separated by a 1px --edge rule, not cards. Server-safe.

import { cx } from "@admitstory/ui";
import type { ReactNode } from "react";

export function HairlineList({
  children,
  className,
  ordered = false,
  label,
}: {
  children: ReactNode;
  className?: string;
  ordered?: boolean;
  /** An accessible name for the list, when its heading isn't enough. */
  label?: string;
}) {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag
      aria-label={label}
      className={cx("divide-y divide-edge border-y border-edge", className)}
      role="list"
    >
      {children}
    </Tag>
  );
}

export function HairlineRow({ children, className }: { children: ReactNode; className?: string }) {
  return <li className={cx("py-6 sm:py-8", className)}>{children}</li>;
}
