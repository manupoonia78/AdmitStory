// The DocCanvas schema (spec §6.8): paragraphs with stable ids and a lock, sentences carrying
// their provenance in a `yourWords` mark, NEED chips as inline atoms, and a `diffMorph` mark for
// revisions under review. Plain DOM node views keep React out of the editor's hot path.

import { Mark, Node, mergeAttributes, type Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import {
  DIFF_MORPH_MARK,
  NEED_CHIP_NODE,
  PARAGRAPH_NODE,
  YOUR_WORDS_MARK,
  type NeedChipAttrs,
} from "../doc-model";

const LOCK =
  "M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM96,56a32,32,0,0,1,64,0V80H96ZM208,208H48V96H208V208Z";
const UNLOCK =
  "M208,80H96V56a32,32,0,0,1,32-32c15.37,0,29.2,11,32.16,25.59a8,8,0,0,0,15.68-3.18C171.32,24.15,151.2,8,128,8A48.05,48.05,0,0,0,80,56V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80Zm0,128H48V96H208V208Z";
const QUESTION =
  "M140,180a12,12,0,1,1-12-12A12,12,0,0,1,140,180ZM128,72c-22.06,0-40,16.15-40,36v4a8,8,0,0,0,16,0v-4c0-11,10.77-20,24-20s24,9,24,20-10.77,20-24,20a8,8,0,0,0-8,8v8a8,8,0,0,0,16,0v-.72c18.24-3.35,32-17.9,32-35.28C168,88.15,150.06,72,128,72Zm104,56A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z";

const SVG_NS = "http://www.w3.org/2000/svg";

function icon(path: string, size: number): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 256 256");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("fill", "currentColor");
  svg.setAttribute("aria-hidden", "true");
  const p = document.createElementNS(SVG_NS, "path");
  p.setAttribute("d", path);
  svg.append(p);
  return svg;
}

/** Callbacks the canvas hands its extensions; read at call time, so they can change freely. */
export interface CanvasHandlers {
  onNeedSelect: (pos: number) => void;
  onToggleLock: (pos: number) => void;
}

/** Every sentence's provenance. Own-words kinds glow when the your-words view is on. */
export const YourWords = Mark.create({
  name: YOUR_WORDS_MARK,
  inclusive: true,
  spanning: false,
  addAttributes() {
    return {
      sid: { default: null, parseHTML: (el) => el.getAttribute("data-sid") },
      kind: { default: "composed", parseHTML: (el) => el.getAttribute("data-kind") ?? "composed" },
      sources: {
        default: [],
        parseHTML: (el) => (el.getAttribute("data-sources") ?? "").split(" ").filter(Boolean),
      },
      author: { default: null, parseHTML: (el) => el.getAttribute("data-author") },
      origin: { default: "", parseHTML: (el) => el.getAttribute("data-origin") ?? "" },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-sentence]" }];
  },
  renderHTML({ mark }) {
    const { sid, kind, sources, author, origin } = mark.attrs as Record<string, unknown>;
    return [
      "span",
      {
        "data-sentence": "",
        "data-sid": sid,
        "data-kind": kind,
        "data-own": kind === "composed" ? undefined : "",
        "data-author": author ?? undefined,
        "data-sources": Array.isArray(sources) ? sources.join(" ") : "",
        "data-origin": origin,
      },
      0,
    ];
  },
});

/** A word in a revision under review: removed (struck) or added (underlined). */
export const DiffMorphMark = Mark.create({
  name: DIFF_MORPH_MARK,
  inclusive: false,
  addAttributes() {
    return { change: { default: "added", parseHTML: (el) => el.getAttribute("data-diff") } };
  },
  parseHTML() {
    return [{ tag: "span[data-diff]" }];
  },
  renderHTML({ mark }) {
    return ["span", { "data-diff": mark.attrs.change as string }, 0];
  },
});

/** A missing detail, sitting where it belongs (spec §5.8 [NEED] chips). Click opens a composer. */
export const NeedChipNode = Node.create<{ handlers: () => CanvasHandlers | null }>({
  name: NEED_CHIP_NODE,
  group: "inline",
  inline: true,
  atom: true,
  selectable: false,
  draggable: false,
  addOptions() {
    return { handlers: () => null };
  },
  addAttributes() {
    return {
      question: { default: "", parseHTML: (el) => el.getAttribute("data-question") ?? "" },
      approxWords: {
        default: 0,
        parseHTML: (el) => Number(el.getAttribute("data-approx-words") ?? 0),
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-need-chip]" }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const { question, approxWords } = node.attrs as NeedChipAttrs;
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-need-chip": "",
        "data-question": question,
        "data-approx-words": String(approxWords),
      }),
      `[${question} About ${approxWords} words.]`,
    ];
  },
  addNodeView() {
    return ({ node, getPos }) => {
      const { question, approxWords } = node.attrs as NeedChipAttrs;
      const dom = document.createElement("span");
      dom.contentEditable = "false";
      dom.dataset.needChip = "";
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.needChipButton = "";
      button.className =
        "inline-block max-w-full rounded-control border border-dashed border-needs px-1.5 py-0.5 " +
        "text-left align-baseline font-ui text-base text-needs hover:border-solid";
      const glyph = icon(QUESTION, 16);
      glyph.setAttribute("class", "mr-1 inline-block align-[-0.15em]");
      const hidden = document.createElement("span");
      hidden.className = "sr-only";
      hidden.textContent = "Needs you:";
      button.append(glyph, hidden, ` ${question} About ${approxWords} words.`);
      button.addEventListener("click", (event) => {
        event.preventDefault();
        const pos = typeof getPos === "function" ? getPos() : undefined;
        if (typeof pos === "number") this.options.handlers()?.onNeedSelect(pos);
      });
      dom.append(button);
      return { dom, stopEvent: (event) => button.contains(event.target as globalThis.Node) };
    };
  },
});

