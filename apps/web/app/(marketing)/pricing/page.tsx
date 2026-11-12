// /pricing (direction §5, plan §9.4.1): what exactly $100 buys, and what stays free. One hero
// moment, the kit that opens; everything below it is still. No checkout here: purchases start in the
// app from a school's kit preview, where the school and cycle are known.

import { FileMapList, PositioningBlock } from "@admitstory/ui";
import {
  LEDGER,
  LEDGER_COPY,
  NO_CHARGE_COPY,
  PRICING_PAGE_COPY,
  PAYMENT_COPY,
  PRICING_QUESTIONS_HEADING,
  pricingQuestions,
  type LedgerCell,
  type LedgerGroup,
} from "../_copy/pricing-page";
import { START_FREE } from "../_copy/shared";
import {
  CURRENCY,
  FREE_PRICE_USD,
  KIT_PLAN,
  KIT_PRICE_USD,
  PLAN_CARDS,
  SALES_FINAL_RULE,
  TAX_LINE,
} from "../_data/pricing";
import { SchoolPacks } from "../_sections/school-packs";
import { FaqTracking } from "../_sections/faq-tracking";
import { pageMetadata } from "../_lib/seo";
import { CtaLink, START_FREE_HREF } from "../_ui/cta-link";
import { DisplayHeading } from "../_ui/display-heading";
import { JsonLd, type JsonLdValue } from "../_ui/json-ld";
import { FictionalNote } from "../_ui/notes";
import { sampleHueStyle } from "../_ui/sample-hue";
import { Section } from "../_ui/section";
import { absoluteUrl } from "@/lib/marketing/site-url";
import { APP_NAME } from "@admitstory/shared/brand";
import { DELIVERABLES, FILE_MAP, POSITIONING } from "./_data";
import { UnlockPreviewIsland } from "./_unlock-island";

export const metadata = pageMetadata({
  title: "Pricing",
  description:
    "AdmitStories is free to talk to. Five schools for $349 or ten for $699, with every essay drafted from your own words, not just guidelines. Or $100 for one school.",
  path: "/pricing",
});

