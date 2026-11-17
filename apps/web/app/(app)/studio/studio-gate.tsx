import { buttonStyles, cx } from "@admitstory/ui";
import Link from "next/link";
import type { CSSProperties } from "react";
import "./studio.css";
import type { NextSchool } from "@/lib/funnel/next-school";
import { FEATURED_PLAN, SCHOOL_KIT_PRICE_CENTS, SCHOOL_PLANS, dollars } from "@/lib/payments/plans";

// The halfway prompt (lib/studio/allowance.ts): an account with no school pack has used its free
// half of Story Studio. It shows what those answers became (the stories, by name), and puts the
// school they would unlock one click away: its unlock page, or its free preview with the opening
// of their own essay (16 Nov 2026; before, this page led to the schools list and showed nothing of
// theirs). The free next steps stay, so there is always somewhere to go. Server-safe (no hooks):
// the page renders it when the limit was already reached, and the screen loads it through
// ./studio-gate-live when the last free answer lands.

const PACK = SCHOOL_PLANS[FEATURED_PLAN];

/** Stories listed by name before the rest are counted. */
const STORIES_SHOWN = 6;

const FREE_STEPS = [
  {
    href: "/profile-read",
    title: "See how admissions will read you",
    body: "Your Profile Read is free, and it already has the first half of your story to work from.",
    cta: "Open your Profile Read",
  },
  {
    href: "/dossier",
    title: "Look over what you’ve told us",
    body: "Every story and fact is saved. Check them, fix them, and decide what stays private.",
    cta: "Open your Dossier",
  },
] as const;

export interface StudioGateProps {
  used: number;
  limit: number;
  /** The applicant's stories, by title. */
  stories: readonly string[];
  facts: number;
  /** The school they would unlock next, when one is on their list. */
  school: NextSchool | null;
}

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function StudioGate({ used, limit, stories, facts, school }: StudioGateProps) {
  const made =
    stories.length > 0
      ? `Your ${used} answers became ${count(stories.length, "story", "stories")}${facts > 0 ? ` and ${count(facts, "fact", "facts")}` : ""}, all saved.`
      : `That’s ${used} answers, all saved.`;
  const shown = stories.slice(0, STORIES_SHOWN);
  const more = stories.length - shown.length;
  return (
    // Night in both themes, like the Studio it stands in for (SPEC §6.4).
    <div data-theme="night" className="min-h-full">
      <section
        aria-labelledby="studio-gate-title"
        className="mx-auto flex w-full max-w-[55rem] flex-col gap-12 px-5 pt-10 pb-16 sm:px-10 sm:pt-14 lg:px-14 lg:pt-16"
      >
        <div className="flex flex-col gap-4">
          <p className="eyebrow enter" style={{ "--i": 0 } as CSSProperties}>
            Story Studio · the free half
          </p>
          <h1
            id="studio-gate-title"
            className="text-display-2 enter text-text"
            style={{ "--i": 0.8 } as CSSProperties}
          >
            You’re halfway through <span className="serif-accent">your story.</span>
          </h1>
          <p
            className="enter max-w-[60ch] text-lg text-text-80"
            style={{ "--i": 1.45 } as CSSProperties}
          >
            {made} The second half (setbacks, the people behind you, why now, why this school) is
            where an application gets specific, and it opens with your first school pack.
          </p>
        </div>

        <HalfMeter used={Math.min(used, limit)} limit={limit} />

        {shown.length > 0 ? (
          <div className="flex flex-col gap-4">
            <h2 className="eyebrow">What you’ve told so far</h2>
            <ul className="flex flex-wrap gap-2">
              {shown.map((title) => (
                <li key={title} className="chip">
                  {title}
                </li>
              ))}
              {more > 0 ? (
                <li className="flex items-center px-1 text-sm text-text-soft">{`and ${more} more`}</li>
              ) : null}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-col gap-4">
          <ol className="grid gap-4 sm:grid-cols-3">
            <li className="flex flex-col gap-3 rounded-card border border-text-faint bg-frost p-7">
              <h2 className="text-title text-text">
                {school
                  ? shown.length > 0
                    ? `Turn these into your ${school.name} essays`
                    : `Start your ${school.name} essays`
                  : "Choose the school to start with"}
              </h2>
              <p className="flex-1 text-sm text-text-soft">
                {school
                  ? `Unlock ${school.name} and every essay, short answer and form field is drafted from what you’ve said. The rest of Story Studio opens with it.`
                  : "Add a school and its pack drafts every essay, short answer and form field from what you’ve said. The rest of Story Studio opens with it."}
              </p>
              <Link
                href={school ? `/schools/${school.userSchoolId}/unlock` : "/schools"}
                className={cx(buttonStyles({ arrow: true }), "self-start")}
              >
                {school ? `Unlock ${school.name}` : "Choose a school"}
                <span aria-hidden className="btn-arrow" />
              </Link>
              {school ? (
                <Link
                  href={`/schools/${school.userSchoolId}/preview`}
                  className="text-sm text-text-80 underline decoration-1 underline-offset-4 hover:text-text"
                >
                  {`See your stories as a ${school.name} application first, free`}
                </Link>
              ) : null}
            </li>
            {FREE_STEPS.map((step) => (
              <li
                key={step.href}
                className="flex flex-col gap-3 rounded-card border border-edge bg-veil p-7"
              >
                <h2 className="text-title text-text">{step.title}</h2>
                <p className="flex-1 text-sm text-text-soft">{step.body}</p>
                <Link
                  href={step.href}
                  className={cx(buttonStyles({ variant: "secondary", size: "sm" }), "self-start")}
                >
                  {step.cta}
                </Link>
              </li>
            ))}
          </ol>
          <p className="text-sm text-text-soft">
            {`${dollars(SCHOOL_KIT_PRICE_CENTS)} for one school, or ${PACK.schools} schools for ${dollars(PACK.priceCents)}. One payment, no subscription.`}
          </p>
        </div>
      </section>
    </div>
  );
}

/** Two halves of a full Studio: the free one drawn in brass with the peak where they meet. */
function HalfMeter({ used, limit }: { used: number; limit: number }) {
  return (
    <div className="flex flex-col gap-3">
      <div
        role="img"
        aria-label={`${used} of ${limit * 2} answers in a full Story Studio`}
        className="relative h-6"
      >
        <span className="absolute inset-x-0 bottom-0 h-[1.25px] bg-[repeating-linear-gradient(90deg,var(--fg-40)_0_4px,transparent_4px_8px)]" />
        <span className="studio-half-run absolute bottom-0 left-0 h-[1.25px] w-1/2 origin-left bg-accent" />
        <svg
          aria-hidden
          viewBox="0 0 16 22"
          fill="none"
          className="studio-half-peak absolute bottom-0 left-[calc(50%-8px)] h-[22px] w-4 text-accent"
        >
          <path
            d="M0 21.5 L8 1 L16 21.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="miter"
            strokeMiterlimit="8"
          />
        </svg>
      </div>
      <div className="label flex justify-between gap-4 text-text-label">
        <span>Free · {limit} answers</span>
        <span className="text-right">With a school pack · the rest</span>
      </div>
    </div>
  );
}
