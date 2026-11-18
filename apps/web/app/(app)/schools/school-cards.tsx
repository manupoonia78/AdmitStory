import { Peak, buttonStyles, cx } from "@admitstory/ui";
import {
  ArrowsClockwiseIcon,
  CheckCircleIcon,
  CircleDashedIcon,
  CircleHalfIcon,
  CircleIcon,
} from "@phosphor-icons/react/ssr";
import Link from "next/link";
import type { CSSProperties } from "react";
import { SCHOOL_PLANS, dollars } from "@/lib/payments/plans";
import type { StrategyRow } from "@/lib/strategy/types";

// "Your schools" (SPEC §6.5): one card per school on the list. A school you've paid for opens
// straight into its tabs (essays, application, video, recommenders, résumé). One you haven't shows
// its next deadline and what it asks for, with Unlock and a free preview. No controls here: the
// round and reapplicant choices live on the school's preview and unlock pages. With pack credits
// left (Manu, 5 Nov 2026), Unlock says it costs a credit, not a price. Without them the button
// names the school and the line under it gives the single price and points at the packs, so the
// unlock page's three prices are no surprise (16 Nov 2026).
//
// Each card carries the Voiceline as a deadline line: today at the left, the last round at the
// right, a tick at each round still ahead and the peak at the next deadline. The page's moment
// draws the lines and raises the peaks once per visit (schools.css).

type CardState = "ready" | "building" | "failed" | "locked" | "coming_soon";

function stateOf(row: StrategyRow): CardState {
  if (row.kit?.status === "ready") return "ready";
  if (row.kit?.status === "failed") return "failed";
  if (row.kit) return "building";
  return row.pack === "published" ? "locked" : "coming_soon";
}

const STATE: Record<CardState, { word: string; icon: typeof CircleIcon; tone: string }> = {
  ready: { word: "Ready", icon: CheckCircleIcon, tone: "text-verified" },
  building: { word: "Drafting", icon: CircleHalfIcon, tone: "text-text" },
  failed: { word: "Needs a retry", icon: ArrowsClockwiseIcon, tone: "text-text" },
  locked: { word: "Not unlocked", icon: CircleIcon, tone: "text-text-soft" },
  coming_soon: { word: "Pack coming soon", icon: CircleDashedIcon, tone: "text-text-soft" },
};

/** Card entrances start closer together as the list goes on (SPEC §6.5); the sixth and later together. */
const STARTS_MS = [0, 70, 120, 160, 190, 210];

function DeadlineLine({ row, state, index }: { row: StrategyRow; state: CardState; index: number }) {
  const line = row.deadlineLine;
  const progress =
    state === "building" && row.kit
      ? Math.min(row.kit.done, row.kit.total) / Math.max(1, row.kit.total)
      : null;
  const style = {
    "--start": `${STARTS_MS[Math.min(index, STARTS_MS.length - 1)]}ms`,
    ...(line?.peak !== null && line?.peak !== undefined ? { "--peak": line.peak } : {}),
    ...(progress !== null ? { "--done": Math.max(0.04, progress) } : {}),
  } as CSSProperties;
  const days = line?.daysLeft;
  const when =
    progress !== null
      ? `Drafting · ${Math.round(progress * 100)}%`
      : days === null || days === undefined
        ? null
        : days === 0
          ? "today"
          : days === 1
            ? "tomorrow"
            : `in ${days} days`;
  const facts = row.nextDeadline ?? (state === "coming_soon" ? null : "No date yet");

  return (
    <div className="school-line" data-soon={state === "coming_soon" ? "" : undefined} style={style}>
      <div className="school-line-rule" aria-hidden>
        <span className="school-line-track" />
        {progress !== null ? <span className="school-line-run" /> : null}
        {state === "coming_soon"
          ? null
          : line?.ticks.map((at) => (
              <span key={at} className="school-line-tick" style={{ left: `${at * 100}%` }} />
            ))}
        {state !== "coming_soon" && line?.peak !== null && line?.peak !== undefined ? (
          <span className="school-line-peak">
            <Peak className="size-full" strokeWidth={1.25} />
          </span>
        ) : null}
      </div>
      {facts || when ? (
        <p className="school-line-facts">
          <span>{facts}</span>
          {when ? <span className="text-text-soft">{when}</span> : null}
        </p>
      ) : null}
    </div>
  );
}

