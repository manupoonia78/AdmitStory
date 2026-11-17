// The four product windows of "How it works" (SPEC §4, scene 3): Story Studio, a positioning, a
// draft and a revision. Live markup built from the design system, not screenshots. Everything
// inside a window is set in em and the screen's font size follows the window's width
// (marketing.css, .win-screen), so a window scales as one piece and recomposes on a phone.
// Pictures of the product: inert, hidden from assistive technology, described by a caption.
//
// The sample is the hospital systems analyst (../_data/sample.ts), fictional, as is Northfield.

import { cx } from "@admitstory/ui";
import type { ReactNode } from "react";
import { HOW_COPY } from "../_copy/landing";
import { SAMPLE_LINE, SAMPLE_PARAGRAPHS, SAMPLE_PROMPT } from "../_data/sample";
import { lineAt, type LineForm } from "../_hero/voiceline-shape";
import { sheetSerif } from "../_ui/sheet-serif";

function Screen({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className="win">
      <div inert className={cx("win-screen", className)}>
        {children}
      </div>
    </div>
  );
}

function Bar({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div className="win-bar">
      <span className="win-label">{left}</span>
      <span className="win-label">{right}</span>
    </div>
  );
}

// The Studio's line: the hero's maths, frozen, swelling from the record button outwards.
const STUDIO_LINE: LineForm = { ref: 720, rise: [-0.2, -0.1], tint: [0, 0], amp: 1 };
const STUDIO_LINE_PATH = (() => {
  const mid = 36;
  let d = `M0 ${mid}`;
  for (let i = 1; i <= 180; i += 1) {
    const x = i / 180;
    const bell = Math.sin(Math.PI * x) ** 1.4;
    const y = mid + 24 * bell * lineAt(x * 0.96, 720, 2.3, STUDIO_LINE);
    d += `L${(x * 720).toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
})();

function StudioWindow() {
  const { studio } = HOW_COPY;
  return (
    <Screen className="win-studio">
      <div className="win-bar">
        <span className="win-tabs">
          {studio.chapters.map((chapter) => (
            <span
              key={chapter}
              className="win-label"
              data-on={chapter === studio.current ? "" : undefined}
            >
              {chapter}
            </span>
          ))}
        </span>
        <span className="win-seg">
          {studio.modes.map((mode, index) => (
            <span key={mode} data-on={index === 0 ? "" : undefined}>
              {mode}
            </span>
          ))}
        </span>
      </div>
      <p className="win-question">
        {studio.questionLead} <span>{studio.questionAsk}</span>
      </p>
      <p className="win-say">“{SAMPLE_LINE}”</p>
      <div className="win-voice">
        <svg viewBox="0 0 720 72" preserveAspectRatio="none" fill="none" focusable="false">
          <path
            d={STUDIO_LINE_PATH}
            stroke="var(--accent)"
            strokeWidth="1.25"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span className="win-record">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="9" y="3.5" width="6" height="10.5" rx="3" />
            <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" strokeLinecap="round" />
          </svg>
        </span>
      </div>
      <p className="win-label win-listening">{studio.listening}</p>
    </Screen>
  );
}

function PositionWindow() {
  const { position } = HOW_COPY;
  return (
    <Screen className="win-position">
      <Bar left={position.header} right={HOW_COPY.free} />
      <div className="win-position-grid">
        <ol role="list" className="win-lines">
          {position.lines.map((line, index) => (
            <li key={line}>
              <span className="win-label">{String(index + 1).padStart(2, "0")}</span>
              <p>{line}</p>
            </li>
          ))}
        </ol>
        <div className="win-map">
          <p className="win-label">{position.mapHeading}</p>
          <ul role="list">
            {position.map.map((row) => (
              <li key={row.what}>
                <span>{row.what}</span>
                <span>{row.story}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <dl className="win-read">
        {position.read.map((row) => (
          <div key={row.label}>
            <dt className="win-label">{row.label}</dt>
            <dd>{row.text}</dd>
          </div>
        ))}
      </dl>
    </Screen>
  );
}

function SheetMargin({ title, note, count }: { title: string; note: string; count: ReactNode }) {
  return (
    <div className="scene-sheet-margin">
      <p className="scene-sheet-title">{title}</p>
      <p className="scene-sheet-note">{note}</p>
      <p className="scene-sheet-count">{count}</p>
    </div>
  );
}

function DraftWindow() {
  const { draft } = HOW_COPY;
  // Two paragraphs and the first sentence of the third: the sheet stops on her own words.
  const paragraphs = SAMPLE_PARAGRAPHS.slice(0, 3).map((paragraph, index) =>
    index < 2 ? paragraph : { ...paragraph, sentences: paragraph.sentences.slice(0, 1) },
  );
  return (
    <Screen className="win-paper">
      <Bar left={draft.header} right={draft.status} />
      <article data-theme="day" className="scene-sheet">
        <SheetMargin
          title={draft.title}
          note={draft.note}
          count={
            <>
              {draft.count}
              <br />
              {draft.words}
            </>
          }
        />
        <div className={cx(sheetSerif.className, "scene-sheet-body")}>
          <p className="scene-sheet-prompt font-reading italic">{SAMPLE_PROMPT.text}</p>
          {paragraphs.map((paragraph) => (
            <p key={paragraph.id}>
              {paragraph.sentences.map((sentence, index) => (
                <span key={sentence.text}>
                  {index > 0 ? " " : null}
                  {sentence.kind === "verbatim" ? (
                    <mark className="sheet-mark">{sentence.text}</mark>
                  ) : (
                    sentence.text
                  )}
                </span>
              ))}
            </p>
          ))}
        </div>
      </article>
    </Screen>
  );
}

function RefineWindow() {
  const { refine } = HOW_COPY;
  return (
    <Screen className="win-paper">
      <Bar
        left={refine.header}
        right={
          <>
            <s>{refine.countFrom}</s> → {refine.countTo}
          </>
        }
      />
      <p className="win-request">
        <span className="win-label">{refine.asked}</span>
        <span>{refine.request}</span>
      </p>
      <article data-theme="day" className="scene-sheet scene-sheet-plain">
        <div className={cx(sheetSerif.className, "scene-sheet-body")}>
          <p className="win-context">{refine.context}</p>
          <p>
            {refine.before} <mark className="sheet-mark">{refine.said}</mark> {refine.kept1}
            <del>{refine.cut1}</del>
            <ins>{refine.added}</ins>
            {refine.kept2}
            <del>{refine.cut2}</del>.
          </p>
          <div className="win-review">
            <span className="win-label">{refine.change}</span>
            <span className="win-pill" data-on="">
              {refine.keep}
            </span>
            <span className="win-pill">{refine.undo}</span>
          </div>
        </div>
      </article>
    </Screen>
  );
}

/** The windows in step order: Tell, Position, Draft, Refine. */
export const HOW_WINDOWS = [StudioWindow, PositionWindow, DraftWindow, RefineWindow] as const;
