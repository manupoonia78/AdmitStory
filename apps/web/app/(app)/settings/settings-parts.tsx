import { cx } from "@admitstory/ui";
import Link from "next/link";
import type { ReactNode } from "react";

// The pieces every Settings page is built from (SPEC §6.17): sections on hairlines with a label
// head, and link rows whose whole width is the link. Server-safe, no client code.

export function SettingsSection({
  id,
  title,
  lede,
  children,
  className,
}: {
  id: string;
  title: string;
  lede?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={cx("flex flex-col border-t border-edge py-10", className)}>
      <h2 id={id} className="label">
        {title}
      </h2>
      {lede ? <p className="mt-3 max-w-[60ch] text-sm text-text-soft">{lede}</p> : null}
      <div className="mt-6 flex flex-col gap-6">{children}</div>
    </section>
  );
}

/** A row that is one link: title, a line under it, the arrow circle at the right. */
export function SettingsLinkRow({
  href,
  title,
  line,
  size = "md",
}: {
  href: string;
  title: string;
  line: string;
  size?: "md" | "lg";
}) {
  return (
    <Link
      href={href}
      className={cx(
        "group -mx-3 flex items-center gap-5 rounded-[16px] px-3 transition-colors duration-200 hover:bg-veil active:scale-[0.99]",
        size === "lg" ? "min-h-[88px] py-5" : "min-h-14 py-3",
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className={cx("text-text", size === "lg" ? "text-title" : "text-ui")}>{title}</span>
        <span className="text-sm text-text-soft">{line}</span>
      </span>
      <span
        aria-hidden
        className="btn-arrow [--btn-arrow-bg:var(--veil)] [--btn-arrow-fg:var(--text)] [--btn-arrow-size:2rem]"
      />
    </Link>
  );
}
