// /pricing (SPEC §4.2): what a school costs and what it buys. The head is the page's one moment:
// "5 schools." then the list price struck through as the page settles, and the price beside it.
// Then the four plans (shared with the landing page), one kit opened as sheets of paper, what's
// free and what a kit adds, elsewhere and here, payment, questions and the final call. No
// checkout here: purchases start in the app from a school's unlock page. Every number comes from
// lib/payments/plans.ts through ../_data/pricing.ts.

import { buttonStyles, cx } from "@admitstory/ui";
import Link from "next/link";
import type { CSSProperties } from "react";
import { APP_NAME } from "@admitstory/shared/brand";
import { SocialProofSlot } from "@/components/social-proof-slot";
import { PACK_PITCH } from "@/lib/payments/pitch";
import { absoluteUrl } from "@/lib/marketing/site-url";
import { FEATURED_PLAN, SCHOOL_PLANS, dollars, listCents } from "@/lib/payments/plans";
import {
  KIT_COPY,
  LEDGER,
  LEDGER_COPY,
  NO_CHARGE_COPY,
  PAYMENT_COPY,
  PRICING_PAGE_COPY,
  PRICING_QUESTIONS_HEADING,
  pricingQuestions,
  type LedgerRow,
} from "../_copy/pricing-page";
import { COMING_SOON, START_STORY } from "../_copy/shared";
import {
  CURRENCY,
  FREE_PRICE_USD,
  KIT_PLAN,
  KIT_PRICE_USD,
  PLAN_CARDS,
  SALES_FINAL_RULE,
  TAX_AND_FINAL_LINE,
  TAX_LINE,
} from "../_data/pricing";
import { pageMetadata } from "../_lib/seo";
import { trackAttributes } from "../_lib/track";
import { FaqTracking } from "../_sections/faq-tracking";
import { FinalCall } from "../_sections/final-call";
import { PlanRow } from "../_sections/pricing";
import { START_FREE_HREF } from "../_ui/cta-link";
import { JsonLd, type JsonLdValue } from "../_ui/json-ld";
import { PageHead } from "../_ui/page-head";
import { SceneHead } from "../_ui/scene-head";
import { Section } from "../_ui/section";
import { sheetSerif } from "../_ui/sheet-serif";
import { KIT_DRAFTS, type KitDraft } from "./_data";

export const metadata = pageMetadata({
  title: "Pricing",
  description:
    "AdmitStories is free to talk to. Five schools for $349 or ten for $699, with every essay drafted from your own words, not just guidelines. Or $100 for one school.",
  path: "/pricing",
});

const FEATURED = SCHOOL_PLANS[FEATURED_PLAN];

/** Product JSON-LD (direction §9): free, $100 per school, and the 5- and 10-school packs. */
function productJsonLd(): JsonLdValue {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: APP_NAME,
    description: PRICING_PAGE_COPY.subline,
    url: absoluteUrl("/pricing"),
    offers: [
      { "@type": "Offer", name: "Free", price: FREE_PRICE_USD, priceCurrency: CURRENCY },
      {
        "@type": "Offer",
        name: `${KIT_PLAN.name}, ${KIT_PLAN.unit}`,
        price: KIT_PRICE_USD,
        priceCurrency: CURRENCY,
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: KIT_PRICE_USD,
          priceCurrency: CURRENCY,
          unitText: "school",
        },
      },
      ...PLAN_CARDS.filter((plan) => plan.was !== null).map((plan) => ({
        "@type": "Offer",
        name: `${plan.name} pack`,
        price: plan.priceUsd,
        priceCurrency: CURRENCY,
      })),
    ],
  };
}

/** "$500 $349.": the list price struck by a drawn line, then the price (marketing.css). */
function PriceLine() {
  const was = dollars(listCents(FEATURED));
  return (
    <>
      <span aria-hidden="true" className="price-hero-was">
        <s>{was}</s>
      </span>{" "}
      <span className="price-hero-now enter" style={{ "--i": 14.4 } as CSSProperties}>
        {dollars(FEATURED.priceCents)}.
        <span className="sr-only">
          {" "}
          {PRICING_PAGE_COPY.insteadOf} {was}.
        </span>
      </span>
    </>
  );
}

