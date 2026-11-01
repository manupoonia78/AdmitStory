"use client";

// The Form Advisor (spec §5.10, §6.10 screen G): the Workspace document pane for one form section.
// The section and its limits, the pack's guidance with source and date, then the candidates in
// recommendation lanes (Lead with, Include, Combine with…, Move to resume, Move to an essay,
// Leave out), each with its reason, then what the applicant could still do.
//
// The hero (§6.7, one per screen): when the pane opens, the candidates arrive as one loose stack
// and deal out into their lanes, top lane first, 40 ms apart on the drift spring, while each
// lane's label fades up as its first card lands. It is drawn from the final layout: the cards
// are measured where they belong, offset onto the stack and released, so nothing reflows and
// the layout never shifts (CLS). Springs carry velocity, so it is interruptible, and nothing waits
// on it. It plays only on a client mount (opening the pane), never over server-rendered HTML,
// which the reader has already seen in place. Reduced motion: a 120 ms opacity fade.
//
// After that the pane is quiet. Cards share a LayoutGroup and a layoutId, so when refreshed advice
// moves a candidate to another lane it glides there instead of jumping.

import { ArrowClockwiseIcon, ClockIcon, WarningOctagonIcon } from "@phosphor-icons/react";
import type { ConsistencyFinding, ConsistencyValue } from "@admitstory/linters";
import type { CouldStillDo, FormRecommendation } from "@admitstory/shared/kit";
import { animate, LayoutGroup, motion, useReducedMotion } from "motion/react";
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import { Button } from "../components/button";
import { cx } from "../lib/cx";
import { REDUCED_FADE, spring } from "../motion";
import { formatVerifiedOn } from "../strategy/citation";
import type { CountRule } from "../workspace/portal-text";
import { ConsistencyList } from "./consistency-list";
import { FormItemView, type FormAdvisorItem, type FormAdvisorMode } from "./form-item";
import {
  COACH_POLICY_NOTE,
  entryTally,
  formLanes,
  limitDescription,
  overCountNote,
} from "./form-text";

export interface FormGuidance {
  text: string;
  /** The pack source. Every school fact shows its source and the date it was verified. */
  source: { id: string; label: string; verifiedAt: string } | null;
}

export interface FormAdvisorSection {
  key: string;
  /** "Employment history". */
  label: string;
  rule: CountRule | null;
  itemCountMax: number | null;
  guidance: readonly FormGuidance[];
}

export interface FormAdvisorProps {
  section: FormAdvisorSection;
  /** "coach": the school's AI policy rules out written entries; the applicant writes them. */
  mode: FormAdvisorMode;
  /** Why coach mode, with the policy: "Stanford doesn't allow AI-written answers, so…". */
  policyNote?: string | null;
  items: readonly FormAdvisorItem[];
  couldStillDo: readonly CouldStillDo[];
  /** Consistency findings touching this section; shown first when there are any. */
  consistency: readonly ConsistencyFinding[];
  /** The Dossier changed since this advice was written. */
  stale: boolean;
  refreshing?: boolean;
  /** Every keystroke; the caller debounces and saves. */
  onEditEntry: (itemId: string, text: string) => void;
  /**
   * After "Copy for portal" put `text` (portal-normalised) on the clipboard. Toast
   * `copiedEntryMessage(candidate)`: "Copied Saturday coding class entry".
   */
  onCopy: (itemId: string, text: string) => void;
  onRefresh: () => void;
  onUseExpected?: (finding: ConsistencyFinding, value: ConsistencyValue) => void;
  onDismiss?: (finding: ConsistencyFinding) => void;
  hrefFor?: (value: ConsistencyValue) => string | null;
  /** move_to_essay: the deliverable's name for its key ("Essay 2"). Defaults to the key. */
  deliverableLabel?: (key: string) => string;
  /** 1 when this is the page's document pane (the default), 2 inside a longer page. */
  headingLevel?: 1 | 2;
  className?: string;
}

// The stack the cards deal out of: each card a little lower and turned, so it reads as loose
// paper rather than a pile of identical boxes. Deterministic, so every opening looks the same.
const STACK_STEP_PX = 6;
const STACK_DEPTH = 4;
const STACK_TURN_DEG = [0, -1.4, 1.1, -0.7, 1.6, -1.1];
const STACK_DRIFT_PX = [0, 6, -4, 9, -7, 3];
const STAGGER_S = 0.04;
const STAGGER_CAP = 12;

const subscribeNothing = () => () => {};

/**
 * False while React renders on the server and while it hydrates that HTML; true for a component
 * mounted fresh in the browser. The hero plays only then.
 */
function useClientMount(): boolean {
  return useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
}

