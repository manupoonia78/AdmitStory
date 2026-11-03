"use client";

// The Résumé Pass's hero (spec §5.10, §6.7): the résumé as a printed sheet, line for line as the
// Word file will set it (`resumeLines`, the same helper the export uses). Where the page limit
// falls, a fine hairline crosses the sheet, "End of page 1", and every line past it sits beyond
// the fold in the soft text colour. Accepting a rewrite morphs the bullet's words in place (old
// words fade and blur out, new ones sharpen in, 240 ms: DiffMorph), and as lines shorten the rows
// below and the hairline glide up (Motion `layout`, glide spring), so the overflow visibly
// recedes. Rows animate position only, never size, so text never stretches.
//
// The sheet is paper in either theme (§6.3): a Day subtree on --depth.
// Reduced motion: no glide and no blur; a changed bullet swaps with a 120 ms fade (DiffMorph).

import { CheckIcon, DotOutlineIcon, MinusIcon, PencilSimpleIcon } from "@phosphor-icons/react";
import type { ResumeLine } from "@admitstory/linters";
import { motion, useReducedMotion } from "motion/react";
import { useState, type ReactNode } from "react";
import { cx } from "../lib/cx";
import { spring } from "../motion";
import { DiffMorph } from "../workspace/diff-morph";
import { BULLET_STATE_WORDS, type BulletState } from "./resume-text";

export interface ResumePaperProps {
  lines: readonly ResumeLine[];
  /** The first line past the page limit, or -1 when it fits (`overflowIndex`). */
  overflowAt: number;
  /** The page the hairline closes: "End of page 1". */
  limitPages: number | null;
  states: Readonly<Record<string, BulletState>>;
  focusedId: string | null;
  onSelect: (bulletId: string) => void;
  /** Registers each bullet's button, so the sheet can scroll to and focus it (J and K). */
  bulletRef?: (bulletId: string, element: HTMLButtonElement | null) => void;
  label?: string;
  className?: string;
}

