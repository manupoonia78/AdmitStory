// A second sample applicant, for "See which words are yours" (Manu, 5 Nov 2026: the landing page
// shows more than one story, so the method reads as yours and not as one demo). A fictional
// fintech product manager writing for "Northfield", a fictional school; the night-shift applicant
// (./sample.ts) stays the one followed through the page. FICTIONAL_NOTE goes with it too.
//
// Server-safe: plain data and types only. The your-words toy (a client island) imports it.

import type { DraftParagraph, SourceExcerpts } from "@admitstory/ui";

export const WORDS_PARAGRAPHS: readonly DraftParagraph[] = [
  {
    id: "p1",
    sentences: [
      {
        text: "The dashboard said forty thousand people had switched the feature on, and I knew most of them never opened it again.",
        kind: "verbatim",
        sources: ["L112"],
      },
      {
        text: "It was my feature, and I had pitched it to the whole company.",
        kind: "composed",
        sources: [],
      },
      {
        text: "Shutting it down meant telling six engineers that eight months of their work would disappear.",
        kind: "adapted",
        sources: ["C21"],
      },
    ],
  },
  {
    id: "p2",
    sentences: [
      {
        text: "I spent a week calling the customers who had stopped using it, one by one.",
        kind: "adapted",
        sources: ["C22"],
      },
      {
        text: "Not one of them was angry. They had simply forgotten it was there.",
        kind: "verbatim",
        sources: ["L115"],
      },
      { text: "That was harder to hear than any complaint.", kind: "composed", sources: [] },
    ],
  },
  {
    id: "p3",
    sentences: [
      {
        text: "So I wrote the memo that ended my own project, and I put my name at the top.",
        kind: "verbatim",
        sources: ["L118"],
      },
      {
        text: "The team moved to the payments rebuild, which shipped in half the time we had planned.",
        kind: "adapted",
        sources: ["C23"],
      },
      {
        text: "Two of the engineers told me later they had been waiting for someone to say it.",
        kind: "composed",
        sources: [],
      },
    ],
  },
  {
    id: "p4",
    sentences: [
      {
        text: "What matters most to me is telling the truth about what is working, most of all when it is mine.",
        kind: "composed",
        sources: [],
      },
      {
        text: "Being wrong early costs a week; staying loyal to a bad idea costs a year.",
        kind: "adapted",
        sources: ["S11"],
      },
      {
        text: "I still have the launch T-shirt, and I wear it to the gym.",
        kind: "verbatim",
        sources: ["L121"],
      },
      {
        text: "At Northfield, I want to learn to build teams that can say that out loud.",
        kind: "composed",
        sources: [],
      },
    ],
  },
];

export const WORDS_SOURCES: SourceExcerpts = {
  L112: {
    label: "Story Studio, session 1, 9 minutes in",
    quote:
      "The dashboard said forty thousand people had switched the feature on, and I knew most of them never opened it again. I knew it before anyone asked.",
  },
  C21: {
    label: "Story Studio, session 1, 11 minutes in",
    quote: "Killing it meant going to six engineers and saying eight months of your work is gone.",
  },
  C22: {
    label: "Story Studio, session 1, 13 minutes in",
    quote: "I just called the people who’d stopped using it. A whole week of calls, one at a time.",
  },
  L115: {
    label: "Story Studio, session 1, 14 minutes in",
    quote: "Not one of them was angry. They had simply forgotten it was there.",
  },
  L118: {
    label: "Story Studio, session 1, 17 minutes in",
    quote: "So I wrote the memo that ended my own project, and I put my name at the top.",
  },
  C23: {
    label: "Story Studio, session 1, 19 minutes in",
    quote:
      "Everyone went over to the payments rebuild, and it shipped in about half the time we’d planned.",
  },
  S11: {
    label: "Your story: The feature I shut down",
    quote: "Being wrong early costs you a week. Being loyal to a bad idea costs you a year.",
  },
  L121: {
    label: "Story Studio, session 2, 6 minutes in",
    quote: "I still have the launch T-shirt. I wear it to the gym.",
  },
};
