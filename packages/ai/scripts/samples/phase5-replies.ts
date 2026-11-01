/**
 * Hand-authored replies for the Phase 5 samples (phase5.ts), written from the fictional
 * engineer-to-product applicant's compact dossier and the fictional Halvorsen pack. Every fact,
 * number and name is in that dossier or in his résumé; nothing is invented (spec §0, §8.7).
 *
 * Two samples include a repair turn, so the recordings exercise §8.4 step 6:
 * - the first Form Advisor reply names a "combine with" item without its partner;
 * - the first résumé reply adds a number the applicant never gave ("30%").
 */
import type { FormAdvice, ResumeReview } from "@admitstory/shared/kit";

const ACTIVITY_CLASS = {
  id: "i1",
  candidate: "Saturday coding class",
  cites: ["F08", "S03"],
  recommendation: "lead_with",
  combine_with: null,
  move_to: null,
  reason:
    "It proves you build things that last without you, and no essay uses it, so this field is its only home.",
  entry: {
    text: "Run a Saturday coding class for 12 government-school students in Bengaluru (since 2023). Rewrote the curriculum and recruited three colleagues; the class has run without me for six months.",
    sources: ["F08", "S03", "L003"],
  },
  stronger: ["Add the hours you give each month, as the form asks"],
  needs: [{ question: "How many hours a month do you give the class now?", approx_words: 3 }],
} satisfies FormAdvice["sections"][number]["items"][number];

const ACTIVITY_GO_LIVE = {
  id: "i2",
  candidate: "The night-shift fix",
  cites: ["S01"],
  recommendation: "move_to_resume",
  combine_with: null,
  move_to: null,
  reason:
    "It's work, not community involvement; the résumé carries its result in one line, and the interview can tell the story.",
  entry: null,
  stronger: [],
  needs: [],
} satisfies FormAdvice["sections"][number]["items"][number];

const ACTIVITY_REWRITE = {
  id: "i3",
  candidate: "The rewrite you talked them out of",
  cites: ["S02"],
  recommendation: "move_to_essay",
  combine_with: null,
  move_to: "shaped",
  reason:
    "It's the main story of Essay 2; repeating it here would spend a field on something the reader already has.",
  entry: null,
  stronger: [],
  needs: [],
} satisfies FormAdvice["sections"][number]["items"][number];

const HONOR_PROMOTION = {
  id: "i1",
  candidate: "Early promotion",
  cites: ["F07", "F02"],
  recommendation: "lead_with",
  combine_with: null,
  move_to: null,
  reason:
    "A promotion two years ahead of the usual track is someone else's judgement of you, which is what this field is for.",
  entry: {
    text: "Promoted to Senior Software Engineer at Meridian Health Systems in April 2024, two years ahead of the usual track.",
    sources: ["F07", "F01"],
  },
  stronger: [],
  needs: [],
} satisfies FormAdvice["sections"][number]["items"][number];

const HONOR_RUNBOOK_RIGHT = {
  id: "i2",
  candidate: "Go-live runbook adopted company-wide",
  cites: ["S01"],
  recommendation: "include",
  combine_with: null,
  move_to: null,
  reason:
    "Not a formal award, but a recognised result: your company adopted your work as its template. Keep it only if the form accepts recognitions.",
  entry: {
    text: "Wrote the go-live runbook that became Meridian Health Systems' template.",
    sources: ["S01", "F01"],
  },
  stronger: ["Say how many go-lives have used it since, if you know"],
  needs: [],
} satisfies FormAdvice["sections"][number]["items"][number];

const HONOR_GMAT = {
  id: "i3",
  candidate: "GMAT 705",
  cites: ["F06"],
  recommendation: "leave_out",
  combine_with: null,
  move_to: null,
  reason: "Your score has its own field; listing it as an honour reads as padding.",
  entry: null,
  stronger: [],
  needs: [],
} satisfies FormAdvice["sections"][number]["items"][number];

