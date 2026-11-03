"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { cx } from "../../lib/cx";
import { REDUCED_FADE, spring } from "../../motion";
import {
  docToDraft,
  draftToDoc,
  newParagraphId,
  reviewToDoc,
  sameDraft,
  changedParagraphIds,
  NEED_CHIP_NODE,
  type DocNode,
  type ParagraphReview,
  type ReviewChange,
} from "../doc-model";
import { usePlainKey } from "../shortcuts";
import type { DraftNeed, DraftParagraph, DraftSentence, SourceExcerpts } from "../types";
import { SourceBody, describeSource } from "../your-words-text";
import { canvasExtensions, type CanvasHandlers } from "./extensions";

/** One edit, as the canvas reports it: the whole draft, and which paragraphs changed. */
export interface DocEdit {
  paragraphs: DraftParagraph[];
  needs: DraftNeed[];
  /** Paragraphs edited, added, removed, locked or unlocked by this edit. */
  changed: string[];
}

export interface DocCanvasProps {
  paragraphs: readonly DraftParagraph[];
  needs?: readonly DraftNeed[];
  /** What each cite id points at, for the your-words source plane. */
  sources: SourceExcerpts;
  /** The your-words view (spec §5.8, key Y). */
  yourWords: boolean;
  /** The accessible name of the editor, e.g. "Essay 1 draft". */
  label: string;
  /** Default true. Off while drafting, or in coach mode where prose is the applicant's to write. */
  editable?: boolean;
  /** Every edit, with stable paragraph ids. Debounce saves on the caller's side. */
  onChange?: (edit: DocEdit) => void;
  onNeedSelect?: (need: DraftNeed) => void;
  /**
   * A revision under review: changed paragraphs show their word diff in place and morph as each
   * decision lands (spec §6.6). The canvas is read-only meanwhile.
   */
  review?: {
    changes: readonly ReviewChange[];
    decisions: Readonly<Record<string, ParagraphReview>>;
  } | null;
  /** L locks the paragraph last edited, when focus is outside a text field. Default true. */
  lockShortcut?: boolean;
  createParagraphId?: () => string;
  className?: string;
}

interface LitSentence {
  sentence: DraftSentence;
  top: number;
  left: number;
  key: string;
}

function sentenceFromDom(element: HTMLElement): DraftSentence {
  const kind = (element.dataset.kind ?? "composed") as DraftSentence["kind"];
  const author = element.dataset.author === "user" ? "user" : undefined;
  return {
    text: element.textContent ?? "",
    kind,
    sources: (element.dataset.sources ?? "").split(" ").filter(Boolean),
    ...(author ? { author } : {}),
  };
}

// The your-words glow, as in YourWordsText (spec §6.2): a translucent fill in the applicant's hue
// with a halo of the same colour, on `glide`. In forced colours it becomes a dotted underline.
const CANVAS =
  "relative font-reading text-read text-text [&_.ProseMirror]:flex [&_.ProseMirror]:flex-col [&_.ProseMirror]:gap-[1lh] " +
  "[&_.ProseMirror]:outline-none [&_.ProseMirror]:max-w-[68ch] [&_.ProseMirror]:whitespace-pre-wrap " +
  "[&_[data-sentence]]:box-decoration-clone [&_[data-sentence]]:transition-[background-color,box-shadow] " +
  "[&_[data-sentence]]:duration-(--spring-glide-duration) [&_[data-sentence]]:ease-glide motion-reduce:[&_[data-sentence]]:transition-none " +
  "data-[your-words=on]:[&_[data-own]]:bg-voice-glow data-[your-words=on]:[&_[data-own]]:shadow-[0_0_0.7em_var(--voice-glow)] " +
  "forced-colors:data-[your-words=on]:[&_[data-own]]:underline forced-colors:data-[your-words=on]:[&_[data-own]]:decoration-dotted " +
  "contrast-more:data-[your-words=on]:[&_[data-own]]:underline contrast-more:data-[your-words=on]:[&_[data-own]]:decoration-dotted " +
  // Diffs under review (spec §6.6): struck and underlined while pending; on a decision the losing
  // words fade and blur out over 240 ms. Reduced motion: they swap at once.
  "[&_[data-diff]]:transition-[opacity,filter] [&_[data-diff]]:duration-240 [&_[data-diff]]:ease-linear motion-reduce:[&_[data-diff]]:transition-none " +
  "[&_[data-review=pending]_[data-diff=removed]]:text-text-soft [&_[data-review=pending]_[data-diff=removed]]:line-through " +
  "[&_[data-review=pending]_[data-diff=added]]:bg-veil [&_[data-review=pending]_[data-diff=added]]:underline [&_[data-review=pending]_[data-diff=added]]:underline-offset-4 " +
  "[&_[data-review=kept]_[data-diff=removed]]:opacity-0 [&_[data-review=kept]_[data-diff=removed]]:blur-[4px] " +
  "[&_[data-review=undone]_[data-diff=added]]:opacity-0 [&_[data-review=undone]_[data-diff=added]]:blur-[4px] " +
  "[&_[data-locked=true]>p]:border-l-2 [&_[data-locked=true]>p]:border-edge [&_[data-locked=true]>p]:pl-4";