function KitSheet({ draft }: { draft: KitDraft }) {
  return (
    <li>
      <article data-theme="day" className="scene-sheet kit-sheet">
        <div className="scene-sheet-margin">
          <p className="scene-sheet-title">{draft.title}</p>
          <p className="scene-sheet-note">{draft.note}</p>
          <p className="scene-sheet-count">{draft.limit}</p>
        </div>
        <div className={cx(sheetSerif.className, "scene-sheet-body")}>
          <p className="kit-sheet-from">
            {KIT_COPY.from} · {draft.story}
          </p>
          <p>
            {draft.opening.map((sentence, index) => (
              <span key={sentence.text}>
                {index > 0 ? " " : null}
                {sentence.own ? <mark className="sheet-mark">{sentence.text}</mark> : sentence.text}
              </span>
            ))}
          </p>
        </div>
      </article>
    </li>
  );
}

function LedgerWord({ row }: { row: LedgerRow }) {
  if (row.kit === "coming_soon") return <span className="soon-pill label">{COMING_SOON}</span>;
  if (row.free === "included")
    return <span className="label text-text">{LEDGER_COPY.phoneFree}</span>;
  return <span className="label">{LEDGER_COPY.phoneKit}</span>;
}

const QUESTIONS_ID = "pricing-questions";

