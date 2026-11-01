"use client";

// The Résumé Pass screen (spec §5.10): what matters most, the suggested section order, the
// Word export, any consistency Must fix rows, then the résumé as a printed sheet (the hero, see
// ./resume-paper) beside the focused bullet's review (./bullet-review). Below 1024px the review
// stacks under the sheet.
//
// Keyboard (§6.12): J and K move between bullets, A keeps the rewrite (or, while a detail is
// unanswered, puts the cursor in its field), R keeps the applicant's own line. Bare letters never
// fire inside a text field. After a decision the review moves on to the next bullet still waiting.
//
// Decisions are controlled: `onDecide` reports each one, and the sheet, the page estimate and the
// hairline follow `decisions` as it comes back.

import { FileDocIcon, CheckCircleIcon, WarningIcon } from "@phosphor-icons/react";
import {
  bulletText,
  estimatePages,
  overflowIndex,
  placeholdersIn,
  resumeLines,
  type ConsistencyFinding,
  type ConsistencyValue,
} from "@admitstory/linters";
import type { BulletDecision, ResumeReview } from "@admitstory/shared/kit";
import { useId, useMemo, useRef, useState } from "react";
import { Button } from "../components/button";
import { cx } from "../lib/cx";
import { usePlainKey } from "../workspace/shortcuts";
import { BulletReview, openPlaceholders } from "./bullet-review";
import { ConsistencyList } from "./consistency-list";
import { ResumePaper } from "./resume-paper";
import {
  bulletState,
  bulletsInOrder,
  nextUndecided,
  pageSummary,
  stepBullet,
  suggestedOrderText,
  type BulletState,
} from "./resume-text";

export interface ResumeSheetProps {
  review: ResumeReview;
  /** By bullet id; missing means undecided. Controlled. */
  decisions: Readonly<Record<string, BulletDecision>>;
  /** The strictest page limit among the applicant's schools, and which schools set it. */
  pageLimit: { pages: number; schools: readonly string[] } | null;
  useSuggestedOrder: boolean;
  onToggleOrder: (useSuggested: boolean) => void;
  consistency: readonly ConsistencyFinding[];
  /** A decision on one bullet; null undoes it. */
  onDecide: (bulletId: string, decision: BulletDecision | null) => void;
  /** "Download Word file". */
  onExport: () => void;
  exporting?: boolean;
  onUseExpected?: (finding: ConsistencyFinding, value: ConsistencyValue) => void;
  onDismiss?: (finding: ConsistencyFinding) => void;
  hrefFor?: (value: ConsistencyValue) => string | null;
  /** J, K, A and R outside text fields. Default true. */
  shortcuts?: boolean;
  className?: string;
}

function prioritiesHeading(n: number): string {
  if (n === 1) return "The change that matters most";
  if (n === 2) return "The two changes that matter most";
  return "The three changes that matter most";
}

function OrderSwitch({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="inline-flex min-h-11 items-center gap-3 self-start rounded-control px-2 font-medium text-text hover:bg-veil"
    >
      <span
        aria-hidden
        className={cx(
          "relative h-6 w-10 shrink-0 rounded-full border transition-colors duration-(--spring-snap-duration) ease-snap motion-reduce:transition-none",
          on ? "border-signal bg-signal" : "border-control bg-depth",
        )}
      >
        <span
          className={cx(
            "absolute left-0.5 top-1/2 size-4 -translate-y-1/2 rounded-full transition-[translate,background-color] duration-(--spring-snap-duration) ease-snap motion-reduce:transition-none",
            on ? "translate-x-4 bg-on-signal" : "translate-x-0 bg-control",
          )}
        />
      </span>
      Use the suggested order
    </button>
  );
}

/** The answers for a rewrite's placeholders, indexed n − 1, trimmed. */
function answersFor(text: string, answers: readonly string[]): string[] {
  const slots = placeholdersIn(text);
  const size = slots.length ? Math.max(...slots) : 0;
  return Array.from({ length: size }, (_, i) => answers[i]?.trim() ?? "");
}

