// Scene 8 (SPEC §4): what it won't do, the section a sceptical applicant reads twice. Short and
// sharp: the five integrity lines, numbered, on hairlines. Each line's first sentence carries the
// weight; the rest of it sits beside it, smaller. The AI-policy table lives on /how-it-works now.
// No icons, no motion beyond the reveal.

import Link from "next/link";
import { WONT_DO_COPY } from "../_copy/landing";
import { INTEGRITY_LINES } from "../_copy/shared";
import { TEXT_LINK } from "../_ui/cta-link";
import { SceneHead } from "../_ui/scene-head";
import { Section } from "../_ui/section";

/** The first sentence, and whatever follows it. Typographic apostrophes for display. */
function split(line: string): [string, string] {
  const text = line.replace(/'/g, "’");
  const end = text.indexOf(". ");
  return end === -1 ? [text, ""] : [text.slice(0, end + 1), text.slice(end + 2)];
}

export function WontDoSection() {
  return (
    <Section id="wont-do" labelledBy="wont-do-title">
      <SceneHead
        id="wont-do-title"
        eyebrow={WONT_DO_COPY.eyebrow}
        lines={WONT_DO_COPY.headingLines}
        className="reveal col-span-4 sm:col-span-8 lg:col-span-8"
      />
      <ol
        role="list"
        className="col-span-4 mt-14 border-b border-edge sm:col-span-8 lg:col-span-12 lg:mt-24"
      >
        {INTEGRITY_LINES.map((line, index) => {
          const [first, rest] = split(line);
          return (
            <li
              key={line}
              className="reveal grid grid-cols-[40px_minmax(0,1fr)] gap-x-4 border-t border-edge py-7 lg:grid-cols-12 lg:gap-x-6 lg:py-9"
            >
              <span aria-hidden="true" className="label pt-1.5 lg:col-span-1 lg:pt-3">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className="lg:col-span-11 lg:grid lg:grid-cols-11 lg:gap-x-6">
                <span className="block text-[1.25rem] leading-[1.25] font-[450] tracking-[-0.02em] text-text lg:col-span-6 lg:text-[1.75rem]">
                  {first}
                </span>{" "}
                {rest ? (
                  <span className="mt-3 block text-base text-text-soft lg:col-span-4 lg:col-start-8 lg:mt-1.5">
                    {rest}
                  </span>
                ) : null}
              </p>
            </li>
          );
        })}
      </ol>
      <div className="col-span-4 mt-4 sm:col-span-8 lg:col-span-12">
        <Link href="/how-it-works#ai-policies" className={TEXT_LINK}>
          {WONT_DO_COPY.allPolicies}
        </Link>
      </div>
    </Section>
  );
}