export default function PricingPage() {
  const questions = pricingQuestions();
  const { compare } = PACK_PITCH;
  return (
    <>
      <PageHead
        id="pricing-page-title"
        eyebrow={PRICING_PAGE_COPY.eyebrow}
        lines={[PRICING_PAGE_COPY.schools, <PriceLine key="price" />]}
        accent={false}
        headingClassName="price-hero-title"
        paragraph={PRICING_PAGE_COPY.subline}
        action={
          <Link
            href={START_FREE_HREF}
            className={buttonStyles({ size: "lg", arrow: true })}
            {...trackAttributes("cta_start_free", { location: "pricing-page" })}
          >
            {START_STORY}
            <span aria-hidden="true" className="btn-arrow" />
          </Link>
        }
      />

      {/* Social proof goes here, above the plans. It renders nothing until
          components/social-proof.ts has real, attributable content from Manu. */}
      <SocialProofSlot />

      <Section labelledBy="plans-title" spacing="none" className="pt-18 lg:pt-24">
        <h2 id="plans-title" className="sr-only">
          {PACK_PITCH.eyebrow}
        </h2>
        <PlanRow className="reveal col-span-4 sm:col-span-8 lg:col-span-12" />
        <div className="col-span-4 mt-10 grid gap-4 border-t border-edge pt-6 sm:col-span-8 lg:col-span-12 lg:grid-cols-2 lg:gap-6">
          <p className="max-w-[560px] text-sm text-text-soft">{PACK_PITCH.credits}</p>
          <p className="max-w-[560px] text-sm text-text-soft lg:justify-self-end lg:text-right">
            {TAX_AND_FINAL_LINE}
          </p>
        </div>
      </Section>

      <Section labelledBy="kit-title">
        <SceneHead
          id="kit-title"
          eyebrow={KIT_COPY.eyebrow}
          lines={KIT_COPY.headingLines}
          size="2"
          className="reveal col-span-4 sm:col-span-8 lg:col-span-7"
        />
        <p className="reveal col-span-4 mt-6 text-lg text-text-soft sm:col-span-6 lg:col-span-4 lg:col-start-9 lg:mt-auto">
          {KIT_COPY.paragraph}
        </p>
        <ul
          role="list"
          className="kit-sheets reveal col-span-4 mt-12 sm:col-span-8 lg:col-span-12 lg:mt-16"
        >
          {KIT_DRAFTS.map((draft) => (
            <KitSheet key={draft.key} draft={draft} />
          ))}
        </ul>
        <ul role="list" className="kit-others reveal col-span-4 mt-10 sm:col-span-8 lg:col-span-12">
          {KIT_COPY.others.map((item) => (
            <li key={item.label}>
              <p className="label">{item.label}</p>
              <p className="mt-2 text-sm text-text-80">{item.line}</p>
            </li>
          ))}
        </ul>
        <p className="label col-span-4 mt-8 sm:col-span-8 lg:col-span-12">{KIT_COPY.note}</p>
      </Section>

      <Section labelledBy="ledger-title" className="border-t border-edge">
        <div className="col-span-4 sm:col-span-8 lg:col-span-5">
          <SceneHead
            id="ledger-title"
            lines={LEDGER_COPY.headingLines}
            size="2"
            className="reveal lg:sticky lg:top-28"
          />
        </div>
        <div className="col-span-4 mt-12 sm:col-span-8 lg:col-span-7 lg:col-start-6 lg:mt-0">
          {LEDGER.map((group) => (
            <section
              key={group.id}
              aria-labelledby={`ledger-${group.id}`}
              className="reveal ledger-group"
            >
              <h3 id={`ledger-${group.id}`} className="label">
                {group.name}
              </h3>
              <ul role="list">
                {group.rows.map((row) => (
                  <li key={row.feature} className="ledger-line">
                    <span>
                      <span className="block text-title text-text">{row.feature}</span>
                      <span className="mt-1 block max-w-[52ch] text-sm text-text-soft">
                        {row.description}
                      </span>
                    </span>
                    <LedgerWord row={row} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </Section>

      <Section labelledBy="compare-title" className="border-t border-edge">
        <h2
          id="compare-title"
          className="reveal col-span-4 font-display text-display-2 text-text [text-wrap:balance] sm:col-span-8 lg:col-span-9"
        >
          <span className="block text-text-label">{PACK_PITCH.others}</span>{" "}
          <span className="block">{PACK_PITCH.ours}</span>
        </h2>
        <table className="compare-table reveal col-span-4 mt-12 sm:col-span-8 lg:col-span-12 lg:mt-16">
          <caption className="sr-only">
            What other services give you, and what a pack gives you
          </caption>
          <thead>
            <tr>
              <th scope="col">{compare.othersLabel}</th>
              <th scope="col">{compare.oursLabel}</th>
            </tr>
          </thead>
          <tbody>
            {compare.rows.map((row) => (
              <tr key={row.ours}>
                <td>{row.others}</td>
                <td>{row.ours}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section labelledBy="payment-title" spacing="compact">
        <div className="reveal col-span-4 grid gap-12 border-t border-edge-strong pt-10 sm:col-span-8 lg:col-span-12 lg:grid-cols-2 lg:gap-6">
          <div>
            <h2 id="payment-title" className="text-title text-text">
              {PAYMENT_COPY.heading}
            </h2>
            <div className="mt-4 flex max-w-[560px] flex-col gap-3 text-base text-text-soft">
              <p>{PAYMENT_COPY.processor}</p>
              <p>{PAYMENT_COPY.noSubscription}</p>
              <p className="text-text">{SALES_FINAL_RULE}</p>
              <p>{TAX_LINE}</p>
            </div>
          </div>
          <div>
            <h2 className="text-title text-text">{NO_CHARGE_COPY.heading}</h2>
            <p className="mt-4 max-w-[560px] text-base text-text-soft">{NO_CHARGE_COPY.line}</p>
          </div>
        </div>
      </Section>

      <Section labelledBy="pricing-questions-title">
        <h2
          id="pricing-questions-title"
          className="reveal col-span-4 font-display text-display-2 text-text sm:col-span-8 lg:col-span-4"
        >
          {PRICING_QUESTIONS_HEADING}
        </h2>
        <div
          id={QUESTIONS_ID}
          className="faq reveal col-span-4 mt-10 border-b border-edge sm:col-span-8 lg:col-span-7 lg:col-start-6 lg:mt-2"
        >
          {questions.map((entry) => (
            <details
              key={entry.id}
              id={`pricing-${entry.id}`}
              data-faq={`pricing-${entry.id}`}
              className="faq-item border-t border-edge"
            >
              <summary className="faq-summary flex min-h-11 cursor-pointer list-none items-start justify-between gap-6 py-6 text-title text-text [&::-webkit-details-marker]:hidden">
                <span>{entry.question}</span>
                <span aria-hidden="true" className="faq-plus relative mt-1.5 size-4 shrink-0">
                  <span className="absolute inset-x-0 top-1/2 h-[1.25px] -translate-y-1/2 bg-current" />
                  <span className="faq-plus-stem absolute inset-y-0 left-1/2 w-[1.25px] -translate-x-1/2 bg-current" />
                </span>
              </summary>
              <p className="max-w-[60ch] pb-7 text-base text-text-80">{entry.answer}</p>
            </details>
          ))}
        </div>
        <FaqTracking target={QUESTIONS_ID} />
      </Section>

      <FinalCall />
      <JsonLd data={productJsonLd()} />
    </>
  );
}
