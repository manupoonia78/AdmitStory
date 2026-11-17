import { getDb } from "@admitstory/db";
import { buttonStyles, cx } from "@admitstory/ui";
import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { ModelSealMark } from "@/components/model-seal";
import { requireOnboardedUser } from "@/lib/app-user";
import { STORIES_BEFORE_READ, nextStep } from "@/lib/home/next-step";
import { loadHomeFacts } from "@/lib/home/server";
import { MODEL_CORPUS, MODEL_COPY, SEAL_LABEL } from "@/lib/model-claims";
import { recommenderSummary } from "@/lib/recommenders/summary";
import { shortDate } from "@/lib/strategy/pack";
import "./home.css";

export const metadata: Metadata = { title: "Home" };

const STATUS_WORDS: Record<string, string> = {
  considering: "Considering",
  preview: "Previewed",
  unlocked: "Unlocked",
  submitted: "Submitted",
  interview: "Interview",
  admitted: "Admitted",
  waitlisted: "Waitlisted",
  denied: "Not admitted",
  withdrawn: "Withdrawn",
};

const enter = (i: number) => ({ "--i": i }) as CSSProperties;

/**
 * Home (SPEC §6.3): the single most useful next step, the path as one line with the peak on where
 * the applicant is, then their schools on hairlines with the next deadline. Server-rendered; the
 * path's moment is CSS (home.css).
 *
 * One step outranks the journey's order: asking a recommender (§5.11). It is the only step with a
 * date of its own (about seven weeks before a deadline) and it is somebody else's time, so when
 * that date is within a week and no invitation has gone, it becomes the headline.
 */
