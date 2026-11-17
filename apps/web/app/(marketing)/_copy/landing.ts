// The landing page's scenes below the hero (SPEC §4), in page order. Sentence case, no "!", honest
// per spec §14.5: nothing here promises an outcome, a number of users or a school's endorsement.
// Prices are never typed here: scenes read them from ../_data/pricing.ts.
//
// Deferrals (Manu, 2 Nov 2026): interview practice is "Coming soon" and is never listed as part of
// a kit; expert mock interviews and the tracker aren't sold, so neither is mentioned.
//
// Every applicant is fictional and so is Northfield. Three people appear below the hero: the
// hospital systems analyst (../_data/sample.ts) in "How it works", a site engineer on a metro line
// in "School by school" (new in Phase 3, written here), and the fintech product manager
// (../_data/sample-words.ts) in the paper scene.

/** Scene 2: the label beside the sixteen names. The count comes from the list itself. */
export const STRIP_COPY = {
  schools: "schools",
  verified: "verified for 2026–27",
} as const;

/**
 * Scene 3: how it works, in four steps. "Twenty minutes" is the fast path and the paragraph says
 * so. The windows' words (a Studio question, a positioning, a draft, a revision) are the
 * analyst's sample material.
 */
export const HOW_COPY = {
  eyebrow: "How it works",
  headingLines: ["Twenty minutes", "to a first draft."],
  paragraph:
    "That’s the fast path, if you upload a résumé and talk for twenty minutes. Most people come back for more, because the more you say, the more there is to choose from.",
  link: "See how it works in full",
  stepsLabel: "Four steps",
  free: "Free",
  pack: "With a school pack",
  steps: [
    {
      verb: "Tell",
      title: "Say it once, out loud.",
      body: "Story Studio asks one question at a time and listens. Talk for twenty minutes or two hours, or type. Nothing is asked twice.",
      paid: false,
      caption:
        "Story Studio: a question on screen, the applicant’s answer arriving as a transcript, and the record button on a live line.",
    },
    {
      verb: "Position",
      title: "See how each school will read you.",
      body: "A Profile Read, then a strategy for every school on your list: what to lead with, and which story goes where. Every number is sourced and dated.",
      paid: false,
      caption:
        "The positioning for one school: three lines on what to lead with, and which story feeds which part of the application.",
    },
    {
      verb: "Draft",
      title: "Every essay, drafted from your own words.",
      body: "Unlock a school and its essays, short answers and form are drafted from your stories. Each draft says why it is built that way, and marks the sentences that are yours.",
      paid: true,
      caption:
        "An essay on paper: a note in the margin on why it opens this way, the applicant’s own sentences marked, and the word count.",
    },
    {
      verb: "Refine",
      title: "Change anything. See exactly what changed.",
      body: "Ask for a cut, another story or a new angle. Every revision comes back as a diff you keep or undo, and anything you haven’t told us becomes a question, never a guess.",
      paid: true,
      caption:
        "A revision: the request, the sentence that changed with the removed words struck through, and the count going from 199 to 187.",
    },
  ],
  studio: {
    chapters: ["Early life", "Work", "Turning points"],
    current: "Work",
    modes: ["Speak", "Write"],
    questionLead: "You led the go-live with no manager in place.",
    questionAsk: "What was the moment you were most worried it would fail?",
    listening: "Listening · hold space",
  },
  position: {
    header: "Northfield · positioning",
    lines: [
      "Lead with ownership: the night nobody asked you to stay.",
      "Your goal grows out of that night: teams that never need the 2 a.m. call.",
      "Don’t open on your job title. Open on the ward.",
    ],
    read: [
      { label: "Lands", text: "Ownership under pressure, shown with a 2 a.m. fix." },
      { label: "A reader may doubt", text: "Why an MBA now, and not a promotion?" },
    ],
    mapHeading: "Which story goes where",
    map: [
      { what: "Essay 1", story: "The night-shift fix" },
      { what: "Goals", story: "Teams that never need the call" },
      { what: "Application form", story: "From your Fact Sheet" },
      { what: "Recommender briefs", story: "Two, one for each" },
    ],
  },
  draft: {
    header: "Northfield · Essay 1",
    status: "First draft",
    title: "Essay 1",
    note: "Opens on your own sentence. The prompt asks about responsibility, so the night comes first.",
    count: "199 / 200",
    words: "words",
  },
  refine: {
    header: "Essay 1 · revision",
    asked: "You asked",
    request: "“Cut twelve words from paragraph two. I need room for the ending.”",
    before: "I was a systems analyst with no authority over the vendor or the nurses.",
    said: "What I did have was a phone list and a pot of terrible coffee.",
    kept1: "I called the vendor’s engineer",
    cut1: ", then woke",
    added: " and",
    kept2: " the lab supervisor",
    cut2: ", and kept them both on one line until we found it",
    countFrom: "199",
    countTo: "187 / 200",
    context:
      "It was 2 a.m. and the feed from the lab system was dropping every fourth message. Nobody on the ward could see it yet, but I could.",
    change: "1 change · paragraph 2",
    keep: "Keep",
    undo: "Undo",
  },
  note: "A sample applicant · fictional, as is Northfield",
} as const;

