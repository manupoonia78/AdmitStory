// Small print (plan §3.3): the 13 px margin note, the fictional-applicant note. Server-safe.

import { cx } from "@admitstory/ui";
import type { ReactNode } from "react";
import { FICTIONAL_NOTE } from "../_copy/shared";

/** 13 px, tabular numerals, --text-soft: a position readout or an aside, never a label. */
export function MarginNote({
  children,
  className,
  as: Tag = "p",
}: {
  children: ReactNode;
  className?: string;
  as?: "p" | "span" | "div";
}) {
  return <Tag className={cx("text-sm text-text-soft tabular-nums", className)}>{children}</Tag>;
}

/** "A sample applicant. Fictional, as is Northfield." Wherever the sample applicant appears. */
export function FictionalNote({ className }: { className?: string }) {
  return <MarginNote className={className}>{FICTIONAL_NOTE}</MarginNote>;
}
