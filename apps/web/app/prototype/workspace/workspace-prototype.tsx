"use client";

import {
  Button,
  DiffMorph,
  LimitCounter,
  RevisionBar,
  Sheet,
  SheetContent,
  TextField,
  YourWordsLegend,
  YourWordsText,
  YourWordsToggle,
  countWords,
  cx,
  draftText,
  overLimit,
  ownWordsShare,
  paragraphText,
  type DraftNeed,
  type DraftParagraph,
  type MorphDecision,
  type SourceExcerpts,
} from "@admitstory/ui";
import { ChatCircleTextIcon } from "@phosphor-icons/react";
import { useRef, useState, type FormEvent, type PointerEvent } from "react";
import { CoachPane, type CoachTab } from "./coach-pane";
import {
  NEEDS,
  PARAGRAPHS,
  PROMPT,
  REVISIONS,
  SOURCES,
  answerNeed,
  applyRevision,
  type PreparedRevision,
} from "./essay";
import { FilesPane } from "./files-pane";
import { useMediaQuery } from "./use-media-query";

// Workspace prototype (spec §5.8, §6.7 "Your words, lit", §6.10 screen G). Three planes at 1280px
// and up; from 1024px the Coach becomes a sheet from the right; below that the three planes are
// views you switch between with the tabs or a swipe. Only the glow and the morph animate here.

type View = "files" | "document" | "coach";
const VIEWS: readonly { id: View; label: string }[] = [
  { id: "files", label: "Files" },
  { id: "document", label: "Essay" },
  { id: "coach", label: "Coach" },
];

/** One refinement under review. `round` remounts the morph when it has to restart. */
interface Review {
  revision: PreparedRevision;
  before: DraftParagraph;
  after: DraftParagraph;
  decision: MorphDecision;
  initial?: MorphDecision;
  /** The kept change is in the draft; the bar stays so it can still be undone. */
  settled: boolean;
  round: number;
}

const SHEET_QUERY = "(min-width: 1024px) and (max-width: 1279.98px)";
const NARROW_QUERY = "(max-width: 1023.98px)";
const SWIPE_PX = 64;

function withParagraph(paragraphs: readonly DraftParagraph[], next: DraftParagraph) {
  return paragraphs.map((paragraph) => (paragraph.id === next.id ? next : paragraph));
}

