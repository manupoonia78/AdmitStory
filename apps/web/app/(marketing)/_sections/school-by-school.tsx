// Scene 4 (SPEC §4): one story, three schools, three readings. A fictional site engineer says
// three sentences once; each school's draft is built around a different one of them, because each
// school asks a different question. The schools are real and named in type only; what each "asks"
// paraphrases a prompt in its published pack. Server markup.

import { cx } from "@admitstory/ui";
import type { CSSProperties } from "react";
import { SCHOOLS_COPY } from "../_copy/landing";
import { SceneHead } from "../_ui/scene-head";
import { Section } from "../_ui/section";
import { sheetSerif } from "../_ui/sheet-serif";

export function SchoolBySchool() {
  return (
    <Section labelledBy="schools-title">
      <div className="reveal col-span-4 sm:col-span-8 lg:col-span-6">
        <SceneHead
          id="schools-title"
          eyebrow={SCHOOLS_COPY.eyebrow}
          lines={SCHOOLS_COPY.headingLines}
        />
        <p className="mt-6 max-w-[440px] text-lg text-text-soft">{SCHOOLS_COPY.paragraph}</p>
      </div>
      <div
        className="reveal col-span-4 mt-12 sm:col-span-8 lg:col-span-5 lg:col-start-8 lg:mt-auto"
        style={{ "--i": 1 } as CSSProperties}
      >
        <p className="label">{SCHOOLS_COPY.spokenLabel}</p>
        <p className="mt-4 font-accent text-[1.5rem] leading-[1.25] tracking-[-0.005em] text-text-80 italic lg:text-[1.75rem]">
          “{SCHOOLS_COPY.spoken.join(" ")}”
        </p>
      </div>

      <ul
        role="list"
        className="col-span-4 mt-14 grid gap-x-6 gap-y-14 sm:col-span-8 lg:col-span-12 lg:mt-24 lg:grid-cols-3"
      >
        {SCHOOLS_COPY.schools.map((school, index) => (
          <li
            key={school.name}
            className="reveal flex flex-col border-t border-edge-strong pt-6"
            style={{ "--i": index } as CSSProperties}
          >
            <h3 className="text-[1.5rem] leading-7 font-[450] tracking-[-0.02em] text-text">
              {school.name}
            </h3>
            <p className="label mt-2">{school.essay}</p>
            <p className="mt-4 text-base text-text-soft lg:min-h-[4.5em]">{school.asks}</p>
            <article data-theme="day" className="scene-sheet mt-6 flex-1">
              <div className="scene-sheet-margin">
                <p className="scene-sheet-title">{SCHOOLS_COPY.draftLabel}</p>
                <p className="scene-sheet-note">{school.note}</p>
              </div>
              <p className={cx(sheetSerif.className, "scene-sheet-body")}>
                {school.before ? `${school.before} ` : null}
                <mark className="sheet-mark">{school.said}</mark> {school.after}
              </p>
            </article>
          </li>
        ))}
      </ul>
      <p className="label col-span-4 mt-8 sm:col-span-8 lg:col-span-12">{SCHOOLS_COPY.note}</p>
    </Section>
  );
}
