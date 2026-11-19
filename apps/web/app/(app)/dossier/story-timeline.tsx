import { Peak, StatusLabel, UNDATED, cx, orderEras } from "@admitstory/ui";
import { TRAITS } from "@admitstory/shared";
import { LockSimpleIcon } from "@phosphor-icons/react";
import type { CSSProperties } from "react";
import { STORY_STATUS_LABELS, type DossierStoryView } from "./types";

// The Story Bank as a life (SPEC §6.11): one hairline across the page with a tick for each era,
// and under each era its chapters as cards. On phones the line turns and runs down the left.
// Choosing a card opens the story under the strip. The moment (dossier.css): the line draws,
// and each era arrives as the line reaches it, once, under data-motion="on".

const STATUS_TONES = {
  confirmed: "verified",
  partial: "needs",
  unconfirmed: "neutral",
} as const;

const TRAIT_LABEL = new Map<string, string>(TRAITS.map((trait) => [trait.id, trait.label]));

/** When each era's column arrives: as the line passes it, with gaps that shrink. */
const STARTS = [260, 350, 420, 480, 530, 570] as const;

function contextWord(context: DossierStoryView["context"]): string {
  return context[0]?.toUpperCase() + context.slice(1);
}

export function StoryTimeline({
  stories,
  selectedId,
  onSelect,
}: {
  stories: readonly DossierStoryView[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const eras = orderEras(stories);
  const byEra = new Map<string, DossierStoryView[]>();
  for (const story of stories) {
    const key = story.era.trim() || UNDATED;
    byEra.set(key, [...(byEra.get(key) ?? []), story]);
  }

  return (
    <div className="dt">
      <div className="dt-track">
        <span aria-hidden className="dt-line" />
        <ol className="dt-eras" aria-label="Your stories, by when they happened">
          {eras.map((era, index) => {
            const chapters = byEra.get(era) ?? [];
            const here = chapters.some((story) => story.id === selectedId);
            return (
              <li
                key={era}
                className="dt-era"
                style={
                  { "--d": `${STARTS[Math.min(index, STARTS.length - 1)]}ms` } as CSSProperties
                }
              >
                <h3 className="dt-head">
                  <span className="font-mono text-[12px] tracking-[0.06em] text-text-80 uppercase">
                    {era}
                  </span>
                  <span className="font-mono text-[12px] text-text-soft">
                    <span aria-hidden> · </span>
                    <span className="sr-only">, </span>
                    {chapters.length} {chapters.length === 1 ? "story" : "stories"}
                  </span>
                  <span aria-hidden className={cx("dt-tick", here && "dt-tick-here")}>
                    {here ? <Peak className="dt-peak" strokeWidth={1.25} /> : null}
                  </span>
                </h3>
                <ul className="dt-cards">
                  {chapters.map((story) => {
                    const selected = story.id === selectedId;
                    const traits = story.traits.map((id) => TRAIT_LABEL.get(id) ?? id);
                    return (
                      <li key={story.id}>
                        <button
                          type="button"
                          onClick={() => onSelect(story.id)}
                          aria-pressed={selected}
                          className="dt-card"
                        >
                          <span className="flex items-start justify-between gap-3">
                            <span className="label">{contextWord(story.context)}</span>
                            <StatusLabel tone={STATUS_TONES[story.status]}>
                              {STORY_STATUS_LABELS[story.status]}
                            </StatusLabel>
                          </span>
                          <span className="mt-3 line-clamp-2 text-title text-text">
                            {story.nickname}
                          </span>
                          {traits.length > 0 ? (
                            <span className="mt-3 flex flex-wrap items-center gap-1.5">
                              {traits.slice(0, 3).map((trait) => (
                                <span key={trait} className="chip h-7 px-2.5">
                                  {trait}
                                </span>
                              ))}
                              {traits.length > 3 ? (
                                <span className="label ps-1">+{traits.length - 3}</span>
                              ) : null}
                            </span>
                          ) : null}
                          {story.sensitivity === "sensitive" ? (
                            <span className="label mt-3 flex items-center gap-1.5 text-needs">
                              <LockSimpleIcon size={12} aria-hidden />
                              Sensitive · ask first
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