export function WorkspacePrototype() {
  const [paragraphs, setParagraphs] = useState<readonly DraftParagraph[]>(PARAGRAPHS);
  const [needs, setNeeds] = useState<readonly DraftNeed[]>(NEEDS);
  const [sources, setSources] = useState<SourceExcerpts>(SOURCES);
  const [yourWords, setYourWords] = useState(false);
  const [review, setReview] = useState<Review | null>(null);
  const [composing, setComposing] = useState<DraftNeed | null>(null);
  const [status, setStatus] = useState("");
  const [view, setView] = useState<View>("document");
  const [coachTab, setCoachTab] = useState<CoachTab>("why");
  const [coachOpen, setCoachOpen] = useState(false);
  const sheetMode = useMediaQuery(SHEET_QUERY);
  const narrow = useMediaQuery(NARROW_QUERY);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const reviewRef = useRef<HTMLDivElement>(null);
  const handOffToReview = useRef(false);
  const swipe = useRef<{ x: number; y: number } | null>(null);

  const count = countWords(draftText(paragraphs));
  const paragraphNumber = (id: string) => paragraphs.findIndex((p) => p.id === id) + 1;

  /* Refine: a prepared change arrives, morphs in place, and is kept or undone. */

  const revisions = REVISIONS.map((revision) => {
    const paragraph = paragraphs.find((p) => p.id === revision.paragraphId);
    return { revision, available: Boolean(paragraph && applyRevision(paragraph, revision)) };
  });

  const refine = (revision: PreparedRevision) => {
    // A change still morphing in is committed first, so nothing kept is lost.
    let current = paragraphs;
    if (review && !review.settled && review.decision === "kept") {
      current = withParagraph(paragraphs, review.after);
      setParagraphs(current);
    }
    const before = current.find((p) => p.id === revision.paragraphId);
    const after = before ? applyRevision(before, revision) : null;
    if (!before || !after) return;
    setComposing(null);
    setReview({
      revision,
      before,
      after,
      decision: "pending",
      settled: false,
      round: (review?.round ?? 0) + 1,
    });
    // Bring the change into view: the sheet hands focus to the review bar, the views switch.
    if (sheetMode && coachOpen) {
      handOffToReview.current = true;
      setCoachOpen(false);
    }
    if (narrow) setView("document");
  };

  const keep = () => {
    setReview((current) =>
      current && current.decision === "pending" ? { ...current, decision: "kept" } : current,
    );
  };

  const undo = () => {
    if (!review) return;
    if (review.settled) {
      // Already in the draft: take it out, and morph back from the new wording to the old.
      setParagraphs((current) => withParagraph(current, review.before));
      setReview({
        ...review,
        decision: "undone",
        initial: "kept",
        settled: false,
        round: review.round + 1,
      });
    } else {
      setReview({ ...review, decision: "undone" });
    }
  };

  const settled = (decision: MorphDecision) => {
    if (!review) return;
    if (decision === "kept") {
      setParagraphs((current) => withParagraph(current, review.after));
      setReview({ ...review, settled: true, initial: undefined });
    } else if (decision === "undone") {
      // The bar goes with the change; keep a keyboard user's place instead of dropping to <body>.
      if (reviewRef.current?.contains(document.activeElement)) {
        headingRef.current?.focus({ preventScroll: true });
      }
      setReview(null);
    }
  };

  /* NEED chips: a small composer opens under the paragraph; the answer joins it verbatim. */

  const answer = (need: DraftNeed, text: string) => {
    const paragraph = paragraphs.find((p) => p.id === need.paragraph_id);
    if (!paragraph || !text.trim()) return;
    const sourceId = `A${Object.keys(sources).length + 1}`;
    setSources({ ...sources, [sourceId]: { label: "Your answer, just now", quote: text.trim() } });
    setParagraphs(withParagraph(paragraphs, answerNeed(paragraph, need, text, sourceId)));
    setNeeds(needs.filter((n) => n !== need));
    setComposing(null);
    setStatus(`Your answer was added to paragraph ${paragraphNumber(need.paragraph_id)}.`);
    headingRef.current?.focus({ preventScroll: true });
  };

  const cancelAnswer = (need: DraftNeed) => {
    setComposing(null);
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(`[data-need-chip="${need.paragraph_id}"]`)
        ?.focus({ preventScroll: true });
    });
  };

  /* Below 1024px the three planes are views; a horizontal swipe moves between them. */

  const onPointerDown = (event: PointerEvent) => {
    swipe.current = event.pointerType === "touch" ? { x: event.clientX, y: event.clientY } : null;
  };
  const onPointerUp = (event: PointerEvent) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start || !narrow) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dy) > Math.abs(dx) / 2) return;
    const index = VIEWS.findIndex((v) => v.id === view);
    const next = VIEWS[Math.min(VIEWS.length - 1, Math.max(0, index + (dx < 0 ? 1 : -1)))];
    if (next) setView(next.id);
  };

  const coach = (
    <CoachPane
      tab={coachTab}
      onTab={setCoachTab}
      revisions={revisions}
      onRefine={refine}
      over={overLimit(count, PROMPT.limit)}
      ownShare={ownWordsShare(paragraphs)}
      openNeeds={needs.length}
    />
  );

  const reviewing = review && !review.settled ? review : null;
  const afterCount = review ? countWords(draftText(withParagraph(paragraphs, review.after))) : 0;

  return (
    <div
      className="flex flex-1 flex-col gap-3 p-3 max-lg:touch-pan-y sm:p-4 lg:h-[calc(100dvh-3.5rem)] lg:min-h-0"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <div role="group" aria-label="Views" className="flex gap-1 lg:hidden">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            aria-pressed={view === v.id}
            aria-controls={`pane-${v.id}`}
            onClick={() => setView(v.id)}
            className={cx(
              "min-h-11 flex-1 rounded-control px-3 font-medium",
              view === v.id ? "bg-veil text-text" : "text-text-soft hover:text-text",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 gap-3 sm:gap-4 lg:grid-cols-[248px_minmax(0,1fr)] xl:grid-cols-[248px_minmax(0,1fr)_400px]">
        <FilesPane
          id="pane-files"
          essayCount={`${count} / ${PROMPT.limit} words`}
          essayNeeds={needs.length}
          className={cx("plane min-h-0 overflow-y-auto", view === "files" ? null : "max-lg:hidden")}
        />

        <section
          id="pane-document"
          aria-labelledby="essay-heading"
          className={cx(
            "plane min-h-0 overflow-y-auto",
            view === "document" ? null : "max-lg:hidden",
          )}
        >
          <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6 px-5 py-8 sm:px-8 sm:py-10">
            <header className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <h1
                  id="essay-heading"
                  ref={headingRef}
                  tabIndex={-1}
                  className="text-display-sm text-text outline-none"
                >
                  {PROMPT.title}
                </h1>
                <LimitCounter count={count} limit={PROMPT.limit} className="pt-2" />
              </div>
              <p className="font-reading text-read text-text-soft">
                “{PROMPT.text}” ({PROMPT.limit} words)
              </p>
              <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-y border-edge py-3">
                <div className="flex flex-col gap-2">
                  <YourWordsToggle
                    on={yourWords}
                    onChange={setYourWords}
                    className="-ml-2 self-start"
                  />
                  <YourWordsLegend className="max-w-[46ch]" />
                </div>
                {/* Only between 1024 and 1279px, where the Coach is a sheet. */}
                <div className="hidden lg:max-xl:block">
                  <Button
                    variant="secondary"
                    icon={ChatCircleTextIcon}
                    onClick={() => setCoachOpen(true)}
                  >
                    Open coach
                  </Button>
                </div>
              </div>
            </header>

            <p aria-live="polite" className="sr-only">
              {status}
            </p>

            <YourWordsText
              paragraphs={paragraphs}
              sources={sources}
              on={yourWords}
              needs={needs}
              onNeedSelect={(need) => setComposing(need)}
              className="max-w-[68ch] font-reading text-read text-text"
              renderParagraph={(paragraph) =>
                reviewing && reviewing.before.id === paragraph.id ? (
                  <DiffMorph
                    key={reviewing.round}
                    before={paragraphText(reviewing.before)}
                    after={paragraphText(reviewing.after)}
                    decision={reviewing.decision}
                    initial={reviewing.initial}
                    onSettled={settled}
                  />
                ) : undefined
              }
              renderAfterParagraph={(paragraph) => (
                <>
                  {review && review.before.id === paragraph.id ? (
                    <div ref={reviewRef} data-review>
                      <RevisionBar
                        key={review.revision.action}
                        decision={review.settled ? "kept" : review.decision}
                        message={`Paragraph ${paragraphNumber(paragraph.id)} rewritten. Review the change.`}
                        keptMessage={`Change kept in paragraph ${paragraphNumber(paragraph.id)}.`}
                        detail={`${review.revision.action}. With this change: ${afterCount} / ${PROMPT.limit} words.`}
                        onKeep={keep}
                        onUndo={undo}
                      />
                    </div>
                  ) : null}
                  {composing && composing.paragraph_id === paragraph.id ? (
                    <NeedComposer
                      need={composing}
                      onAnswer={(text) => answer(composing, text)}
                      onCancel={() => cancelAnswer(composing)}
                    />
                  ) : null}
                </>
              )}
            />
          </div>
        </section>

        {sheetMode ? null : (
          <aside
            id="pane-coach"
            aria-label="Coach"
            className={cx(
              "plane min-h-0 overflow-y-auto lg:max-xl:hidden",
              view === "coach" ? null : "max-lg:hidden",
            )}
          >
            {coach}
          </aside>
        )}
      </div>

      {sheetMode ? (
        <Sheet open={coachOpen} onOpenChange={setCoachOpen}>
          <SheetContent
            title="Coach"
            className="[&>div:last-child]:p-0"
            onCloseAutoFocus={(event) => {
              if (!handOffToReview.current) return;
              handOffToReview.current = false;
              event.preventDefault();
              reviewRef.current?.querySelector<HTMLElement>("[role=group]")?.focus();
            }}
          >
            {coach}
          </SheetContent>
        </Sheet>
      ) : null}
    </div>
  );
}

/** The mini-composer a NEED chip opens (spec §5.8). Text only in the prototype. */
function NeedComposer({
  need,
  onAnswer,
  onCancel,
}: {
  need: DraftNeed;
  onAnswer: (text: string) => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | undefined>();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = String(new FormData(event.currentTarget).get("answer") ?? "");
    if (!text.trim()) {
      setError("Write a sentence or two, or cancel to answer later.");
      return;
    }
    onAnswer(text);
  };
  return (
    <form
      onSubmit={submit}
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
      }}
      className="plane flex flex-col gap-3 p-4 font-ui text-base"
    >
      <TextField
        label={need.question}
        name="answer"
        autoComplete="off"
        autoFocus
        hint={`About ${need.approx_words} words. It goes into the draft as your own words.`}
        error={error}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit">Add to draft</Button>
        <Button variant="quiet" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
