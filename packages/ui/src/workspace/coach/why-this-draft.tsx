import { useId } from "react";
import { StatusLabel } from "../../components/status-label";
import { SourceLine, type PackSource } from "./source-line";

export interface WhyThisDraftProps {
  /** The primary story, or null with the Strategist's reason (FileMapItem.primary_reason_if_none). */
  story: { id: string; title: string } | null;
  /** Draft.notes.why_this_story. */
  whyThisStory: string;
  /** Draft.notes.what_it_proves. */
  whatItProves: string;
  /** Traits and lenses this essay shows that the rest of the file doesn't (FileMapItem). */
  shows?: readonly string[];
  /** Each part of the prompt and the paragraphs (1-based) that answer it; empty: unanswered. */
  promptParts: readonly { part: string; paragraphs: readonly number[] }[];
  /** How it fits this school, each point with its pack sources (Draft.notes.school_fit_points). */
  schoolFit: readonly { text: string; sources: readonly PackSource[] }[];
  /** What the recommenders cover, so the essay doesn't repeat it. */
  recommenderCovers?: readonly string[];
}

function paragraphsLabel(paragraphs: readonly number[]): string {
  if (paragraphs.length === 1) return `paragraph ${paragraphs[0]}`;
  const sorted = [...paragraphs].sort((a, b) => a - b);
  const contiguous = sorted.every((n, i) => i === 0 || n === (sorted[i - 1] ?? 0) + 1);
  return contiguous
    ? `paragraphs ${sorted[0]} to ${sorted.at(-1)}`
    : `paragraphs ${sorted.slice(0, -1).join(", ")} and ${sorted.at(-1)}`;
}

/**
 * Coach tab 1, "Why this draft" (spec §5.8): the story and why, what the essay proves that the
 * rest of the file doesn't, each part of the prompt ticked where it is answered, how it fits the
 * school (every school point with its source and verified date), and what the recommender covers.
 */
export function WhyThisDraft({
  story,
  whyThisStory,
  whatItProves,
  shows = [],
  promptParts,
  schoolFit,
  recommenderCovers = [],
}: WhyThisDraftProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-lg font-semibold text-text">Why this draft</h2>
      <section className="flex flex-col gap-1" aria-label="The story">
        <p className="text-text">
          {story ? (
            <>
              Story: <span className="font-medium">{story.title}</span>.{" "}
            </>
          ) : null}
          {whyThisStory}
        </p>
        <p className="text-text-soft">{whatItProves}</p>
        {shows.length > 0 ? (
          <p className="text-sm text-text-soft">Shows: {shows.join(", ")}</p>
        ) : null}
      </section>

      {promptParts.length > 0 ? (
        <section className="flex flex-col gap-2" aria-labelledby={`${id}-why-prompt-parts`}>
          <h3 id={`${id}-why-prompt-parts`} className="font-medium text-text">
            How it answers the prompt
          </h3>
          <ul className="flex flex-col gap-2">
            {promptParts.map((item) => (
              <li key={item.part} className="flex flex-col gap-0.5">
                {item.paragraphs.length > 0 ? (
                  <StatusLabel tone="verified">
                    Answered in {paragraphsLabel(item.paragraphs)}
                  </StatusLabel>
                ) : (
                  <StatusLabel tone="risk">Not answered yet</StatusLabel>
                )}
                <span className="text-text-soft">{item.part}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {schoolFit.length > 0 ? (
        <section className="flex flex-col gap-2" aria-labelledby={`${id}-why-school-fit`}>
          <h3 id={`${id}-why-school-fit`} className="font-medium text-text">
            How it fits the school
          </h3>
          <ul className="flex flex-col gap-3">
            {schoolFit.map((point) => (
              <li key={point.text} className="flex flex-col gap-0.5">
                <span className="text-text">{point.text}</span>
                <SourceLine sources={point.sources} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {recommenderCovers.length > 0 ? (
        <section className="flex flex-col gap-1" aria-labelledby={`${id}-why-recommender`}>
          <h3 id={`${id}-why-recommender`} className="font-medium text-text">
            What your recommenders cover
          </h3>
          <p className="text-text-soft">
            {recommenderCovers.join("; ")}. The essay leaves these to them.
          </p>
        </section>
      ) : null}
    </div>
  );
}
