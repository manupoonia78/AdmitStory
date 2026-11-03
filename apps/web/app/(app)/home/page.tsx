import { getDb } from "@admitstory/db";
import { Button, cx } from "@admitstory/ui";
import { ArrowRightIcon, CheckIcon } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { requireOnboardedUser } from "@/lib/app-user";
import { STORIES_BEFORE_READ, nextStep } from "@/lib/home/next-step";
import { loadHomeFacts } from "@/lib/home/server";
import { recommenderSummary } from "@/lib/recommenders/summary";

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

/**
 * Home (spec §5.1, screen A): the single most useful next step as the headline, then the
 * applicant's schools. Nothing else competes with the next step.
 *
 * One step outranks the journey's order: asking a recommender (§5.11). It is the only step with a
 * date of its own — about seven weeks before a deadline — and it is somebody else's time, so when
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
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-14 px-5 py-10 sm:px-10 sm:py-14">
      <header className="flex flex-col gap-3">
        <p className="eyebrow">Your application</p>
        <h1 className="text-display text-text">
          Welcome back
          {firstName ? (
            <>
              , <em>{firstName}</em>
            </>
          ) : null}
        </h1>
      </header>

      <section
        aria-labelledby="next-step"
        className="plane relative flex flex-col gap-6 overflow-hidden p-7 sm:flex-row sm:items-end sm:justify-between sm:p-10"
      >
        <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-accent" />
        <div className="flex max-w-[34rem] flex-col gap-3">
          <p className="meta uppercase tracking-[0.16em]">Next step</p>
          <h2
            id="next-step"
            className="font-display text-[clamp(1.6rem,1.2rem+1vw,2.1rem)] leading-[1.12] tracking-[-0.015em] text-text"
          >
            {step.title}
          </h2>
        </div>
        <Button asChild className="self-start sm:self-auto">
          <Link href={step.href}>
            {step.action}
            <ArrowRightIcon size={16} aria-hidden />
          </Link>
        </Button>
      </section>

      <section aria-labelledby="journey" className="flex flex-col gap-5">
        <h2 id="journey" className="eyebrow">
          The path
        </h2>
        <ol className="grid gap-px overflow-hidden rounded-plane border border-edge bg-edge sm:grid-cols-2 lg:grid-cols-4">
          {journey.map((item, index) => (
            <li key={item.title} className="bg-depth">
              <Link
                href={item.href}
                className="group flex h-full flex-col gap-6 p-6 transition-colors hover:bg-[color-mix(in_srgb,var(--text)_3%,var(--depth))]"
              >
                <span className="flex items-center justify-between">
                  <span className="meta">{String(index + 1).padStart(2, "0")}</span>
                  <span
                    aria-hidden
                    className={cx(
                      "grid size-6 place-items-center rounded-full border",
                      item.done ? "border-text bg-text text-space" : "border-edge text-transparent",
                    )}
                  >
                    <CheckIcon size={12} weight="bold" />
                  </span>
                </span>
                <span className="flex flex-col gap-1.5">
                  <span className="font-display text-[1.375rem] leading-tight text-text">
                    {item.title}
                  </span>
                  <span className="text-sm text-text-soft">
                    {item.detail}
                    {item.done ? <span className="sr-only"> (done)</span> : null}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {facts.schools.length > 0 ? (
        <section className="flex flex-col gap-4" aria-labelledby="your-schools">
          <h2 id="your-schools" className="eyebrow">
            Your schools
          </h2>
          <div className="plane overflow-x-auto px-6 py-1">
            <table className="w-full text-left">
              <thead className="meta uppercase tracking-[0.12em]">
                <tr className="border-b border-edge">
                  <th scope="col" className="py-3 font-normal">
                    School
                  </th>
                  <th scope="col" className="py-3 font-normal">
                    Where it stands
                  </th>
                  <th scope="col" className="py-3 font-normal">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {facts.schools.map((s) => (
                  <tr
                    key={s.userSchoolId}
                    className="border-b border-edge last:border-0 hover:bg-veil"
                  >
                    <td className="py-4 font-display text-lg text-text">{s.name}</td>
                    <td className="py-4 text-text-soft">
                      <span className="block">
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
                      {lineFor(s.userSchoolId) ? (
                        <Link
                          href="/recommenders"
                          className="block text-sm text-text-soft hover:text-text"
                        >
                          {lineFor(s.userSchoolId)}
                        </Link>
                      ) : null}
                    </td>
                    <td className="py-4 text-right">
                      <Link
                        className="text-sm text-text underline-offset-2 hover:underline"
                        href={s.kit ? `/kits/${s.kit.id}` : `/schools/${s.userSchoolId}/preview`}
                      >
                        Open <span className="sr-only">{s.name}</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
