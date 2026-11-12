// A still of the app, drawn in HTML (paper redesign): the essay workspace with the sidebar, the
// draft on paper and the coach beside it. Shown in "Quiet where you work" until real captures
// exist (_data/screens.ts). Decorative, server-only. Its draft is a third sample applicant (Manu,
// 5 Nov 2026: more than one story on the page), fictional, as is Northfield.

import { Wordmark } from "@admitstory/ui";
import { sampleHueStyle } from "../_ui/sample-hue";

const NAV = ["Home", "Story Studio", "Schools", "Interview", "Connect", "Tracker"];

export function AppPreview() {
  return (
    <div
      aria-hidden="true"
      data-theme="day"
      style={sampleHueStyle()}
      className="overflow-hidden rounded-[16px] border border-edge bg-space text-text shadow-[0_40px_80px_-30px_rgb(40_30_15/0.35)]"
    >
      <div className="grid min-h-[34rem] grid-cols-[13rem_minmax(0,1fr)] lg:grid-cols-[13rem_minmax(0,1fr)_17rem]">
        <div className="flex flex-col gap-4 border-r border-edge bg-rail p-4">
          <Wordmark size={18} />
          <span className="rounded-control bg-text py-2 text-center text-[12px] font-medium text-space">
            New story
          </span>
          <ul className="flex flex-col gap-0.5 text-[13px]">
            {NAV.map((item) => (
              <li
                key={item}
                className={
                  item === "Schools"
                    ? "rounded-control bg-depth px-2.5 py-1.5 font-medium shadow-paper ring-1 ring-edge"
                    : "px-2.5 py-1.5 text-text-soft"
                }
              >
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-4 p-6">
          <div className="flex items-center justify-between">
            <p className="meta uppercase tracking-[0.14em]">Northfield · Goals essay</p>
            <span className="rounded-full bg-[color-mix(in_srgb,var(--verified)_12%,transparent)] px-2.5 py-0.5 text-[11px] font-medium text-verified">
              91% your words
            </span>
          </div>
          <div className="flex-1 rounded-[6px] border border-edge bg-depth px-8 py-7 shadow-paper">
            <p className="font-display text-[1.375rem] leading-tight">Why an MBA, and why now?</p>
            <div className="mt-5 flex flex-col gap-4 font-reading text-[14.5px] leading-[1.75]">
              <p>
                <mark>
                  My father ran the plant from a notebook, and the notebook was always right.
                </mark>{" "}
                When I joined our family’s packaging business in 2021, we had 140 people, one
                supervisor who could fix the corrugator, and no system anyone else could read.
              </p>
              <p>
                I spent my first year moving the notebook into software nobody had asked for.{" "}
                <mark>The supervisors called it my homework.</mark>
              </p>
              <p className="text-text-soft">
                By the second year waste was down a third, and I knew the next problem wasn’t a
                machine…
              </p>
            </div>
          </div>
        </div>

        <div className="hidden flex-col gap-4 border-l border-edge p-5 lg:flex">
          <p className="meta uppercase tracking-[0.14em]">Coach</p>
          {[
            ["Word count", "468 of 500", "verified"],
            ["Every claim sourced", "4 stories cited", "verified"],
            ["Reads like you", "Voice match 0.93", "verified"],
            ["One question for you", "What did your father say in month one?", "needs"],
          ].map(([title, detail, tone]) => (
            <div key={title} className="rounded-control border border-edge bg-depth p-3">
              <p className="flex items-center gap-2 text-[13px] font-medium">
                <span
                  className={`size-1.5 rounded-full ${tone === "needs" ? "bg-needs" : "bg-verified"}`}
                />
                {title}
              </p>
              <p className="mt-1 text-[12px] text-text-soft">{detail}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
