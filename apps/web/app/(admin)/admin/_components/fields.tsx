import { cx } from "@admitstory/ui";
import type { ComponentProps, ReactNode } from "react";

// Dense console controls (direction doc, M): UI 15 for controls, 13/18 for data, hairline edges.
// Server-safe: no hooks, so pages render them inside AdminForm without extra client code.

const control =
  "min-h-9 w-full rounded-control border border-control bg-depth px-2 text-base text-text " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-signal";

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("flex min-w-0 flex-col gap-1", className)}>
      <span className="text-sm font-medium text-text">{label}</span>
      {children}
      {hint ? <span className="text-sm text-text-soft">{hint}</span> : null}
    </label>
  );
}

export function Input({ className, ...rest }: ComponentProps<"input">) {
  return <input className={cx(control, className)} {...rest} />;
}

export function Select({ className, ...rest }: ComponentProps<"select">) {
  return <select className={cx(control, "pr-6", className)} {...rest} />;
}

export function TextArea({ className, ...rest }: ComponentProps<"textarea">) {
  return (
    <textarea className={cx(control, "min-h-24 py-2 font-mono text-sm", className)} {...rest} />
  );
}

/** A section of a console page: a sentence-case heading and its content. */
export function Section({
  title,
  children,
  aside,
  id,
}: {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
  id?: string;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 border-t border-edge pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={id} className="text-lg font-semibold text-text">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Table classes: hairline rules between rows, no zebra, tabular numbers (direction doc, M). */
export const table = {
  wrap: "overflow-x-auto",
  table: "w-full border-collapse text-sm tabular-nums",
  th: "border-b border-edge px-2 py-1.5 text-left font-medium text-text-soft align-bottom",
  td: "border-b border-edge px-2 py-1.5 align-top text-text",
  num: "text-right",
};

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "Not yet";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
    .format(date)
    .replace("Sept", "Sep");
}
