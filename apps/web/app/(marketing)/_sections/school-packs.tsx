// School packs (Manu, 5 Nov 2026): the value story, on the landing page's pricing section and on
// /pricing. The contrast leads ("other services charge about $349 for guidelines; for $349 we draft
// your essays for five schools"), then the three ways to buy, with the 5-school pack as the one
// Night plane, lifted and badged, its one-at-a-time price struck through. Then the side-by-side.
// Server-safe; prices from _data/pricing.ts, words from lib/payments/pitch.ts.

import { cx } from "@admitstory/ui";
import { PACK_PITCH } from "@/lib/payments/pitch";
import { PLAN_CARDS, type PlanCard } from "../_data/pricing";
import { DisplayHeading } from "../_ui/display-heading";
import { Tick } from "../_ui/tick";

function Card({ plan }: { plan: PlanCard }) {
  return (
    <li
      data-theme={plan.featured ? "night" : undefined}
      className={cx(
        "flex flex-col rounded-plane p-6 sm:p-8",
        plan.featured
          ? "grain relative order-first bg-space text-text ring-1 ring-accent lg:order-none lg:-my-5 lg:p-10"
          : "plane",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg text-text-soft">{plan.name}</h3>
        {plan.featured ? (
          <span className="rounded-control border border-accent px-2 py-0.5 text-sm text-accent">
            {PACK_PITCH.badge}
          </span>
        ) : null}
      </div>
      <p className="mt-4 flex flex-wrap items-baseline gap-x-3">
        <span
          className={cx(
            "text-text tabular-nums",
            plan.featured ? "text-display-xl" : "text-display-lg",
          )}
        >
          {plan.price}
        </span>
        {plan.was ? (
          <s className="text-lg text-text-soft tabular-nums">
            <span className="sr-only">instead of </span>
            {plan.was}
          </s>
        ) : null}
      </p>
      <p className="mt-4 text-base text-text-soft">{plan.line}</p>
      {plan.featured ? (
        <p className="mt-6 border-t border-edge pt-5 font-reading text-read-lg text-text">
          {PACK_PITCH.detail}
        </p>
      ) : null}
    </li>
  );
}

export function SchoolPacks({ headingId, level = 2 }: { headingId: string; level?: 2 | 3 }) {
  const { compare } = PACK_PITCH;
  return (
    <>
      <div className="col-span-4 sm:col-span-8 lg:col-span-10">
        <p className="eyebrow mb-6">{PACK_PITCH.eyebrow}</p>
        <DisplayHeading
          level={level}
          size="md"
          id={headingId}
          lines={[PACK_PITCH.others, PACK_PITCH.ours]}
        />
      </div>

      <ul
        role="list"
        aria-label="Ways to buy"
        className="col-span-4 mt-14 grid items-stretch gap-4 sm:col-span-8 lg:col-span-12 lg:mt-20 lg:grid-cols-3 lg:gap-6"
      >
        {PLAN_CARDS.map((plan) => (
          <Card key={plan.id} plan={plan} />
        ))}
      </ul>
      <p className="col-span-4 mt-8 max-w-[44rem] text-base text-text-soft sm:col-span-8 lg:col-span-8 lg:mt-12">
        {PACK_PITCH.credits}
      </p>

      <div className="col-span-4 mt-16 sm:col-span-8 lg:col-span-10 lg:mt-24">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">
            What other services give you, and what a pack gives you
          </caption>
          <thead>
            <tr className="border-b border-edge">
              <th scope="col" className="w-1/2 py-3 pr-6 text-sm font-normal text-text-soft">
                {compare.othersLabel}
              </th>
              <th scope="col" className="w-1/2 py-3 text-sm font-medium text-accent">
                {compare.oursLabel}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge border-b border-edge">
            {compare.rows.map((row) => (
              <tr key={row.ours}>
                <td className="py-5 pr-6 align-top text-base text-text-soft sm:text-lg">
                  {row.others}
                </td>
                <td className="py-5 align-top text-base text-text sm:text-lg">
                  <span className="flex gap-3">
                    <Tick />
                    <span>{row.ours}</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