/** Deals the cards from one stack into their lanes (see the file comment). */
function useDealHero(root: RefObject<HTMLElement | null>, play: boolean) {
  const reduced = useReducedMotion();
  const played = useRef(false);
  useLayoutEffect(() => {
    const element = root.current;
    if (!play || played.current || !element) return;
    played.current = true;
    const cards = [...element.querySelectorAll<HTMLElement>("[data-hero-card]")].filter(
      (card) => card.getClientRects().length > 0,
    );
    const labels = [...element.querySelectorAll<HTMLElement>("[data-hero-label]")];
    if (reduced) {
      const fades = [...cards, ...labels].map((el) =>
        animate(el, { opacity: [0, 1] }, REDUCED_FADE),
      );
      return () => fades.forEach((fade) => fade.stop());
    }
    const top = cards[0]?.getBoundingClientRect();
    if (!top) return;
    const controls = cards.map((card, index) => {
      const rect = card.getBoundingClientRect();
      const depth = Math.min(index, STACK_DEPTH);
      const x = top.left - rect.left + (STACK_DRIFT_PX[index % STACK_DRIFT_PX.length] ?? 0);
      const y = top.top - rect.top + depth * STACK_STEP_PX;
      const rotate = STACK_TURN_DEG[index % STACK_TURN_DEG.length] ?? 0;
      const opacity = 1 - depth * 0.15;
      // Placed on the stack before the first paint; the spring takes it from here.
      card.style.transform = `translateX(${x}px) translateY(${y}px) rotate(${rotate}deg)`;
      card.style.opacity = String(opacity);
      card.style.zIndex = String(cards.length - index);
      const control = animate(
        card,
        { x: [x, 0], y: [y, 0], rotate: [rotate, 0], opacity: [opacity, 1] },
        { ...spring("drift"), delay: Math.min(index, STAGGER_CAP) * STAGGER_S },
      );
      void control.then(() => {
        card.style.zIndex = "";
      });
      return control;
    });
    const fades = labels.map((label) => {
      const order = Number(label.dataset.heroLabel) || 0;
      label.style.opacity = "0";
      return animate(
        label,
        { opacity: [0, 1], y: [8, 0] },
        { ...spring("drift"), delay: Math.min(order, STAGGER_CAP) * STAGGER_S + 0.12 },
      );
    });
    return () => [...controls, ...fades].forEach((control) => control.stop());
  }, [play, reduced, root]);
}

