// /privacy (direction §7, plan §9.5.2): a privacy policy people actually read, which is also
// complete. Its one hero moment is the voice-path diagram. Counsel reviews the full text before
// launch (spec §14.4); until then the layout says it's a draft.

import { PRIVACY_COPY, PRIVACY_SECTIONS } from "../_copy/privacy";
import { LegalLayout } from "../_legal/legal-layout";
import { VoicePathDiagram } from "../_legal/voice-path-diagram";
import { pageMetadata } from "../_lib/seo";

export const metadata = pageMetadata({
  title: "Privacy",
  description:
    "What AdmitStories collects, what happens to your voice, and how to export or delete everything.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <LegalLayout
      title={PRIVACY_COPY.title}
      titleId="privacy-title"
      contentsLabel={PRIVACY_COPY.contents}
      sections={PRIVACY_SECTIONS}
      hero={<VoicePathDiagram />}
    />
  );
}