/** Product JSON-LD (direction §9): free, $100 per school, and the 5- and 10-school packs. */
function productJsonLd(): JsonLdValue {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: APP_NAME,
    description: PRICING_PAGE_COPY.subline,
    url: absoluteUrl("/pricing"),
    offers: [
      {
        "@type": "Offer",
        name: "Free",
        price: FREE_PRICE_USD,
        priceCurrency: CURRENCY,
      },
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

function cellWords(cell: LedgerCell): string {
  if (cell === "included") return LEDGER_COPY.included;
  if (cell === "coming_soon") return LEDGER_COPY.comingSoon;
  return LEDGER_COPY.notIncluded;
}

/** Phones: one word per row, where it first becomes available. */
function phoneWord(row: { free: LedgerCell; kit: LedgerCell }): string {
  if (row.free === "included") return LEDGER_COPY.phoneFree;
  if (row.kit === "coming_soon") return LEDGER_COPY.comingSoon;
  return LEDGER_COPY.phoneKit;
}

function Cell({ cell }: { cell: LedgerCell }) {
  return (
    <td
      className={
        cell === "included"
          ? "py-4 pr-4 align-top text-base text-text"
          : "py-4 pr-4 align-top text-base text-text-soft"
      }
    >
      {cell === "none" ? (
        <>
          <span aria-hidden="true">{LEDGER_COPY.notIncluded}</span>
          <span className="sr-only">Not included</span>
        </>
      ) : (
        cellWords(cell)
      )}
    </td>
  );
}

function LedgerTable({ groups }: { groups: readonly LedgerGroup[] }) {
  return (
    <table className="hidden w-full border-collapse text-left sm:table">
      <caption className="sr-only">{LEDGER_COPY.caption}</caption>
      <colgroup>
        <col />
        <col className="w-36 lg:w-48" />
        <col className="w-36 lg:w-48" />
      </colgroup>
      <thead>
        <tr className="border-b border-edge text-sm text-text-soft">
          <th scope="col" className="py-3 pr-4 font-normal">
            {LEDGER_COPY.feature}
          </th>
          <th scope="col" className="py-3 pr-4 font-normal">
            {LEDGER_COPY.free}
          </th>
          <th scope="col" className="py-3 pr-4 font-normal">
            {LEDGER_COPY.kit}
          </th>
        </tr>
      </thead>
      {groups.map((group) => (
        <tbody key={group.id} className="border-b border-edge">
          <tr>
            <th
              scope="rowgroup"
              colSpan={3}
              className="pt-10 pb-2 text-sm font-medium text-text-soft"
            >
              {group.name}
            </th>
          </tr>
          {group.rows.map((row) => (
            <tr key={row.feature} className="border-t border-edge">
              <th scope="row" className="py-4 pr-8 align-top font-normal">
                <span className="block text-lg text-text">{row.feature}</span>
                <span className="mt-1 block max-w-[52ch] text-sm text-text-soft">
                  {row.description}
                </span>
              </th>
              <Cell cell={row.free} />
              <Cell cell={row.kit} />
            </tr>
          ))}
        </tbody>
      ))}
    </table>
  );
}

function LedgerStack({ groups }: { groups: readonly LedgerGroup[] }) {
  return (
    <div className="sm:hidden">
      {groups.map((group) => (
        <section key={group.id} aria-labelledby={`ledger-${group.id}`} className="mt-10 first:mt-0">
          <h3 id={`ledger-${group.id}`} className="text-sm font-medium text-text-soft">
            {group.name}
          </h3>
          <ul role="list" className="mt-2 divide-y divide-edge border-y border-edge">
            {group.rows.map((row) => (
              <li key={row.feature} className="flex items-start justify-between gap-4 py-4">
                <span>
                  <span className="block text-lg text-text">{row.feature}</span>
                  <span className="mt-1 block text-sm text-text-soft">{row.description}</span>
                </span>
                <span className="shrink-0 pt-0.5 text-base text-text">{phoneWord(row)}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

const QUESTIONS_ID = "pricing-questions";

export default function PricingPage() {
  const questions = pricingQuestions();
  return (
    <>
      <Section labelledBy="pricing-page-title" spacing="compact">
        <div className="col-span-4 sm:col-span-8 lg:col-span-10">
          <DisplayHeading
            level={1}
            size="xl"
            id="pricing-page-title"
            lines={[PRICING_PAGE_COPY.heading]}
            phoneLines={PRICING_PAGE_COPY.phoneHeading}
          />
          <p className="mt-8 max-w-[40rem] font-reading text-read-lg text-text-soft">
            {PRICING_PAGE_COPY.subline}
          </p>
          <CtaLink href={START_FREE_HREF} track="pricing-page" className="mt-10">
            {START_FREE}
          </CtaLink>
        </div>
      </Section>

      <Section labelledBy="packs-title" spacing="compact">
        <SchoolPacks headingId="packs-title" />
      </Section>

      <Section labelledBy="kit-preview-title" spacing="compact">
        <h2 id="kit-preview-title" className="sr-only">
          {PRICING_PAGE_COPY.kitLabel}
        </h2>
        <figure
          className="col-span-4 sm:col-span-8 lg:col-span-12"
          aria-labelledby="kit-preview-title"
          style={sampleHueStyle()}
        >
          <div className="plane grid gap-12 p-6 sm:p-10 lg:grid-cols-12 lg:gap-8 lg:p-14">
            <div className="flex flex-col gap-10 lg:col-span-5">
              <div>
                <h3 className="text-lg font-medium text-text">
                  {PRICING_PAGE_COPY.positioningHeading}
                </h3>
                <PositioningBlock
                  headline={POSITIONING.headline}
                  support={POSITIONING.support}
                  className="mt-4"
                />
              </div>
              <div>
                <h3 className="text-lg font-medium text-text">
                  {PRICING_PAGE_COPY.fileMapHeading}
                </h3>
                <FileMapList entries={FILE_MAP} className="mt-4" />
              </div>
            </div>
            <div className="lg:col-span-7 lg:border-l lg:border-edge lg:pl-8">
              <UnlockPreviewIsland
                deliverables={DELIVERABLES}
                heading={PRICING_PAGE_COPY.deliverablesHeading}
                switchLabel={PRICING_PAGE_COPY.unlockSwitch}
                lockedWord={PRICING_PAGE_COPY.locked}
              />
            </div>
          </div>
          <figcaption>
            <FictionalNote className="mt-4" />
          </figcaption>
        </figure>
      </Section>

      <Section labelledBy="ledger-title">
        <div className="col-span-4 sm:col-span-8 lg:col-span-8">
          <DisplayHeading level={2} size="md" id="ledger-title" lines={[LEDGER_COPY.heading]} />
        </div>
        <div className="col-span-4 mt-12 sm:col-span-8 lg:col-span-12 lg:mt-16">
          <LedgerTable groups={LEDGER} />
          <LedgerStack groups={LEDGER} />
        </div>
      </Section>

      <Section labelledBy="payment-title" spacing="compact">
        <div className="col-span-4 sm:col-span-4 lg:col-span-6">
          <h2 id="payment-title" className="text-display-sm text-text">
            {PAYMENT_COPY.heading}
          </h2>
          <div className="mt-6 flex max-w-[40rem] flex-col gap-4 text-lg text-text-soft">
            <p>{PAYMENT_COPY.processor}</p>
            <p>{PAYMENT_COPY.noSubscription}</p>
            <p className="text-text">{SALES_FINAL_RULE}</p>
            <p className="text-base">{TAX_LINE}</p>
          </div>
        </div>
        <div className="col-span-4 mt-14 sm:col-span-4 sm:mt-0 lg:col-span-5 lg:col-start-8">
          <h2 className="text-display-sm text-text">{NO_CHARGE_COPY.heading}</h2>
          <p className="mt-6 max-w-[40rem] text-lg text-text-soft">{NO_CHARGE_COPY.line}</p>
        </div>
      </Section>

      <Section labelledBy="pricing-questions-title">
        <div className="col-span-4 sm:col-span-8 lg:col-span-4">
          <DisplayHeading
            level={2}
            size="md"
            id="pricing-questions-title"
            lines={[PRICING_QUESTIONS_HEADING]}
          />
        </div>
        <div id={QUESTIONS_ID} className="faq col-span-4 mt-10 sm:col-span-8 lg:col-span-8 lg:mt-2">
          <div className="divide-y divide-edge border-y border-edge">
            {questions.map((entry) => (
              <details
                key={entry.id}
                id={`pricing-${entry.id}`}
                data-faq={`pricing-${entry.id}`}
                className="faq-item"
              >
                <summary className="faq-summary flex min-h-11 cursor-pointer list-none items-start justify-between gap-6 py-6 text-read-lg font-medium text-text [&::-webkit-details-marker]:hidden">
                  <span>{entry.question}</span>
                  <span aria-hidden="true" className="faq-plus relative mt-2 size-4 shrink-0">
                    <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-current" />
                    <span className="faq-plus-stem absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-current" />
                  </span>
                </summary>
                <p className="max-w-[62ch] pb-8 text-lg leading-[26px] text-text-soft">
                  {entry.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
        <div className="col-span-4 mt-14 sm:col-span-8 lg:col-span-12">
          <CtaLink href={START_FREE_HREF} track="pricing-page">
            {START_FREE}
          </CtaLink>
        </div>
        <FaqTracking target={QUESTIONS_ID} />
      </Section>

      <JsonLd data={productJsonLd()} />
    </>
  );
}
