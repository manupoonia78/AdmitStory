import { ArrowRightIcon } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { SCHOOL_PLANS, dollars } from "@/lib/payments/plans";
import type { StrategyRow } from "@/lib/strategy/types";

// "Your schools" (school workspace redesign): one card per school on the list. A school you've
// paid for opens straight into its tabs (essays, application, video, recommenders, résumé). One
// you haven't shows its next deadline and what it asks for, with Unlock and a free preview. No
// controls here: the round and reapplicant choices live on the school's preview and unlock pages.
// With pack credits left (Manu, 5 Nov 2026), Unlock says it costs a credit, not a price.

type CardState = "ready" | "building" | "failed" | "locked" | "coming_soon";

function stateOf(row: StrategyRow): CardState {
  if (row.kit?.status === "ready") return "ready";
  if (row.kit?.status === "failed") return "failed";
  if (row.kit) return "building";
  return row.pack === "published" ? "locked" : "coming_soon";
}

const CHIP: Record<CardState, string> = {
  ready: "Ready",
  building: "Drafting",
  failed: "Needs a retry",
  locked: "Not unlocked",
  coming_soon: "Pack coming soon",
};

function Card({ row, price }: { row: StrategyRow; price: string }) {
  const state = stateOf(row);
  const open = state === "ready" || state === "building" || state === "failed";
  const progress =
    state === "building" && row.kit
      ? Math.round((Math.min(row.kit.done, row.kit.total) / Math.max(1, row.kit.total)) * 100)
      : null;
  const facts = [
    row.nextDeadline,
    row.essays ? `${row.essays} ${row.essays === 1 ? "essay" : "essays"}` : null,
  ].filter(Boolean);

  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="meta text-text-soft">{row.cycle}</span>
        <span
          className={
            state === "ready"
              ? "meta text-verified"
              : state === "building" || state === "failed"
                ? "meta text-accent"
                : "meta text-text-soft"
          }
        >
          {progress !== null ? `${CHIP[state]} · ${progress}%` : CHIP[state]}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="font-display text-[2rem] leading-[1.05] tracking-[-0.02em] text-text">
          {row.shortName || row.name}
        </h3>
        {row.shortName && row.shortName !== row.name ? (
          <p className="text-sm text-text-soft">{row.name}</p>
        ) : null}
      </div>
      {facts.length > 0 ? <p className="text-sm text-text">{facts.join("  ·  ")}</p> : null}
      {progress !== null ? (
        <div className="h-0.5 w-full overflow-hidden rounded-full bg-veil" aria-hidden>
          <div className="h-full bg-accent" style={{ width: `${Math.max(4, progress)}%` }} />
        </div>
      ) : null}
    </>
  );

  if (open)
    return (
      <Link
        href={`/schools/${row.userSchoolId}`}
        className="group flex min-h-56 flex-col justify-between gap-6 rounded-plane border border-edge bg-depth p-6 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-text-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal motion-reduce:hover:translate-y-0"
      >
        <div className="flex flex-col gap-4">{body}</div>
        <span className="flex items-center gap-2 font-medium text-text">
          {state === "ready" ? `Open ${row.shortName || row.name}` : "See where it's at"}
          <ArrowRightIcon
            aria-hidden
            size={16}
            className="transition-transform duration-200 group-hover:translate-x-1 motion-reduce:group-hover:translate-x-0"
          />
        </span>
      </Link>
    );

  return (
    <div className="flex min-h-56 flex-col justify-between gap-6 rounded-plane border border-dashed border-edge p-6">
      <div className="flex flex-col gap-4">{body}</div>
      {state === "locked" ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link
            href={`/schools/${row.userSchoolId}/unlock`}
            className="inline-flex min-h-10 items-center rounded-full bg-signal px-4 text-sm font-medium text-on-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
          >
            Unlock · {price}
          </Link>
          <Link
            href={`/schools/${row.userSchoolId}/preview`}
            className="text-sm text-text-soft underline-offset-4 hover:text-text hover:underline"
          >
            Free preview
          </Link>
        </div>
      ) : (
        <p className="text-sm text-text-soft">
          We&apos;re still verifying {row.shortName || row.name}&apos;s pack. It can&apos;t be
          bought yet.
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
    <section aria-labelledby="cards-heading" className="flex flex-col gap-5">
      <h2
        id="cards-heading"
        className="font-display text-[1.625rem] leading-tight tracking-[-0.01em] text-text"
      >
        Your schools
      </h2>
      {credits > 0 ? (
        <p className="text-base text-text">
          {`You have ${credits} school ${credits === 1 ? "credit" : "credits"} from your pack. Each one unlocks a school, essays and all.`}
        </p>
      ) : locked > 1 ? (
        <p className="text-base text-text-soft">
          {`Unlocking more than one? ${PACK5.schools} schools for ${dollars(PACK5.priceCents)}, or ${PACK10.schools} for ${dollars(PACK10.priceCents)}, every essay drafted. Choose a pack on any school's unlock page.`}
        </p>
      ) : null}
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {sorted.map((row) => (
          <li key={row.userSchoolId}>
            <Card row={row} price={credits > 0 ? "1 credit" : price} />
          </li>
        ))}
      </ul>
    </section>
  );
}
