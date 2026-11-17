// The head of a landing scene (SPEC §4, shared values): an eyebrow, then the heading broken by
// hand with its last line in the italic accent. Server-safe.

import { cx } from "@admitstory/ui";
import type { ReactNode } from "react";

export interface SceneHeadProps {
  id: string;
  eyebrow?: ReactNode;
  /** Author-set lines. The last is set in the accent unless `accent` is false. */
  lines: readonly string[];
  size?: "1" | "2";
  accent?: boolean;
  className?: string;
}

const SIZE = { "1": "text-display-1", "2": "text-display-2" } as const;

export function SceneHead({
  id,
  eyebrow,
  lines,
  size = "1",
  accent = true,
  className,
}: SceneHeadProps) {
  const last = lines.length - 1;
  return (
    <div className={className}>
      {eyebrow ? <p className="eyebrow mb-6">{eyebrow}</p> : null}
      <h2 id={id} className={cx(SIZE[size], "font-display text-text [font-kerning:normal]")}>
        {lines.map((line, index) => (
          <span key={line} className="block">
            {accent && index === last && last > 0 ? <em>{line}</em> : line}
            {index < last ? " " : null}
          </span>
        ))}
      </h2>
    </div>
  );
}