export default async function HomePage() {
  const { session } = await requireOnboardedUser();
  const userId = session.user.id;
  const [facts, recommenders] = await Promise.all([
    loadHomeFacts(userId),
    recommenderSummary(getDb(), userId),
  ]);
  const ask = recommenders.next?.due ? recommenders.next : null;
  const step = ask
    ? { title: ask.text, action: "Open their page", href: ask.href }
    : nextStep(facts);
  const lineFor = (userSchoolId: string) =>
    recommenders.schools.find((school) => school.userSchoolId === userSchoolId)?.label ?? null;
  const firstName = session.user.name.trim().split(/\s+/)[0] ?? "";
  const kitsReady = facts.schools.filter((s) => s.kit?.status === "ready").length;
  const journey = [
    {
      title: "Tell your stories",
      detail: facts.stories === 1 ? "1 story told" : `${facts.stories} stories told`,
      done: facts.stories >= STORIES_BEFORE_READ,
      href: "/studio",
    },
    {
      title: "Read your Profile Read",
      detail: facts.hasProfileRead ? "Ready to read" : "After two stories",
      done: facts.hasProfileRead,
      href: "/profile-read",
    },
    {
      title: "Choose your schools",
      detail:
        facts.schools.length === 1
          ? "1 school on your list"
          : `${facts.schools.length} schools on your list`,
      done: facts.schools.length > 0,
      href: "/schools",
    },
    {
      title: "Draft each application",
      detail: kitsReady === 1 ? "1 kit ready" : `${kitsReady} kits ready`,
      done: kitsReady > 0,
      href: "/schools",
    },
  ];
  const firstOpen = journey.findIndex((stage) => !stage.done);
  const at = firstOpen === -1 ? journey.length : firstOpen;
  const allDone = at === journey.length;

  return (
    <div className="mx-auto flex w-full max-w-[55rem] flex-col px-5 pt-8 pb-16 sm:px-10 sm:pt-12 lg:px-14 lg:pt-16">
      <header className="flex flex-col gap-3">
        <p className="eyebrow enter" style={enter(0)}>
          Your application
        </p>
        <h1 className="text-display-2 enter text-text" style={enter(0.8)}>
          Welcome back{firstName ? "," : "."}
          {firstName ? (
            <>
              {" "}
              <span className="serif-accent text-text-soft">{firstName}</span>.
            </>
          ) : null}
        </h1>
      </header>

      <section
        aria-labelledby="next-step"
        className="card enter mt-12 flex flex-col gap-7 p-7 sm:flex-row sm:items-end sm:justify-between sm:gap-10 sm:p-10"
        style={enter(1.45)}
      >
        <div className="flex max-w-[30ch] flex-col gap-3">
          <p className="label text-text-label">Next step</p>
          <h2 id="next-step" className="text-display-3 text-text">
            {step.title}
          </h2>
        </div>
        <Link
          href={step.href}
          className={cx(buttonStyles({ arrow: true }), "shrink-0 self-start sm:self-auto")}
        >
          {step.action}
          <span aria-hidden className="btn-arrow" />
        </Link>
      </section>

      <section aria-labelledby="journey" className="mt-16 flex flex-col gap-6">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="journey" className="eyebrow">
            The path
          </h2>
          <p className="label text-text-label">
            {allDone ? "All four done" : `Stage ${at + 1} of ${journey.length}`}
          </p>
        </div>
        <div
          className="path"
          data-all={allDone ? "" : undefined}
          style={{ "--path-at": at } as CSSProperties}
        >
          <span aria-hidden className="path-track" />
          <span aria-hidden className="path-run" />
          <svg aria-hidden className="path-peak" viewBox="0 0 20 28" fill="none">
            <path
              d="M0 27.5 L10 1 L20 27.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="miter"
              strokeMiterlimit="8"
            />
          </svg>
          <ol className="path-steps">
            {journey.map((stage, index) => (
              <li key={stage.title} className="flex">
                <Link
                  href={stage.href}
                  className="path-step w-full"
                  data-done={stage.done ? "" : undefined}
                  aria-current={index === at ? "step" : undefined}
                >
                  <span aria-hidden className="path-tick" />
                  <span className="label text-text-label">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="path-step-title text-[14px] leading-5 font-medium">
                    {stage.title}
                  </span>
                  <span className="text-sm text-text-soft">
                    {stage.detail}
                    {stage.done ? <span className="sr-only"> (done)</span> : null}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="your-schools" className="mt-16 flex flex-col gap-4">
        <h2 id="your-schools" className="eyebrow">
          Your schools
        </h2>
        {facts.schools.length > 0 ? (
          <ul>
            {facts.schools.map((s) => {
              const href = s.kit
                ? `/schools/${s.userSchoolId}`
                : `/schools/${s.userSchoolId}/preview`;
              const line = lineFor(s.userSchoolId);
              return (
                <li key={s.userSchoolId} className="home-school">
                  <Link
                    href={href}
                    className="text-title min-w-0 [overflow-wrap:anywhere] text-text hover:underline hover:decoration-1 hover:underline-offset-4"
                  >
                    {s.name}
                  </Link>
                  <div className="home-school-state flex min-w-0 flex-col gap-1 text-sm text-text-soft">
                    <span>
                      {s.kit
                        ? s.kit.status === "ready"
                          ? s.kit.openNeeds > 0
                            ? `Kit ready, ${s.kit.openNeeds} ${s.kit.openNeeds === 1 ? "question" : "questions"} for you`
                            : "Kit ready"
                          : "Kit building"
                        : s.published
                          ? (STATUS_WORDS[s.status] ?? s.status)
                          : "Pack coming soon"}
                    </span>
                    {line ? (
                      <Link
                        href="/recommenders"
                        className="underline-offset-4 hover:text-text hover:underline"
                      >
                        {line}
                      </Link>
                    ) : null}
                  </div>
                  <p className="home-school-date flex flex-col gap-0.5">
                    {s.deadline ? (
                      <>
                        <span className="label text-text-label">
                          {s.deadline.round ? `${s.deadline.round} · deadline` : "Deadline"}
                        </span>
                        <span className="font-mono text-[13px] leading-[18px] text-text-80 tabular-nums">
                          {shortDate(s.deadline.date)}
                        </span>
                      </>
                    ) : (
                      <span className="text-sm text-text-soft">No date yet</span>
                    )}
                  </p>
                  <Link
                    href={href}
                    className={cx(
                      buttonStyles({ variant: "quiet", size: "sm" }),
                      "home-school-open justify-self-end",
                    )}
                  >
                    Open <span className="sr-only">{s.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex flex-col items-start gap-5 border-t border-edge pt-8">
            <p className="text-title text-text">No schools on your list yet.</p>
            <Link href="/schools" className={buttonStyles({ variant: "secondary" })}>
              Choose your schools
            </Link>
          </div>
        )}
      </section>

      <section
        aria-labelledby="your-model"
        className="mt-16 flex flex-col gap-8 border-t border-edge pt-8"
      >
        <div className="flex items-start gap-4">
          <ModelSealMark size={40} className="shrink-0" />
          <div className="flex flex-col gap-1.5">
            <p className="label text-text-label">Writing with you</p>
            <h2 id="your-model" className="text-title text-text">
              {SEAL_LABEL}
            </h2>
          </div>
        </div>
        <ul className="grid gap-x-8 gap-y-5 sm:grid-cols-3" aria-label={MODEL_COPY.ledgerLabel}>
          {MODEL_CORPUS.slice(0, 3).map((row) => (
            <li key={row.title} className="flex flex-col gap-1">
              <span className="text-[24px] leading-7 font-[450] tracking-[-0.02em] text-text tabular-nums">
                {row.figure}
              </span>
              <span className="text-sm text-text-soft">{row.title}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
