// Scene 5 (SPEC §4): essays that show their thinking. The page turns to paper here and only here:
// a Day island, a desk with 32px corners rising out of the dark, and one large sheet on it with
// its reasoning in the margin. The sheet, the "your words" switch and "Write your own line" are
// one small client component (./essay-toy), rendered on the server like any other: not a lazy
// island, because an island's markup arrives late and never shows without JavaScript.

import { ESSAY_COPY } from "../_copy/landing";
import { SceneHead } from "../_ui/scene-head";
import { Section } from "../_ui/section";
import EssayToy from "./essay-toy";

export function EssayScene() {
  return (
    <Section id="essays" labelledBy="essays-title" theme="paper" className="rounded-frame">
      <SceneHead
        id="essays-title"
        eyebrow={ESSAY_COPY.eyebrow}
        lines={ESSAY_COPY.headingLines}
        className="reveal col-span-4 sm:col-span-8 lg:col-span-7"
      />
      <p className="reveal col-span-4 mt-6 text-lg text-text-soft sm:col-span-6 lg:col-span-4 lg:col-start-9 lg:mt-auto">
        {ESSAY_COPY.paragraph}
      </p>
      <div className="col-span-4 mt-12 sm:col-span-8 lg:col-span-12 lg:mt-20">
        <EssayToy />
      </div>
    </Section>
  );
}
