// @vitest-environment jsdom
import "../../../test/dom";
import type { Editor } from "@tiptap/core";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DraftNeed, DraftParagraph, SourceExcerpts } from "../types";
import { DocCanvas, type DocEdit } from "./doc-canvas";

// jsdom has no layout: ProseMirror asks for rects when it scrolls the selection into view.
const rect = { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 };
Range.prototype.getBoundingClientRect ??= () => ({ ...rect, toJSON: () => rect });
Range.prototype.getClientRects ??= () =>
  Object.assign([], { item: () => null }) as unknown as DOMRectList;
document.elementFromPoint ??= () => null;

const PARAGRAPHS: DraftParagraph[] = [
  {
    id: "p1",
    sentences: [
      { text: "It was 2 a.m. and the feed was failing.", kind: "verbatim", sources: ["L041"] },
      { text: "Nobody else could see it yet.", kind: "composed", sources: [] },
    ],
  },
  {
    id: "p2",
    locked: true,
    sentences: [{ text: "I kept both of them on one line.", kind: "adapted", sources: ["C2"] }],
  },
];

const NEEDS: DraftNeed[] = [
  { paragraph_id: "p1", after_sentence: 0, question: "What did he say?", approx_words: 20 },
];

const SOURCES: SourceExcerpts = {
  L041: { label: "Story Studio, session 2", quote: "It was 2 a.m., the feed kept failing." },
  C2: { label: "Story Studio, session 3", quote: "I kept them both on the line." },
};

async function mount(props: Partial<Parameters<typeof DocCanvas>[0]> = {}) {
  const onChange = vi.fn<(edit: DocEdit) => void>();
  const utils = render(
    <DocCanvas
      paragraphs={PARAGRAPHS}
      needs={NEEDS}
      sources={SOURCES}
      yourWords
      label="Essay 1 draft"
      onChange={onChange}
      createParagraphId={() => "p-new"}
      {...props}
    />,
  );
  const box = await screen.findByRole("textbox", { name: "Essay 1 draft" });
  const editor = (box as HTMLElement & { editor: Editor }).editor;
  return { ...utils, editor, onChange, box };
}

describe("DocCanvas", () => {
  it("renders sentences with provenance, the lock, and chips; lit kinds only when on", async () => {
    const { container, rerender } = await mount();
    const own = container.querySelectorAll("[data-own]");
    expect([...own].map((n) => n.textContent)).toEqual([
      "It was 2 a.m. and the feed was failing.",
      "I kept both of them on one line.",
    ]);
    expect(container.querySelector("[data-your-words]")?.getAttribute("data-your-words")).toBe(
      "on",
    );
    expect(screen.getByRole("button", { name: /Needs you: What did he say\?/ })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Locked: AI changes skip this paragraph/ }),
    ).toBeTruthy();
    rerender(
      <DocCanvas
        paragraphs={PARAGRAPHS}
        sources={SOURCES}
        yourWords={false}
        label="Essay 1 draft"
      />,
    );
    expect(container.querySelector("[data-your-words]")?.getAttribute("data-your-words")).toBe(
      "off",
    );
  });

  it("emits the model unchanged when nothing is edited, and an edited sentence as the user's", async () => {
    const { editor, onChange } = await mount();
    // Type at the end of the composed sentence ("…see it yet." ends paragraph 1's text).
    let end = 0;
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === "Nobody else could see it yet.") {
        end = pos + node.nodeSize - 1;
      }
    });
    act(() => {
      editor.chain().setTextSelection(end).insertContent(" at all").run();
    });
    const edit = onChange.mock.lastCall?.[0];
    expect(edit?.changed).toEqual(["p1"]);
    expect(edit?.paragraphs[0]?.sentences).toEqual([
      PARAGRAPHS[0]?.sentences[0],
      {
        text: "Nobody else could see it yet at all.",
        kind: "verbatim",
        sources: [],
        author: "user",
      },
    ]);
    // Untouched: the locked paragraph and its provenance.
    expect(edit?.paragraphs[1]).toEqual(PARAGRAPHS[1]);
    expect(edit?.needs).toEqual(NEEDS);
  });

  it("toggles a paragraph lock from its gutter button and reports it", async () => {
    const { onChange } = await mount();
    fireEvent.click(screen.getByRole("button", { name: "Lock this paragraph" }));
    const edit = onChange.mock.lastCall?.[0];
    expect(edit?.changed).toEqual(["p1"]);
    expect(edit?.paragraphs[0]?.locked).toBe(true);
    expect(edit?.paragraphs[0]?.sentences).toEqual(PARAGRAPHS[0]?.sentences);
  });

  it("toggles the lock of the paragraph last edited with L outside the editor", async () => {
    const { editor, onChange } = await mount();
    act(() => {
      editor.commands.setTextSelection(editor.state.doc.content.size - 2);
    });
    fireEvent.keyDown(window, { key: "l" });
    expect(onChange.mock.lastCall?.[0].paragraphs[1]?.locked).toBeUndefined();
  });

  it("opens the composer for a chip with its need", async () => {
    const onNeedSelect = vi.fn();
    await mount({ onNeedSelect });
    fireEvent.click(screen.getByRole("button", { name: /Needs you: What did he say\?/ }));
    expect(onNeedSelect).toHaveBeenCalledWith(NEEDS[0]);
  });

  it("does not reset the editor when the parent echoes an edit back", async () => {
    const { editor, onChange, rerender } = await mount();
    act(() => {
      editor.chain().setTextSelection(2).insertContent("Yes, ").run();
    });
    const edit = onChange.mock.lastCall?.[0] as DocEdit;
    rerender(
      <DocCanvas
        paragraphs={edit.paragraphs}
        needs={edit.needs}
        sources={SOURCES}
        yourWords
        label="Essay 1 draft"
        onChange={onChange}
      />,
    );
    expect(editor.getText()).toContain("IYes, t was 2 a.m.");
  });

  it("shows a revision under review as a read-only diff and morphs on a decision", async () => {
    const after: DraftParagraph = {
      id: "p1",
      sentences: [
        { text: "It was 2 a.m. and the feed had stopped.", kind: "composed", sources: [] },
      ],
    };
    const change = {
      paragraphId: "p1",
      op: "replace" as const,
      before: PARAGRAPHS[0] ?? null,
      after,
    };
    const { container, editor, rerender } = await mount({
      review: { changes: [change], decisions: {} },
    });
    await waitFor(() => expect(container.querySelector("[data-review=pending]")).toBeTruthy());
    expect(editor.isEditable).toBe(false);
    expect(
      [...container.querySelectorAll("[data-diff=removed]")].map((n) => n.textContent),
    ).toContain("failing.");
    rerender(
      <DocCanvas
        paragraphs={PARAGRAPHS}
        sources={SOURCES}
        yourWords
        label="Essay 1 draft"
        review={{ changes: [change], decisions: { p1: "kept" } }}
      />,
    );
    await waitFor(() => expect(container.querySelector("[data-review=kept]")).toBeTruthy());
    // Review over: the parent passes the kept draft and the canvas is editable again.
    rerender(
      <DocCanvas
        paragraphs={[after, PARAGRAPHS[1] as DraftParagraph]}
        sources={SOURCES}
        yourWords
        label="Essay 1 draft"
      />,
    );
    await waitFor(() => expect(editor.isEditable).toBe(true));
    expect(container.querySelector("[data-diff]")).toBeNull();
    expect(editor.getText()).toContain("the feed had stopped.");
  });
});
