// Questions (direction §4.9). Native <details>, every row closed by default and several open at
// once; the opening height glides where interpolate-size is supported and is instant elsewhere
// (marketing.css, .faq-item). FAQPage JSON-LD is built from the same entries, so the two can't
// differ. The schools answer comes from the verified packs.

import { packSchools } from "@/lib/marketing/public-data";
import { FAQ_HEADING, faqEntries, type FaqEntry } from "../_copy/faq";
import { DisplayHeading } from "../_ui/display-heading";
import { JsonLd, type JsonLdValue } from "../_ui/json-ld";
import { Section } from "../_ui/section";
import { FaqTracking } from "./faq-tracking";

export function faqJsonLd(entries: readonly FaqEntry[]): JsonLdValue {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entries.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: { "@type": "Answer", text: entry.answer },
    })),
  };
}

const LIST_ID = "faq-list";

export async function FaqSection() {
  const schools = await packSchools();
  const entries = faqEntries(schools.map((school) => school.name));
  return (
    <Section id="questions" labelledBy="faq-title">
      <div className="col-span-4 sm:col-span-8 lg:col-span-4">
        <DisplayHeading level={2} size="md" id="faq-title" lines={[FAQ_HEADING]} />
      </div>
      <div id={LIST_ID} className="faq col-span-4 mt-10 sm:col-span-8 lg:col-span-8 lg:mt-2">
        <div className="divide-y divide-edge border-y border-edge">
          {entries.map((entry) => (
            <details key={entry.id} id={`faq-${entry.id}`} data-faq={entry.id} className="faq-item">
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
      <FaqTracking target={LIST_ID} />
      <JsonLd data={faqJsonLd(entries)} />
    </Section>
  );
}
