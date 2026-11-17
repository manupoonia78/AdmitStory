// The pack assembling (SPEC §4.2, /how-it-works): which story feeds which file, for the sample
// kit. The page's one moment: as the figure comes into view each thread draws from its story to
// the file it feeds, and each file's name comes up to full strength as its thread arrives
// (marketing.css, .pack). Server markup and CSS only, no island: drawn and complete without
// JavaScript and under reduced motion. Below 1024 px there are no threads; the files are rows,
// each naming the story it comes from.

import type { CSSProperties } from "react";
import {
  PACK_FILES,
  PACK_HELD_BACK,
  PACK_MAP_COPY,
  PACK_STORIES,
  type PackStory,
} from "../_copy/how-it-works";

/** The drawing's height in rows of files; the stories share the same height. */
const ROWS = PACK_FILES.length;
const ROW = 56;
const HEIGHT = ROWS * ROW;
const STORY_ROW = HEIGHT / PACK_STORIES.length;

const storyY = (index: number) => STORY_ROW * index + STORY_ROW / 2;
const fileY = (index: number) => ROW * index + ROW / 2;

const storyTitle = (id: string) => PACK_STORIES.find((story) => story.id === id)?.title ?? "";
const delay = (i: number) => ({ "--i": i }) as CSSProperties;

function Story({ story }: { story: PackStory }) {
  const held = story.id === PACK_HELD_BACK;
  return (
    <li className="pack-story" style={{ height: STORY_ROW }} data-held={held ? "" : undefined}>
      <span className="pack-name">{story.title}</span>
      <span className="label">{held ? PACK_MAP_COPY.heldBack : story.context}</span>
    </li>
  );
}

export function PackMap() {
  const threads = PACK_FILES.map((file, index) => {
    const from = PACK_STORIES.findIndex((story) => story.id === file.from);
    const y1 = storyY(from);
    const y2 = fileY(index);
    return { key: file.id, d: `M0 ${y1} C 50 ${y1}, 50 ${y2}, 100 ${y2}` };
  });

  return (
    <figure aria-labelledby="pack-title" className="pack reveal">
      <div className="pack-head">
        <p className="label">{PACK_MAP_COPY.label}</p>
        <h3 id="pack-title" className="mt-3 font-display text-display-3 text-text">
          {PACK_MAP_COPY.heading}
        </h3>
      </div>

      {/* Laptops: stories, threads, files. */}
      <div aria-hidden="true" className="pack-board">
        <div>
          <p className="label pack-col-label">{PACK_MAP_COPY.storiesLabel}</p>
          <ul role="list" className="pack-stories" style={{ height: HEIGHT }}>
            {PACK_STORIES.map((story) => (
              <Story key={story.id} story={story} />
            ))}
          </ul>
        </div>
        <svg
          viewBox={`0 0 100 ${HEIGHT}`}
          preserveAspectRatio="none"
          fill="none"
          focusable="false"
          className="pack-threads"
          style={{ height: HEIGHT }}
        >
          {threads.map((thread, index) => (
            <path key={thread.key} d={thread.d} className="pack-thread" style={delay(index)} />
          ))}
        </svg>
        <div>
          <p className="label pack-col-label">{PACK_MAP_COPY.filesLabel}</p>
          <ul role="list" className="pack-files" style={{ height: HEIGHT }}>
            {PACK_FILES.map((file, index) => (
              <li key={file.id} className="pack-file" style={{ ...delay(index), height: ROW }}>
                <span className="pack-name">{file.title}</span>
                <span className="label">{file.limit}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Phones and tablets, and what assistive technology reads: the files with their story. */}
      <ul role="list" className="pack-list">
        {PACK_FILES.map((file, index) => (
          <li key={file.id} style={delay(index)}>
            <span className="label">
              {PACK_MAP_COPY.from} · {storyTitle(file.from)}
            </span>
            <span className="pack-list-file">
              <span className="pack-name">{file.title}</span>
              <span className="label">{file.limit}</span>
            </span>
          </li>
        ))}
      </ul>
      <figcaption className="sr-only">{PACK_MAP_COPY.caption}</figcaption>
      <p className="label mt-8">{PACK_MAP_COPY.note}</p>
    </figure>
  );
}
