// "/" (SPEC §3, §4): the landing page, thirteen scenes in order, all server sections. It doesn't
// read the session, so signed-in visitors see it too and "Sign in" takes them on to /home.

import { pageMetadata, HOME_DESCRIPTION, HOME_TITLE } from "./_lib/seo";
import { SocialProofSlot } from "@/components/social-proof-slot";
import { Hero } from "./_hero/hero";
import { ConnectPeopleSection } from "./_sections/connect-people";
import { EssayScene } from "./_sections/essay-scene";
import { FaqSection } from "./_sections/faq";
import { FinalCall } from "./_sections/final-call";
import { HowScene } from "./_sections/how-scene";
import { InterviewSoon } from "./_sections/interview-soon";
import { PricingSection } from "./_sections/pricing";
import { SchoolBySchool } from "./_sections/school-by-school";
import { SchoolsStrip } from "./_sections/schools-strip";
import { TheModelSection } from "./_sections/the-model";
import { WontDoSection } from "./_sections/wont-do";

export const metadata = pageMetadata({
  title: { absolute: HOME_TITLE },
  description: HOME_DESCRIPTION,
  path: "/",
});

export default function Home() {
  return (
    <>
      <Hero /> {/* 1: voice becomes story becomes essays */}
      <SchoolsStrip /> {/* 2: the sixteen schools, typeset */}
      <HowScene /> {/* 3: Tell, Position, Draft, Refine */}
      <SchoolBySchool /> {/* 4: one story, three schools */}
      <EssayScene /> {/* 5: the paper scene, with "Write your own line" */}
      <TheModelSection /> {/* 6: the seal and the ledger */}
      <ConnectPeopleSection /> {/* 7: people from each school */}
      {/* Social proof goes here. It renders nothing until components/social-proof.ts has real,
          attributable content from Manu: no empty box and no placeholder ever ships. */}
      <SocialProofSlot />
      <WontDoSection /> {/* 8: what it won't do */}
      <InterviewSoon /> {/* 9: interview practice, coming soon, labelled as a preview */}
      <PricingSection /> {/* 10: Free, 1, 5 and 10 schools */}
      <FaqSection /> {/* 11: questions */}
      <FinalCall /> {/* 12: the final call; the footer (13) is in the layout */}
    </>
  );
}
