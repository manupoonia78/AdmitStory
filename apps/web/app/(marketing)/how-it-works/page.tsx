// /how-it-works (direction §6, plan §9.4.2): the full path, step by step, and the home of the
// AI-policy table. One hero moment, the kit assembly, from 1024 px (narrower, there are no
// threads: the stages, then the deliverables with their story names, as plain markup). The eight
// steps below are still. Keep id="ai-policies": the footer and the landing page link to it.

import { cx } from "@admitstory/ui";
import Image from "next/image";
import { verifiedPolicies } from "@/lib/marketing/public-data";
import { HOW_COPY, HOW_STEPS, type HowStep } from "../_copy/how-it-works";
import { AI_POLICY_FALLBACK, COMING_SOON, INTEGRITY_LINES, START_FREE } from "../_copy/shared";
import { SCREENS, screenAvailable } from "../_data/screens";
import { pageMetadata } from "../_lib/seo";
import { AiPolicyTable } from "../_ui/ai-policy-table";
import { CtaLink, START_FREE_HREF } from "../_ui/cta-link";
import { DisplayHeading } from "../_ui/display-heading";
import { FictionalNote } from "../_ui/notes";
import { sampleHueStyle } from "../_ui/sample-hue";
import { Section } from "../_ui/section";
import { AssemblyIsland } from "./_assembly-island";
import { KIT_DURATION_MS, finishedRows, kitStateAt } from "./_data";

export const metadata = pageMetadata({
  title: "How it works",
  description:
    "From one conversation to every school: how AdmitStory turns what you say into each school's essays, form and briefs.",
  path: "/how-it-works",
});

