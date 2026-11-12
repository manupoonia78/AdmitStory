// Your words, lit (direction §4.6): the one toy on the page. The real Workspace switch and the real
// YourWordsText on a Day paper sheet holding a second sample applicant's essay. The server renders
// it with the switch off (plain text that reads well on its own); the island's code loads when the
// section is within one viewport.

import { YOUR_WORDS_COPY } from "../_copy/landing";
import { DisplayHeading } from "../_ui/display-heading";
import { sampleHueStyle } from "../_ui/sample-hue";
import { Section } from "../_ui/section";
import { YourWordsToyIsland } from "./your-words-island";

export function YourWordsSection() {
  return (
    <Section labelledBy="your-words-title" className="overflow-x-clip">
      <div className="col-span-4 sm:col-span-8 lg:col-span-7">
        <DisplayHeading
          level={2}
          size="md"
          id="your-words-title"
          lines={[YOUR_WORDS_COPY.heading]}
        />
      </div>
      <div
        className="col-span-4 mt-8 sm:col-span-8 lg:col-span-12 lg:mt-14"
        style={sampleHueStyle()}
      >
        <YourWordsToyIsland
          paragraph={YOUR_WORDS_COPY.paragraph}
          phoneParagraph={YOUR_WORDS_COPY.phoneParagraph}
          sheetLabel={YOUR_WORDS_COPY.sheetLabel}
          sheetHeader={YOUR_WORDS_COPY.sheetHeader}
        />
      </div>
    </Section>
  );
}