/**
 * Scene 4: one story, three schools. The applicant is a new fictional person. Each school's
 * "asks" line paraphrases an essay prompt that school publishes for 2026–27 (knowledge/schools);
 * nothing here says a school endorses AdmitStories. Each sheet marks a different one of her three
 * sentences, word for word.
 */
export const SCHOOLS_COPY = {
  eyebrow: "School by school",
  headingLines: ["One story.", "Three schools."],
  paragraph:
    "No two schools ask the same question, so no two drafts open the same way. AdmitStories reads each school’s prompts and builds each essay around the part of your story that answers them.",
  spokenLabel: "Spoken once · site engineer, metro line",
  spoken: [
    "I stopped the pour at eleven that night, with forty people and nine trucks waiting.",
    "The foreman had signed off on that mix, so I asked him to walk the site with me before I told anyone else.",
    "The next morning I taught the two junior engineers to run the test themselves.",
  ],
  draftLabel: "First draft",
  schools: [
    {
      name: "Wharton",
      essay: "The community essay",
      asks: "Asks how you’ll add value to the community. So the draft opens the morning after, with what she taught.",
      note: "Starts with what you gave the team.",
      before: "",
      said: "The next morning I taught the two junior engineers to run the test themselves.",
      after:
        "Within a month, anyone on the night shift could stop the line. That is what I would bring to a learning team: the habit of handing the test to the next person.",
    },
    {
      name: "Tuck",
      essay: "The supporting-another essay",
      asks: "Asks about a time supporting someone was not easy. So the draft is about the foreman, not the concrete.",
      note: "The hard part is a person, so it opens there.",
      before: "Stopping the pour was the easy decision.",
      said: "The foreman had signed off on that mix, so I asked him to walk the site with me before I told anyone else.",
      after: "It cost us an hour we did not have, and it was the hour that mattered.",
    },
    {
      name: "HEC Paris",
      essay: "The leadership and ethics essay",
      asks: "Asks for a situation where leadership and ethics met. So the draft opens on the decision, and what it cost.",
      note: "Opens on the decision. The cost comes second.",
      before: "",
      said: "I stopped the pour at eleven that night, with forty people and nine trucks waiting.",
      after:
        "The delay would be charged to my name. The test said the mix was wrong, and the schedule said pour.",
    },
  ],
  note: "A sample applicant, fictional · each school’s prompt as it publishes it for 2026–27",
} as const;

/**
 * Scene 5: the paper scene. The essay is the product manager's (../_data/sample-words.ts); the
 * notes are the draft's reasoning for paragraphs one, two and four.
 */
