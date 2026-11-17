"use client";

// The paper scene's sheet and its two controls (SPEC §4, scene 5). The server renders it with
// the switch off, which reads as a finished page on its own.
//
// "Your words": every sentence takes the mark for where it came from (SPEC §2.3), never by hue
// alone: word for word is a wash and a solid underline, lightly edited a paler wash and a dotted
// one, written-for-you stays plain. Y toggles it while focus is inside the scene (no global key
// capture on a marketing page).
//
// "Write your own line": client-only. The line is tidied in code (../_hero/line-cleanup), set as
// the essay's first sentence and marked as the visitor's own. It is never praised, and nothing
// typed leaves the browser unless they sign up and keep it (lib/marketing/first-line).

import { buttonStyles, cx } from "@admitstory/ui";
import { useRouter } from "next/navigation";
import {
  startTransition,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { saveFirstLine } from "@/lib/marketing/first-line";
import { ESSAY_COPY } from "../_copy/landing";
import { WRITE_ACTIONS, WRITE_CAPTION, WRITE_COPY, placedAnnouncement } from "../_copy/write-line";
import { WORDS_PARAGRAPHS, WORDS_SOURCES } from "../_data/sample-words";
import { cleanWrittenLine, type CleanLine } from "../_hero/line-cleanup";
import { track } from "../_lib/track";
import { sheetSerif } from "../_ui/sheet-serif";

const NOTES: Record<string, string | undefined> = ESSAY_COPY.notes;

function isPlainY(event: KeyboardEvent): boolean {
  if (event.key !== "y" && event.key !== "Y") return false;
  if (event.metaKey || event.ctrlKey || event.altKey) return false;
  const target = event.target as HTMLElement;
  return !(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement);
}

export default function EssayToy() {
  const [on, setOn] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [placed, setPlaced] = useState<CleanLine | null>(null);
  const sheet = useRef<HTMLElement>(null);
  const router = useRouter();
  const fieldId = useId();
  const noteId = useId();

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!isPlainY(event)) return;
    event.preventDefault();
    setOn((value) => !value);
  };

  const place = (event: FormEvent) => {
    event.preventDefault();
    const cleaned = cleanWrittenLine(draft);
    if (!cleaned) return;
    setPlaced(cleaned);
    setOn(true);
    setSource(ESSAY_COPY.yours);
    track("hero_line_placed", { source: "written" });
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // On a phone the sheet is above the field: bring the line into view.
    if (sheet.current && sheet.current.getBoundingClientRect().top < 0) {
      sheet.current.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
  };

  const keep = () => {
    if (!placed) return;
    saveFirstLine({
      line: placed.line,
      source: "written",
      identity: null,
      removedFillers: placed.removed,
    });
    track("hero_keep_line");
    startTransition(() => router.push("/sign-in?from=line"));
  };

  const again = () => {
    setPlaced(null);
    setDraft("");
    setSource(null);
  };

  let order = 0;
  return (
    <div className="essay-toy" data-on={on ? "" : undefined} onKeyDown={onKeyDown}>
      <figure aria-label={ESSAY_COPY.sheetLabel} className="essay-figure">
        <article ref={sheet} className="essay-sheet">
          <header className="essay-row">
            <div>
              <p className="label">{ESSAY_COPY.sheetHeader}</p>
              <p className="essay-prompt font-reading italic">{ESSAY_COPY.prompt}</p>
            </div>
          </header>
          {WORDS_PARAGRAPHS.map((paragraph, index) => {
            const note = NOTES[paragraph.id];
            return (
              <div key={paragraph.id} className="essay-row">
                <p className={cx(sheetSerif.className, "essay-text")}>
                  {index === 0 && placed ? (
                    <>
                      <mark
                        className="essay-s"
                        data-kind="verbatim"
                        data-own=""
                        tabIndex={0}
                        onPointerEnter={() => setSource(ESSAY_COPY.yours)}
                        onFocus={() => setSource(ESSAY_COPY.yours)}
                      >
                        {placed.line}
                      </mark>{" "}
                    </>
                  ) : null}
                  {paragraph.sentences.map((sentence, i) => {
                    const label = WORDS_SOURCES[sentence.sources[0] ?? ""]?.label;
                    const marked = sentence.kind !== "composed" && label !== undefined;
                    const show = marked ? () => setSource(label) : undefined;
                    const style = marked ? ({ "--k": order++ } as CSSProperties) : undefined;
                    return (
                      <span key={sentence.text}>
                        {i > 0 ? " " : null}
                        <span
                          className="essay-s"
                          data-kind={sentence.kind}
                          style={style}
                          tabIndex={on && marked ? 0 : undefined}
                          onPointerEnter={on ? show : undefined}
                          onFocus={on ? show : undefined}
                        >
                          {sentence.text}
                        </span>
                      </span>
                    );
                  })}
                </p>
                {note ? <p className="essay-note">{note}</p> : null}
              </div>
            );
          })}
        </article>
        <figcaption className="label mt-5">{ESSAY_COPY.fictional}</figcaption>
      </figure>

      <div className="essay-side">
        <div className="essay-side-a">
          <p className="label">{ESSAY_COPY.legendLabel}</p>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            onClick={() => setOn((value) => !value)}
            className="essay-switch"
          >
            <span aria-hidden="true" className="essay-switch-track" />
            <span>{ESSAY_COPY.toggle}</span>
            <kbd aria-hidden="true" className="essay-key">
              Y
            </kbd>
          </button>
          <ul role="list" className="essay-legend">
            {ESSAY_COPY.legend.map((row) => (
              <li key={row.kind}>
                <span aria-hidden="true" className="essay-s" data-kind={row.kind} data-key="">
                  Aa
                </span>
                {row.label}
              </li>
            ))}
          </ul>
          <p aria-live="polite" className="essay-source">
            {on && source ? (
              source
            ) : (
              <>
                <span className="hidden pointer-fine:inline">{ESSAY_COPY.sourceIdle}</span>
                <span className="pointer-fine:hidden">{ESSAY_COPY.sourceIdleTouch}</span>
              </>
            )}
          </p>
        </div>

        <div className="essay-side-b">
          <p className="label">{WRITE_ACTIONS.write}</p>
          {placed ? (
            <div className="mt-4">
              <p role="status" className="sr-only">
                {placedAnnouncement(placed.line)}
              </p>
              <p className="text-sm text-text-80">{WRITE_CAPTION}</p>
              <div className="mt-5 flex flex-col items-start gap-1">
                <button
                  type="button"
                  onClick={keep}
                  className={cx(buttonStyles({ arrow: true }), "max-sm:w-full")}
                >
                  {WRITE_ACTIONS.keep}
                  <span aria-hidden="true" className="btn-arrow max-sm:ml-auto" />
                </button>
                <button
                  type="button"
                  onClick={again}
                  className={buttonStyles({ variant: "quiet" })}
                >
                  {WRITE_ACTIONS.again}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={place} className="mt-4">
              <label htmlFor={fieldId} className="sr-only">
                {WRITE_COPY.label}
              </label>
              <input
                id={fieldId}
                type="text"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={WRITE_COPY.placeholder}
                aria-describedby={noteId}
                autoComplete="off"
                maxLength={240}
                className="essay-field"
              />
              <button
                type="submit"
                disabled={draft.trim() === ""}
                className={cx(buttonStyles(), "mt-3 max-sm:w-full")}
              >
                {WRITE_ACTIONS.place}
              </button>
              <p id={noteId} className="mt-4 text-sm text-text-soft">
                {WRITE_COPY.note}
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