function Card({
  row,
  price,
  credits,
  index,
}: {
  row: StrategyRow;
  price: string;
  credits: boolean;
  index: number;
}) {
  const state = stateOf(row);
  const name = row.shortName || row.name;
  const open = state === "ready" || state === "building" || state === "failed";
  const { word, icon: StateIcon, tone } = STATE[state];

  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="label text-text-label">{row.cycle}</span>
        <span className={cx("inline-flex items-center gap-1.5 text-sm font-medium", tone)}>
          <StateIcon size={14} aria-hidden className="shrink-0" />
          {word}
        </span>
      </div>
      <div className="mt-7 flex min-w-0 flex-col gap-1.5">
        <h3 className="truncate text-display-3 text-text">{name}</h3>
        {row.shortName && row.shortName !== row.name ? (
          <p className="line-clamp-2 text-sm text-text-soft">{row.name}</p>
        ) : null}
        {row.essays ? (
          <p className="text-sm text-text-soft">
            {`${row.essays} ${row.essays === 1 ? "essay" : "essays"} to write`}
          </p>
        ) : null}
      </div>
      <div className="mt-auto pt-8">
        <DeadlineLine row={row} state={state} index={index} />
      </div>
    </>
  );

  if (open)
    return (
      <Link
        href={`/schools/${row.userSchoolId}`}
        className="school-card card card-link group"
        data-state={state}
      >
        {body}
        <span className="mt-6 flex min-h-[4.75rem] items-end justify-between gap-3 text-ui text-text">
          {state === "ready" ? `Open ${name}` : "See where it's at"}
          <span
            aria-hidden
            className="btn-arrow [--btn-arrow-bg:var(--text)] [--btn-arrow-fg:var(--space)] [--btn-arrow-size:1.75rem]"
          />
        </span>
      </Link>
    );

  return (
    <div className="school-card card" data-state={state}>
      {body}
      {state === "locked" ? (
        <div className="mt-6 flex min-h-[4.75rem] flex-col items-start justify-end gap-3">
          <Link
            href={`/schools/${row.userSchoolId}/unlock`}
            className={buttonStyles({ size: "sm" })}
          >
            {credits ? "Unlock · 1 credit" : `Unlock ${name}`}
          </Link>
          <p className="text-sm text-text-soft">
            <Link
              href={`/schools/${row.userSchoolId}/preview`}
              className="relative text-text underline decoration-edge-strong underline-offset-4 transition-colors duration-(--dur-hover) before:absolute before:-inset-x-1 before:top-1/2 before:h-11 before:-translate-y-1/2 hover:decoration-text"
            >
              Free preview
            </Link>
            {credits ? null : <span>{` · ${price} alone, less in a pack`}</span>}
          </p>
        </div>
      ) : (
        <p className="mt-6 flex min-h-[4.75rem] items-end text-sm text-text-soft">
          We&apos;re still verifying {name}&apos;s pack. It can&apos;t be bought yet.
        </p>
      )}
    </div>
  );
}

const PACK5 = SCHOOL_PLANS.school_pack5;
const PACK10 = SCHOOL_PLANS.school_pack10;

export function SchoolCards({
  rows,
  price,
  credits,
}: {
  rows: readonly StrategyRow[];
  price: string;
  /** Unused schools from packs already bought. */
  credits: number;
}) {
  if (rows.length === 0) return null;
  const locked = rows.filter((row) => stateOf(row) === "locked").length;
  // Paid schools first, in the order they were added; then the rest.
  const order: CardState[] = ["ready", "building", "failed", "locked", "coming_soon"];
  const sorted = [...rows].sort((a, b) => order.indexOf(stateOf(a)) - order.indexOf(stateOf(b)));
  return (
    <section aria-labelledby="cards-heading" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 id="cards-heading" className="sr-only">
          Your schools
        </h2>
        {credits > 0 ? (
          <p className="text-sm text-text-80">
            {`You have ${credits} school ${credits === 1 ? "credit" : "credits"} from your pack. Each one unlocks a school, essays and all.`}
          </p>
        ) : locked > 1 ? (
          <p className="max-w-[64ch] text-sm text-text-soft">
            {`Unlocking more than one? ${PACK5.schools} schools for ${dollars(PACK5.priceCents)}, or ${PACK10.schools} for ${dollars(PACK10.priceCents)}, every essay drafted. Choose a pack on any school's unlock page.`}
          </p>
        ) : null}
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 xl:gap-6">
        {sorted.map((row, index) => (
          <li key={row.userSchoolId} className="flex">
            <Card row={row} price={price} credits={credits > 0} index={index} />
          </li>
        ))}
      </ul>
    </section>
  );
}