const COULD_STILL_DO: FormAdvice["could_still_do"] = [
  {
    text: "Write down the class's monthly hours and what the four bootcamp students went on to do",
    why: "It gives the community entry the time commitment the form asks for, and a result you can state.",
    time: "An evening",
  },
];

const VERIFY: FormAdvice["verify"] = [
  {
    text: "12 students, three colleagues, six months without you",
    reason: "The numbers in your community entry: confirm they're still current.",
  },
];

/** The Form Advisor in draft mode: the first reply breaks a rule, the repair fixes it. */
export const FORMS_ADVISE_REPLIES: readonly [FormAdvice, FormAdvice] = [
  {
    sections: [
      { section_key: "activities", items: [ACTIVITY_CLASS, ACTIVITY_GO_LIVE, ACTIVITY_REWRITE] },
      {
        section_key: "honors",
        items: [
          HONOR_PROMOTION,
          { ...HONOR_RUNBOOK_RIGHT, recommendation: "combine_with" },
          HONOR_GMAT,
        ],
      },
    ],
    could_still_do: COULD_STILL_DO,
    verify: VERIFY,
  },
  {
    sections: [
      { section_key: "activities", items: [ACTIVITY_CLASS, ACTIVITY_GO_LIVE, ACTIVITY_REWRITE] },
      { section_key: "honors", items: [HONOR_PROMOTION, HONOR_RUNBOOK_RIGHT, HONOR_GMAT] },
    ],
    could_still_do: COULD_STILL_DO,
    verify: VERIFY,
  },
];

/** Coach mode: the same advice with no entries; the applicant writes their own. */
export const FORMS_ADVISE_COACH_REPLY: FormAdvice = {
  sections: [
    {
      section_key: "activities",
      items: [
        {
          ...ACTIVITY_CLASS,
          entry: null,
          stronger: [
            "Open with the role and the students, then what changed",
            "Add the hours you give each month, as the form asks",
          ],
        },
        ACTIVITY_GO_LIVE,
        ACTIVITY_REWRITE,
      ],
    },
    {
      section_key: "honors",
      items: [
        { ...HONOR_PROMOTION, entry: null, stronger: ["Name the title and the month"] },
        { ...HONOR_RUNBOOK_RIGHT, entry: null },
        HONOR_GMAT,
      ],
    },
  ],
  could_still_do: COULD_STILL_DO,
  verify: [],
};

/* Résumé ------------------------------------------------------------------------------------- */

const B2_RIGHT = {
  id: "b2",
  original: "Successfully handled the lab-feed go-live at a 900-bed hospital",
  verdict: "activity",
  issues: ["weak_verb", "lead_with_impact"],
  feedback: '"Successfully handled" hides what you did: say the fix, then what it saved.',
  rewrite: {
    text: "Rewrote message retry logic overnight to save a 900-bed hospital's go-live; no dropped lab messages in twenty months, and the runbook became Meridian's template",
    sources: ["S01"],
    needs: [],
  },
} satisfies ResumeReview["sections"][number]["roles"][number]["bullets"][number];

