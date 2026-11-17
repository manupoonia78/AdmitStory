// The sheet beside the sign-in form (SPEC §5): the hero's last sample, a fictional applicant from
// a family packaging business, as one sheet of paper turned 2° and standing on the horizon. Its
// words come from the landing page's copy (_copy/hero.ts). Decorative: the room hides it from
// assistive technology. The reading serif is the root's lazy face, so /sign-in preloads nothing
// extra for it. Server markup.

import { HERO_COPY, HERO_SAMPLES } from "@/app/(marketing)/_copy/hero";

const SAMPLE = HERO_SAMPLES[HERO_SAMPLES.length - 1];

export function EntrySheet() {
  const sheet = SAMPLE?.sheets[2];
  if (!sheet) return null;
  return (
    <figure className="room-sheet-wrap">
      <div className="room-sheet">
        <div className="room-sheet-margin">
          <p className="room-sheet-title">{sheet.title}</p>
          <p className="room-sheet-note">{sheet.note}</p>
          <p className="room-sheet-count">
            {sheet.count.written} / {sheet.count.limit}
            <br />
            words
          </p>
        </div>
        <p className="room-sheet-body">
          {sheet.before ? `${sheet.before} ` : null}
          {sheet.said ? <mark>{sheet.said}</mark> : null} {sheet.after}
        </p>
      </div>
      <figcaption className="label">{HERO_COPY.sampleNote}</figcaption>
    </figure>
  );
}
