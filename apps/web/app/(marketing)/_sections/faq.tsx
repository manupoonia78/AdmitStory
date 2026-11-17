// Scene 11 (SPEC §4): questions. Native <details>, every row closed by default and several open at
// once; the opening height glides where interpolate-size is supported and is instant elsewhere
// (marketing.css, .faq-item). FAQPage JSON-LD is built from the same entries, so the two can't
// differ. The schools answer comes from the verified packs.

import { packSchools } from "@/lib/marketing/public-data";
import { HELLO_EMAIL } from "../_copy/chrome";
import { FAQ_HEADING, FAQ_MORE, faqEntries, type FaqEntry } from "../_copy/faq";
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
      <div className="reveal col-span-4 sm:col-span-8 lg:col-span-4">
        <h2 id="faq-title" className="font-display text-display-1 text-text">
          {FAQ_HEADING}
        </h2>
        <p className="mt-6 max-w-[280px] text-base text-text-soft">
          {FAQ_MORE}{" "}
          <a
            href={`mailto:${HELLO_EMAIL}`}
            className="text-text underline-offset-4 hover:underline"
          >
            {HELLO_EMAIL}
          </a>
        </p>
      </div>
      <div
        id={LIST_ID}
        className="faq reveal col-span-4 mt-10 border-b border-edge sm:col-span-8 lg:col-span-7 lg:col-start-6 lg:mt-3"
      >
        {entries.map((entry) => (
          <details
            key={entry.id}
            id={`faq-${entry.id}`}
            data-faq={entry.id}
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
      <FaqTracking target={LIST_ID} />
      <JsonLd data={faqJsonLd(entries)} />
    </Section>
  );
}
