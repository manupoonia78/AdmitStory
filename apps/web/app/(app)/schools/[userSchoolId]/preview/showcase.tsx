import { LockSimpleIcon } from "@phosphor-icons/react/ssr";
import type { ShowcaseView } from "@/lib/strategy/showcase";

// The free preview's showcase (Manu, 4 Nov 2026), rendered on the server and handed to the client
// screen as slots, so none of it ships JavaScript. Two halves: `ShowcaseIntro` (what the school
// looks for, then a worked example of a story reshaped for it) sits above the applicant's own
// version; `ShowcaseDetails` (what the pack drafts, then pointers from our research) sits below.

function SectionHead({ id, eyebrow, title }: { id: string; eyebrow: string; title: string }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="label">{eyebrow}</p>
      <h2 id={id} className="text-display-3 text-text">
        {title}
      </h2>
    </div>
  );
}

export function ShowcaseIntro({ view }: { view: ShowcaseView }) {
  const { schoolName, story } = view;
  return (
    <>
      {view.looksFor.length > 0 ? (
        <section aria-labelledby="looks-heading" className="flex flex-col gap-6">
          <SectionHead
            id="looks-heading"
            eyebrow={`What ${schoolName} looks for`}
            title="In the school's own words"
          />
          <ol className="flex flex-col border-t border-edge">
            {view.looksFor.map((item, index) => (
              <li
                key={item.text}
                className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 border-b border-edge py-5"
              >
                <span className="pt-1.5 font-mono text-[12px] text-text-label tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="flex flex-col gap-2">
                  <p className="max-w-[38rem] font-reading text-read-lg text-text">{item.text}</p>
                  {item.source ? <p className="label">{`${schoolName} · ${item.source}`}</p> : null}
                </div>
              </li>
            ))}
          </ol>
          {view.values.length > 0 ? (
            <div className="flex flex-col gap-3">
              <p className="label">{`What we make sure your ${schoolName} file shows`}</p>
              <ul className="flex flex-wrap gap-2">
                {view.values.map((value) => (
                  <li key={value} className="chip text-text">
                    {value}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {story ? (
        <section aria-labelledby="example-heading" className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <SectionHead
              id="example-heading"
              eyebrow="A worked example"
              title={`How we reshape a story for ${schoolName}`}
            />
            <p className="max-w-[60ch] text-text-soft">
              {story.who}{" "}
              <span className="label whitespace-nowrap">Illustrative, not a real client</span>
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-stretch">
            <figure className="flex flex-col gap-3 rounded-card border border-dashed border-edge p-6">
              <figcaption className="label">The story they came with</figcaption>
              <p className="font-reading text-read text-text-soft">“{story.before}”</p>
            </figure>
            <span aria-hidden="true" className="hidden w-12 items-center lg:flex">
              <span className="h-[1.25px] flex-1 bg-edge-strong" />
              <span className="size-0 border-y-[4px] border-l-[6px] border-y-transparent border-l-edge-strong" />
            </span>
            <figure className="flex flex-col gap-3 rounded-paper bg-sheet p-6 text-sheet-text shadow-(--shadow-paper) sm:p-7">
              <figcaption className="note text-accent">{`The story we built for ${schoolName}`}</figcaption>
              <p className="font-reading text-read">“{story.after}”</p>
            </figure>
          </div>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            <div className="flex flex-col gap-4">
              <h3 className="text-title text-text">What we changed</h3>
              <ol className="flex flex-col border-t border-edge">
                {story.moves.map((move, index) => (
                  <li
                    key={move}
                    className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3 border-b border-edge py-3"
                  >
                    <span className="pt-0.5 font-mono text-[12px] text-text-label tabular-nums">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="text-ui font-normal text-text">{move}</span>
                  </li>
                ))}
              </ol>
            </div>
            <figure className="relative flex flex-col gap-4 overflow-hidden rounded-paper bg-sheet p-7 text-sheet-text shadow-(--shadow-paper) sm:p-9">
              <figcaption className="label">{`From the example file · ${story.excerpt.essay}`}</figcaption>
              <blockquote className="whitespace-pre-line font-reading text-read-sm">
                {story.excerpt.text}
              </blockquote>
              <p className="note text-accent">The opening only. Your pack drafts the whole essay.</p>
            </figure>
          </div>
        </section>
      ) : null}
    </>
  );
}

export function ShowcaseDetails({ view }: { view: ShowcaseView }) {
  const { schoolName } = view;
  return (
    <>
      {view.drafts.length > 0 ? (
        <section aria-labelledby="drafts-heading" className="flex flex-col gap-6">
          <SectionHead
            id="drafts-heading"
            eyebrow="What's in the pack"
            title={`Everything ${schoolName} asks for, drafted`}
          />
          <ul className="flex flex-col border-t border-edge">
            {view.drafts.map((draft) => (
              <li key={draft.key} className="flex flex-col gap-1.5 border-b border-edge py-5">
                <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="flex flex-wrap items-baseline gap-x-3 text-ui text-text">
                    {draft.title}
                    {draft.limit ? <span className="label">{draft.limit}</span> : null}
                  </span>
                  <span className="label inline-flex items-center gap-1.5">
                    <LockSimpleIcon size={12} aria-hidden />
                    Drafted when you unlock
                  </span>
                </span>
                <span className="max-w-[60ch] text-sm text-text-soft">{draft.prompt}</span>
              </li>
            ))}
          </ul>
          {view.alsoIn.length > 0 ? (
            <div className="flex flex-col gap-3">
              <h3 className="label">Also in the pack</h3>
              <ul className="flex flex-col gap-2">
                {view.alsoIn.map((line) => (
                  <li key={line} className="flex gap-3 text-sm text-text-80">
                    <span aria-hidden="true" className="text-text-faint">
                      ·
                    </span>
                    <span className="max-w-[60ch]">{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {view.angles.length > 0 || view.avoid.length > 0 ? (
        <section aria-labelledby="pointers-heading" className="flex flex-col gap-6">
          <SectionHead
            id="pointers-heading"
            eyebrow="Pointers"
            title={`From our ${schoolName} research`}
          />
          <div className="grid gap-8 lg:grid-cols-2">
            {view.angles.length > 0 ? (
              <div className="flex flex-col gap-3">
                <h3 className="label text-verified">What works</h3>
                <ul className="flex flex-col border-t border-edge">
                  {view.angles.map((line) => (
                    <li key={line} className="border-b border-edge py-3 text-ui font-normal text-text">
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {view.avoid.length > 0 ? (
              <div className="flex flex-col gap-3">
                <h3 className="label text-needs">What to avoid</h3>
                <ul className="flex flex-col border-t border-edge">
                  {view.avoid.map((line) => (
                    <li key={line} className="border-b border-edge py-3 text-ui font-normal text-text">
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </>
  );
}
