import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prototypesEnabled } from "@/app/prototype/_shared/enabled";
import { PreviewScreen } from "../../[userSchoolId]/preview/preview-screen";

export const metadata: Metadata = { title: "Free preview (sample)" };

// The free preview with the applicant's own version built (SPEC §12): a fictional applicant
// (a hospital systems analyst) at the fictional Northfield, so the populated preview can be seen
// without an AI key. Off unless prototypes are on; nothing here reaches the database.

export default function SamplePreviewPage() {
  if (!prototypesEnabled()) notFound();
  return (
    <PreviewScreen
      userSchoolId="sample"
      hasStories
      setup={null}
      intro={null}
      details={null}
      initial={{
        schoolId: null,
        schoolName: "Northfield",
        state: {
          state: "ready",
          stale: false,
          updating: false,
          preview: {
            headline:
              "The analyst who makes problems hers before anyone asks, and writes down how so the next person doesn't have to.",
            support: [
              "Lead with the night-shift fix: ownership without a title.",
              "Let the runbook carry what changed because of you.",
              "Leave the vendor negotiation to your recommender.",
            ],
            opening: {
              essay: "Essay 1",
              limit: "200 words",
              prompt:
                "Tell us about a time you took responsibility for something that was not yours to fix. What changed because of you?",
              story: "The night-shift fix",
              text: "It was 2 a.m. and the feed from the lab system was dropping every fourth message. Nobody on the ward could see it yet, but I could.",
            },
            coached: false,
            fileMap: [
              { key: "e1", deliverable: "Essay 1", story: "The night-shift fix" },
              { key: "e2", deliverable: "Essay 2", story: "The handover guide" },
              { key: "s1", deliverable: "Short answer 1", story: "Night markets in Pune" },
              { key: "v1", deliverable: "Video essay", story: null },
            ],
            deliverables: [
              { key: "e1", title: "Essay 1", limit: "200 words", story: "The night-shift fix" },
              { key: "e2", title: "Essay 2", limit: "300 words", story: "The handover guide" },
              { key: "s1", title: "Short answer 1", limit: "50 words", story: null },
              { key: "v1", title: "Video essay", limit: "1 minute", story: null },
            ],
            builtAt: "2026-11-17T09:00:00.000Z",
          },
        },
      }}
    />
  );
}