/** Below 1024 px: the finished kit as plain rows, no threads (Phase 3–4 direction). */
function AssemblyList() {
  const stages = kitStateAt(KIT_DURATION_MS).stages;
  const rows = finishedRows();
  return (
    <div className="flex flex-col gap-10 lg:hidden">
      <div>
        <h3 className="text-lg font-medium text-text">{HOW_COPY.stagesHeading}</h3>
        <ol role="list" className="mt-3 divide-y divide-edge border-y border-edge">
          {stages.map((stage) => (
            <li key={stage.id} className="flex items-baseline justify-between gap-4 py-3">
              <span className="text-base text-text">{stage.label}</span>
              {stage.detail ? (
                <span className="text-right text-sm text-text-soft">{stage.detail}</span>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
      <div>
        <h3 className="text-lg font-medium text-text">{HOW_COPY.deliverablesHeading}</h3>
        <ul role="list" className="mt-3 divide-y divide-edge border-y border-edge">
          {rows.map((row) => (
            <li key={row.key} className="py-4">
              <p className="font-medium text-text">
                {row.title}
                <span className="text-sm font-normal text-text-soft tabular-nums">
                  , {row.limit}
                </span>
              </p>
              <p className="mt-1 text-sm text-text-soft">
                {HOW_COPY.fromStory} “{row.story}”
              </p>
              <p className="mt-3 line-clamp-3 font-reading text-read text-text">{row.opening}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function StepCapture({ id }: { id: NonNullable<HowStep["screen"]> }) {
  if (!screenAvailable(id)) return null;
  const screen = SCREENS.find((candidate) => candidate.id === id);
  if (!screen) return null;
  return (
    <figure className="mt-8 lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1 lg:mt-0">
      <div className="plane overflow-hidden p-0">
        <Image
          src={screen.file}
          width={screen.width}
          height={screen.height}
          alt={screen.alt}
          sizes="(min-width:1024px) 420px, 92vw"
          loading="lazy"
          className="block h-auto w-full"
        />
      </div>
      <figcaption className="mt-3 text-sm text-text-soft">{screen.caption}</figcaption>
    </figure>
  );
}

function Step({ step, index }: { step: HowStep; index: number }) {
  const soon = step.value === COMING_SOON;
  const capture = step.screen && screenAvailable(step.screen);
  return (
    <li
      id={`step-${step.id}`}
      className="grid grid-cols-[3rem_1fr] gap-x-4 py-10 sm:grid-cols-[5rem_1fr] lg:grid-cols-[7rem_1fr] lg:py-14"
    >
      <span
        aria-hidden="true"
        className="text-display text-text-soft tabular-nums [line-height:1] max-sm:text-display-sm"
      >
        {index + 1}
      </span>
      <div className={cx("grid gap-y-4", capture && "lg:grid-cols-12 lg:gap-x-8")}>
        <div
          className={cx(
            "flex flex-col gap-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8",
            capture && "lg:col-span-7",
          )}
        >
          <h3 className="text-display-sm text-text">
            <span className="sr-only">Step {index + 1}: </span>
            {step.heading}
          </h3>
          <p
            className={cx(
              "shrink-0 text-base tabular-nums sm:text-right",
              soon ? "text-text" : "text-text-soft",
            )}
          >
            {soon ? (
              <span className="rounded-control border border-edge px-1.5 py-0.5 text-sm">
                {step.value}
              </span>
            ) : (
              step.value
            )}
          </p>
        </div>
        <p className={cx("max-w-[44rem] text-lg text-text-soft", capture && "lg:col-span-7")}>
          {step.body}
        </p>
        {step.screen ? <StepCapture id={step.screen} /> : null}
      </div>
    </li>
  );
}

export default async function HowItWorksPage() {
  const policies = await verifiedPolicies();
  return (
    <>
      <Section labelledBy="how-title" spacing="compact">
        <div className="col-span-4 sm:col-span-8 lg:col-span-10">
          <DisplayHeading level={1} size="xl" id="how-title" lines={HOW_COPY.heading} />
        </div>
      </Section>

      <Section labelledBy="assembly-title" spacing="compact">
        <h2 id="assembly-title" className="sr-only">
          {HOW_COPY.assemblyLabel}
        </h2>
        <figure
          aria-labelledby="assembly-title"
          className="col-span-4 sm:col-span-8 lg:col-span-12"
          style={sampleHueStyle()}
        >
          <AssemblyIsland
            islandClassName="hidden lg:block"
            deliverablesHeading={HOW_COPY.deliverablesHeading}
            playAgain={HOW_COPY.playAgain}
          />
          <AssemblyList />
          <figcaption>
            <FictionalNote className="mt-4" />
          </figcaption>
        </figure>
      </Section>

      <Section labelledBy="steps-title">
        <div className="col-span-4 sm:col-span-8 lg:col-span-8">
          <DisplayHeading level={2} size="md" id="steps-title" lines={[HOW_COPY.stepsHeading]} />
        </div>
        <ol
          role="list"
          className="col-span-4 mt-12 divide-y divide-edge border-y border-edge sm:col-span-8 lg:col-span-12 lg:mt-16"
        >
          {HOW_STEPS.map((step, index) => (
            <Step key={step.id} step={step} index={index} />
          ))}
        </ol>
      </Section>

      <Section id="ai-policies" labelledBy="ai-policies-title" spacing="compact">
        <div className="col-span-4 sm:col-span-8 lg:col-span-10">
          <h2 id="ai-policies-title" className="text-display-sm text-text">
            {HOW_COPY.policiesHeading}
          </h2>
          {policies.length === 0 ? (
            <p className="mt-4 text-lg text-text-soft">{AI_POLICY_FALLBACK}</p>
          ) : (
            <>
              <p className="mt-4 max-w-[44rem] text-lg text-text-soft">{HOW_COPY.policiesLine}</p>
              <AiPolicyTable rows={policies} variant="full" className="mt-8" />
            </>
          )}
        </div>
      </Section>

      <Section labelledBy="close-title" theme="night" className="border-t border-edge">
        <div className="col-span-4 sm:col-span-8 lg:col-span-8">
          <DisplayHeading level={2} size="md" id="close-title" lines={[HOW_COPY.closeHeading]} />
          <ul role="list" className="mt-10 flex flex-col gap-4">
            {INTEGRITY_LINES.map((line) => (
              <li key={line} className="max-w-[46rem] font-reading text-read text-text">
                {line}
              </li>
            ))}
          </ul>
          <CtaLink href={START_FREE_HREF} track="how-it-works-page" className="mt-12">
            {START_FREE}
          </CtaLink>
        </div>
      </Section>
    </>
  );
}
