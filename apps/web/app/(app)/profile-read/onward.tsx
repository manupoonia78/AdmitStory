import { buttonStyles } from "@admitstory/ui";
import Link from "next/link";
import type { NextSchool } from "@/lib/funnel/next-school";

// Where the Profile Read leads (16 Nov 2026): reading how admissions will see you is the moment
// to see what a school's pack does with it, so the foot of the read points at the next school's
// preview, or at choosing a school. SPEC §6.12: the preview's final-call card, under the sheet.

export function ProfileReadOnward({ school }: { school: NextSchool | null }) {
  const href = school ? `/schools/${school.userSchoolId}/preview` : "/schools";
  return (
    <div className="mx-auto w-full max-w-[70rem] px-5 pb-16 sm:px-10 lg:px-14">
      <section
        aria-labelledby="read-onward"
        className="card mx-auto flex max-w-[48rem] flex-col gap-6 p-7 sm:flex-row sm:items-end sm:justify-between sm:p-8"
      >
        <div className="flex max-w-[34rem] flex-col gap-2">
          <p className="label">Next step</p>
          <h2 id="read-onward" className="text-title text-balance text-text">
            {school
              ? `See these stories as your ${school.name} application`
              : "Choose the schools to build this for"}
          </h2>
          <p className="text-sm text-text-soft">
            {school
              ? `The free ${school.name} preview shows which story leads there and where each one goes, and opens one of your essays.`
              : "Add a school and its free preview shows which of your stories leads there, and opens one of your essays."}
          </p>
        </div>
        <Link
          href={href}
          className={`${buttonStyles({ variant: "primary", arrow: true })} shrink-0 self-start sm:self-auto`}
        >
          {school ? `Preview ${school.name}` : "Choose your schools"}
          <span aria-hidden className="btn-arrow" />
        </Link>
      </section>
    </div>
  );
}
