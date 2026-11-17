// Connect is closed (Manu, 2026-11-17). LinkedIn's API won't let us search members, send
// connection requests or read replies, so Connect waits until we pick how its people join. Until
// then nobody opens it: not applicants with a pack, not guides. /connect shows the coming-soon
// page, and every /api/connect route answers 404 `coming_soon` (lib/connect/server.ts).
//
// To reopen, set CONNECT_OPEN to true. The directory, the conversations and the locked page are
// all still here. Everything that mentions Connect uses these words; grep for COMING_SOON.

import { COMING_SOON } from "@/lib/deferred/coming-soon";

/** Declared as boolean so the checks that read it aren't flagged as always-false. */
export const CONNECT_OPEN: boolean = false;

export const CONNECT_COMING_SOON = {
  title: "Connect",
  status: COMING_SOON,
  headline: ["Talk to people", "who’ve walked your path."],
  intro:
    "We’re building a short list of people for each school you choose: alumni and students who do the work you do now, or the work you want next. You’ll write to them from here.",
  /** The one line that says what is true today. Used by the API too. */
  line: "Connect isn’t open yet.",
  carry:
    "It will match on your schools, your résumé and your goals, so the work you do now carries over.",
  /** The illustrative match: Northfield is the fictional school of the landing samples. */
  match: {
    label: "How a match will read · illustrative",
    you: {
      eyebrow: "You",
      facets: [
        { name: "Now", value: "Product manager" },
        { name: "Next", value: "Product leadership" },
        { name: "School", value: "Northfield" },
      ],
    },
    people: [
      {
        src: "/people/p03.webp",
        role: "Alum · Northfield ’22",
        line: "Product lead at a fintech",
        shared: "Same school · same work",
      },
      {
        src: "/people/p02.webp",
        role: "Student · Northfield ’27",
        line: "Was a PM; recruiting for product",
        shared: "Same school · where you are",
      },
      {
        src: "/people/p05.webp",
        role: "Alum · Northfield ’19",
        line: "Moved from consulting into product",
        shared: "Same school · where you’re going",
      },
    ],
  },
  peopleHeading: "The kinds of people you’ll meet",
  parts: [
    {
      name: "Matched on your path",
      line: "Your schools, the work you do now and the work you want next, read from your résumé and goals.",
    },
    {
      name: "Why this person",
      line: "Each profile says what you share with them, and what they can speak to.",
    },
    {
      name: "Write to them here",
      line: "Send a note from AdmitStories and keep the conversation in one place.",
    },
  ],
  back: "Back to your schools",
} as const;