/** The form section's guidance from the pack, each line with its source and verified date. */
function Guidance({ guidance }: { guidance: readonly FormGuidance[] }) {
  if (guidance.length === 0) return null;
  return (
    <ul className="flex flex-col gap-2 border-l border-edge pl-4">
      {guidance.map((line) => (
        <li key={line.text} className="flex flex-col gap-0.5">
          <p className="text-text">{line.text}</p>
          {line.source ? (
            <p className="text-sm text-text-soft">
              {line.source.label}. Verified{" "}
              <time dateTime={line.source.verifiedAt} className="tabular-nums">
                {formatVerifiedOn(line.source.verifiedAt)}
              </time>
              .
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function StillDo({ items, level }: { items: readonly CouldStillDo[]; level: 2 | 3 }) {
  const id = useId();
  if (items.length === 0) return null;
  const Heading = `h${level}` as const;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 border-t border-edge pt-6">
      <Heading id={id} className="text-lg font-semibold text-text">
        What you could still do
      </Heading>
      <ul className="flex flex-col divide-y divide-edge">
        {items.map((item) => (
          <li
            key={item.text}
            className="grid grid-cols-1 gap-x-6 gap-y-1 py-3 sm:grid-cols-[minmax(0,1fr)_auto]"
          >
            <div className="flex flex-col gap-0.5">
              <p className="font-medium text-text">{item.text}</p>
              <p className="text-sm text-text-soft">{item.why}</p>
            </div>
            <p className="inline-flex items-center gap-1 self-start text-sm tabular-nums text-text-soft">
              <ClockIcon size={16} aria-hidden className="shrink-0" />
              {item.time}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function FormAdvisor({
  section,
  mode,
  policyNote,
  items,
  couldStillDo,
  consistency,
  stale,
  refreshing = false,
  onEditEntry,
  onCopy,
  onRefresh,
  onUseExpected,
  onDismiss,
  hrefFor,
  deliverableLabel = (key) => key,
  headingLevel = 1,
  className,
}: FormAdvisorProps) {
  const headingId = useId();
  const groupId = useId();
  const reduced = useReducedMotion();
  const clientMount = useClientMount();
  // Captured on the first render: true only when the pane mounts in the browser.
  const [hero] = useState(clientMount);
  const lanesRef = useRef<HTMLDivElement>(null);
  useDealHero(lanesRef, hero);

  const Title = `h${headingLevel}` as const;
  const laneLevel = (headingLevel + 1) as 2 | 3;
  const itemLevel = (headingLevel + 2) as 3 | 4;
  const limits = limitDescription(section.itemCountMax, section.rule);
  const lanes = formLanes(items);
  const overNote = overCountNote(entryTally(items), section.itemCountMax);
  const names = new Map(items.map((item) => [item.id, item.candidate]));
  const layout = reduced ? false : ("position" as const);
  const glide = spring("glide");

  // A card's order in the deal, so each lane's label rises as its first card lands.
  let dealt = 0;
  const firstCard = new Map<FormRecommendation, number>();
  for (const lane of lanes) {
    firstCard.set(lane.recommendation, dealt);
    dealt += lane.items.length;
  }

  const card = (item: FormAdvisorItem, quiet: boolean) => (
    <motion.li
      key={item.id}
      layoutId={reduced ? undefined : `${groupId}-${item.id}`}
      layout={layout}
      transition={glide}
      className="py-5"
    >
      <div data-hero-card="" className="relative">
        <FormItemView
          item={item}
          mode={mode}
          rule={section.rule}
          combineWith={
            item.recommendation === "combine_with" && item.combine_with
              ? (names.get(item.combine_with) ?? null)
              : null
          }
          moveTo={
            item.recommendation === "move_to_essay" && item.move_to
              ? deliverableLabel(item.move_to)
              : null
          }
          headingLevel={itemLevel}
          onEditEntry={onEditEntry}
          onCopy={onCopy}
          quiet={quiet}
        />
      </div>
    </motion.li>
  );

  return (
    <article
      aria-labelledby={headingId}
      data-mode={mode}
      className={cx("flex flex-col gap-8 font-ui text-base", className)}
    >
      <header className="flex flex-col gap-3">
        <Title id={headingId} className="text-display-sm text-text">
          {section.label}
        </Title>
        {limits ? <p className="text-lg tabular-nums text-text-soft">{limits}</p> : null}
        {mode === "coach" ? (
          <p className="text-text-soft">{policyNote ?? COACH_POLICY_NOTE}</p>
        ) : null}
        <Guidance guidance={section.guidance} />
      </header>

      <div aria-live="polite" className="empty:hidden">
        {stale ? (
          <div className="flex flex-col items-start gap-2 border-l-2 border-needs pl-4">
            <p className="text-text">
              Your Dossier changed after this advice was written. The entries may miss it.
            </p>
            <Button
              variant="secondary"
              icon={ArrowClockwiseIcon}
              loading={refreshing}
              onClick={onRefresh}
            >
              {refreshing ? "Refreshing the advice" : "Refresh the advice"}
            </Button>
          </div>
        ) : null}
      </div>

      {consistency.length > 0 ? (
        <ConsistencyList
          findings={consistency}
          hrefFor={hrefFor}
          onUseExpected={onUseExpected}
          onDismiss={onDismiss}
        />
      ) : null}

      {overNote ? (
        <p className="inline-flex items-center gap-1.5 font-medium text-risk">
          <WarningOctagonIcon size={16} aria-hidden className="shrink-0" />
          <span className="sr-only">Must fix:</span>
          {overNote}
        </p>
      ) : null}

      <LayoutGroup id={groupId}>
        <div ref={lanesRef} className="flex flex-col gap-10">
          {lanes.map((lane) => {
            const laneId = `${groupId}-${lane.recommendation}`;
            const order = firstCard.get(lane.recommendation) ?? 0;
            const Lane = `h${laneLevel}` as const;
            const quiet = lane.recommendation === "leave_out";
            const list = (
              <ul className="flex flex-col divide-y divide-edge">
                {lane.items.map((item) => card(item, quiet))}
              </ul>
            );
            return (
              <motion.section
                key={lane.recommendation}
                layout={layout}
                transition={glide}
                aria-labelledby={laneId}
                data-lane={lane.recommendation}
                className="flex flex-col"
              >
                <div data-hero-label={order} className="border-b border-edge pb-2">
                  <Lane id={laneId} className="text-base font-medium text-text-soft">
                    {lane.label} <span className="tabular-nums">({lane.items.length})</span>
                  </Lane>
                </div>
                {quiet ? (
                  // Left-out candidates stay folded away: the reasons are there for anyone who
                  // wonders, and nothing else competes with the entries.
                  <details className="group/leave">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-control text-sm text-signal hover:underline [&::-webkit-details-marker]:hidden">
                      <span className="group-open/leave:hidden">
                        Show what to leave out and why
                      </span>
                      <span className="hidden group-open/leave:inline">Hide them</span>
                    </summary>
                    {list}
                  </details>
                ) : (
                  list
                )}
              </motion.section>
            );
          })}
        </div>
      </LayoutGroup>

      <StillDo items={couldStillDo} level={laneLevel} />
    </article>
  );
}
