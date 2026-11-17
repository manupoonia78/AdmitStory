// Scene 10 (SPEC §4): pricing. The contrast leads (others charge about the pack's price for
// guidelines; we draft the essays), then four ways to start on one baseline: Free, 1 school,
// 5 schools, 10 schools. The 5-school pack is the only filled card and holds the scene's only brass
// button. Every name, price and list comes from ../_data/pricing.ts and lib/payments/pitch.ts;
// nothing is typed here. All sales are final, said once, plainly, under the row.

import { buttonStyles, cx } from "@admitstory/ui";
import Link from "next/link";
import { PACK_PITCH } from "@/lib/payments/pitch";
import { PRICING_COPY } from "../_copy/landing";
import { START_FREE, START_STORY } from "../_copy/shared";
import {
  FREE_FEATURES,
  FREE_PLAN,
  KIT_COMING_SOON,
  KIT_FEATURES,
  PLAN_CARDS,
  TAX_AND_FINAL_LINE,
} from "../_data/pricing";
import { trackAttributes } from "../_lib/track";
import { START_FREE_HREF, TEXT_LINK } from "../_ui/cta-link";
import { Section } from "../_ui/section";

interface Column {
  id: string;
  name: string;
  price: string;
  was: string | null;
  line: string;
  featured: boolean;
}

const COLUMNS: readonly Column[] = [
  {
    id: "free",
    name: FREE_PLAN.name,
    price: FREE_PLAN.price,
    was: null,
    line: FREE_PLAN.line,
    featured: false,
  },
  ...PLAN_CARDS,
];

function Plan({ plan }: { plan: Column }) {
  const track = trackAttributes("cta_start_free", { location: "pricing" });
  return (
    <li className={cx("price-col", plan.featured && "price-col-featured")}>
      {plan.featured ? (
        <p className="soon-pill soon-pill-solid label price-badge">{PACK_PITCH.badge}</p>
      ) : null}
      <h3 className="label">{plan.name}</h3>
      <p className="mt-5 flex flex-wrap items-baseline gap-x-3">
        <span className="price-figure text-text">{plan.price}</span>
        {plan.was ? (
          <s className="text-[1.125rem] tracking-[-0.02em] text-text-faint tabular-nums">
            <span className="sr-only">{PRICING_COPY.insteadOf}</span>
            {plan.was}
          </s>
        ) : null}
      </p>
      <p className="mt-4 text-sm text-text-soft">{plan.line}</p>
      {plan.featured ? <p className="mt-4 text-sm text-text-80">{PACK_PITCH.detail}</p> : null}
      <div className="mt-auto pt-8">
        {plan.featured ? (
          <Link
            href={START_FREE_HREF}
            className={cx(buttonStyles({ arrow: true }), "w-full")}
            {...track}
          >
            {START_STORY}
            <span aria-hidden="true" className="btn-arrow ml-auto" />
          </Link>
        ) : (
          <Link
            href={START_FREE_HREF}
            className={cx(buttonStyles({ variant: "secondary" }), "w-full")}
            {...track}
          >
            {START_FREE}
          </Link>
        )}
      </div>
    </li>
  );
}

/** The four ways to start on one baseline, shared with /pricing. */
export function PlanRow({ className }: { className?: string }) {
  return (
    <ul role="list" aria-label={PRICING_COPY.waysLabel} className={cx("price-row", className)}>
      {COLUMNS.map((plan) => (
        <Plan key={plan.id} plan={plan} />
      ))}
    </ul>
  );
}

function Included({ label, items }: { label: string; items: readonly string[] }) {
  return (
    <div>
      <h3 className="label">{label}</h3>
      <ul role="list" className="mt-4 border-b border-edge">
        {items.map((item) => (
          <li key={item} className="price-item text-sm text-text-80">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PricingSection() {
  return (
    <Section id="pricing" labelledBy="pricing-title">
      <div className="reveal col-span-4 sm:col-span-8 lg:col-span-9">
        <p className="eyebrow mb-6">{PACK_PITCH.eyebrow}</p>
        <h2
          id="pricing-title"
          className="font-display text-display-2 text-text [text-wrap:balance]"
        >
          <span className="block text-text-label">{PACK_PITCH.others}</span>{" "}
          <span className="block">{PACK_PITCH.ours}</span>
        </h2>
      </div>

      <PlanRow className="reveal col-span-4 mt-14 sm:col-span-8 lg:col-span-12 lg:mt-24" />

      <div className="reveal col-span-4 mt-14 grid gap-x-6 gap-y-10 border-t border-edge pt-8 sm:col-span-8 lg:col-span-12 lg:mt-20 lg:grid-cols-2">
        <Included label={PRICING_COPY.freeListLabel} items={FREE_FEATURES} />
        <div>
          <Included label={PRICING_COPY.kitListLabel} items={KIT_FEATURES} />
          <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-text-soft">
            <span className="soon-pill label">{KIT_COMING_SOON.label}</span>
            <span>{KIT_COMING_SOON.line}</span>
          </p>
        </div>
      </div>
      <div className="col-span-4 mt-10 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 border-t border-edge pt-6 sm:col-span-8 lg:col-span-12">
        <p className="max-w-[640px] text-sm text-text-soft">{TAX_AND_FINAL_LINE}</p>
        <Link href="/pricing" className={TEXT_LINK}>
          {PRICING_COPY.seeKit}
        </Link>
      </div>
    </Section>
  );
}
