"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Fragment,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { cx } from "../lib/cx";
import { REDUCED_FADE, spring } from "../motion";
import { NeedChip } from "./need-chip";
import { isOwnWords } from "./provenance";
import type {
  DraftNeed,
  DraftParagraph,
  DraftSentence,
  SourceExcerpt,
  SourceExcerpts,
} from "./types";

export interface YourWordsTextProps {
  paragraphs: readonly DraftParagraph[];
  /** What each cite id points at. Sentences whose sources are all missing still glow. */
  sources: SourceExcerpts;
  /** The your-words view (spec §5.8). Off, every sentence reads the same. */
  on: boolean;
  needs?: readonly DraftNeed[];
  onNeedSelect?: (need: DraftNeed) => void;
  /**
   * Replaces one paragraph's content (a diff under review, a composer). Return undefined to
   * render the paragraph as usual. The <p> around it stays, so the text never changes shape.
   */
  renderParagraph?: (paragraph: DraftParagraph, index: number) => ReactNode | undefined;
  /** Block content after a paragraph, such as the bar to keep or undo a change to it. */
  renderAfterParagraph?: (paragraph: DraftParagraph, index: number) => ReactNode;
  className?: string;
}

// The glow is a background in the translucent hue plus a halo of the same colour, so it reads as
// light around the words rather than a flat highlighter (spec §6.2). Both properties interpolate,
// so toggling mid-transition reverses smoothly; reduced motion drops the transition entirely. In
// forced colours or high contrast the glow becomes a 1px dotted underline.
const GLOW_BASE =
  "box-decoration-clone transition-[background-color,box-shadow] duration-(--spring-glide-duration) ease-glide motion-reduce:transition-none";
const GLOW_OFF = "bg-transparent shadow-[0_0_0.7em_transparent]";
const GLOW_ON =
  "cursor-default bg-voice-glow text-text shadow-[0_0_0.7em_var(--voice-glow)] " +
  "forced-colors:underline forced-colors:decoration-dotted forced-colors:decoration-1 forced-colors:underline-offset-4 " +
  "contrast-more:underline contrast-more:decoration-dotted contrast-more:decoration-1 contrast-more:underline-offset-4";
// A light sweep: lit sentences come on one after another, never more than ~300 ms in total.
const STAGGER_MS = 24;
const STAGGER_MAX = 12;
// Leaving a sentence for its popover must not close it (WCAG 1.4.13: hoverable).
const CLOSE_DELAY_MS = 160;

interface OpenSource {
  key: string;
  sentence: DraftSentence;
  top: number;
  left: number;
  /** Open above the line instead of below when there is no room underneath. */
  above: boolean;
  /** Opened by a click or tap: stays until dismissed rather than following hover and focus. */
  pinned: boolean;
}

function kindLabel(sentence: Pick<DraftSentence, "kind" | "author">): string {
  if (sentence.author === "user") return "You wrote this in the draft";
  return sentence.kind === "verbatim" ? "Your exact words" : "Adapted from what you said";
}

/** A lit sentence's source in one line, for screen readers. */
export function describeSource(sentence: DraftSentence, sources: SourceExcerpts): string {
  const found = sentence.sources
    .map((id) => sources[id])
    .filter((excerpt): excerpt is SourceExcerpt => Boolean(excerpt));
  if (found.length === 0) return `${kindLabel(sentence)}.`;
  return `${kindLabel(sentence)}. ${found.map((s) => `${s.label}: “${s.quote}”`).join(" ")}`;
}

/**
 * A draft with the your-words view (spec §6.7 Workspace hero: "Your words, lit"). With the view
 * on, verbatim and adapted sentences glow softly in the applicant's hue and composed sentences
 * stay plain. Pointing at, focusing or tapping a lit sentence shows the moment it was said: the
 * original line and where it came from. Every lit sentence is a tab stop, and its source is its
 * accessible description, so screen reader users get the same answer without the popover.
 */
