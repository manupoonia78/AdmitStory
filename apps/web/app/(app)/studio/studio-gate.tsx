import { buttonStyles, cx } from "@admitstory/ui";
import Link from "next/link";
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
    <section
      aria-labelledby="studio-gate-title"
      className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-5 py-12 sm:px-10 sm:py-16"
    >
      <div className="flex flex-col gap-4">
        <p className="eyebrow">Story Studio · the free half</p>
        <h1 id="studio-gate-title" className="text-display text-text">
          You’re halfway through <em className="text-accent">your story.</em>
        </h1>
        <p className="max-w-2xl text-lg text-text-soft">
          {made} The second half (setbacks, the people behind you, why now, why this school) is
          where an application gets specific, and it opens with your first school pack.
        </p>
      </div>

      <HalfMeter used={Math.min(used, limit)} limit={limit} />

      {shown.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h2 className="eyebrow">What you’ve told so far</h2>
          <ul className="flex flex-wrap gap-2">
            {shown.map((title) => (
              <li
                key={title}
                className="rounded-full border border-edge bg-depth px-3.5 py-1.5 font-reading text-text"
              >
                {title}
              </li>
            ))}
            {more > 0 ? (
              <li className="px-1 py-1.5 text-sm text-text-soft">{`and ${more} more`}</li>
            ) : null}
          </ul>
        </div>
      ) : null}

      <div className="plane flex flex-col gap-4 p-6 ring-1 ring-accent/40 sm:p-8">
        <h2 className="font-display text-[1.75rem] leading-tight tracking-[-0.015em] text-text">
          {school
            ? shown.length > 0
              ? `Turn these into your ${school.name} essays`
              : `Start your ${school.name} essays`
            : "Choose the school to start with"}
        </h2>
        <p className="max-w-2xl text-text-soft">
          {school
            ? `Unlock ${school.name} and every essay, short answer and form field is drafted from what you’ve said. The rest of Story Studio opens with it.`
            : "Add a school and its pack drafts every essay, short answer and form field from what you’ve said. The rest of Story Studio opens with it."}
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <Link
            href={school ? `/schools/${school.userSchoolId}/unlock` : "/schools"}
            className={buttonStyles({ variant: "primary" })}
          >
            {school ? `Unlock ${school.name}` : "Choose a school"}
          </Link>
          {school ? (
            <Link
              href={`/schools/${school.userSchoolId}/preview`}
              className="text-text underline underline-offset-4 hover:text-accent"
            >
              {`See your stories as a ${school.name} application first, free`}
            </Link>
          ) : null}
        </div>
        <p className="text-sm text-text-soft">
          {`${dollars(SCHOOL_KIT_PRICE_CENTS)} for one school, or ${PACK.schools} schools for ${dollars(PACK.priceCents)}. One payment, no subscription.`}
        </p>
      </div>

      <ol className="grid gap-4 sm:grid-cols-2">
        {FREE_STEPS.map((step) => (
          <li key={step.href} className="plane flex flex-col gap-3 p-6">
            <h2 className="font-display text-[1.375rem] leading-tight tracking-[-0.01em] text-text">
              {step.title}
            </h2>
            <p className="flex-1 text-text-soft">{step.body}</p>
            <Link href={step.href} className={cx(buttonStyles({ variant: "quiet" }), "self-start")}>
              {step.cta}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Two halves of a full Studio: the free one filled, the paid one waiting. */
function HalfMeter({ used, limit }: { used: number; limit: number }) {
  return (
    <div className="flex flex-col gap-2">
      <div
        role="img"
        aria-label={`${used} of ${limit * 2} answers in a full Story Studio`}
        className="grid grid-cols-2 gap-1.5"
      >
        <span className="h-1.5 rounded-full bg-accent" />
        <span className="h-1.5 rounded-full border border-dashed border-control-edge" />
      </div>
      <div className="meta flex justify-between">
        <span>Free · {limit} answers</span>
        <span>With a school pack · the rest</span>
      </div>
    </div>
  );
}
