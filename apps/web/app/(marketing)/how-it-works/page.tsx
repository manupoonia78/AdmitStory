// /how-it-works (SPEC §4.2): the landing page's four steps, told in full. The head, an index of
// the four stages, then a band for each stage with its two detailed steps and the same product
// window the landing page uses (static here, not pinned). Inside the Draft stage, the page's one
// moment: the sample pack assembling (./_pack-map). Then interview practice (coming soon), what
// it won't do, each school's AI policy on paper, and the final call. Keep id="ai-policies": the
// footer and the landing page link to it.

import { cx } from "@admitstory/ui";
import { verifiedPolicies } from "@/lib/marketing/public-data";
import { HOW_PAGE_COPY, HOW_STAGES, type HowStage } from "../_copy/how-it-works";
import { HOW_COPY } from "../_copy/landing";
import { AI_POLICY_FALLBACK, COMING_SOON } from "../_copy/shared";
import { pageMetadata } from "../_lib/seo";
import { FinalCall } from "../_sections/final-call";
import { HOW_WINDOWS } from "../_sections/how-windows";
import { WontDoSection } from "../_sections/wont-do";
import { AiPolicyTable } from "../_ui/ai-policy-table";
import { PageHead } from "../_ui/page-head";
import { SceneHead } from "../_ui/scene-head";
import { SECTION_GRID, Section } from "../_ui/section";
import { PackMap } from "./_pack-map";

export const metadata = pageMetadata({
  title: "How it works",
  description:
    "From one conversation to every school: how AdmitStories turns what you say into each school's essays, form and briefs, and what it won't do.",
  path: "/how-it-works",
});

function StageIndex() {
  return (
    <nav aria-label={HOW_PAGE_COPY.indexLabel} className={cx(SECTION_GRID, "mt-12 lg:mt-18")}>
      <ol role="list" className="how-index col-span-4 sm:col-span-8 lg:col-span-12">
        {HOW_STAGES.map((stage, index) => (
          <li key={stage.id}>
            <a href={`#${stage.id}`}>
              <span className="label">
                {String(index + 1).padStart(2, "0")} ·{" "}
                <span className="how-index-verb">{stage.verb}</span>
              </span>
              <span className="text-sm text-text-80">{stage.cost}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function Stage({ stage, index }: { stage: HowStage; index: number }) {
  const Window = HOW_WINDOWS[index];
  const landing = HOW_COPY.steps[index];
  return (
    <section id={stage.id} aria-labelledby={`${stage.id}-title`} className="how-stage">
      <div className={cx(SECTION_GRID, "gap-y-10")}>
        <div className="reveal col-span-4 sm:col-span-8 lg:col-span-5">
          <p className="label">
            {String(index + 1).padStart(2, "0")} · {stage.verb}
          </p>
          <h2 id={`${stage.id}-title`} className="mt-5 font-display text-display-2 text-text">
            {landing?.title}
          </h2>
          <p className="soon-pill label mt-5">{stage.pill}</p>
          <ul role="list" className="mt-10 border-b border-edge">
            {stage.details.map((detail) => (
              <li key={detail.heading} className="border-t border-edge py-6">
                <p className="flex items-baseline justify-between gap-6">
                  <span className="text-title text-text">{detail.heading}</span>
                  <span className="label shrink-0">{detail.value}</span>
                </p>
                <p className="mt-2 max-w-[440px] text-base text-text-soft">{detail.body}</p>
              </li>
            ))}
          </ul>
        </div>
        <figure className="reveal how-stage-window col-span-4 sm:col-span-8 lg:col-span-6 lg:col-start-7">
          <div aria-hidden="true">{Window ? <Window /> : null}</div>
          <figcaption className="sr-only">{landing?.caption}</figcaption>
        </figure>
      </div>
      {stage.id === "draft" ? (
        <div className={cx(SECTION_GRID, "mt-18 lg:mt-24")}>
          <div className="col-span-4 sm:col-span-8 lg:col-span-12">
            <PackMap />
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default async function HowItWorksPage() {
  const policies = await verifiedPolicies();
  const copy = HOW_PAGE_COPY.policies;
  return (
    <>
      <PageHead
        id="how-title"
        eyebrow={HOW_PAGE_COPY.eyebrow}
        lines={HOW_PAGE_COPY.headingLines}
        paragraph={HOW_PAGE_COPY.paragraph}
      />
      <StageIndex />

      {HOW_STAGES.map((stage, index) => (
        <Stage key={stage.id} stage={stage} index={index} />
      ))}

      <section aria-labelledby="interview-row-title" className={cx(SECTION_GRID, "pb-6")}>
        <div className="reveal how-interview col-span-4 sm:col-span-8 lg:col-span-12">
          <p className="soon-pill label">{COMING_SOON}</p>
          <h2 id="interview-row-title" className="text-title text-text">
            {HOW_PAGE_COPY.interviewHeading}
          </h2>
          <p className="max-w-[560px] text-base text-text-soft">{HOW_PAGE_COPY.interviewLine}</p>
        </div>
      </section>

      <WontDoSection />

      <Section
        id="ai-policies"
        labelledBy="ai-policies-title"
        theme="paper"
        className="rounded-frame"
      >
        <SceneHead
          id="ai-policies-title"
          eyebrow={copy.eyebrow}
          lines={copy.headingLines}
          size="2"
          className="reveal col-span-4 sm:col-span-8 lg:col-span-7"
        />
        <p className="reveal col-span-4 mt-6 text-lg text-text-soft sm:col-span-6 lg:col-span-4 lg:col-start-9 lg:mt-auto">
          {copy.paragraph}
        </p>
        <div className="reveal policy-sheet col-span-4 mt-12 sm:col-span-8 lg:col-span-12 lg:mt-16">
          {policies.length === 0 ? (
            <p className="policy-fallback">{AI_POLICY_FALLBACK}</p>
          ) : (
            <AiPolicyTable rows={policies} />
          )}
        </div>
      </Section>

      <FinalCall />
    </>
  );
}
