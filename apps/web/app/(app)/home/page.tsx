import { getDb } from "@admitstory/db";
import { Button } from "@admitstory/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { requireOnboardedUser } from "@/lib/app-user";
import { nextStep } from "@/lib/home/next-step";
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
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-12 px-4 py-10 sm:px-8 sm:py-16">
      <section className="flex flex-col items-start gap-6">
        <p className="eyebrow">Your next step</p>
        <h1 className="max-w-[14ch] text-display text-text sm:text-display-lg">{step.title}</h1>
        <Button asChild>
          <Link href={step.href}>{step.action}</Link>
        </Button>
      </section>

      {facts.schools.length > 0 ? (
        <section className="flex flex-col gap-4" aria-labelledby="your-schools">
          <h2 id="your-schools" className="text-lg font-semibold text-text">
            Your schools
          </h2>
          <div className="plane overflow-x-auto px-5 py-1">
            <table className="w-full text-left">
              <thead className="text-sm text-text-soft">
                <tr className="border-b border-edge">
                  <th scope="col" className="py-2 font-normal">
                    School
                  </th>
                  <th scope="col" className="py-2 font-normal">
                    Where it stands
                  </th>
                  <th scope="col" className="py-2 font-normal">
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
                    <td className="py-3 text-text">{s.name}</td>
                    <td className="py-3 text-text-soft">
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
                    <td className="py-3 text-right">
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