export function YourWordsText({
  paragraphs,
  sources,
  on,
  needs = [],
  onNeedSelect,
  renderParagraph,
  renderAfterParagraph,
  className,
}: YourWordsTextProps) {
  const id = useId();
  const reduced = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const [open, setOpen] = useState<OpenSource | null>(null);

  const cancelClose = () => window.clearTimeout(closeTimer.current);
  const close = () => {
    cancelClose();
    setOpen(null);
  };
  const closeSoon = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => {
      setOpen((current) => (current?.pinned ? current : null));
    }, CLOSE_DELAY_MS);
  };

  const show = (
    element: HTMLElement,
    key: string,
    sentence: DraftSentence,
    { pinned, pointerY }: { pinned: boolean; pointerY?: number },
  ) => {
    const container = containerRef.current;
    if (!container) return;
    cancelClose();
    const box = container.getBoundingClientRect();
    const lines = Array.from(element.getClientRects());
    // The line under the pointer, or the first line for keyboard focus.
    const line =
      (pointerY === undefined
        ? undefined
        : lines.find((rect) => pointerY >= rect.top && pointerY <= rect.bottom)) ??
      lines[0] ??
      element.getBoundingClientRect();
    const above = line.bottom + 220 > window.innerHeight && line.top > 220;
    setOpen({
      key,
      sentence,
      pinned,
      above,
      left: line.left - box.left,
      top: above ? line.top - box.top : line.bottom - box.top,
    });
  };

  // Escape dismisses (WCAG 1.4.13), and a press anywhere else closes a pinned popover.
  const isOpen = open !== null;
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (target?.closest?.("[data-own-words], [data-source-popover]")) return;
      setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [isOpen]);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  // Turning the view off takes the popover with it.
  const shown = on ? open : null;
  let litIndex = 0;

  return (
    <div
      ref={containerRef}
      className={cx("relative flex flex-col gap-[1lh]", className)}
      data-your-words={on ? "on" : "off"}
    >
      {paragraphs.map((paragraph, paragraphIndex) => {
        const override = renderParagraph?.(paragraph, paragraphIndex);
        const paragraphNeeds = needs.filter((need) => need.paragraph_id === paragraph.id);
        return (
          <Fragment key={paragraph.id}>
            <p data-paragraph={paragraph.id}>
              {override !== undefined
                ? override
                : paragraph.sentences.map((sentence, index) => {
                    const key = `${paragraph.id}:${index}`;
                    const own = on && isOwnWords(sentence);
                    const delay = own ? Math.min(litIndex++, STAGGER_MAX) * STAGGER_MS : 0;
                    const descriptionId = `${id}-${key}`;
                    const chips = paragraphNeeds.filter((need) => need.after_sentence === index);
                    return (
                      <Fragment key={key}>
                        {index > 0 ? " " : null}
                        <span
                          data-kind={sentence.kind}
                          data-own-words={own ? "" : undefined}
                          className={cx(GLOW_BASE, own ? GLOW_ON : GLOW_OFF)}
                          style={{ transitionDelay: `${delay}ms` }}
                          {...(own
                            ? {
                                role: "button",
                                tabIndex: 0,
                                "aria-describedby": descriptionId,
                                onPointerEnter: (event: ReactPointerEvent<HTMLSpanElement>) => {
                                  if (event.pointerType !== "mouse" || open?.pinned) return;
                                  show(event.currentTarget, key, sentence, {
                                    pinned: false,
                                    pointerY: event.clientY,
                                  });
                                },
                                onPointerLeave: (event: ReactPointerEvent<HTMLSpanElement>) => {
                                  if (event.pointerType === "mouse") closeSoon();
                                },
                                onFocus: (event: ReactFocusEvent<HTMLSpanElement>) => {
                                  if (open?.key === key) return;
                                  show(event.currentTarget, key, sentence, { pinned: false });
                                },
                                onBlur: () => closeSoon(),
                                onClick: (event: ReactMouseEvent<HTMLSpanElement>) => {
                                  if (shown?.key === key && shown.pinned) return close();
                                  show(event.currentTarget, key, sentence, {
                                    pinned: true,
                                    pointerY: event.clientY || undefined,
                                  });
                                },
                                onKeyDown: (event: ReactKeyboardEvent<HTMLSpanElement>) => {
                                  if (event.key !== "Enter" && event.key !== " ") return;
                                  event.preventDefault();
                                  if (shown?.key === key && shown.pinned) return close();
                                  show(event.currentTarget, key, sentence, { pinned: true });
                                },
                              }
                            : {})}
                        >
                          {sentence.text}
                        </span>
                        {own ? (
                          <span id={descriptionId} hidden>
                            {describeSource(sentence, sources)}
                          </span>
                        ) : null}
                        {chips.map((need) => (
                          <Fragment key={need.question}>
                            {" "}
                            <NeedChip
                              data-need-chip={need.paragraph_id}
                              question={need.question}
                              approxWords={need.approx_words}
                              onClick={() => onNeedSelect?.(need)}
                            />
                          </Fragment>
                        ))}
                      </Fragment>
                    );
                  })}
            </p>
            {renderAfterParagraph?.(paragraph, paragraphIndex)}
          </Fragment>
        );
      })}

      <AnimatePresence>
        {shown ? (
          <motion.div
            key={shown.key}
            data-source-popover
            // The same words are each lit sentence's accessible description; this is the view.
            aria-hidden
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: shown.above ? 4 : -4 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={reduced ? REDUCED_FADE : spring("glide")}
            onPointerEnter={cancelClose}
            onPointerLeave={(event) => {
              if (event.pointerType === "mouse") closeSoon();
            }}
            className={cx(
              "plane absolute z-20 flex w-[min(22rem,100%)] flex-col gap-2 p-4 font-ui shadow-overlay",
              shown.above ? "-translate-y-full" : null,
            )}
            style={{
              top: shown.above ? shown.top - 8 : shown.top + 8,
              left: `max(0px, min(${shown.left}px, calc(100% - min(22rem, 100%))))`,
            }}
          >
            <SourceBody sentence={shown.sentence} sources={sources} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** What the source plane says: "The moment you said it", the original line, where it was said. */
export function SourceBody({
  sentence,
  sources,
}: {
  sentence: DraftSentence;
  sources: SourceExcerpts;
}) {
  const found = sentence.sources
    .map((sourceId) => [sourceId, sources[sourceId]] as const)
    .filter((entry): entry is readonly [string, SourceExcerpt] => Boolean(entry[1]));
  return (
    <>
      <p className="text-sm font-medium text-text">
        {sentence.author === "user" && found.length === 0 ? "Your edit" : "The moment you said it"}
      </p>
      {found.length === 0 && sentence.author === "user" ? null : found.length === 0 ? (
        <p className="text-sm text-text-soft">The source for this sentence isn’t loaded.</p>
      ) : (
        found.map(([sourceId, excerpt]) => (
          <figure key={sourceId} className="flex flex-col gap-1">
            <blockquote className="font-reading text-lg text-text">“{excerpt.quote}”</blockquote>
            <figcaption className="text-sm text-text-soft">{excerpt.label}</figcaption>
          </figure>
        ))
      )}
      <p className="text-sm text-text-soft">{kindLabel(sentence)}</p>
    </>
  );
}
