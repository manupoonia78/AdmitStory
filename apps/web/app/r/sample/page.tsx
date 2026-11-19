import { OWN_WORDS_REMINDER, type PortalView } from "@admitstory/shared/kit";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prototypesEnabled } from "@/app/prototype/_shared/enabled";
import { PortalPage } from "../portal-page";

export const metadata: Metadata = {
  title: "Your recommendation page (sample)",
  robots: { index: false, follow: false },
};

// The open portal on sample data (SPEC §12, §6.14), so the populated page can be seen without a
// sent invitation or an AI key. A fictional applicant (a port logistics planner in Kochi, new to
// this sample) and a fictional recommender, at the fictional Northfield and Halvorsen. Off unless
// prototypes are on (PROTOTYPES_ENABLED=1, never in production); its saves fail quietly.

const VIEW: PortalView = {
  applicant: { name: "Anjali Varghese", firstName: "Anjali" },
  recommender: { name: "Dana Whitlock", firstName: "Dana" },
  expiresAt: "2027-01-20T00:00:00.000Z",
  groups: [
    {
      key: "g1",
      schools: [
        { schoolCycleId: "s1", name: "Northfield", deadline: "2027-01-06", submittedAt: null },
        { schoolCycleId: "s2", name: "Halvorsen", deadline: "2027-01-13", submittedAt: null },
      ],
      mode: "assist",
      policyNote: null,
      sections: [
        {
          kind: "note",
          heading: "A note from Anjali",
          text: "Dana, thank you for doing this. You saw the monsoon season of 2024 closer than anyone: the week the berth schedule fell apart and we rebuilt it by hand. If you can, write about that week and about how I trained the night planners afterwards.",
        },
        { kind: "reminder", heading: "How to use this brief", text: OWN_WORDS_REMINDER },
        {
          kind: "school",
          heading: "Northfield",
          deadline: "2027-01-06",
          howToSubmit: "Northfield emails you a link to its own form once Anjali submits.",
          packNotes: ["Two questions, about 500 words each."],
          questions: [
            {
              id: "q1",
              text: "How does the candidate's performance compare to other well-qualified individuals in similar roles?",
              limit: "About 500 words",
              points: [
                {
                  point: "Rebuilt the berth schedule by hand during the July 2024 system outage",
                  evidence: "11 vessels re-sequenced in 36 hours, no demurrage charged",
                  trait: "Ownership",
                  story: null,
                  cites: [],
                },
                {
                  point: "Trained the four night planners on the new sequence rules",
                  evidence: "Night re-plans fell from 9 a week to 2 by October",
                  trait: "Teaches others",
                  story: null,
                  cites: [],
                },
              ],
            },
            {
              id: "q2",
              text: "Describe the most important piece of constructive feedback you have given the candidate.",
              limit: "About 500 words",
              points: [
                {
                  point: "Asked her to bring the crane crews into planning, not only tell them",
                  evidence: "She started a 10-minute stand-up at shift change",
                  trait: "Listens and changes",
                  story: null,
                  cites: [],
                },
              ],
            },
          ],
        },
        {
          kind: "facts",
          heading: "Facts you can use",
          items: [
            { text: "Port logistics planner, Kochi, since March 2022", cites: [] },
            { text: "Leads a night planning desk of four", cites: [] },
          ],
        },
      ],
      questions: [
        {
          id: "q1",
          text: "How does the candidate's performance compare to other well-qualified individuals in similar roles?",
          limit: { kind: "words", value: 500 },
        },
      ],
    },
  ],
  notes: [
    {
      id: "n1",
      text: "The outage week: she slept at the terminal two nights. Ask about the tug captain call.",
      at: "2026-11-15T09:20:00.000Z",
      spoken: null,
    },
  ],
  letters: {},
  voiceSecondsLeft: 600,
  assistsLeft: 5,
  preferCoach: false,
};

export default function Page() {
  if (!prototypesEnabled()) notFound();
  return <PortalPage view={VIEW} />;
}
