// Pricing on the landing page (direction §4.8). One plane split by a hairline (vertical on desktop,
// horizontal on phones), not two cards. No badges, no strikethrough, no "limited time". The prices
// and lists come from _data/pricing.ts, which /pricing and /terms read too.

import {
  FREE_FEATURES,
  FREE_PLAN,
  KIT_COMING_SOON,
  KIT_FEATURES,
  KIT_PLAN,
  TAX_AND_REFUND_LINE,
} from "../_data/pricing";
import { ModelCredit } from "@/components/model-seal";
import { PRICING_COPY } from "../_copy/landing";
import { START_FREE } from "../_copy/shared";
import { CtaLink, START_FREE_HREF } from "../_ui/cta-link";
import { Section } from "../_ui/section";
import { Tick } from "../_ui/tick";

function FeatureList({ items, label }: { items: readonly string[]; label: string }) {
  return (
    <ul role="list" aria-label={label} className="mt-8 flex flex-col gap-3">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-base text-text">
          <Tick />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

const PRICE = "block text-display-xl text-text tabular-nums";

export function PricingSection() {
  return (
    <Section id="pricing" labelledBy="pricing-title">
      <h2 id="pricing-title" className="sr-only">
        {PRICING_COPY.heading}
      </h2>
      <div className="plane col-span-4 grid overflow-hidden sm:col-span-8 lg:col-span-12 lg:grid-cols-2">
        <div className="p-6 sm:p-10 lg:p-14">
          <h3 className="text-lg text-text-soft">{FREE_PLAN.name}</h3>
          <p className="mt-4">
            <span className={PRICE}>{FREE_PLAN.price}</span>
          </p>
          <p className="mt-6 font-reading text-read-lg text-text">{FREE_PLAN.line}</p>
          <FeatureList items={FREE_FEATURES} label={PRICING_COPY.freeListLabel} />
        </div>
        <div className="border-t border-edge p-6 sm:p-10 lg:border-t-0 lg:border-l lg:p-14">
          <h3 className="text-lg text-text-soft">{KIT_PLAN.name}</h3>
          <p className="mt-4 flex flex-wrap items-baseline gap-x-4">
            <span className={PRICE}>{KIT_PLAN.price}</span>
            <span className="text-lg text-text-soft">{KIT_PLAN.unit}</span>
          </p>
          <p className="mt-6 font-reading text-read-lg text-text">{KIT_PLAN.line}</p>
          <ModelCredit className="mt-4" />
          <FeatureList items={KIT_FEATURES} label={PRICING_COPY.kitListLabel} />
          <p className="mt-6 border-t border-edge pt-5 text-base text-text-soft">
            <span className="mr-2 rounded-control border border-edge px-1.5 py-0.5 text-sm text-text">
              {KIT_COMING_SOON.label}
            </span>
            {KIT_COMING_SOON.feature}. {KIT_COMING_SOON.line}
          </p>
        </div>
      </div>
      <p className="col-span-4 mt-6 text-base text-text-soft sm:col-span-8 lg:col-span-9">
        {TAX_AND_REFUND_LINE}
      </p>
      <div className="col-span-4 mt-8 flex flex-wrap items-center gap-3 sm:col-span-8 lg:col-span-12">
        <CtaLink href={START_FREE_HREF} track="pricing">
          {START_FREE}
        </CtaLink>
        <CtaLink href="/pricing" variant="ghost">
          {PRICING_COPY.seeKit}
        </CtaLink>
      </div>
    </Section>
  );
}