/**
 * A paragraph with a stable id (spec §8.6) and a lock (spec §5.8, key L). The lock sits in the
 * gutter as a real button with a word, so it is never colour or icon alone. A paragraph split off
 * with Enter gets no id and no lock: the serializer gives it a fresh id.
 */
export const ParagraphNode = Node.create<{ handlers: () => CanvasHandlers | null }>({
  name: PARAGRAPH_NODE,
  group: "block",
  content: "inline*",
  priority: 1000,
  addOptions() {
    return { handlers: () => null };
  },
  addAttributes() {
    return {
      id: {
        default: null,
        keepOnSplit: false,
        parseHTML: (el) => el.getAttribute("data-paragraph"),
      },
      locked: {
        default: false,
        keepOnSplit: false,
        parseHTML: (el) => el.getAttribute("data-locked") === "true",
      },
      review: { default: null, keepOnSplit: false, rendered: false },
    };
  },
  parseHTML() {
    return [{ tag: "p" }];
  },
  renderHTML({ node }) {
    return [
      "p",
      { "data-paragraph": node.attrs.id ?? undefined, "data-locked": String(node.attrs.locked) },
      0,
    ];
  },
  addKeyboardShortcuts() {
    return {
      // L belongs to typing inside the editor, so the lock has a chord here; L works outside.
      "Mod-Shift-l": ({ editor }) => {
        const { $from } = editor.state.selection;
        const pos = $from.depth > 0 ? $from.before(1) : null;
        if (pos === null) return false;
        this.options.handlers()?.onToggleLock(pos);
        return true;
      },
      // Leave the editor, so J, K, L and Y work again.
      Escape: ({ editor }) => {
        editor.commands.blur();
        return true;
      },
    };
  },
  addNodeView() {
    return ({ node: initial, getPos }) => {
      let node = initial;
      const dom = document.createElement("div");
      dom.className = "group/paragraph relative";
      const content = document.createElement("p");
      const lock = document.createElement("button");
      lock.type = "button";
      lock.contentEditable = "false";
      lock.className =
        "absolute -left-12 top-0 hidden size-11 items-center justify-center rounded-control font-ui text-text-soft " +
        "hover:bg-veil hover:text-text focus-visible:flex group-hover/paragraph:flex group-focus-within/paragraph:flex " +
        "data-[locked=true]:flex data-[locked=true]:text-text max-sm:static max-sm:mt-1 max-sm:flex max-sm:h-auto max-sm:w-auto max-sm:justify-start max-sm:gap-1 max-sm:px-0";
      const word = document.createElement("span");
      word.className = "text-sm max-sm:not-sr-only sr-only";

      const paint = () => {
        const locked = Boolean(node.attrs.locked);
        const id = node.attrs.id as string | null;
        content.dataset.paragraph = id ?? "";
        content.dataset.locked = String(locked);
        const review = node.attrs.review as string | null;
        if (review) dom.dataset.review = review;
        else delete dom.dataset.review;
        dom.dataset.locked = String(locked);
        lock.dataset.locked = String(locked);
        lock.setAttribute("aria-pressed", String(locked));
        lock.setAttribute("aria-keyshortcuts", "L");
        lock.setAttribute(
          "aria-label",
          locked ? "Locked: AI changes skip this paragraph. Unlock" : "Lock this paragraph",
        );
        lock.title = locked ? "Locked. Press to unlock (L)" : "Lock this paragraph (L)";
        word.textContent = locked ? "Locked" : "Lock";
        lock.replaceChildren(icon(locked ? LOCK : UNLOCK, 18), word);
        lock.hidden = review !== null;
      };
      paint();
      lock.addEventListener("mousedown", (event) => event.preventDefault());
      lock.addEventListener("click", (event) => {
        event.preventDefault();
        const pos = typeof getPos === "function" ? getPos() : undefined;
        if (typeof pos === "number") this.options.handlers()?.onToggleLock(pos);
      });
      dom.append(content, lock);
      return {
        dom,
        contentDOM: content,
        update: (next) => {
          if (next.type !== node.type) return false;
          node = next;
          paint();
          return true;
        },
        stopEvent: (event) => lock.contains(event.target as globalThis.Node),
        ignoreMutation: (mutation) =>
          mutation.type !== "selection" && !content.contains(mutation.target),
      };
    };
  },
});

/** The canvas's extensions: plain prose only (portals take plain text), plus undo and redo. */
export function canvasExtensions(ref: { current: CanvasHandlers | null }) {
  // A getter, not the ref: TipTap deep-copies plain option objects, functions it keeps.
  const handlers = () => ref.current;
  return [
    StarterKit.configure({
      paragraph: false,
      blockquote: false,
      bold: false,
      bulletList: false,
      code: false,
      codeBlock: false,
      hardBreak: false,
      heading: false,
      horizontalRule: false,
      italic: false,
      link: false,
      listItem: false,
      listKeymap: false,
      orderedList: false,
      strike: false,
      underline: false,
      dropcursor: false,
      gapcursor: false,
    }),
    ParagraphNode.configure({ handlers }),
    NeedChipNode.configure({ handlers }),
    YourWords,
    DiffMorphMark,
  ];
}

export type { Editor };
