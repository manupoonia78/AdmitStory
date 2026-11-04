// "/" (direction §4, plan §8.9): the landing page, server sections in order. Foundation owns this
// file; packages build the sections it imports and never edit it. It doesn't read the session, so
// signed-in visitors see it too and "Sign in" takes them on to /home.

import { pageMetadata, HOME_DESCRIPTION, HOME_TITLE } from "./_lib/seo";
import { FollowSection } from "./_follow/follow-section";
import { Hero } from "./_hero/hero";
import { FaqSection } from "./_sections/faq";
import { FinalCall } from "./_sections/final-call";
import { HowItWorksLines } from "./_sections/how-it-works-lines";
import { PricingSection } from "./_sections/pricing";
import { RealScreens } from "./_sections/real-screens";
import { SchoolsStrip } from "./_sections/schools-strip";
import { TheModelSection } from "./_sections/the-model";
import { WontDoSection } from "./_sections/wont-do";
import { YourWordsSection } from "./_sections/your-words";

export const metadata = pageMetadata({
  title: { absolute: HOME_TITLE },
  description: HOME_DESCRIPTION,
  path: "/",
});

export default function Home() {
  return (
    <>
      <Hero /> {/* ./_hero/hero (A) */}
      <SchoolsStrip /> {/* ./_sections/schools-strip: every school with a verified pack */}
      <FollowSection /> {/* ./_follow/follow-section (B) */}
      <HowItWorksLines /> {/* ./_sections/how-it-works-lines (C) */}
      <TheModelSection /> {/* ./_sections/the-model: what the model is trained on */}
      <RealScreens /> {/* ./_sections/real-screens (C) */}
      <YourWordsSection /> {/* ./_sections/your-words (C) */}
      <WontDoSection /> {/* ./_sections/wont-do (C) */}
      <PricingSection /> {/* ./_sections/pricing (C) */}
      <FaqSection /> {/* ./_sections/faq (C) */}
      <FinalCall /> {/* ./_sections/final-call (C) */}
    </>
  );
}
