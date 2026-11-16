import { buttonStyles } from "@admitstory/ui";
import { ArrowRightIcon } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import type { NextSchool } from "@/lib/funnel/next-school";

// Where the Profile Read leads (16 Nov 2026): it used to end at its feedback control, with no way
// on. Reading how admissions will see you is the moment to see what a school's pack does with it,
// so the foot of the read points at the next school's preview, or at choosing a school.

export function ProfileReadOnward({ school }: { school: NextSchool | null }) {
  const href = school ? `/schools/${school.userSchoolId}/preview` : "/schools";
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-8 sm:pb-16">
      <section
        aria-labelledby="read-onward"
        className="plane relative flex flex-col gap-6 overflow-hidden p-7 sm:flex-row sm:items-end sm:justify-between sm:p-10"
      >
        <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-accent" />
        <div className="flex max-w-[38rem] flex-col gap-3">
          <p className="meta uppercase tracking-[0.16em]">Next step</p>
          <h2
            id="read-onward"
            className="font-display text-[clamp(1.6rem,1.2rem+1vw,2.1rem)] leading-[1.12] tracking-[-0.015em] text-text"
          >
            {school
              ? `See these stories as your ${school.name} application`
              : "Choose the schools to build this for"}
          </h2>
          <p className="text-text-soft">
            {school
              ? `The free ${school.name} preview shows which story leads there and where each one goes, and opens one of your essays.`
              : "Add a school and its free preview shows which of your stories leads there, and opens one of your essays."}
          </p>
        </div>
        <Link
          href={href}
          className={`${buttonStyles({ variant: "primary" })} self-start sm:self-auto`}
        >
          {school ? `Preview ${school.name}` : "Choose your schools"}
          <ArrowRightIcon size={16} aria-hidden />
        </Link>
      </section>
    </div>
  );
}
