// The brief as the recommender reads it (Phase 6 plan §8, spec §5.11, §6.7): one paper column,
// the questions verbatim, the talking points as facts to jog a memory. It renders the sections
// `briefSections(brief, meta, "recommender")` returns, so screen H, the PDF and this page can
// never drift apart.
//
// A server component with no state and no Motion: nothing here reaches the browser. There is no
// field for letter prose anywhere in a brief, and none is rendered.

import type { BriefSection } from "@admitstory/shared/kit";
import { cx } from "../lib/cx";
import { portalDay } from "./portal-text";

/**
 * The parts every group repeats (the applicant's note, the own-words reminder, what admissions
 * look for) and the parts that belong to one group. With two groups the intro is shown once.
 */
export function splitBriefSections(sections: readonly BriefSection[]): {
  intro: BriefSection[];
  body: BriefSection[];
} {
  const introKinds = new Set(["note", "reminder", "explainer"]);
  return {
    intro: sections.filter((section) => introKinds.has(section.kind)),
    body: sections.filter((section) => !introKinds.has(section.kind)),
  };
}

const headingClass = "text-lg font-semibold text-text";

function Section({
  heading,
  children,
  className,
}: {
  heading: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("flex flex-col gap-3", className)}>
      <h3 className={headingClass}>{heading}</h3>
      {children}
    </section>
  );
}

function SchoolSection({ section }: { section: Extract<BriefSection, { kind: "school" }> }) {
  const day = portalDay(section.deadline);
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-display-sm text-text">{section.heading}</h3>
        {day ? (
          <p className="text-sm tabular-nums text-text-soft">Due {day}</p>
        ) : (
          <p className="text-sm text-text-soft">The school hasn&rsquo;t published a date yet.</p>
        )}
        <p className="text-sm text-text-soft">{section.howToSubmit}</p>
      </div>
      {section.packNotes.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm text-text-soft">
          {section.packNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
      <ol className="flex flex-col gap-6">
        {section.questions.map((question, index) => (
          <li key={question.id} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <p className="text-sm text-text-soft">Question {index + 1}</p>
              <p className="font-reading text-read text-text">{question.text}</p>
              {question.limit ? (
                <p className="text-sm tabular-nums text-text-soft">{question.limit}</p>
              ) : null}
            </div>
            {question.points.length > 0 ? (
              <ul className="flex flex-col gap-3 border-l border-edge pl-4">
                {question.points.map((point) => (
                  <li key={`${point.point}-${point.trait}`} className="flex flex-col gap-0.5">
                    <p className="text-base text-text">{point.point}</p>
                    {point.evidence ? (
                      <p className="text-sm tabular-nums text-text-soft">{point.evidence}</p>
                    ) : null}
                    {point.trait ? <p className="text-sm text-text-soft">{point.trait}</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-soft">
                No notes from the applicant for this question. Write from what you saw.
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function OneSection({ section }: { section: BriefSection }) {
  switch (section.kind) {
    case "note":
      return (
        <section className="flex flex-col gap-2">
          <h3 className={headingClass}>{section.heading}</h3>
          <p className="font-reading text-read-lg whitespace-pre-line text-text">{section.text}</p>
        </section>
      );
    case "reminder":
      return (
        <section className="flex flex-col gap-1 border-l-2 border-edge pl-4">
          <h3 className="text-base font-semibold text-text">{section.heading}</h3>
          <p className="text-base text-text-soft">{section.text}</p>
        </section>
      );
    case "explainer":
      return (
        <Section heading={section.heading}>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-base text-text-soft">
            {section.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </Section>
      );
    case "school":
      return <SchoolSection section={section} />;
    case "traits":
      return (
        <Section heading={section.heading}>
          <ul className="flex flex-col gap-2">
            {section.items.map((item) => (
              <li key={item.trait} className="flex flex-col gap-0.5">
                <span className="text-base text-text">{item.trait}</span>
                <span className="text-sm text-text-soft">{item.why}</span>
              </li>
            ))}
          </ul>
        </Section>
      );
    case "covers":
      return (
        <Section heading={section.heading}>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-base text-text-soft">
            {section.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Section>
      );
    case "arc":
      return (
        <Section heading={section.heading}>
          <dl className="flex flex-col gap-3">
            {section.steps.map((step) => (
              <div key={step.label} className="flex flex-col gap-0.5">
                <dt className="text-sm text-text-soft">{step.label}</dt>
                <dd className="text-base text-text">{step.text}</dd>
              </div>
            ))}
          </dl>
        </Section>
      );
    case "facts":
      return (
        <Section heading={section.heading}>
          <ul className="flex flex-col gap-1.5 text-base tabular-nums text-text">
            {section.items.map((item) => (
              <li key={item.text}>{item.text}</li>
            ))}
          </ul>
        </Section>
      );
    case "timeline":
      return (
        <Section heading={section.heading}>
          <ul className="flex flex-col gap-1.5">
            {section.items.map((item) => (
              <li key={`${item.date}-${item.text}`} className="flex flex-wrap gap-x-3 text-base">
                <span className="tabular-nums text-text-soft">{portalDay(item.date)}</span>
                <span className="text-text">{item.text}</span>
              </li>
            ))}
          </ul>
        </Section>
      );
    default:
      return null;
  }
}

export interface BriefReadingProps {
  sections: readonly BriefSection[];
  className?: string;
}

/** The brief's sections in order, as plain reading matter. */
export function BriefReading({ sections, className }: BriefReadingProps) {
  if (sections.length === 0) return null;
  return (
    <div className={cx("flex flex-col gap-8", className)}>
      {sections.map((section, index) => (
        <OneSection key={`${section.kind}-${index}-${section.heading}`} section={section} />
      ))}
    </div>
  );
}
