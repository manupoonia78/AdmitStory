import { LockSimpleIcon } from "@phosphor-icons/react/ssr";
import type { ShowcaseView } from "@/lib/strategy/showcase";

// The free preview's showcase (Manu, 4 Nov 2026), rendered on the server and handed to the client
// screen as slots, so none of it ships JavaScript. Two halves: `ShowcaseIntro` (what the school
// looks for, then a worked example of a story reshaped for it) sits above the applicant's own
// version; `ShowcaseDetails` (what the pack drafts, then pointers from our research) sits below.

function SectionHead({ id, eyebrow, title }: { id: string; eyebrow: string; title: string }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="eyebrow">{eyebrow}</p>
      <h2
        id={id}
        className="font-display text-[1.75rem] leading-tight tracking-[-0.015em] text-text sm:text-[2rem]"
      >
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
                <span className="meta pt-1 text-accent">{String(index + 1).padStart(2, "0")}</span>
                <div className="flex flex-col gap-1.5">
                  <p className="max-w-essay font-reading text-lg leading-relaxed text-text">
                    {item.text}
                  </p>
                  {item.source ? (
                    <p className="meta text-text-soft">{`${schoolName} · ${item.source}`}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
          {view.values.length > 0 ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-text-soft">
                {`What we make sure your ${schoolName} file shows:`}
              </p>
              <ul className="flex flex-wrap gap-2">
                {view.values.map((value) => (
                  <li
                    key={value}
                    className="rounded-full border border-edge px-3.5 py-1.5 text-sm text-text"
                  >
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
            <p className="max-w-essay text-text-soft">
              {story.who}{" "}
              <span className="text-sm">
                An illustrative applicant we wrote to show the method, not a real client.
              </span>
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-stretch">
            <figure className="flex flex-col gap-3 rounded-plane border border-dashed border-edge p-6">
              <figcaption className="meta text-text-soft">The story they came with</figcaption>
              <p className="font-reading text-lg leading-relaxed text-text-soft">
                “{story.before}”
              </p>
            </figure>
            <span
              aria-hidden="true"
              className="hidden items-center justify-center font-display text-2xl text-accent lg:flex"
            >
              →
            </span>
            <figure className="flex flex-col gap-3 rounded-plane border border-edge border-l-2 border-l-accent bg-depth p-6">
              <figcaption className="meta text-accent">{`The story we built for ${schoolName}`}</figcaption>
              <p className="font-reading text-lg leading-relaxed text-text">“{story.after}”</p>
            </figure>
          </div>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            <div className="flex flex-col gap-4">
              <h3 className="text-lg font-semibold text-text">What we changed</h3>
              <ol className="flex flex-col border-t border-edge">
                {story.moves.map((move, index) => (
                  <li
                    key={move}
                    className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3 border-b border-edge py-3"
                  >
                    <span className="meta pt-0.5 text-text-soft">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="text-text">{move}</span>
                  </li>
                ))}
              </ol>
            </div>
            <figure className="relative flex flex-col gap-4 overflow-hidden rounded-plane border border-edge bg-depth p-6 sm:p-8">
              <figcaption className="meta text-text-soft">{`From the example file · ${story.excerpt.essay}`}</figcaption>
              <blockquote className="whitespace-pre-line font-reading text-[1.0625rem] leading-[1.7] text-text">
                {story.excerpt.text}
              </blockquote>
              <p className="meta text-text-soft">
                The opening only. Your pack drafts the whole essay.
              </p>
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
              <li key={draft.key} className="flex flex-col gap-2 border-b border-edge py-4">
                <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="font-medium text-text">
                    {draft.title}
                    {draft.limit ? (
                      <span className="text-sm font-normal tabular-nums text-text-soft">
                        {` · ${draft.limit}`}
                      </span>
                    ) : null}
                  </span>
                  <span className="inline-flex items-center gap-1 text-sm text-text-soft">
                    <LockSimpleIcon size={14} aria-hidden />
                    Drafted when you unlock
                  </span>
                </span>
                <span className="max-w-essay text-sm text-text-soft">{draft.prompt}</span>
              </li>
            ))}
          </ul>
          {view.alsoIn.length > 0 ? (
            <div className="flex flex-col gap-3">
              <h3 className="text-lg font-semibold text-text">Also in the pack</h3>
              <ul className="flex flex-col gap-2">
                {view.alsoIn.map((line) => (
                  <li key={line} className="flex gap-3 text-text">
                    <span aria-hidden="true" className="text-accent">
                      ·
                    </span>
                    <span className="max-w-essay">{line}</span>
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
                <h3 className="meta text-verified">What works</h3>
                <ul className="flex flex-col border-t border-edge">
                  {view.angles.map((line) => (
                    <li key={line} className="border-b border-edge py-3 text-text">
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {view.avoid.length > 0 ? (
              <div className="flex flex-col gap-3">
                <h3 className="meta text-needs">What to avoid</h3>
                <ul className="flex flex-col border-t border-edge">
                  {view.avoid.map((line) => (
                    <li key={line} className="border-b border-edge py-3 text-text">
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