export const ESSAY_COPY = {
  eyebrow: "On paper",
  headingLines: ["Essays that show", "their thinking."],
  paragraph:
    "Every draft comes with its reasons in the margin, and every sentence knows where it came from. You can see which words are yours before you change one.",
  sheetLabel: "A sample essay",
  sheetHeader: "Essay 1 · Northfield",
  prompt: "What matters most to you, and why?",
  /** Keyed by paragraph id. */
  notes: {
    p1: "Opens on the number you said out loud. It is the most specific thing in the story.",
    p2: "The week of calls stays in your words. Nothing is added to make it sound bigger.",
    p4: "The prompt asks what matters most. This is the only paragraph that says it outright.",
  },
  toggle: "Show which words are yours",
  legendLabel: "Whose words",
  legend: [
    { kind: "verbatim", label: "Yours, word for word" },
    { kind: "adapted", label: "Yours, lightly edited" },
    { kind: "composed", label: "Written to join them" },
  ],
  sourceIdle: "Point at a marked sentence to see when it was said.",
  sourceIdleTouch: "Tap a marked sentence to see when it was said.",
  yours: "Your line, typed on this page a moment ago",
  fictional: "A sample applicant · fictional, as is Northfield",
} as const;

/**
 * Scene 7: Connect, which is NOT live (Manu, 17 Nov 2026; lib/connect/coming-soon.ts). It says
 * what Connect will be and never that a pack includes it today. The faces are illustrative
 * (lib/connect/illustrative.ts) and labelled as such.
 */
export const CONNECT_COPY = {
  eyebrow: "Connect · coming soon",
  headingLines: ["Talk to people", "who’ve walked your path."],
  paragraph:
    "We’re building a short list of people for each school you choose: alumni and students who do the work you do now, or the work you want next. You’ll write to them from here. Connect isn’t open yet.",
  pointsLabel: "Who you’ll be matched with",
  points: [
    { figure: "Same school", line: "Alumni and students of the schools you choose" },
    { figure: "Same work", line: "People who do the job you do now" },
    { figure: "Your next", line: "People who made the move you want to make" },
  ],
  illustrative: "Illustrative portraits · roles only",
} as const;

/** Scene 8: what it won't do. The lines themselves are INTEGRITY_LINES in ./shared.ts. */
export const WONT_DO_COPY = {
  eyebrow: "Trust",
  headingLines: ["What it", "won’t do."],
  allPolicies: "See all schools’ AI policies",
} as const;

/**
 * Scene 9: interview practice, which is not live. The promise is INTERVIEW_COMING_SOON_LINE in
 * ./shared.ts, verbatim. The still is a preview and is labelled as one; its answer is the
 * analyst's, fictional.
 */
export const INTERVIEW_COPY = {
  headingLines: ["Interview practice,", "from the same story."],
  preview: "Preview · not available yet",
  from: "Follow-up · from your essay",
  time: "0:42",
  of: "of 2:00",
  answer: [
    "I’d set up the handover before the go-live, not during it.",
    "The fault was a setting, but the gap was that nobody owned the night.",
    "So the first thing I’d change is the rota, not the software.",
    "And I’d write the runbook before we needed it.",
  ],
  caption:
    "A preview of interview practice, which is not available yet: a follow-up question from the essay, a two-minute timer at 42 seconds, and the answer as a transcript.",
} as const;

/** Scene 10: pricing. Names, prices and lists come from ../_data/pricing.ts. */
export const PRICING_COPY = {
  waysLabel: "Ways to start",
  seeKit: "See what’s in a kit",
  freeListLabel: "Included free",
  kitListLabel: "In every school kit",
  insteadOf: "instead of ",
} as const;

/** Scene 12: the final call. The accent falls on "told well,". */
export const FINAL_COPY = {
  before: "Your story,",
  accent: "told well,",
  after: "for each school.",
} as const;