function review(b2: ResumeReview["sections"][number]["roles"][number]["bullets"][number]) {
  return {
    header: {
      name: "Engineer Product",
      lines: ["Bengaluru, India | engineer.product@example.test"],
    },
    sections: [
      {
        id: "s1",
        heading: "EXPERIENCE",
        kind: "experience",
        roles: [
          {
            id: "r1",
            organisation: "Meridian Health Systems",
            title: "Senior Software Engineer",
            dates: "Apr 2024 - Present",
            location: "Bengaluru",
            bullets: [
              {
                id: "b1",
                original:
                  "Responsible for the scheduling module used by hospitals in India and the US",
                verdict: "activity",
                issues: ["activity_not_achievement", "so_what"],
                feedback: "This says what you owned, not what changed because of you.",
                rewrite: {
                  text: "Cut scheduling page loads from 4.2 seconds to 900 milliseconds by fixing three slow queries, taking a US customer live a month early and shelving a six-month rewrite",
                  sources: ["S02"],
                  needs: [],
                },
              },
              b2,
              {
                id: "b3",
                original: "Worked with the product team on the nurse scheduling screen",
                verdict: "activity",
                issues: ["activity_not_achievement", "lead_with_impact"],
                feedback: "Lead with what changed for the nurses, then how you got it changed.",
                rewrite: {
                  text: "Shadowed four nurses through a full shift and persuaded the product team to reorder the scheduling screen, ending a paper workaround on [?1] wards",
                  sources: ["S06"],
                  needs: [
                    { question: "How many wards used the paper workaround?", approx_words: 2 },
                  ],
                },
              },
              {
                id: "b4",
                original: "Coordinated 4 engineers across two releases",
                verdict: "activity",
                issues: ["so_what"],
                feedback: "Say what the two releases changed for the hospitals.",
                rewrite: {
                  text: "Coordinated 4 engineers to ship two releases of the scheduling platform that [?1]",
                  sources: ["F03"],
                  needs: [
                    {
                      question: "What did those two releases change for the hospitals?",
                      approx_words: 10,
                    },
                  ],
                },
              },
            ],
          },
          {
            id: "r2",
            organisation: "Meridian Health Systems",
            title: "Software Engineer",
            dates: "Jul 2020 - Mar 2024",
            location: null,
            bullets: [
              {
                id: "b5",
                original: "Developed backend services in Java and Kafka for HL7 interfaces",
                verdict: "activity",
                issues: ["jargon", "so_what"],
                feedback:
                  "A reader outside health tech won't know HL7 or Kafka: say what the services do.",
                rewrite: {
                  text: "Built the backend services that move lab and admission data between hospital systems",
                  sources: [],
                  needs: [],
                },
              },
              {
                id: "b6",
                original:
                  "Restored about 1,100 appointment records within 2 hours after a failed migration and added a schema check that has blocked 4 migrations since",
                verdict: "achievement",
                issues: ["too_long", "lead_with_impact"],
                feedback:
                  "Strong and honest; lead with the safeguard, which is the lasting result.",
                rewrite: {
                  text: "Added a schema check that has blocked 4 risky migrations, after restoring about 1,100 appointment records within 2 hours",
                  sources: ["S04"],
                  needs: [],
                },
              },
            ],
          },
        ],
        lines: [],
      },
      {
        id: "s2",
        heading: "EDUCATION",
        kind: "education",
        roles: [
          {
            id: "r3",
            organisation: "Vellore Institute of Technology",
            title: "B.Tech in Computer Science",
            dates: "2020",
            location: null,
            bullets: [],
          },
        ],
        lines: ["CGPA 8.4/10"],
      },
      {
        id: "s3",
        heading: "ADDITIONAL",
        kind: "additional",
        roles: [],
        lines: [
          "Languages: English, Hindi, Tamil",
          "Volunteer teacher, Saturday coding class for government-school students, 2023 - Present",
          "Interests: long-distance cycling",
        ],
      },
    ],
    section_order: {
      order: ["s1", "s2", "s3"],
      reason:
        "Experience first: it carries your strongest evidence, and a reader decides in the first few lines.",
    },
    priorities: [
      "Turn duties into results: four of your six bullets say what you were responsible for, not what changed.",
      "Translate the health-tech terms (HL7, Kafka) for a business reader.",
      "Say what the coding class achieved, not only that you teach it.",
    ],
  } satisfies ResumeReview;
}

/** The first reply invents a number; the repair turns it back into the applicant's own facts. */
export const RESUME_REVIEW_REPLIES: readonly [ResumeReview, ResumeReview] = [
  review({
    ...B2_RIGHT,
    rewrite: {
      ...B2_RIGHT.rewrite,
      text: "Rewrote message retry logic overnight to save a 900-bed hospital's go-live, cutting incident tickets by 30%",
    },
  }),
  review(B2_RIGHT),
];