/**
 * The document canvas (spec §5.8, §6.8): the draft in the reading face, editable in place, with
 * the your-words glow, NEED chips, paragraph locks and diffs under review. Every edit is reported
 * as the paragraph model with stable ids: untouched sentences keep their provenance exactly, and a
 * sentence the applicant changed becomes theirs (author "user"). Pointing at a lit sentence, or
 * moving the caret into one, shows the moment it was said; the caret's sentence is also announced.
 *
 * TipTap is heavy: import this from "@admitstory/ui/editor" behind next/dynamic, never from the
 * main entry, so it stays out of every route's first load.
 */
export function DocCanvas({
  paragraphs,
  needs = [],
  sources,
  yourWords,
  label,
  editable = true,
  onChange,
  onNeedSelect,
  review = null,
  lockShortcut = true,
  createParagraphId = newParagraphId,
  className,
}: DocCanvasProps) {
  const reduced = useReducedMotion();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const handlers = useRef<CanvasHandlers | null>(null);
  // The draft as the editor last reported it, so a parent echoing it back doesn't reset the editor.
  const current = useRef<{ paragraphs: readonly DraftParagraph[]; needs: readonly DraftNeed[] }>({
    paragraphs,
    needs,
  });
  const lastParagraph = useRef<string | null>(null);
  const [litSentence, setLit] = useState<LitSentence | null>(null);
  // The source plane only exists in the your-words view.
  const lit = yourWords ? litSentence : null;
  const [announcement, setAnnouncement] = useState("");
  // The ref is read only inside the editor's event callbacks, never while rendering.
  // eslint-disable-next-line react-hooks/refs
  const extensions = useMemo(() => canvasExtensions(handlers), []);
  const reviewing = Boolean(review && review.changes.length > 0);

  // Props the editor's callbacks read at call time (they are bound once, at creation).
  const latest = useRef({ onChange, onNeedSelect, createParagraphId, sources, yourWords });
  useLayoutEffect(() => {
    latest.current = { onChange, onNeedSelect, createParagraphId, sources, yourWords };
  });

  const emit = (doc: DocNode) => {
    const next = docToDraft(doc, latest.current.createParagraphId);
    const before = current.current.paragraphs;
    current.current = next;
    latest.current.onChange?.({ ...next, changed: changedParagraphIds(before, next.paragraphs) });
  };

  const place = (element: HTMLElement, key: string, pointerY?: number) => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const box = wrapper.getBoundingClientRect();
    const lines = Array.from(element.getClientRects());
    const line =
      (pointerY === undefined
        ? undefined
        : lines.find((rect) => pointerY >= rect.top && pointerY <= rect.bottom)) ??
      lines[0] ??
      element.getBoundingClientRect();
    setLit({
      sentence: sentenceFromDom(element),
      key,
      left: line.left - box.left,
      top: line.bottom - box.top,
    });
  };

  // Moving the caret into a lit sentence shows and announces its source (the keyboard path).
  const caretSource = (e: Editor) => {
    if (!latest.current.yourWords) return;
    let element: HTMLElement | null = null;
    try {
      const at = e.view.domAtPos(e.state.selection.from);
      const node = at.node instanceof HTMLElement ? at.node : at.node.parentElement;
      element = node?.closest<HTMLElement>("[data-own]") ?? null;
    } catch {
      element = null;
    }
    if (!element) {
      setLit((open) => (open?.key === "caret" ? null : open));
      return;
    }
    setAnnouncement(describeSource(sentenceFromDom(element), latest.current.sources));
    place(element, "caret");
  };

  const editor = useEditor({
    extensions,
    content:
      reviewing && review
        ? reviewToDoc(paragraphs, needs, review.changes, review.decisions)
        : draftToDoc(paragraphs, needs),
    editable: editable && !reviewing,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        "aria-label": label,
        "aria-multiline": "true",
        role: "textbox",
        spellcheck: "true",
      },
    },
    onUpdate: ({ editor: e, transaction }) => {
      if (!transaction.docChanged || transaction.getMeta("canvasSync")) return;
      emit(e.getJSON() as DocNode);
    },
    onSelectionUpdate: ({ editor: e }) => {
      const { $from } = e.state.selection;
      if ($from.depth > 0) {
        const id = $from.node(1).attrs.id as string | null;
        if (id) lastParagraph.current = id;
      }
      caretSource(e);
    },
    onBlur: () => setLit((open) => (open?.key === "caret" ? null : open)),
  });

  // Paint external changes (a kept revision, a regenerated paragraph, a review) into the editor.
  useEffect(() => {
    if (!editor) return;
    const content =
      reviewing && review
        ? reviewToDoc(paragraphs, needs, review.changes, review.decisions)
        : draftToDoc(paragraphs, needs);
    if (!reviewing) {
      const echo =
        sameDraft(paragraphs, current.current.paragraphs) &&
        JSON.stringify(needs) === JSON.stringify(current.current.needs);
      const showingReview = editor.state.doc.content.content.some(
        (node) => node.attrs.review !== null && node.attrs.review !== undefined,
      );
      if (echo && !showingReview) return;
    }
    current.current = { paragraphs, needs };
    const { from } = editor.state.selection;
    editor
      .chain()
      .command(({ tr }) => {
        tr.setMeta("canvasSync", true);
        // Outside changes are not the applicant's to undo: the version timeline restores them.
        tr.setMeta("addToHistory", false);
        return true;
      })
      .setContent(content, { emitUpdate: false })
      .run();
    // Keep the caret near where it was, if it still fits.
    const max = editor.state.doc.content.size;
    if (editor.isFocused) editor.commands.setTextSelection(Math.min(from, Math.max(1, max - 1)));
  }, [editor, paragraphs, needs, review, reviewing]);

  useEffect(() => {
    editor?.setEditable(editable && !reviewing, false);
  }, [editor, editable, reviewing]);

  useLayoutEffect(() => {
    handlers.current = {
      onNeedSelect: (pos) => {
        if (!editor) return;
        let index = -1;
        editor.state.doc.descendants((node, at) => {
          if (node.type.name === NEED_CHIP_NODE) {
            index += 1;
            if (at === pos) return false;
          }
          return at <= pos;
        });
        const need = docToDraft(editor.getJSON() as DocNode, latest.current.createParagraphId)
          .needs[index];
        if (need) latest.current.onNeedSelect?.(need);
      },
      onToggleLock: (pos) => {
        if (!editor || reviewing) return;
        const node = editor.state.doc.nodeAt(pos);
        if (!node) return;
        editor.view.dispatch(
          editor.state.tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            locked: !node.attrs.locked,
          }),
        );
      },
    };
  }, [editor, reviewing]);

  const toggleLastLock = () => {
    if (!editor || reviewing) return;
    const id = lastParagraph.current;
    let target: number | null = null;
    editor.state.doc.forEach((node, offset) => {
      if (target === null && (id === null || node.attrs.id === id)) target = offset;
    });
    if (target !== null) handlers.current?.onToggleLock(target);
  };
  usePlainKey("l", toggleLastLock, lockShortcut && editable && !reviewing);

  // Escape dismisses the source plane (WCAG 1.4.13).
  const open = lit !== null;
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLit(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div
      ref={wrapperRef}
      className={cx(CANVAS, className)}
      data-your-words={yourWords ? "on" : "off"}
      data-reviewing={reviewing ? "" : undefined}
      onPointerOver={(event) => {
        if (!yourWords || event.pointerType !== "mouse") return;
        const element = (event.target as Element).closest<HTMLElement>("[data-own]");
        if (element) place(element, `hover:${element.dataset.sid ?? ""}`, event.clientY);
      }}
      onPointerLeave={() => setLit((open) => (open?.key.startsWith("hover:") ? null : open))}
    >
      <EditorContent editor={editor} />
      <p className="sr-only" aria-live="polite">
        {yourWords ? announcement : ""}
      </p>
      <AnimatePresence>
        {yourWords && lit ? (
          <motion.div
            key={lit.key}
            data-source-popover
            aria-hidden
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={reduced ? REDUCED_FADE : spring("glide")}
            className="plane pointer-events-none absolute z-20 flex w-[min(22rem,100%)] flex-col gap-2 p-4 font-ui shadow-overlay"
            style={{
              top: lit.top + 8,
              left: `max(0px, min(${lit.left}px, calc(100% - min(22rem, 100%))))`,
            }}
          >
            <SourceBody sentence={lit.sentence} sources={sources} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