export function ResumeSheet({
  review,
  decisions,
  pageLimit,
  useSuggestedOrder,
  onToggleOrder,
  consistency,
  onDecide,
  onExport,
  exporting = false,
  onUseExpected,
  onDismiss,
  hrefFor,
  shortcuts = true,
  className,
}: ResumeSheetProps) {
  const uid = useId();
  const order = useMemo(
    () => bulletsInOrder(review, useSuggestedOrder),
    [review, useSuggestedOrder],
  );
  const lines = useMemo(
    () => resumeLines(review, decisions, useSuggestedOrder),
    [review, decisions, useSuggestedOrder],
  );
  const pages = estimatePages(lines);
  const overflowAt = pageLimit ? overflowIndex(lines, pageLimit.pages) : -1;
  const summary = pageSummary(pages, pageLimit);

  const [focusedId, setFocusedId] = useState<string | null>(
    () => order.find((b) => b.rewrite && !decisions[b.id])?.id ?? order[0]?.id ?? null,
  );
  const focused = order.find((b) => b.id === focusedId) ?? order[0] ?? null;
  const position = focused ? order.indexOf(focused) + 1 : 0;

  const [answers, setAnswers] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    for (const [id, decision] of Object.entries(decisions)) {
      if (decision.status === "accepted") initial[id] = [...decision.answers];
    }
    return initial;
  });
  const [message, setMessage] = useState("");

  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const states: Record<string, BulletState> = {};
  for (const bullet of order) states[bullet.id] = bulletState(bullet, decisions[bullet.id]);

  const moveTo = (id: string | null) => {
    if (!id) return;
    setFocusedId(id);
    const button = buttons.current.get(id);
    button?.scrollIntoView({ block: "nearest" });
    // Keyboard users on the sheet keep their place on it.
    if (
      document.activeElement instanceof HTMLElement &&
      document.activeElement.closest("[data-bullet]")
    ) {
      button?.focus({ preventScroll: true });
    }
  };

  const decide = (decision: BulletDecision | null, said: string) => {
    if (!focused) return;
    onDecide(focused.id, decision);
    setMessage(said);
    if (decision) {
      const next = nextUndecided(order, { ...decisions, [focused.id]: decision }, focused.id);
      if (next) setFocusedId(next);
    }
  };

  const keep = () => {
    if (!focused?.rewrite || decisions[focused.id]) return;
    const given = answers[focused.id] ?? [];
    const open = openPlaceholders(focused.rewrite.text, given);
    if (open.length > 0) {
      document.getElementById(`${uid}-q${open[0]}`)?.focus();
      return;
    }
    decide(
      { status: "accepted", answers: answersFor(focused.rewrite.text, given) },
      `Rewrite kept for line ${position}.`,
    );
  };
  const keepMine = () => {
    if (!focused?.rewrite || decisions[focused.id]) return;
    decide({ status: "rejected" }, `You kept your own line ${position}.`);
  };

  usePlainKey("j", () => moveTo(stepBullet(order, focused?.id ?? null, 1)), shortcuts);
  usePlainKey("k", () => moveTo(stepBullet(order, focused?.id ?? null, -1)), shortcuts);
  usePlainKey("a", keep, shortcuts && Boolean(focused?.rewrite && !decisions[focused.id]));
  usePlainKey("r", keepMine, shortcuts && Boolean(focused?.rewrite && !decisions[focused.id]));

  return (
    <div className={cx("flex flex-col gap-10 font-ui text-base", className)}>
      <header className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex flex-col gap-8">
          <section aria-labelledby={`${uid}-priorities`} className="flex flex-col gap-3">
            <h2 id={`${uid}-priorities`} className="text-lg font-semibold text-text">
              {prioritiesHeading(review.priorities.length)}
            </h2>
            <ol className="flex flex-col gap-2">
              {review.priorities.map((priority, index) => (
                <li key={priority} className="grid grid-cols-[1.5rem_minmax(0,1fr)] text-text">
                  <span aria-hidden className="tabular-nums text-text-soft">
                    {index + 1}
                  </span>
                  <span>{priority}</span>
                </li>
              ))}
            </ol>
          </section>
          <section aria-labelledby={`${uid}-order`} className="flex flex-col gap-2">
            <h2 id={`${uid}-order`} className="text-lg font-semibold text-text">
              Section order
            </h2>
            <p className="text-text">
              Suggested: <span className="font-medium">{suggestedOrderText(review)}</span>
            </p>
            <p className="max-w-[60ch] text-text-soft">{review.section_order.reason}</p>
            <OrderSwitch on={useSuggestedOrder} onChange={onToggleOrder} />
          </section>
        </div>
        <div className="flex flex-col items-start gap-1 lg:items-end">
          <Button icon={FileDocIcon} loading={exporting} onClick={onExport}>
            {exporting ? "Preparing your Word file" : "Download Word file"}
          </Button>
          <p className="text-sm text-text-soft">Clean and ATS-safe, with your decisions in it.</p>
        </div>
      </header>

      {consistency.length > 0 ? (
        <ConsistencyList
          findings={consistency}
          hrefFor={hrefFor}
          onUseExpected={onUseExpected}
          onDismiss={onDismiss}
        />
      ) : null}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,25rem)]">
        <div className="flex min-w-0 flex-col gap-3">
          <p
            aria-live="polite"
            data-over={summary.over ? "" : undefined}
            className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 tabular-nums"
          >
            {summary.over ? (
              <WarningIcon size={16} aria-hidden className="shrink-0 text-risk" />
            ) : pageLimit ? (
              <CheckCircleIcon size={16} aria-hidden className="shrink-0 text-verified" />
            ) : null}
            <span className={summary.over ? "font-medium text-risk" : "font-medium text-text"}>
              {summary.estimate}
            </span>
            {summary.ask ? (
              <span className="text-text-soft">
                <span aria-hidden>· </span>
                {summary.ask}
                {summary.over ? <span className="sr-only">: over the limit</span> : null}
              </span>
            ) : null}
          </p>
          <ResumePaper
            lines={lines}
            overflowAt={overflowAt}
            limitPages={pageLimit?.pages ?? null}
            states={states}
            focusedId={focused?.id ?? null}
            onSelect={setFocusedId}
            bulletRef={(id, element) => {
              if (element) buttons.current.set(id, element);
              else buttons.current.delete(id);
            }}
          />
        </div>
        <div className="min-h-[24rem] lg:sticky lg:top-6">
          {focused ? (
            <BulletReview
              bullet={focused}
              position={position}
              total={order.length}
              decision={decisions[focused.id]}
              answers={answers[focused.id] ?? []}
              onAnswer={(n, value) =>
                setAnswers((current) => {
                  const next = [...(current[focused.id] ?? [])];
                  next[n - 1] = value;
                  return { ...current, [focused.id]: next };
                })
              }
              idPrefix={uid}
              currentText={bulletText(focused, decisions[focused.id])}
              onKeep={keep}
              onKeepMine={keepMine}
              onSaveEdit={(text) =>
                decide({ status: "edited", text }, `Your edit is in line ${position}.`)
              }
              onUndo={() => decide(null, `Undone. Line ${position} is as it was.`)}
              shortcuts={shortcuts}
            />
          ) : (
            <p className="text-text-soft">No bullet points to review in this resume.</p>
          )}
        </div>
      </div>
      <p aria-live="polite" className="sr-only">
        {message}
      </p>
    </div>
  );
}
