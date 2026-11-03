// /terms (direction §8, plan §9.5.3): plain terms that encode the integrity rules (spec §14.7).
// No hero moment: like the recommender portal, this page is maximum clarity. Counsel reviews it
// before launch.

import { TERMS_COPY, TERMS_SECTIONS } from "../_copy/terms";
import { LegalLayout } from "../_legal/legal-layout";
import { pageMetadata } from "../_lib/seo";

export const metadata = pageMetadata({
  title: "Terms",
  description:
    "The terms for using AdmitStory: your story must be true, schools' rules come first, and recommenders write their own letters.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <LegalLayout
      title={TERMS_COPY.title}
      titleId="terms-title"
      contentsLabel={TERMS_COPY.contents}
      sections={TERMS_SECTIONS}
    />
  );
}