/** Stable keys for the printed lines: a section's lines and the header lines share a ref. */
export function lineKeys(lines: readonly ResumeLine[]): string[] {
  const seen = new Map<string, number>();
  return lines.map((line) => {
    const base = `${line.kind}:${line.ref}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return line.kind === "bullet" || line.kind === "role" ? base : `${base}:${n}`;
  });
}

const STATE_ICONS: Record<BulletState, { icon: typeof CheckIcon; className: string } | null> = {
  suggestion: { icon: DotOutlineIcon, className: "text-signal" },
  accepted: { icon: CheckIcon, className: "text-verified" },
  edited: { icon: PencilSimpleIcon, className: "text-verified" },
  rejected: { icon: MinusIcon, className: "text-text-soft" },
  strong: null,
};

type Morph = { before: string; after: string };

function bulletTexts(lines: readonly ResumeLine[]): Record<string, string> {
  const texts: Record<string, string> = {};
  for (const line of lines) if (line.kind === "bullet") texts[line.ref] = line.text;
  return texts;
}

function sameTexts(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}

export function ResumePaper({
  lines,
  overflowAt,
  limitPages,
  states,
  focusedId,
  onSelect,
  bulletRef,
  label = "Your resume, as the Word file will set it",
  className,
}: ResumePaperProps) {
  const reduced = useReducedMotion();
  const layout = reduced ? false : ("position" as const);
  const glide = spring("glide");
  const keys = lineKeys(lines);

  // A bullet whose words changed since the last render morphs from the old wording to the new.
  const texts = bulletTexts(lines);
  const [shown, setShown] = useState(texts);
  const [morphs, setMorphs] = useState<Record<string, Morph>>({});
  if (!sameTexts(shown, texts)) {
    const changed: Record<string, Morph> = {};
    for (const [id, text] of Object.entries(texts)) {
      const before = shown[id];
      if (before !== undefined && before !== text) changed[id] = { before, after: text };
    }
    setShown(texts);
    if (Object.keys(changed).length > 0) setMorphs((current) => ({ ...current, ...changed }));
  }
  const settle = (id: string) =>
    setMorphs((current) => {
      const { [id]: _done, ...rest } = current;
      return rest;
    });

  const rows: ReactNode[] = [];
  lines.forEach((line, index) => {
    const beyond = overflowAt >= 0 && index >= overflowAt;
    if (index === overflowAt && limitPages !== null) {
      rows.push(
        <motion.div
          key="page-end"
          layout={layout}
          transition={glide}
          role="separator"
          aria-label={`End of page ${limitPages}`}
          data-page-end=""
          className="relative -mx-6 my-3 flex items-center gap-3 sm:-mx-12"
        >
          <span aria-hidden className="h-px flex-1 bg-risk" />
          <span aria-hidden className="pr-6 text-sm font-medium text-risk sm:pr-12">
            End of page {limitPages}
          </span>
        </motion.div>,
      );
    }
    const key = keys[index] ?? `${index}`;
    const tone = beyond ? "text-text-soft" : "text-text";
    const rowClass = cx(
      "transition-colors duration-(--spring-glide-duration) ease-glide motion-reduce:transition-none",
      tone,
    );
    const shared = {
      layout,
      transition: glide,
      "data-line": line.kind,
      "data-beyond": beyond ? "" : undefined,
    } as const;

    if (line.kind === "header") {
      // The name is set large and takes two printed lines; the contact line is one.
      const name = index === 0 && line.lines === 2;
      rows.push(
        <motion.p
          key={key}
          {...shared}
          className={cx(
            name ? rowClass : "text-text-soft",
            name ? "text-lg font-semibold" : "pb-1 text-sm",
          )}
        >
          {line.text}
        </motion.p>,
      );
      return;
    }
    if (line.kind === "heading") {
      rows.push(
        <motion.h3
          key={key}
          {...shared}
          className={cx(rowClass, "mt-5 border-b border-text/25 pb-1 text-sm font-semibold")}
        >
          {line.text}
        </motion.h3>,
      );
      return;
    }
    if (line.kind === "role") {
      rows.push(
        <motion.p key={key} {...shared} className={cx(rowClass, "mt-2 text-sm font-semibold")}>
          {line.text}
        </motion.p>,
      );
      return;
    }
    if (line.kind === "line") {
      rows.push(
        <motion.p key={key} {...shared} className={cx(rowClass, "text-sm")}>
          {line.text}
        </motion.p>,
      );
      return;
    }

    const id = line.ref;
    const state = states[id] ?? "strong";
    const marker = STATE_ICONS[state];
    const MarkerIcon = marker?.icon;
    const morph = morphs[id];
    const current = focusedId === id;
    rows.push(
      <motion.div
        key={key}
        {...shared}
        data-bullet={id}
        data-state={state}
        className={cx(rowClass, "grid grid-cols-[1rem_minmax(0,1fr)] items-start gap-x-1")}
      >
        {/* The gutter is always there, so a decision never moves the text. */}
        <span aria-hidden className="flex h-[1lh] items-center justify-center text-sm">
          {MarkerIcon ? <MarkerIcon size={14} weight="bold" className={marker.className} /> : null}
        </span>
        <button
          ref={(element) => bulletRef?.(id, element)}
          type="button"
          aria-current={current ? "true" : undefined}
          onClick={() => onSelect(id)}
          className={cx(
            "relative -mx-1 rounded-control px-1 py-0.5 text-left text-sm hover:bg-veil",
            "before:absolute before:-left-1.5 before:top-1 before:bottom-1 before:w-0.5 before:rounded-full",
            current && "bg-veil before:bg-signal",
          )}
        >
          <span aria-hidden className="mr-1.5">
            •
          </span>
          {morph ? (
            <DiffMorph
              key={`${morph.before}\u0000${morph.after}`}
              before={morph.before}
              after={morph.after}
              initial="undone"
              decision="kept"
              onSettled={() => settle(id)}
            />
          ) : (
            line.text
          )}
          <span className="sr-only">. {BULLET_STATE_WORDS[state]}.</span>
        </button>
      </motion.div>,
    );
  });

  return (
    <section
      aria-label={label}
      data-theme="day"
      className={cx(
        "min-w-0 rounded-plane border border-edge bg-depth px-6 py-8 font-ui text-text sm:px-12 sm:py-12",
        className,
      )}
    >
      <div className="flex flex-col">{rows}</div>
    </section>
  );
}
