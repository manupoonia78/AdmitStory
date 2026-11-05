// The landing page's questions (direction §4.9), verbatim. Each has a slug id: it is the
// <details> anchor and the faq_open analytics property (never the question text).
//
// "Which schools are covered?" is answered from the database (packSchools), so its answer is a
// function of the verified packs. Interview practice is "Coming soon" (plan OVERRIDE), so it gets
// its own honest question rather than a place in the kit.

import { INTERVIEW_COMING_SOON_LINE } from "./shared";

export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
}

export const FAQ_HEADING = "Questions.";

const BEFORE_SCHOOLS: readonly FaqEntry[] = [
  {
    id: "writes-essays",
    question: "Does AdmitStories write my essays?",
    answer:
      "It depends on the school. Where AI help is allowed, it drafts from your own words and shows which sentences are yours. Where it isn’t, it coaches: questions, structure and critique, with no written answer. You can always choose the stricter mode.",
  },
  {
    id: "allowed",
    question: "Is that allowed?",
    answer:
      "Schools differ, so AdmitStories follows each one’s published policy and shows it beside every essay with the date we checked. When a school asks you to disclose AI use, it drafts an honest disclosure for you to edit. Following the rules is still your responsibility, and we make it easy.",
  },
  {
    id: "impressive",
    question: "Will it make my story sound impressive?",
    answer:
      "It will make it sound like you on a good day. It never adds achievements, numbers or quotes. When a sentence needs a detail you haven’t given, it asks for it.",
  },
  {
    id: "voice",
    question: "What happens to my voice?",
    answer:
      "Your audio is turned into text and discarded. We don’t keep recordings. Your transcripts and documents are encrypted, never used to train AI models, and deleted within 30 days if you delete your account.",
  },
  {
    id: "chances",
    question: "Can it tell me my chances?",
    answer:
      "No. Nobody can honestly, and we won’t pretend to. The Profile Read tells you what helps, what may raise doubts and what to do about it.",
  },
];

const AFTER_SCHOOLS: readonly FaqEntry[] = [
  {
    id: "short-on-time",
    question: "I’m short on time.",
    answer:
      "Upload your résumé and choose the express session, about 20 minutes. It only asks about what the résumé doesn’t say.",
  },
  {
    id: "english",
    question: "English isn’t my first language.",
    answer:
      "Speak the way you speak. Story Studio understands many languages and accents. Your stories are kept in your own words, and drafts are written in the language the school asks for.",
  },
  {
    id: "recommenders",
    question: "What about my recommenders?",
    answer:
      "You get a brief for each one: the stories they can speak to and what each school asks of them. They can use a private page to record their own notes. They write their own letters; we don’t.",
  },
  {
    id: "interviews",
    question: "Can I practise for interviews?",
    answer: INTERVIEW_COMING_SOON_LINE,
  },
  {
    id: "packs",
    question: "Is it cheaper for several schools?",
    answer:
      "Yes. One school is $100. Five are $349 and ten are $699, with every essay drafted for each, where most services charge about $349 for guidelines alone. A pack unlocks your first school straight away and keeps the rest as credits for whenever you’re ready.",
  },
];

export const SCHOOLS_QUESTION = "Which schools are covered?";
export const SCHOOLS_VOTE_LINE =
  "Is yours missing? Add it in School Strategy and vote for it. We cover schools by demand.";
export const SCHOOLS_NONE =
  "School kits open with the first verified packs. Story Studio and the Profile Read are free now.";

/** "A, B and C" */
export function joinSchoolNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

export function schoolsAnswer(names: readonly string[]): string {
  if (names.length === 0) return SCHOOLS_NONE;
  const count = names.length === 1 ? "1 school" : `${names.length} schools`;
  return `Kits are ready for ${count}: ${joinSchoolNames(names)}. ${SCHOOLS_VOTE_LINE}`;
}

/** Every question in order, with the schools answer built from the verified packs. */
export function faqEntries(schoolNames: readonly string[]): FaqEntry[] {
  return [
    ...BEFORE_SCHOOLS,
    { id: "schools", question: SCHOOLS_QUESTION, answer: schoolsAnswer(schoolNames) },
    ...AFTER_SCHOOLS,
  ];
}
